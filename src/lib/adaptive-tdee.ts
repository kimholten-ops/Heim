import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { todayISO, addDays } from "@/lib/nutrition";

// Adaptiv TDEE (samme prinsipp som MacroFactor): i stedet for å stole
// blindt på en Mifflin-St Jeor-formel, sammenligner vi hva medlemmet
// FAKTISK har spist mot hva vekta FAKTISK har gjort de siste to ukene, og
// regner ut hva det egentlige vedlikeholdsnivået må ha vært. Siden
// kcal_target i denne appen allerede settes direkte til et
// vedlikeholdsestimat (kalkulatoren i KostholdCard trekker ikke fra noe
// underskudd/overskudd), kan vi foreslå et nytt kcal_target direkte —
// ingen skjult "diett-fase" å bevare.
type Sb = SupabaseClient<Database>;

const WINDOW_DAYS = 14;
const MIN_WEIGHT_ENTRIES = 4;
const MIN_LOGGED_DAYS = 5;
const KCAL_PER_KG = 7700;
const ADJUST_THRESHOLD = 150; // ikke foreslå justering for mindre enn dette
const MIN_KCAL_TARGET = 1500; // samme gulv som KostholdCard sin kalkulator

export type AdaptiveTdeeSuggestion = {
  current: number;
  suggested: number;
  diff: number;
  avgKcalLogged: number;
  weightChangeKg: number;
  daysUsed: number;
};

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export async function computeAdaptiveTdee(supabase: Sb, memberId: string): Promise<AdaptiveTdeeSuggestion | null> {
  const since = addDays(todayISO(), -WINDOW_DAYS);

  const [{ data: profile }, { data: weightRows }, { data: foodRows }] = await Promise.all([
    supabase.from("health_profiles").select("kcal_target").eq("member_id", memberId).maybeSingle(),
    supabase.from("weight_entries").select("date, weight_kg").eq("member_id", memberId).gte("date", since).order("date"),
    supabase.from("food_log_entries").select("date, kcal").eq("member_id", memberId).gte("date", since),
  ]);

  const currentTarget = profile?.kcal_target ?? null;
  if (!currentTarget) return null;

  const weights = weightRows ?? [];
  if (weights.length < MIN_WEIGHT_ENTRIES) return null;

  const byDate = new Map<string, number>();
  for (const row of foodRows ?? []) byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.kcal);
  const loggedDays = [...byDate.values()];
  if (loggedDays.length < MIN_LOGGED_DAYS) return null;
  const avgKcalLogged = avg(loggedDays);

  // Vektendring som glidende trend (snitt av første vs. siste halvdel av
  // vinduet), ikke enkeltdager — én uvanlig dag skal ikke styre forslaget.
  const mid = Math.floor(weights.length / 2);
  const earlyAvg = avg(weights.slice(0, mid).map((w) => w.weight_kg));
  const lateAvg = avg(weights.slice(mid).map((w) => w.weight_kg));
  const weightChangeKg = lateAvg - earlyAvg;

  const daysUsed = Math.max(
    1,
    (new Date(weights[weights.length - 1].date).getTime() - new Date(weights[0].date).getTime()) / 86_400_000
  );

  // Gikk vekta ned mens de spiste avgKcalLogged, er det ekte vedlikeholdet
  // høyere enn det de spiste (og motsatt ved oppgang).
  const observedMaintenance = avgKcalLogged - (weightChangeKg * KCAL_PER_KG) / daysUsed;
  const suggested = Math.max(MIN_KCAL_TARGET, Math.round(observedMaintenance / 10) * 10);
  const diff = suggested - currentTarget;
  if (Math.abs(diff) < ADJUST_THRESHOLD) return null;

  return {
    current: currentTarget,
    suggested,
    diff,
    avgKcalLogged: Math.round(avgKcalLogged),
    weightChangeKg: Math.round(weightChangeKg * 10) / 10,
    daysUsed: Math.round(daysUsed),
  };
}
