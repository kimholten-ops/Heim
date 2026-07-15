import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { todayISO, addDays } from "@/lib/nutrition";

// Kompakt, aldri rå logg — bygger korte tekstblokker til veileder-konteksten.
// Sender ALDRI: navn på andre medlemmer, vektlogg, eller data fra andre enn
// innlogget medlem. Vektlogg er bevisst utelatt helt (ikke bare "med mindre
// spørsmålet handler om vekt") — å oppdage at et spørsmål "handler om vekt"
// krever intent-gjetting vi ikke gjør oss skyldig i her; brukeren kan alltid
// oppgi vekt selv i chatten om det er relevant.

type Sb = SupabaseClient<Database>;

// Mandag i uken til den gitte datoen (ISO 8601-uke), brukt som cache-nøkkel
// for ukesgjennomgangen (én per medlem per uke).
export function isoWeekStart(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  const dow = d.getDay(); // 0 = søndag … 6 = lørdag
  const diff = dow === 0 ? 6 : dow - 1; // dager siden mandag
  return addDays(dateISO, -diff);
}

// ---------- Profilblokk (cached) ----------
export async function buildProfileBlock(supabase: Sb, memberId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("health_profiles").select("kcal_target, protein_target_g").eq("member_id", memberId).maybeSingle();

  const lines = ["Brukerens mål:"];
  if (profile?.kcal_target || profile?.protein_target_g) {
    if (profile.kcal_target) lines.push(`- Kalorimål: ${profile.kcal_target} kcal/dag`);
    if (profile.protein_target_g) lines.push(`- Proteinmål: ${profile.protein_target_g} g/dag`);
  } else {
    lines.push("- Ingen mål satt ennå.");
  }
  return lines.join("\n");
}

// ---------- Trening: aggregert siste 4 uker ----------
type SetRow = { exercise_id: string; weight_kg: number | null; reps: number | null; completed: boolean };
type SessionRow = { id: string; started_at: string; finished_at: string | null; workout_sets: SetRow[] };

