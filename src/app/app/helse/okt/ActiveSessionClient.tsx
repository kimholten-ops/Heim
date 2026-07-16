"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { X, Plus, Check, Search, Timer, ChevronLeft, Sparkles, Upload } from "lucide-react";
import { Card, Sheet, StatCard } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/lib/exercises";
import { formatDuration, tonnage } from "@/lib/exercises";

type SetRow = { id?: string; set_number: number; weight_kg: number | null; reps: number | null; completed: boolean; rpe: number | null };
type Target = { sets: number; reps: string | null };
type SessionType = "styrke" | "cardio" | "yoga" | "mobilitet" | "annet";

const REST_OPTIONS = [60, 90, 120];
const TYPE_LABELS: Record<SessionType, string> = { styrke: "Styrke", cardio: "Cardio", yoga: "Yoga", mobilitet: "Mobilitet", annet: "Annet" };

export default function ActiveSessionClient({ memberId, aiCoachEnabled, stravaEnabled }: { memberId: string; aiCoachEnabled: boolean; stravaEnabled: boolean }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [loading, setLoading] = useState(true);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>("styrke");
  const [distanceInput, setDistanceInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [exerciseIds, setExerciseIds] = useState<string[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [setsByExercise, setSetsByExercise] = useState<Record<string, SetRow[]>>({});
  const [saving, setSaving] = useState<string | null>(null); // "exerciseId:setIndex" while saving

  const load = useCallback(async () => {
    if (!sessionId) { router.replace("/app/helse"); return; }
    const { data: session } = await supabase.from("workout_sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!session) { router.replace("/app/helse"); return; }
    setStartedAt(session.started_at);
    setSessionType(session.type);
    setDistanceInput(session.distance_km != null ? String(session.distance_km) : "");
    setNotesInput(session.notes ?? "");

    if (session.type !== "styrke") { setLoading(false); return; }

    let orderedIds: string[] = [];
    const targetMap: Record<string, Target> = {};
    if (session.template_id) {
      const { data: tmplEx } = await supabase.from("workout_template_exercises")
        .select("*").eq("template_id", session.template_id).order("position");
      for (const te of tmplEx ?? []) {
        orderedIds.push(te.exercise_id);
        targetMap[te.exercise_id] = { sets: te.target_sets ?? 3, reps: te.target_reps };
      }
    }

    const { data: existingSets } = await supabase.from("workout_sets")
      .select("*").eq("session_id", sessionId).order("set_number");
    for (const s of existingSets ?? []) {
      if (!orderedIds.includes(s.exercise_id)) orderedIds.push(s.exercise_id);
    }

    if (orderedIds.length) {
      const { data: ex } = await supabase.from("exercises").select("*").in("id", orderedIds);
      setExerciseMap((prev) => ({ ...prev, ...Object.fromEntries((ex ?? []).map((e) => [e.id, e])) }));
    }

    // Forhåndsutfylling: hent siste ØKT (ikke denne) som inneholder hver
    // øvelse, og bruk dens sett som utgangspunkt for kg/reps.
    const needPrefill = orderedIds.filter((id) => !(existingSets ?? []).some((s) => s.exercise_id === id));
    const prefillByExercise: Record<string, { weight_kg: number | null; reps: number | null }[]> = {};
    if (needPrefill.length) {
      const { data: prevRaw } = await supabase
        .from("workout_sets")
        .select("exercise_id, set_number, weight_kg, reps, session_id, workout_sessions!inner(member_id, started_at)")
        .in("exercise_id", needPrefill)
        .eq("workout_sessions.member_id", memberId)
        .neq("session_id", sessionId)
        .order("set_number");
      type PrevSet = { exercise_id: string; set_number: number; weight_kg: number | null; reps: number | null; session_id: string; workout_sessions: { started_at: string } };
      const prev = (prevRaw ?? []) as unknown as PrevSet[];
      const latestSessionByExercise: Record<string, { sessionId: string; startedAt: string }> = {};
      for (const row of prev) {
        const cur = latestSessionByExercise[row.exercise_id];
        if (!cur || row.workout_sessions.started_at > cur.startedAt) {
          latestSessionByExercise[row.exercise_id] = { sessionId: row.session_id, startedAt: row.workout_sessions.started_at };
        }
      }
      for (const id of needPrefill) {
        const latest = latestSessionByExercise[id];
        if (!latest) continue;
        prefillByExercise[id] = prev
          .filter((r) => r.exercise_id === id && r.session_id === latest.sessionId)
          .sort((a, b) => a.set_number - b.set_number)
          .map((r) => ({ weight_kg: r.weight_kg, reps: r.reps }));
      }
    }

    const rows: Record<string, SetRow[]> = {};
    for (const id of orderedIds) {
      const dbSets = (existingSets ?? []).filter((s) => s.exercise_id === id);
      if (dbSets.length > 0) {
        rows[id] = dbSets.map((s) => ({ id: s.id, set_number: s.set_number, weight_kg: s.weight_kg, reps: s.reps, completed: s.completed, rpe: s.rpe }));
      } else {
        const targetCount = targetMap[id]?.sets ?? 3;
        const prefill = prefillByExercise[id] ?? [];
        rows[id] = Array.from({ length: targetCount }, (_, i) => ({
          set_number: i + 1,
          weight_kg: prefill[i]?.weight_kg ?? null,
          reps: prefill[i]?.reps ?? null,
          completed: false,
          rpe: null,
        }));
      }
    }

    setExerciseIds(orderedIds);
    setTargets(targetMap);
    setSetsByExercise(rows);
    setLoading(false);
  }, [sessionId, memberId, supabase, router]);

  useEffect(() => { load(); }, [load]);

  function updateSetField(exerciseId: string, index: number, patch: Partial<SetRow>) {
    setSetsByExercise((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addSetRow(exerciseId: string) {
    setSetsByExercise((prev) => {
      const rows = prev[exerciseId] ?? [];
      const last = rows[rows.length - 1];
      return {
        ...prev,
        [exerciseId]: [...rows, {
          set_number: rows.length + 1,
          weight_kg: last?.weight_kg ?? null, reps: last?.reps ?? null, completed: false, rpe: null,
        }],
      };
    });
  }

  async function toggleComplete(exerciseId: string, index: number) {
    if (!sessionId) return;
    const row = setsByExercise[exerciseId][index];
    const nextCompleted = !row.completed;
    setSaving(`${exerciseId}:${index}`);
    if (row.id) {
      await supabase.from("workout_sets").update({
        completed: nextCompleted, weight_kg: row.weight_kg, reps: row.reps, rpe: row.rpe,
      }).eq("id", row.id);
      updateSetField(exerciseId, index, { completed: nextCompleted });
    } else if (nextCompleted) {
      const { data } = await supabase.from("workout_sets").insert({
        session_id: sessionId, exercise_id: exerciseId, set_number: row.set_number,
        weight_kg: row.weight_kg, reps: row.reps, rpe: row.rpe, completed: true,
      }).select().single();
      if (data) updateSetField(exerciseId, index, { id: data.id, completed: true });
      if (restEndAt === null) startRest(90);
    }
    setSaving(null);
  }

  /* ── Hviletimer ── */
  const [restEndAt, setRestEndAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (restEndAt === null) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [restEndAt]);
  function startRest(seconds: number) { setRestEndAt(Date.now() + seconds * 1000); }
  const restRemaining = restEndAt ? Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000)) : 0;
  useEffect(() => {
    if (restEndAt !== null && restRemaining === 0) {
      const t = setTimeout(() => setRestEndAt(null), 800);
      return () => clearTimeout(t);
    }
  }, [restEndAt, restRemaining]);

  /* ── Legg til øvelse ── */
  const [showAdd, setShowAdd] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [addQuery, setAddQuery] = useState("");
  async function openAdd() {
    if (allExercises.length === 0) {
      const { data } = await supabase.from("exercises").select("*");
      setAllExercises((data ?? []) as Exercise[]);
    }
    setAddQuery("");
    setShowAdd(true);
  }
  function addExercise(ex: Exercise) {
    setExerciseMap((prev) => ({ ...prev, [ex.id]: ex }));
    setExerciseIds((prev) => (prev.includes(ex.id) ? prev : [...prev, ex.id]));
    setSetsByExercise((prev) => (prev[ex.id] ? prev : { ...prev, [ex.id]: Array.from({ length: 3 }, (_, i) => ({ set_number: i + 1, weight_kg: null, reps: null, completed: false, rpe: null })) }));
    setShowAdd(false);
  }
  const filteredAdd = allExercises.filter((e) => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return true;
    return e.name_no.toLowerCase().includes(q) || e.name_en.toLowerCase().includes(q);
  }).slice(0, 30);

  /* ── Avslutt økt ── */
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<{ duration: string; sets: number | null; tonnage: number | null; distance: number | null } | null>(null);
  const [coachText, setCoachText] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [stravaExporting, setStravaExporting] = useState(false);
  const [stravaUrl, setStravaUrl] = useState<string | null>(null);
  const [stravaError, setStravaError] = useState<string | null>(null);

  async function exportToStrava() {
    if (!sessionId) return;
    setStravaExporting(true); setStravaError(null);
    try {
      const res = await fetch("/api/strava/export", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }),
      });
      const json = await res.json();
      if (res.ok) setStravaUrl(json.url);
      else setStravaError(json.error ?? "Klarte ikke dele til Strava.");
    } catch {
      setStravaError("Klarte ikke dele til Strava.");
    } finally {
      setStravaExporting(false);
    }
  }

  async function finishSession() {
    if (!sessionId || !startedAt) return;
    setFinishing(true);
    const finishedAt = new Date().toISOString();
    const distanceKm = distanceInput.trim() ? Number(distanceInput.replace(",", ".")) : null;
    const patch: { finished_at: string; distance_km?: number | null; notes?: string | null } = { finished_at: finishedAt };
    if (sessionType !== "styrke") {
      patch.distance_km = distanceKm;
      patch.notes = notesInput.trim() || null;
    }
    await supabase.from("workout_sessions").update(patch).eq("id", sessionId);

    if (sessionType === "styrke") {
      const allSets = Object.values(setsByExercise).flat();
      setSummary({ duration: formatDuration(startedAt, finishedAt), sets: allSets.filter((s) => s.completed).length, tonnage: tonnage(allSets), distance: null });
    } else {
      setSummary({ duration: formatDuration(startedAt, finishedAt), sets: null, tonnage: null, distance: distanceKm });
    }
    setFinishing(false);

    // AI-coachen er en bonus etter at treningsdataen uansett er lagret — feil
    // her (avslått/rate-limitert/utilgjengelig) skal aldri blokkere flyten.
    if (aiCoachEnabled) {
      setCoachLoading(true);
      try {
        const res = await fetch("/api/veileder/trening", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }),
        });
        const json = await res.json();
        if (res.ok) setCoachText(json.text ?? null);
      } catch {
        // stille
      } finally {
        setCoachLoading(false);
      }
    }
  }

  if (loading) {
    return <div className="max-w-[420px] mx-auto flex justify-center py-16 text-text-3 text-[14px]">Laster økt…</div>;
  }

  return (
    <div className="max-w-[420px] mx-auto pb-32">
      <div className="px-[18px] pt-[14px] pb-3 flex items-center gap-2">
        <button onClick={() => router.push("/app/helse")} className="text-text-3 hover:text-fg p-1 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[19px] font-[700] text-fg">{sessionType === "styrke" ? "Pågående økt" : TYPE_LABELS[sessionType]}</h1>
      </div>

      {sessionType !== "styrke" && (
        <div className="px-[18px] space-y-3">
          <Card className="p-4 space-y-3">
            <p className="text-[13px] text-text-3">Startet {new Date(startedAt!).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}</p>
            {sessionType === "cardio" && (
              <div>
                <p className="text-[11px] font-[600] text-text-3 mb-1.5 uppercase tracking-wide12">Distanse (valgfritt)</p>
                <input type="number" inputMode="decimal" placeholder="f.eks. 5.2" value={distanceInput}
                  onChange={(e) => setDistanceInput(e.target.value)}
                  className="w-full rounded-[10px] border border-border px-3 py-2 text-[14.5px] outline-none focus:border-accent" />
              </div>
            )}
            <div>
              <p className="text-[11px] font-[600] text-text-3 mb-1.5 uppercase tracking-wide12">Notater (valgfritt)</p>
              <textarea rows={3} placeholder="Hvordan gikk det?" value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="w-full rounded-[10px] border border-border px-3 py-2 text-[14.5px] outline-none focus:border-accent resize-none" />
            </div>
          </Card>
        </div>
      )}

      {/* Hviletimer */}
      {sessionType === "styrke" && (
      <div className="px-[18px] mb-3">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-[13px] px-3 py-2.5">
          <Timer size={15} className={cn(restEndAt !== null ? "text-accent" : "text-text-3")} />
          {restEndAt !== null ? (
            <span className="text-[15px] font-[700] text-accent tabular-nums">{restRemaining}s</span>
          ) : (
            <span className="text-[12.5px] text-text-3">Hviletimer</span>
          )}
          <div className="flex gap-1.5 ml-auto">
            {REST_OPTIONS.map((s) => (
              <button key={s} onClick={() => startRest(s)}
                className="text-[12px] font-[600] text-fg bg-surface-2 rounded-chip px-2.5 py-1 hover:bg-border/50 transition-colors">
                {s}s
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {sessionType === "styrke" && (
      <div className="px-[18px] space-y-3">
        {exerciseIds.map((exId) => {
          const ex = exerciseMap[exId];
          const target = targets[exId];
          const rows = setsByExercise[exId] ?? [];
          return (
            <Card key={exId}>
              <div className="px-4 py-3 border-b border-border">
                <p className="text-[15px] font-[600] text-fg">{ex?.name_no ?? exId}</p>
                {target && <p className="text-[12px] text-text-3 mt-[1px]">{target.sets} × {target.reps ?? "—"}</p>}
              </div>
              <div className="px-4 py-2.5">
                <div className="grid grid-cols-[16px_1fr_1fr_38px_28px] gap-1.5 text-[10.5px] font-[600] text-text-3 uppercase tracking-wide12 mb-1.5">
                  <span>#</span><span>Kg</span><span>Reps</span><span>RPE</span><span />
                </div>
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[16px_1fr_1fr_38px_28px] gap-1.5 items-center py-[3px]">
                    <span className="text-[13px] text-text-3">{row.set_number}</span>
                    <input type="number" inputMode="decimal" value={row.weight_kg ?? ""} placeholder="—"
                      onChange={(e) => updateSetField(exId, i, { weight_kg: e.target.value === "" ? null : Number(e.target.value) })}
                      disabled={row.completed}
                      className="w-full rounded-[9px] border border-border px-2 py-1.5 text-[14px] outline-none focus:border-accent disabled:bg-surface-2 disabled:text-text-2" />
                    <input type="number" inputMode="numeric" value={row.reps ?? ""} placeholder="—"
                      onChange={(e) => updateSetField(exId, i, { reps: e.target.value === "" ? null : Number(e.target.value) })}
                      disabled={row.completed}
                      className="w-full rounded-[9px] border border-border px-2 py-1.5 text-[14px] outline-none focus:border-accent disabled:bg-surface-2 disabled:text-text-2" />
                    <input type="number" inputMode="numeric" min={1} max={10} value={row.rpe ?? ""} placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Math.min(10, Math.max(1, Number(e.target.value)));
                        updateSetField(exId, i, { rpe: v });
                      }}
                      disabled={row.completed}
                      className="w-full rounded-[9px] border border-border px-1.5 py-1.5 text-[14px] text-center outline-none focus:border-accent disabled:bg-surface-2 disabled:text-text-2" />
                    <button onClick={() => toggleComplete(exId, i)}
                      disabled={saving === `${exId}:${i}`}
                      className={cn(
                        "w-[26px] h-[26px] rounded-check border-2 flex items-center justify-center transition-colors mx-auto",
                        row.completed ? "border-accent bg-accent" : "border-[#d6dae1]"
                      )}>
                      {row.completed && <Check size={13} color="white" strokeWidth={3} />}
                    </button>
                  </div>
                ))}
                <button onClick={() => addSetRow(exId)}
                  className="mt-2 text-[12.5px] font-[600] text-accent flex items-center gap-1">
                  <Plus size={12} strokeWidth={2.5} /> Legg til sett
                </button>
              </div>
            </Card>
          );
        })}

        <button onClick={openAdd}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-[13px] border border-dashed border-border text-text-2 text-[13.5px] font-[600] hover:bg-surface-2 transition-colors">
          <Plus size={15} strokeWidth={2.2} /> Legg til øvelse
        </button>
      </div>
      )}

      {/* Sticky bunn: avslutt */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-sm border-t border-border px-[18px] py-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom,0px), 12px)" }}>
        <div className="max-w-[420px] mx-auto">
          <button onClick={finishSession} disabled={finishing}
            className="w-full py-3 text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all bg-accent">
            {finishing ? "Avslutter…" : "Avslutt økt"}
          </button>
        </div>
      </div>

      {/* Legg til øvelse-sheet */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} maxHeight>
        <h2 className="text-[19px] font-[700] text-fg mb-3 flex-shrink-0">Legg til øvelse</h2>
        <div className="relative mb-3 flex-shrink-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
          <input type="text" autoFocus placeholder="Søk (norsk eller engelsk navn)" value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            className="w-full rounded-[13px] border border-border pl-9 pr-4 py-2.5 text-[14px] outline-none focus:border-accent" />
        </div>
        <div className="overflow-y-auto space-y-1">
          {filteredAdd.map((e) => (
            <button key={e.id} onClick={() => addExercise(e)}
              disabled={exerciseIds.includes(e.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] hover:bg-surface-2 text-left disabled:opacity-30 transition-colors">
              <span className="text-[14px] font-[550] text-fg">{e.name_no}</span>
              <Plus size={14} className="text-accent flex-shrink-0" />
            </button>
          ))}
          {filteredAdd.length === 0 && <p className="text-[12.5px] text-text-3 px-3 py-2">Ingen treff.</p>}
        </div>
      </Sheet>

      {/* Oppsummering */}
      <Sheet open={!!summary} onClose={() => router.push("/app/helse")}>
        <h2 className="text-[19px] font-[700] text-fg mb-4">Økt fullført</h2>
        {summary && (
          <div className="flex gap-2 mb-5">
            <StatCard label="Varighet" value={summary.duration} />
            {summary.sets != null && <StatCard label="Sett" value={String(summary.sets)} />}
            {summary.tonnage != null && <StatCard label="Tonnasje" value={`${summary.tonnage.toLocaleString("nb-NO")} kg`} />}
            {summary.distance != null && <StatCard label="Distanse" value={`${summary.distance} km`} />}
          </div>
        )}
        {(coachLoading || coachText) && (
          <div className="bg-accent-weak rounded-[13px] p-3 mb-5">
            <p className="text-[11px] font-[600] text-accent uppercase tracking-wide12 mb-1.5 flex items-center gap-1.5">
              <Sparkles size={12} /> AI-coach
            </p>
            {coachLoading ? (
              <p className="text-[13.5px] text-text-3">Vurderer økta…</p>
            ) : (
              <p className="text-[13.5px] text-fg whitespace-pre-wrap">{coachText}</p>
            )}
          </div>
        )}
        {stravaEnabled && (
          <div className="mb-5">
            {stravaUrl ? (
              <a href={stravaUrl} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[13px] border border-border text-fg text-[14px] font-[600] hover:bg-surface-2 transition-colors">
                Se på Strava
              </a>
            ) : (
              <button onClick={exportToStrava} disabled={stravaExporting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[13px] border border-border text-fg text-[14px] font-[600] disabled:opacity-40 hover:bg-surface-2 transition-colors">
                <Upload size={14} /> {stravaExporting ? "Deler…" : "Del til Strava"}
              </button>
            )}
            {stravaError && (
              <p className="text-[12px] text-rose-500 mt-1.5 text-center">
                {stravaError}
                {stravaError.includes("Ikke koblet") && <> — <a href="/app/helse" className="underline">koble til på Helse-siden</a></>}
              </p>
            )}
          </div>
        )}
        <button onClick={() => router.push("/app/helse")}
          className="w-full py-3 text-white rounded-[13px] font-[600] text-[15px] hover:opacity-90 transition-all bg-accent">
          Ferdig
        </button>
      </Sheet>
    </div>
  );
}
