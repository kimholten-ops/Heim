"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, Search, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, EmptyState, Sheet, StatCard } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/lib/exercises";
import { estimate1RM, formatKg } from "@/lib/exercises";

type ProgressionPoint = { date: string; label: string; est1RM: number; weightKg: number; reps: number };

const LEVEL_LABEL: Record<string, string> = { nybegynner: "Nybegynner", middels: "Middels", øvet: "Øvet" };

function ProgressionTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: ProgressionPoint }[]; label?: string }) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white rounded-[10px] border border-border px-3 py-2 text-[12.5px] shadow-card">
      <p className="font-[600] text-fg">{label} · est. 1RM {formatKg(p.est1RM)} kg</p>
      <p className="text-text-3">{formatKg(p.weightKg)} kg × {p.reps}</p>
    </div>
  );
}

export default function LibraryClient({ memberId, initialExercises }: { memberId: string; initialExercises: Exercise[] }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [progression, setProgression] = useState<ProgressionPoint[] | null>(null);
  const [progressionLoading, setProgressionLoading] = useState(false);

  const allMuscles = useMemo(() => {
    const s = new Set<string>();
    initialExercises.forEach((e) => e.muscle_groups.forEach((m) => s.add(m)));
    return Array.from(s).sort();
  }, [initialExercises]);
  const allEquipment = useMemo(() => {
    const s = new Set<string>();
    initialExercises.forEach((e) => e.equipment && s.add(e.equipment));
    return Array.from(s).sort();
  }, [initialExercises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialExercises.filter((e) => {
      if (muscle && !e.muscle_groups.includes(muscle)) return false;
      if (equipment && e.equipment !== equipment) return false;
      if (q && !e.name_no.toLowerCase().includes(q) && !e.name_en.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initialExercises, query, muscle, equipment]);

  const openDetail = useCallback(async (ex: Exercise) => {
    setDetail(ex);
    setProgression(null);
    setProgressionLoading(true);
    const { data: raw } = await supabase
      .from("workout_sets")
      .select("weight_kg, reps, completed, session_id, workout_sessions!inner(member_id, started_at)")
      .eq("exercise_id", ex.id)
      .eq("completed", true)
      .eq("workout_sessions.member_id", memberId)
      .not("weight_kg", "is", null)
      .not("reps", "is", null);
    type Row = { weight_kg: number; reps: number; session_id: string; workout_sessions: { started_at: string } };
    const rows = (raw ?? []) as unknown as Row[];
    const bestBySession = new Map<string, ProgressionPoint>();
    for (const r of rows) {
      const est = estimate1RM(r.weight_kg, r.reps);
      const date = r.workout_sessions.started_at;
      const existing = bestBySession.get(r.session_id);
      if (!existing || est > existing.est1RM) {
        bestBySession.set(r.session_id, {
          date, label: new Date(date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }),
          est1RM: Math.round(est * 10) / 10, weightKg: r.weight_kg, reps: r.reps,
        });
      }
    }
    const points = Array.from(bestBySession.values()).sort((a, b) => a.date.localeCompare(b.date));
    setProgression(points);
    setProgressionLoading(false);
  }, [memberId, supabase]);

  const heaviestLift = progression && progression.length > 0
    ? progression.reduce((best, p) => (p.weightKg > best.weightKg ? p : best))
    : null;
  const best1RM = progression && progression.length > 0
    ? progression.reduce((best, p) => (p.est1RM > best.est1RM ? p : best))
    : null;

  return (
    <div className="max-w-[420px] mx-auto">
      <div className="px-[18px] pt-[14px] pb-3 flex items-center gap-2">
        <button onClick={() => router.push("/app/helse")} className="text-text-3 hover:text-fg p-1 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[19px] font-[700] text-fg">Øvelsesbibliotek</h1>
      </div>

      <div className="px-[18px] pb-28">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
          <input type="text" placeholder="Søk øvelse (norsk eller engelsk)" value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[13px] border border-border pl-9 pr-4 py-2.5 text-[14.5px] outline-none focus:border-accent" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={() => setMuscle(null)}
            className={cn("whitespace-nowrap px-2.5 py-1 rounded-chip border text-[11.5px] font-[600] flex-shrink-0", !muscle ? "bg-fg text-white border-fg" : "border-border text-text-2")}>
            Alle muskler
          </button>
          {allMuscles.map((m) => (
            <button key={m} onClick={() => setMuscle(muscle === m ? null : m)}
              className={cn("whitespace-nowrap px-2.5 py-1 rounded-chip border text-[11.5px] font-[600] flex-shrink-0 capitalize", muscle === m ? "bg-fg text-white border-fg" : "border-border text-text-2")}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
          <button onClick={() => setEquipment(null)}
            className={cn("whitespace-nowrap px-2.5 py-1 rounded-chip border text-[11.5px] font-[600] flex-shrink-0", !equipment ? "bg-fg text-white border-fg" : "border-border text-text-2")}>
            Alt utstyr
          </button>
          {allEquipment.map((eq) => (
            <button key={eq} onClick={() => setEquipment(equipment === eq ? null : eq)}
              className={cn("whitespace-nowrap px-2.5 py-1 rounded-chip border text-[11.5px] font-[600] flex-shrink-0 capitalize", equipment === eq ? "bg-fg text-white border-fg" : "border-border text-text-2")}>
              {eq}
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <Card>
            {filtered.map((e, i) => (
              <button key={e.id} onClick={() => openDetail(e)}
                className={cn("w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-2 transition-colors", i > 0 && "border-t border-border")}>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-[550] text-fg truncate">{e.name_no}</p>
                  <p className="text-[12px] text-text-3 capitalize">{e.muscle_groups.slice(0, 2).join(", ")}</p>
                </div>
              </button>
            ))}
          </Card>
        ) : (
          <Card><EmptyState icon={<Search size={18} strokeWidth={1.7} />} text="Ingen øvelser matcher søket." /></Card>
        )}
      </div>

      <Sheet open={!!detail} onClose={() => setDetail(null)} maxHeight>
        {detail && (
          <div className="overflow-y-auto -mx-1 px-1">
            {detail.image_urls[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.image_urls[0]} alt={detail.name_no} loading="lazy"
                className="w-full h-[180px] object-cover rounded-[14px] bg-surface-2 mb-3" />
            )}
            <h2 className="text-[19px] font-[700] text-fg">{detail.name_no}</h2>
            <p className="text-[12.5px] text-text-3 mt-[2px] capitalize">
              {detail.equipment}{detail.level && ` · ${LEVEL_LABEL[detail.level] ?? detail.level}`}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5 mb-4">
              {detail.muscle_groups.map((m) => (
                <span key={m} className="px-2.5 py-1 rounded-chip bg-accent-weak text-accent text-[11.5px] font-[600] capitalize">{m}</span>
              ))}
            </div>

            <p className="text-[11px] font-[600] text-text-3 uppercase tracking-wide12 mb-1.5">Utførelse</p>
            <ol className="space-y-1.5 mb-5">
              {detail.instructions_no.map((step, i) => (
                <li key={i} className="text-[14px] text-fg flex gap-2">
                  <span className="text-text-3 font-[600] flex-shrink-0">{i + 1}.</span>{step}
                </li>
              ))}
            </ol>

            <p className="text-[11px] font-[600] text-text-3 uppercase tracking-wide12 mb-1.5">Din progresjon</p>
            {progressionLoading ? (
              <p className="text-[13px] text-text-3 py-4">Laster…</p>
            ) : progression && progression.length > 0 ? (
              <>
                <div className="flex gap-2 mb-3">
                  <StatCard label="Tyngste løft" value={heaviestLift ? `${formatKg(heaviestLift.weightKg)} kg` : "—"}
                    sub={heaviestLift ? new Date(heaviestLift.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }) : undefined} />
                  <StatCard label="Beste est. 1RM" value={best1RM ? `${formatKg(best1RM.est1RM)} kg` : "—"}
                    sub={best1RM ? new Date(best1RM.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }) : undefined} />
                </div>
                <div className="h-[160px] -ml-2 mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progression} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={34} />
                      <Tooltip content={<ProgressionTooltip />} />
                      <Line type="monotone" dataKey="est1RM" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11.5px] text-text-3 flex items-start gap-1.5">
                  <Info size={13} className="flex-shrink-0 mt-[1px]" />
                  Estimert 1RM = vekt × (1 + reps ÷ 30) — Epley-formelen, basert på beste sett per økt.
                </p>
              </>
            ) : (
              <p className="text-[13px] text-text-3 py-2">Ingen loggført data ennå for denne øvelsen.</p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