export async function buildTrainingContext(supabase: Sb, memberId: string): Promise<string> {
  const since = addDays(todayISO(), -28);
  const { data } = await supabase
    .from("workout_sessions")
    .select("id, started_at, finished_at, workout_sets(exercise_id, weight_kg, reps, completed)")
    .eq("member_id", memberId)
    .gte("started_at", `${since}T00:00:00`)
    .order("started_at");
  const sessions = (data ?? []) as unknown as SessionRow[];
  const finished = sessions.filter((s) => s.finished_at);

  if (finished.length === 0) {
    return "Trening (siste 4 uker): ingen fullførte økter logget.";
  }

  const { data: exerciseRows } = await supabase.from("exercises").select("id, name_no");
  const nameById = new Map((exerciseRows ?? []).map((e) => [e.id, e.name_no]));

  const midpoint = finished[0].started_at.slice(0, 10) < finished[finished.length - 1].started_at.slice(0, 10)
    ? finished[Math.floor(finished.length / 2)].started_at
    : finished[0].started_at;

  const byExercise = new Map<string, { early: number[]; late: number[]; best: { weight: number; reps: number } }>();
  for (const s of finished) {
    const isLate = s.started_at >= midpoint;
    for (const set of s.workout_sets) {
      if (!set.completed || set.weight_kg == null) continue;
      const entry = byExercise.get(set.exercise_id) ?? { early: [], late: [], best: { weight: 0, reps: 0 } };
      (isLate ? entry.late : entry.early).push(set.weight_kg);
      if (set.weight_kg > entry.best.weight) entry.best = { weight: set.weight_kg, reps: set.reps ?? 0 };
      byExercise.set(set.exercise_id, entry);
    }
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const lines: string[] = [`Trening (siste 4 uker, ${finished.length} økter, ~${(finished.length / 4).toFixed(1)} økter/uke):`];
  let count = 0;
  for (const [exerciseId, e] of byExercise) {
    if (count >= 12) break; // maks ~40 linjer totalt — én linje per øvelse
    const name = nameById.get(exerciseId) ?? exerciseId;
    const earlyAvg = avg(e.early);
    const lateAvg = avg(e.late);
    let trend = "flat";
    if (earlyAvg != null && lateAvg != null && earlyAvg > 0) {
      const pct = (lateAvg - earlyAvg) / earlyAvg;
      trend = pct > 0.02 ? "opp" : pct < -0.02 ? "ned" : "flat";
    }
    lines.push(`- ${name}: beste sett ${e.best.weight} kg x ${e.best.reps} reps, trend ${trend}`);
    count++;
  }
  return lines.join("\n");
}

// ---------- Trening: kun inneværende uke (til ukesgjennomgangen) ----------
export async function buildWeekTrainingContext(supabase: Sb, memberId: string): Promise<string> {
  const weekStart = isoWeekStart(todayISO());
  const { data } = await supabase
    .from("workout_sessions")
    .select("id, started_at, finished_at, workout_sets(exercise_id, weight_kg, reps, completed)")
    .eq("member_id", memberId)
    .gte("started_at", `${weekStart}T00:00:00`)
    .order("started_at");
  const finished = ((data ?? []) as unknown as SessionRow[]).filter((s) => s.finished_at);

  if (finished.length === 0) {
    return "Trening denne uken: ingen fullførte økter logget.";
  }

  const { data: exerciseRows } = await supabase.from("exercises").select("id, name_no");
  const nameById = new Map((exerciseRows ?? []).map((e) => [e.id, e.name_no]));

  const perExercise = new Map<string, number>(); // beste vekt denne uken
  for (const s of finished) {
    for (const set of s.workout_sets) {
      if (!set.completed || set.weight_kg == null) continue;
      const best = perExercise.get(set.exercise_id) ?? 0;
      if (set.weight_kg > best) perExercise.set(set.exercise_id, set.weight_kg);
    }
  }

  const lines = [`Trening denne uken: ${finished.length} fullførte økter.`];
  for (const [exerciseId, weight] of perExercise) {
    lines.push(`- ${nameById.get(exerciseId) ?? exerciseId}: beste sett ${weight} kg`);
  }
  return lines.join("\n");
}

// ---------- Kosthold: dagens sum + ukens snitt ----------
export async function buildKostholdContext(supabase: Sb, memberId: string): Promise<string> {
  const today = todayISO();
  const weekStart = addDays(today, -6);

  const [{ data: profile }, { data: todayRows }, { data: weekRows }] = await Promise.all([
    supabase.from("health_profiles").select("kcal_target, protein_target_g").eq("member_id", memberId).maybeSingle(),
    supabase.from("food_log_entries").select("kcal, protein_g, karbo_g, fett_g").eq("member_id", memberId).eq("date", today),
    supabase.from("food_log_entries").select("date, kcal").eq("member_id", memberId).gte("date", weekStart).lte("date", today),
  ]);

  const sum = (todayRows ?? []).reduce(
    (s, r) => ({ kcal: s.kcal + r.kcal, protein_g: s.protein_g + r.protein_g, karbo_g: s.karbo_g + r.karbo_g, fett_g: s.fett_g + r.fett_g }),
    { kcal: 0, protein_g: 0, karbo_g: 0, fett_g: 0 }
  );
  const byDate = new Map<string, number>();
  for (const r of weekRows ?? []) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.kcal);
  const daysWithData = byDate.size || 1;
  const weekAvgKcal = Array.from(byDate.values()).reduce((a, b) => a + b, 0) / daysWithData;

  const lines = [
    "Kosthold i dag:",
    `- Logget: ${Math.round(sum.kcal)} kcal, ${Math.round(sum.protein_g)} g protein, ${Math.round(sum.karbo_g)} g karbo, ${Math.round(sum.fett_g)} g fett`,
    profile?.kcal_target ? `- Kalorimål: ${profile.kcal_target} kcal/dag` : "- Ingen kalorimål satt.",
    profile?.protein_target_g ? `- Proteinmål: ${profile.protein_target_g} g/dag` : "",
    `- Ukens snitt (dager med loggføring): ${Math.round(weekAvgKcal)} kcal/dag`,
  ].filter(Boolean);
  return lines.join("\n");
}

// ---------- Middag i dag fra ukesmenyen ----------
export async function buildMealContext(supabase: Sb, householdId: string): Promise<string> {
  const { data: meal } = await supabase
    .from("meals").select("title").eq("household_id", householdId).eq("date", todayISO()).maybeSingle();
  return meal?.title ? `Middag planlagt i dag: ${meal.title}` : "Ingen middag planlagt i dag i ukesmenyen.";
}

// ---------- Gjenstående kcal/protein i dag (for måltidsforslag) ----------
export async function buildRemainingToday(supabase: Sb, memberId: string): Promise<{ kcalLeft: number | null; proteinLeft: number | null; context: string }> {
  const today = todayISO();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("health_profiles").select("kcal_target, protein_target_g").eq("member_id", memberId).maybeSingle(),
    supabase.from("food_log_entries").select("kcal, protein_g").eq("member_id", memberId).eq("date", today),
  ]);
  const sum = (rows ?? []).reduce((s, r) => ({ kcal: s.kcal + r.kcal, protein_g: s.protein_g + r.protein_g }), { kcal: 0, protein_g: 0 });
  const kcalLeft = profile?.kcal_target != null ? Math.max(0, Math.round(profile.kcal_target - sum.kcal)) : null;
  const proteinLeft = profile?.protein_target_g != null ? Math.max(0, Math.round(profile.protein_target_g - sum.protein_g)) : null;

  const lines = [
    `Logget i dag: ${Math.round(sum.kcal)} kcal, ${Math.round(sum.protein_g)} g protein.`,
    kcalLeft != null ? `Gjenstående i dag: ~${kcalLeft} kcal.` : "Ingen kalorimål satt.",
    proteinLeft != null ? `Gjenstående protein: ~${proteinLeft} g.` : "",
  ].filter(Boolean);
  return { kcalLeft, proteinLeft, context: lines.join("\n") };
}
