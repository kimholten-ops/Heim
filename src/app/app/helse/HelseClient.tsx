"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/HouseholdContext";
import {
  Plus, X, Dumbbell, ChevronRight, Search, ArrowUp, ArrowDown,
  Pencil, Calendar, Play, Clock, HeartPulse, Flower2, Move, Activity, Sparkles, Link2, Unplug, Upload,
} from "lucide-react";
import { Card, SectionLabel, EmptyState, Sheet } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/lib/exercises";
import { formatDuration, tonnage } from "@/lib/exercises";
import KostholdCard from "./KostholdCard";
import VeilederCard from "./VeilederCard";

type Template = { id: string; name: string };
type TemplateExercise = {
  id?: string; exercise_id: string; position: number;
  target_sets: number | null; target_reps: string | null; notes: string | null;
};
export type SessionType = "styrke" | "cardio" | "yoga" | "mobilitet" | "annet";
type SessionRow = {
  id: string; template_id: string | null; started_at: string; finished_at: string | null;
  notes: string | null; calendar_event_id: string | null;
  type: SessionType; distance_km: number | null; ai_review: string | null; strava_activity_id: number | null;
  workout_sets: { reps: number | null; weight_kg: number | null; completed: boolean }[];
};

const TYPE_LABELS: Record<SessionType, string> = { styrke: "Styrke", cardio: "Cardio", yoga: "Yoga", mobilitet: "Mobilitet", annet: "Annet" };
const TYPE_ICONS: Record<SessionType, typeof Dumbbell> = { styrke: Dumbbell, cardio: HeartPulse, yoga: Flower2, mobilitet: Move, annet: Activity };

