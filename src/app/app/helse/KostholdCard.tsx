"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Utensils, Target, Scale, Search, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, SectionLabel, Sheet } from "@/components/ui";
import { cn } from "@/lib/utils";

type Matvare = {
  id: string; navn: string; gruppe: string | null;
  kcal: number; protein_g: number; karbo_g: number; fett_g: number; fiber_g: number;
};
type WeightPoint = { date: string; label: string; weight_kg: number; avg7: number | null };

const ACTIVITY_FACTORS = [
  { value: 1.2, label: "Stillesittende" },
  { value: 1.375, label: "Lett aktiv" },
  { value: 1.55, label: "Moderat aktiv" },
  { value: 1.725, label: "Svært aktiv" },
];
const MIN_KCAL_TARGET = 1500;

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO(): string {
  return toISODate(new Date());
}

export default function KostholdCard({ memberId, householdId }: { memberId: string; householdId: string }) {
  const [supabase] = useState(() => createClient());

  const [todaysMeal, setTodaysMeal] = useState<string | null>(null);
  const [kcalTarget, setKcalTarget] = useState<number | null>(null);
  const [proteinTarget, setProteinTarget] = useState<number | null>(null);
  const [weightPoints, setWeightPoints] = useState<WeightPoint[]>([]);

  const fetchAll = useCallback(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = toISODate(cutoff);

    const [{ data: meal }, { data: profile }, { data: weights }] = await Promise.all([
      supabase.from("meals").select("title").eq("household_id", householdId).eq("date", todayISO()).maybeSingle(),
      supabase.from("health_profiles").select("kcal_target, protein_target_g").eq("member_id", memberId).maybeSingle(),
      supabase.from("weight_entries").select("date, weight_kg").eq("member_id", memberId).gte("date", cutoffStr).order("date"),
    ]);
    setTodaysMeal(meal?.title ?? null);
    setKcalTarget(profile?.kcal_target ?? null);
    setProteinTarget(profile?.protein_target_g ?? null);

    const rows = weights ?? [];
    const points: WeightPoint[] = rows.map((w, i) => {
      const windowStart = Math.max(0, i - 6);
      const window = rows.slice(windowStart, i + 1);
      const avg7 = window.reduce((s, r) => s + r.weight_kg, 0) / window.length;
      return {
        date: w.date,
        label: new Date(w.date + "T12:00:00").toLocaleDateString("nb-NO", { day: "numeric", month: "short" }),
        weight_kg: w.weight_kg,
        avg7: Math.round(avg7 * 10) / 10,
      };
    });
    setWeightPoints(points);
  }, [memberId, householdId, supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Mål-sheet ── */
  const [showGoals, setShowGoals] = useState(false);
  const [gKcal, setGKcal] = useState("");
  const [gProtein, setGProtein] = useState("");
  const [savingGoals, setSavingGoals] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [calcGender, setCalcGender] = useState<"mann" | "kvinne">("mann");
  const [calcWeight, setCalcWeight] = useState("");
  const [calcHeight, setCalcHeight] = useState("");
  const [calcAge, setCalcAge] = useState("");
  const [calcActivity, setCalcActivity] = useState(1.375);

  function openGoals() {
    setGKcal(kcalTarget != null ? String(kcalTarget) : "");
    setGProtein(proteinTarget != null ? String(proteinTarget) : "");
    setShowCalc(false);
    setShowGoals(true);
  }

  function applyCalculator() {
    const w = Number(calcWeight), h = Number(calcHeight), a = Number(calcAge);
    if (!w || !h || !a) return;
    const bmr = calcGender === "mann" ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
    const tdee = Math.round(bmr * calcActivity);
    setGKcal(String(Math.max(MIN_KCAL_TARGET, tdee)));
    setGProtein(String(Math.round(w * 1.6)));
    setShowCalc(false);
  }

  async function saveGoals() {
    const kcal = gKcal ? Math.max(MIN_KCAL_TARGET, Number(gKcal)) : null;
    const protein = gProtein ? Number(gProtein) : null;
    setSavingGoals(true);
    await supabase.from("health_profiles").upsert(
      { member_id: memberId, kcal_target: kcal, protein_target_g: protein, updated_at: new Date().toISOString() },
      { onConflict: "member_id" }
    );
    setSavingGoals(false);
    setShowGoals(false);
    await fetchAll();
  }

  /* ── Vekt quick-log ── */
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  async function logWeight() {
    const kg = Number(weightInput.replace(",", "."));
    if (!kg || kg <= 0) return;
    setSavingWeight(true);
    await supabase.from("weight_entries").upsert(
      { member_id: memberId, date: todayISO(), weight_kg: kg },
      { onConflict: "member_id,date" }
    );
    setWeightInput("");
    setSavingWeight(false);
    await fetchAll();
  }

  /* ── Matvaresøk ── */
  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState<Matvare[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = foodQuery.trim();
    if (q.length < 2) { setFoodResults([]); return; }
    const handle = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from("matvarer").select("*").ilike("navn", `%${q}%`).order("navn").limit(20);
      setFoodResults((data ?? []) as Matvare[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [foodQuery, supabase]);

  const latestWeight = weightPoints[weightPoints.length - 1]?.weight_kg ?? null;

  return (
    <div className="mt-6">
      <SectionLabel title="Kosthold" />

      {/* Dagens middag */}
      <Card className="mb-3">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="w-[38px] h-[38px] rounded-[11px] bg-accent-weak text-accent flex items-center justify-center flex-shrink-0">
            <Utensils size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-[600] text-fg truncate">{todaysMeal ?? "Ingen middag planlagt i dag"}</p>
            {todaysMeal && <p className="text-[12.5px] text-text-2 mt-[1px]">Fra ukesmenyen</p>}
          </div>
        </div>
      </Card>

      {/* Mål */}
      <Card className="mb-3">
        <button onClick={openGoals} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors">
          <span className="w-[38px] h-[38px] rounded-[11px] bg-surface-2 text-text-3 flex items-center justify-center flex-shrink-0">
            <Target size={17} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-[600] text-fg">Mål</p>
            <p className="text-[12.5px] text-text-2 mt-[1px]">
              {kcalTarget || proteinTarget
                ? [kcalTarget && `${kcalTarget} kcal`, proteinTarget && `${proteinTarget} g protein`].filter(Boolean).join(" · ")
                : "Ikke satt ennå"}
            </p>
          </div>
        </button>
      </Card>

      {/* Vekt */}
      <Card className="mb-3">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-[38px] h-[38px] rounded-[11px] bg-surface-2 text-text-3 flex items-center justify-center flex-shrink-0">
              <Scale size={17} strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-[600] text-fg">Vekt</p>
              <p className="text-[12.5px] text-text-2 mt-[1px]">{latestWeight != null ? `${latestWeight} kg sist logget` : "Ingen loggføringer ennå"}</p>
            </div>
          </div>
          <div className="flex gap-2 mb-1">
            <input type="text" inputMode="decimal" placeholder="Vekt i dag (kg)" value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="flex-1 rounded-[13px] border border-border px-4 py-2.5 text-[15px] outline-none focus:border-accent" />
            <button onClick={logWeight} disabled={savingWeight || !weightInput}
              className="px-4 rounded-[13px] bg-accent text-white font-[600] text-[14px] disabled:opacity-40 hover:opacity-90 transition-all">
              {savingWeight ? "…" : "Lagre i dag"}
            </button>
          </div>
          {weightPoints.length > 1 && (
            <div className="h-[140px] -ml-2 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightPoints} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "var(--text-3)" }} axisLine={false} tickLine={false}
                    interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10.5, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={32} domain={["auto", "auto"]} />
                  <Tooltip content={<WeightTooltip />} />
                  <Line type="monotone" dataKey="weight_kg" stroke="var(--text-3)" strokeWidth={1.5} dot={false} name="Vekt" />
                  <Line type="monotone" dataKey="avg7" stroke="var(--accent)" strokeWidth={2} dot={false} name="7-dagers snitt" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* Matvaresøk */}
      <Card>
        <div className="px-4 py-3">
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <input type="text" placeholder="Slå opp næringsinnhold (f.eks. laks, brød)" value={foodQuery}
              onChange={(e) => setFoodQuery(e.target.value)}
              className="w-full rounded-[13px] border border-border pl-9 pr-4 py-2.5 text-[14px] outline-none focus:border-accent" />
          </div>
          {searching && <p className="text-[12.5px] text-text-3 py-1">Søker…</p>}
          {!searching && foodQuery.trim().length >= 2 && foodResults.length === 0 && (
            <p className="text-[12.5px] text-text-3 py-1">Ingen treff.</p>
          )}
          {foodResults.length > 0 && (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[12.5px] mt-1">
                <thead>
                  <tr className="text-text-3 text-[10.5px] uppercase tracking-wide12">
                    <th className="text-left font-[600] px-1 pb-1.5">Matvare</th>
                    <th className="text-right font-[600] px-1 pb-1.5">Kcal</th>
                    <th className="text-right font-[600] px-1 pb-1.5">Prot.</th>
                    <th className="text-right font-[600] px-1 pb-1.5">Karbo</th>
                    <th className="text-right font-[600] px-1 pb-1.5">Fett</th>
                  </tr>
                </thead>
                <tbody>
                  {foodResults.map((f, i) => (
                    <tr key={f.id} className={cn(i > 0 && "border-t border-border")}>
                      <td className="py-1.5 px-1 text-fg font-[550]">{f.navn}</td>
                      <td className="py-1.5 px-1 text-right text-text-2">{f.kcal}</td>
                      <td className="py-1.5 px-1 text-right text-text-2">{f.protein_g}g</td>
                      <td className="py-1.5 px-1 text-right text-text-2">{f.karbo_g}g</td>
                      <td className="py-1.5 px-1 text-right text-text-2">{f.fett_g}g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10.5px] text-text-3 mt-1.5">Verdier per 100 g.</p>
            </div>
          )}
          <p className="text-[10.5px] text-text-3 mt-3 pt-2 border-t border-border">Kilde: Matvaretabellen 2026, Mattilsynet</p>
        </div>
      </Card>

      {/* ── Mål-sheet ── */}
      <Sheet open={showGoals} onClose={() => setShowGoals(false)} maxHeight>
        <h2 className="text-[19px] font-[700] text-fg mb-4 flex-shrink-0">Mål</h2>
        <div className="overflow-y-auto -mx-1 px-1 space-y-3">
          <div>
            <p className="text-[11px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">Kalorimål (kcal/dag)</p>
            <input type="number" min={MIN_KCAL_TARGET} value={gKcal} onChange={(e) => setGKcal(e.target.value)}
              className="w-full rounded-[13px] border border-border px-4 py-2.5 text-[15px] outline-none focus:border-accent" />
          </div>
          <div>
            <p className="text-[11px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">Proteinmål (g/dag)</p>
            <input type="number" min={0} value={gProtein} onChange={(e) => setGProtein(e.target.value)}
              className="w-full rounded-[13px] border border-border px-4 py-2.5 text-[15px] outline-none focus:border-accent" />
          </div>

          <button type="button" onClick={() => setShowCalc((v) => !v)}
            className="text-[13px] font-[600] text-accent">
            {showCalc ? "Skjul kalkulator" : "Foreslå utgangspunkt"}
          </button>

          {showCalc && (
            <div className="bg-surface-2 rounded-[13px] p-3.5 space-y-2.5">
              <div className="flex gap-2">
                <button type="button" onClick={() => setCalcGender("mann")}
                  className={cn("flex-1 py-2 rounded-[10px] border-2 text-[13px] font-[550]", calcGender === "mann" ? "border-accent text-accent bg-accent-weak" : "border-border text-text-2")}>
                  Mann
                </button>
                <button type="button" onClick={() => setCalcGender("kvinne")}
                  className={cn("flex-1 py-2 rounded-[10px] border-2 text-[13px] font-[550]", calcGender === "kvinne" ? "border-accent text-accent bg-accent-weak" : "border-border text-text-2")}>
                  Kvinne
                </button>
              </div>
              <div className="flex gap-2">
                <input type="number" placeholder="Vekt (kg)" value={calcWeight} onChange={(e) => setCalcWeight(e.target.value)}
                  className="flex-1 rounded-[10px] border border-border px-3 py-2 text-[13px] outline-none focus:border-accent" />
                <input type="number" placeholder="Høyde (cm)" value={calcHeight} onChange={(e) => setCalcHeight(e.target.value)}
                  className="flex-1 rounded-[10px] border border-border px-3 py-2 text-[13px] outline-none focus:border-accent" />
                <input type="number" placeholder="Alder" value={calcAge} onChange={(e) => setCalcAge(e.target.value)}
                  className="flex-1 rounded-[10px] border border-border px-3 py-2 text-[13px] outline-none focus:border-accent" />
              </div>
              <select value={calcActivity} onChange={(e) => setCalcActivity(Number(e.target.value))}
                className="w-full rounded-[10px] border border-border px-3 py-2 text-[13px] outline-none focus:border-accent bg-white">
                {ACTIVITY_FACTORS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <button type="button" onClick={applyCalculator} disabled={!calcWeight || !calcHeight || !calcAge}
                className="w-full py-2 rounded-[10px] bg-fg text-white text-[13px] font-[600] disabled:opacity-40">
                Bruk forslag
              </button>
            </div>
          )}

          {/* Vises alltid når målsheeten er åpen, ikke bare mens kalkulatoren
              er utvidet — disclaimeren skal følge målene uansett hvordan de
              ble satt (kalkulert eller manuelt inntastet). */}
          <p className="text-[11.5px] text-text-3 flex items-start gap-1.5">
            <Info size={12} className="flex-shrink-0 mt-[1px]" />
            Dette er et estimat for vedlikehold — juster etter egne behov. Grovt overslag, ikke medisinsk råd; snakk med lege eller ernæringsfysiolog ved spørsmål om kosthold og helse.
          </p>

          <button onClick={saveGoals} disabled={savingGoals}
            className="w-full py-3 text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all bg-accent">
            {savingGoals ? "Lagrer…" : "Lagre mål"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function WeightTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: WeightPoint }[]; label?: string }) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white rounded-[10px] border border-border px-3 py-2 text-[12.5px] shadow-card">
      <p className="font-[600] text-fg">{label}</p>
      <p className="text-text-2">{p.weight_kg} kg{p.avg7 != null && ` · snitt ${p.avg7} kg`}</p>
    </div>
  );
}