export default function HelseClient({ memberId, householdId, veilederEnabled, stravaEnabled }: { memberId: string; householdId: string; veilederEnabled: boolean; stravaEnabled: boolean }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const searchParams = useSearchParams();
  const { members } = useHousehold();
  const myName = members.find((m) => m.id === memberId)?.name ?? "Du";

  /* ── Strava ── */
  const [stravaConnected, setStravaConnected] = useState<boolean | null>(null);
  const [stravaMsg, setStravaMsg] = useState<string | null>(null);
  const [disconnectingStrava, setDisconnectingStrava] = useState(false);

  useEffect(() => {
    if (!stravaEnabled) return;
    (async () => {
      const { data } = await supabase.from("strava_connections").select("member_id").eq("member_id", memberId).maybeSingle();
      setStravaConnected(!!data);
    })();
  }, [stravaEnabled, memberId, supabase]);

  useEffect(() => {
    const status = searchParams.get("strava");
    if (!status) return;
    if (status === "tilkoblet") { setStravaMsg("Koblet til Strava!"); setStravaConnected(true); }
    else if (status === "avslatt") setStravaMsg("Strava-tilkobling avbrutt.");
    else if (status === "feil") setStravaMsg("Klarte ikke koble til Strava. Prøv igjen.");
    router.replace("/app/helse");
  }, [searchParams, router]);

  async function disconnectStrava() {
    if (!confirm("Koble fra Strava?")) return;
    setDisconnectingStrava(true);
    await fetch("/api/strava/disconnect", { method: "POST" });
    setStravaConnected(false);
    setDisconnectingStrava(false);
  }

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const exerciseMap = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);

  const fetchAll = useCallback(async () => {
    const [{ data: ex }, { data: tmpl }, { data: tmplEx }, { data: sess }] = await Promise.all([
      supabase.from("exercises").select("*"),
      supabase.from("workout_templates").select("id, name").eq("member_id", memberId).order("created_at"),
      supabase.from("workout_template_exercises").select("*"),
      supabase.from("workout_sessions")
        .select("id, template_id, started_at, finished_at, notes, calendar_event_id, type, distance_km, ai_review, strava_activity_id, workout_sets(reps, weight_kg, completed)")
        .eq("member_id", memberId).order("started_at", { ascending: false }).limit(40),
    ]);
    setExercises((ex ?? []) as Exercise[]);
    setTemplates((tmpl ?? []) as Template[]);
    setTemplateExercises((tmplEx ?? []) as TemplateExercise[]);
    setSessions((sess ?? []) as unknown as SessionRow[]);
    setLoading(false);
  }, [memberId, supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const now = Date.now();
  // Både fremtidig-planlagte og påbegynte-men-ikke-avsluttede økter (f.eks.
  // hvis noen navigerte bort midt i en økt) havner her, sortert kronologisk.
  const upcoming = sessions.filter((s) => !s.finished_at)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const finished = sessions.filter((s) => s.finished_at);
  const templateExerciseCount = (tid: string) => templateExercises.filter((e) => "template_id" in e && (e as unknown as { template_id: string }).template_id === tid).length;

  /* ── Start økt ── */
  const [showStart, setShowStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startType, setStartType] = useState<SessionType>("styrke");
  async function startSession(templateId: string | null, type: SessionType) {
    setStarting(true);
    const { data } = await supabase.from("workout_sessions")
      .insert({ member_id: memberId, template_id: templateId, started_at: new Date().toISOString(), type })
      .select().single();
    setStarting(false);
    if (data) router.push(`/app/helse/okt?session=${data.id}`);
  }

  /* ── Planlegg økt ── */
  const [showPlan, setShowPlan] = useState(false);
  const [pTemplateId, setPTemplateId] = useState<string | null>(null);
  const [pDate, setPDate] = useState("");
  const [pTime, setPTime] = useState("18:00");
  const [pInCalendar, setPInCalendar] = useState(false);
  const [planning, setPlanning] = useState(false);

  function openPlan() {
    const d = new Date(); d.setDate(d.getDate() + 1);
    setPDate(d.toISOString().slice(0, 10));
    setPTime("18:00"); setPTemplateId(templates[0]?.id ?? null); setPInCalendar(false);
    setShowPlan(true);
  }

  async function planSession() {
    if (!pDate) return;
    setPlanning(true);
    const startedAt = new Date(`${pDate}T${pTime}:00`).toISOString();
    const { data: session } = await supabase.from("workout_sessions")
      .insert({ member_id: memberId, template_id: pTemplateId, started_at: startedAt })
      .select().single();
    if (session && pInCalendar) {
      const endedAt = new Date(new Date(startedAt).getTime() + 60 * 60 * 1000).toISOString();
      const { data: ev } = await supabase.from("events")
        .insert({ household_id: householdId, title: `${myName} trener`, start_at: startedAt, end_at: endedAt, all_day: false, color: "#12936b", recurrence: "none" })
        .select().single();
      if (ev) {
        await supabase.from("event_members").insert({ event_id: ev.id, member_id: memberId });
        await supabase.from("workout_sessions").update({ calendar_event_id: ev.id }).eq("id", session.id);
      }
    }
    setPlanning(false);
    setShowPlan(false);
    await fetchAll();
  }

  async function deletePlanned(s: SessionRow) {
    if (!confirm("Slett den planlagte økten?")) return;
    if (s.calendar_event_id) await supabase.from("events").delete().eq("id", s.calendar_event_id);
    await supabase.from("workout_sessions").delete().eq("id", s.id);
    await fetchAll();
  }

  /* ── Maler ── */
  const [showTemplate, setShowTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tName, setTName] = useState("");
  const [tExercises, setTExercises] = useState<TemplateExercise[]>([]);
  const [tQuery, setTQuery] = useState("");
  const [tMuscle, setTMuscle] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const allMuscles = useMemo(() => {
    const s = new Set<string>();
    exercises.forEach((e) => e.muscle_groups.forEach((m) => s.add(m)));
    return Array.from(s).sort();
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    const q = tQuery.trim().toLowerCase();
    return exercises.filter((e) => {
      if (tMuscle && !e.muscle_groups.includes(tMuscle)) return false;
      if (!q) return true;
      return e.name_no.toLowerCase().includes(q) || e.name_en.toLowerCase().includes(q);
    }).slice(0, 30);
  }, [exercises, tQuery, tMuscle]);

  function openNewTemplate() {
    setEditingTemplateId(null); setTName(""); setTExercises([]); setTQuery(""); setTMuscle(null);
    setShowTemplate(true);
  }
  function openEditTemplate(t: Template) {
    setEditingTemplateId(t.id); setTName(t.name);
    setTExercises(
      templateExercises
        .filter((e) => (e as unknown as { template_id: string }).template_id === t.id)
        .sort((a, b) => a.position - b.position)
    );
    setTQuery(""); setTMuscle(null);
    setShowTemplate(true);
  }
  function addExerciseToTemplate(exerciseId: string) {
    if (tExercises.some((e) => e.exercise_id === exerciseId)) return;
    setTExercises((prev) => [...prev, { exercise_id: exerciseId, position: prev.length, target_sets: 3, target_reps: "8-12", notes: null }]);
  }
  function removeExerciseFromTemplate(exerciseId: string) {
    setTExercises((prev) => prev.filter((e) => e.exercise_id !== exerciseId));
  }
  function moveExercise(index: number, dir: -1 | 1) {
    setTExercises((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function updateTExercise(exerciseId: string, patch: Partial<TemplateExercise>) {
    setTExercises((prev) => prev.map((e) => (e.exercise_id === exerciseId ? { ...e, ...patch } : e)));
  }

  async function saveTemplate() {
    if (!tName.trim()) return;
    setSavingTemplate(true);
    let templateId = editingTemplateId;
    if (templateId) {
      await supabase.from("workout_templates").update({ name: tName.trim() }).eq("id", templateId);
      await supabase.from("workout_template_exercises").delete().eq("template_id", templateId);
    } else {
      const { data } = await supabase.from("workout_templates").insert({ member_id: memberId, name: tName.trim() }).select().single();
      templateId = data?.id ?? null;
    }
    if (templateId && tExercises.length) {
      await supabase.from("workout_template_exercises").insert(
        tExercises.map((e, i) => ({
          template_id: templateId, exercise_id: e.exercise_id, position: i,
          target_sets: e.target_sets, target_reps: e.target_reps, notes: e.notes,
        }))
      );
    }
    setSavingTemplate(false);
    setShowTemplate(false);
    await fetchAll();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Slett malen?")) return;
    await supabase.from("workout_templates").delete().eq("id", id);
    await fetchAll();
  }

  /* ──Øktdetalj (les-modus) ── */
  const [viewSession, setViewSession] = useState<SessionRow | null>(null);
  const [viewSessionExporting, setViewSessionExporting] = useState(false);
  const [viewSessionStravaError, setViewSessionStravaError] = useState<string | null>(null);

  async function exportViewSessionToStrava() {
    if (!viewSession) return;
    setViewSessionExporting(true); setViewSessionStravaError(null);
    try {
      const res = await fetch("/api/strava/export", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: viewSession.id }),
      });
      const json = await res.json();
      if (res.ok) {
        setViewSession((prev) => (prev ? { ...prev, strava_activity_id: json.activityId } : prev));
        setSessions((prev) => prev.map((s) => (s.id === viewSession.id ? { ...s, strava_activity_id: json.activityId } : s)));
        window.open(json.url, "_blank");
      } else {
        setViewSessionStravaError(json.error ?? "Klarte ikke dele til Strava.");
      }
    } catch {
      setViewSessionStravaError("Klarte ikke dele til Strava.");
    } finally {
      setViewSessionExporting(false);
    }
  }

  return (
    <div className="max-w-[420px] mx-auto">
      <div className="px-[18px] pt-[14px] pb-28">
        <div>
          <p className="text-[12.5px] font-[600] text-text-3 tracking-[0.02em]">Voksne</p>
          <h1 className="text-[27px] font-[700] tracking-tight27 text-fg mt-[3px] leading-[1.05]">Helse</h1>
        </div>

        {/* ── Trening ── */}
        <div className="mt-5">
          <SectionLabel title="Trening" />

          <div className="flex gap-2 mb-3">
            <button onClick={() => setShowStart(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] hover:opacity-90 active:scale-[.98] transition-all">
              <Play size={15} strokeWidth={2.2} /> Start økt
            </button>
            <button onClick={openPlan}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-border rounded-[13px] font-[600] text-[14px] text-fg hover:bg-surface-2 transition-colors">
              <Calendar size={15} strokeWidth={2} /> Planlegg
            </button>
          </div>

          {upcoming.length > 0 && (
            <Card className="mb-3">
              {upcoming.map((s, i) => {
                const isFuture = new Date(s.started_at).getTime() > now;
                return (
                <div key={s.id} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-border")}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-[600] text-fg">
                      {templates.find((t) => t.id === s.template_id)?.name ?? "Tom økt"}
                      {!isFuture && <span className="ml-1.5 text-[11px] font-[600] text-accent">· pågår</span>}
                    </p>
                    <p className="text-[12px] text-text-3">
                      {new Date(s.started_at).toLocaleString("nb-NO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {s.calendar_event_id && " · i kalenderen"}
                    </p>
                  </div>
                  <button onClick={() => router.push(`/app/helse/okt?session=${s.id}`)}
                    className="text-[12.5px] font-[600] text-accent px-2 py-1">{isFuture ? "Start nå" : "Fortsett"}</button>
                  <button onClick={() => deletePlanned(s)} className="text-text-3 hover:text-rose-500 p-1"><X size={14} /></button>
                </div>
                );
              })}
            </Card>
          )}

          <div className="flex items-center justify-between px-1 mb-1.5 mt-4">
            <h2 className="text-[12px] font-[600] uppercase tracking-wide12 text-text-3">Mine maler</h2>
            <button onClick={openNewTemplate} className="text-[12px] font-[600] text-accent flex items-center gap-1">
              <Plus size={12} strokeWidth={2.5} /> Ny mal
            </button>
          </div>
          {templates.length > 0 ? (
            <Card className="mb-4">
              {templates.map((t, i) => (
                <div key={t.id} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-border")}>
                  <Dumbbell size={16} className="text-text-3 flex-shrink-0" strokeWidth={2} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14.5px] font-[550] text-fg">{t.name}</p>
                    <p className="text-[12px] text-text-3">{templateExerciseCount(t.id)} øvelser</p>
                  </div>
                  <button onClick={() => openEditTemplate(t)} className="text-text-3 hover:text-accent p-1"><Pencil size={14} /></button>
                  <button onClick={() => deleteTemplate(t.id)} className="text-text-3 hover:text-rose-500 p-1"><X size={14} /></button>
                </div>
              ))}
            </Card>
          ) : !loading && (
            <Card className="mb-4"><EmptyState icon={<Dumbbell size={18} strokeWidth={1.7} />} text="Ingen maler ennå — lag én, eller start en tom økt." /></Card>
          )}

          <div className="px-1 mb-1.5">
            <h2 className="text-[12px] font-[600] uppercase tracking-wide12 text-text-3">Siste økter</h2>
          </div>
          {finished.length > 0 ? (
            <Card className="mb-4">
              {finished.slice(0, 10).map((s, i) => {
                const completedSets = s.workout_sets.filter((set) => set.completed);
                const isStyrke = s.type === "styrke";
                const Icon = TYPE_ICONS[s.type] ?? Dumbbell;
                return (
                  <button key={s.id} onClick={() => setViewSession(s)}
                    className={cn("w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors", i > 0 && "border-t border-border")}>
                    <Icon size={15} className="text-text-3 flex-shrink-0" strokeWidth={2} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-[550] text-fg">
                        {isStyrke ? (templates.find((t) => t.id === s.template_id)?.name ?? "Tom økt") : TYPE_LABELS[s.type]}
                      </p>
                      <p className="text-[12px] text-text-3 flex items-center gap-1.5">
                        <Clock size={11} /> {new Date(s.started_at).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                        {" · "}{formatDuration(s.started_at, s.finished_at)}
                        {isStyrke ? <>{" · "}{completedSets.length} sett</> : s.distance_km ? <>{" · "}{s.distance_km} km</> : null}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-text-3 flex-shrink-0" />
                  </button>
                );
              })}
            </Card>
          ) : !loading && (
            <Card className="mb-4"><EmptyState icon={<Clock size={18} strokeWidth={1.7} />} text="Ingen fullførte økter ennå." /></Card>
          )}

          <button onClick={() => router.push("/app/helse/bibliotek")}
            className="w-full flex items-center gap-[13px] px-4 py-[14px] bg-surface border border-border rounded-card shadow-card hover:bg-surface-2 transition-colors">
            <span className="w-[38px] h-[38px] rounded-[11px] bg-accent-weak text-accent flex items-center justify-center flex-shrink-0">
              <Search size={17} strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[15px] font-[600] text-fg">Øvelsesbibliotek</p>
              <p className="text-[12.5px] text-text-2 mt-[1px]">Søk, se instruksjoner og din progresjon</p>
            </div>
            <ChevronRight size={18} className="text-text-3 flex-shrink-0" />
          </button>
        </div>

        {/* Strava skjules helt hvis STRAVA_CLIENT_ID/SECRET mangler i miljøet
            — appen fungerer 100 % uten. */}
        {stravaEnabled && (
          <Card className="mt-5 px-4 py-3.5 flex items-center gap-3">
            <span className="w-[38px] h-[38px] rounded-[11px] bg-accent-weak text-accent flex items-center justify-center flex-shrink-0">
              <Upload size={17} strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14.5px] font-[600] text-fg">Strava</p>
              <p className="text-[12.5px] text-text-2 mt-[1px]">
                {stravaConnected === null ? "Sjekker…" : stravaConnected ? "Koblet til — del økter herfra" : "Del fullførte økter til Strava"}
              </p>
              {stravaMsg && <p className="text-[12px] text-accent mt-[2px]">{stravaMsg}</p>}
            </div>
            {stravaConnected === true ? (
              <button onClick={disconnectStrava} disabled={disconnectingStrava}
                className="flex items-center gap-1.5 text-[12.5px] font-[600] text-text-3 hover:text-rose-500 px-2 py-1 disabled:opacity-40">
                <Unplug size={13} /> Koble fra
              </button>
            ) : stravaConnected === false ? (
              <a href="/api/strava/connect"
                className="flex items-center gap-1.5 text-[12.5px] font-[600] text-accent px-2 py-1">
                <Link2 size={13} /> Koble til
              </a>
            ) : null}
          </Card>
        )}

        <KostholdCard memberId={memberId} householdId={householdId} />

        {/* AI-veilederen skjules helt (ikke bare deaktivert) hvis
            ANTHROPIC_API_KEY mangler i miljøet — appen fungerer 100 % uten. */}
        {veilederEnabled && <VeilederCard memberId={memberId} />}
      </div>

      {/* ── Start-økt sheet ── */}
      <Sheet open={showStart} onClose={() => { setShowStart(false); setStartType("styrke"); }}>
        <h2 className="text-[19px] font-[700] text-fg mb-3">Start økt</h2>
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
          {(Object.keys(TYPE_LABELS) as SessionType[]).map((t) => {
            const Icon = TYPE_ICONS[t];
            return (
              <button key={t} type="button" onClick={() => setStartType(t)}
                className={cn("whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-chip border text-[12.5px] font-[600] flex-shrink-0 transition-all",
                  startType === t ? "bg-fg text-white border-fg" : "border-border text-fg")}>
                <Icon size={13} /> {TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {startType === "styrke" ? (
            <>
              <button onClick={() => startSession(null, "styrke")} disabled={starting}
                className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2 rounded-[13px] text-left hover:bg-border/40 transition-colors disabled:opacity-50">
                <Dumbbell size={16} className="text-text-3" /> <span className="text-[14.5px] font-[550] text-fg">Tom økt</span>
              </button>
              {templates.map((t) => (
                <button key={t.id} onClick={() => startSession(t.id, "styrke")} disabled={starting}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2 rounded-[13px] text-left hover:bg-border/40 transition-colors disabled:opacity-50">
                  <Dumbbell size={16} className="text-text-3" /> <span className="text-[14.5px] font-[550] text-fg">{t.name}</span>
                </button>
              ))}
            </>
          ) : (
            <button onClick={() => startSession(null, startType)} disabled={starting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all">
              {starting ? "Starter…" : `Start ${TYPE_LABELS[startType].toLowerCase()}-økt`}
            </button>
          )}
        </div>
      </Sheet>

      {/* ── Planlegg-økt sheet ── */}
      <Sheet open={showPlan} onClose={() => setShowPlan(false)}>
        <h2 className="text-[19px] font-[700] text-fg mb-4">Planlegg økt</h2>
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-[600] text-text-3 mb-1.5 uppercase tracking-wide12">Mal</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPTemplateId(null)}
                className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550]", !pTemplateId ? "bg-fg text-white border-fg" : "border-border text-fg")}>
                Tom økt
              </button>
              {templates.map((t) => (
                <button key={t.id} type="button" onClick={() => setPTemplateId(t.id)}
                  className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550]", pTemplateId === t.id ? "bg-fg text-white border-fg" : "border-border text-fg")}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)}
              className="flex-1 rounded-[13px] border border-border px-4 py-2.5 text-[15px] outline-none focus:border-accent" />
            <input type="time" value={pTime} onChange={(e) => setPTime(e.target.value)}
              className="w-[110px] rounded-[13px] border border-border px-3 py-2.5 text-[15px] outline-none focus:border-accent" />
          </div>
          <button type="button" onClick={() => setPInCalendar((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-surface-2 rounded-[13px]">
            <span className="text-[13.5px] font-[550] text-fg">Vis i familiekalenderen</span>
            <span className={cn("relative w-[42px] h-[24px] rounded-full transition-colors", pInCalendar ? "bg-accent" : "bg-border")}>
              <span className={cn("absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-transform", pInCalendar ? "translate-x-[21px]" : "translate-x-[3px]")} />
            </span>
          </button>
          {pInCalendar && <p className="text-[12px] text-text-3">Kun tittelen «{myName} trener» deles — ikke øvelser eller resultater.</p>}
          <button onClick={planSession} disabled={planning || !pDate}
            className="w-full py-3 text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all bg-accent">
            {planning ? "Lagrer…" : "Planlegg økt"}
          </button>
        </div>
      </Sheet>

      {/* ── Mal-editor sheet ── */}
      <Sheet open={showTemplate} onClose={() => setShowTemplate(false)} maxHeight>
        <h2 className="text-[19px] font-[700] text-fg mb-4 flex-shrink-0">{editingTemplateId ? "Rediger mal" : "Ny mal"}</h2>
        <div className="overflow-y-auto -mx-1 px-1 space-y-4">
          <input type="text" placeholder="Navn på mal (f.eks. Overkropp A)" value={tName}
            onChange={(e) => setTName(e.target.value)} autoFocus
            className="w-full rounded-[13px] border border-border px-4 py-3 text-[15px] outline-none focus:border-accent" />

          {tExercises.length > 0 && (
            <div className="space-y-2">
              {tExercises.map((te, i) => {
                const ex = exerciseMap[te.exercise_id];
                return (
                  <div key={te.exercise_id} className="bg-surface-2 rounded-[13px] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button type="button" onClick={() => moveExercise(i, -1)} disabled={i === 0} className="text-text-3 disabled:opacity-30"><ArrowUp size={13} /></button>
                        <button type="button" onClick={() => moveExercise(i, 1)} disabled={i === tExercises.length - 1} className="text-text-3 disabled:opacity-30"><ArrowDown size={13} /></button>
                      </div>
                      <p className="flex-1 text-[13.5px] font-[600] text-fg truncate">{ex?.name_no ?? te.exercise_id}</p>
                      <button type="button" onClick={() => removeExerciseFromTemplate(te.exercise_id)} className="text-text-3 hover:text-rose-500 p-1"><X size={14} /></button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input type="number" min={1} placeholder="Sett" value={te.target_sets ?? ""}
                        onChange={(e) => updateTExercise(te.exercise_id, { target_sets: e.target.value ? Number(e.target.value) : null })}
                        className="w-16 rounded-[10px] border border-border px-2 py-1.5 text-[13px] outline-none focus:border-accent" />
                      <input type="text" placeholder="Reps (f.eks. 8-12)" value={te.target_reps ?? ""}
                        onChange={(e) => updateTExercise(te.exercise_id, { target_reps: e.target.value || null })}
                        className="flex-1 rounded-[10px] border border-border px-2 py-1.5 text-[13px] outline-none focus:border-accent" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <p className="text-[11px] font-[600] text-text-3 mb-1.5 uppercase tracking-wide12">Legg til øvelse</p>
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
              <input type="text" placeholder="Søk (norsk eller engelsk navn)" value={tQuery}
                onChange={(e) => setTQuery(e.target.value)}
                className="w-full rounded-[13px] border border-border pl-9 pr-4 py-2.5 text-[14px] outline-none focus:border-accent" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              <button type="button" onClick={() => setTMuscle(null)}
                className={cn("whitespace-nowrap px-2.5 py-1 rounded-chip border text-[11.5px] font-[600] flex-shrink-0", !tMuscle ? "bg-fg text-white border-fg" : "border-border text-text-2")}>
                Alle
              </button>
              {allMuscles.map((m) => (
                <button key={m} type="button" onClick={() => setTMuscle(tMuscle === m ? null : m)}
                  className={cn("whitespace-nowrap px-2.5 py-1 rounded-chip border text-[11.5px] font-[600] flex-shrink-0 capitalize", tMuscle === m ? "bg-fg text-white border-fg" : "border-border text-text-2")}>
                  {m}
                </button>
              ))}
            </div>
            <div className="max-h-[180px] overflow-y-auto space-y-1">
              {filteredExercises.map((e) => (
                <button key={e.id} type="button" onClick={() => addExerciseToTemplate(e.id)}
                  disabled={tExercises.some((te) => te.exercise_id === e.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[10px] hover:bg-surface-2 text-left disabled:opacity-30 transition-colors">
                  <span className="text-[13.5px] font-[550] text-fg">{e.name_no}</span>
                  <Plus size={14} className="text-accent flex-shrink-0" />
                </button>
              ))}
              {filteredExercises.length === 0 && <p className="text-[12.5px] text-text-3 px-3 py-2">Ingen treff.</p>}
            </div>
          </div>

          <button onClick={saveTemplate} disabled={savingTemplate || !tName.trim()}
            className="w-full py-3 text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all bg-accent">
            {savingTemplate ? "Lagrer…" : "Lagre mal"}
          </button>
        </div>
      </Sheet>

      {/* ── Øktdetalj (les-modus) ── */}
      <Sheet open={!!viewSession} onClose={() => setViewSession(null)} maxHeight>
        {viewSession && (
          <>
            <h2 className="text-[19px] font-[700] text-fg mb-1 flex-shrink-0">
              {viewSession.type === "styrke" ? (templates.find((t) => t.id === viewSession.template_id)?.name ?? "Tom økt") : TYPE_LABELS[viewSession.type]}
            </h2>
            <p className="text-[13px] text-text-3 mb-4 flex-shrink-0">
              {new Date(viewSession.started_at).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}
              {" · "}{formatDuration(viewSession.started_at, viewSession.finished_at)}
              {viewSession.type === "styrke"
                ? <>{" · "}{tonnage(viewSession.workout_sets).toLocaleString("nb-NO")} kg totalt</>
                : viewSession.distance_km ? <>{" · "}{viewSession.distance_km} km</> : null}
            </p>
            <div className="overflow-y-auto space-y-3">
              {viewSession.type === "styrke" ? (
                <p className="text-[13px] text-text-2">
                  {viewSession.workout_sets.filter((s) => s.completed).length} fullførte sett logget denne økten.
                </p>
              ) : viewSession.notes ? (
                <p className="text-[13px] text-text-2">{viewSession.notes}</p>
              ) : null}
              {viewSession.ai_review && (
                <div className="bg-accent-weak rounded-[13px] p-3">
                  <p className="text-[11px] font-[600] text-accent uppercase tracking-wide12 mb-1.5 flex items-center gap-1.5">
                    <Sparkles size={12} /> AI-coach
                  </p>
                  <p className="text-[13.5px] text-fg whitespace-pre-wrap">{viewSession.ai_review}</p>
                </div>
              )}
              {stravaEnabled && viewSession.finished_at && (
                <div>
                  {viewSession.strava_activity_id ? (
                    <a href={`https://www.strava.com/activities/${viewSession.strava_activity_id}`} target="_blank" rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[13px] border border-border text-fg text-[13.5px] font-[600] hover:bg-surface-2 transition-colors">
                      Se på Strava
                    </a>
                  ) : (
                    <button onClick={exportViewSessionToStrava} disabled={viewSessionExporting}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[13px] border border-border text-fg text-[13.5px] font-[600] disabled:opacity-40 hover:bg-surface-2 transition-colors">
                      <Upload size={13} /> {viewSessionExporting ? "Deler…" : "Del til Strava"}
                    </button>
                  )}
                  {viewSessionStravaError && (
                    <p className="text-[12px] text-rose-500 mt-1.5 text-center">
                      {viewSessionStravaError}
                      {viewSessionStravaError.includes("Ikke koblet") && <> — koble til over</>}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
