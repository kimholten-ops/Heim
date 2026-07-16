// Delte hjelpefunksjoner for treningsmodulen.

export type Exercise = {
  id: string;
  name_no: string;
  name_en: string;
  muscle_groups: string[];
  equipment: string | null;
  level: string | null;
  instructions_no: string[];
  image_urls: string[];
};

export type WorkoutSet = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  completed: boolean;
};

// Epley-formelen: est. 1RM = vekt × (1 + reps / 30).
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function formatKg(kg: number): string {
  return (Math.round(kg * 10) / 10).toLocaleString("nb-NO");
}

export function tonnage(sets: { reps: number | null; weight_kg: number | null; completed: boolean }[]): number {
  return sets
    .filter((s) => s.completed && s.reps != null && s.weight_kg != null)
    .reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
}

export function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "—";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}t ${m}min` : `${h}t`;
}

// Grovt MET-basert forbrenningsestimat (kcal = MET × kroppsvekt(kg) × timer).
// Bevisst konservativt i valg av MET-verdier — PWA-en har ingen tilgang til
// puls/HealthKit, så dette skal aldri late som presisjon det ikke har.
const MET_BY_SESSION_TYPE: Record<string, number> = {
  styrke: 5.0,
  cardio: 7.0,
  yoga: 2.5,
  mobilitet: 2.3,
  annet: 4.0,
};
const DEFAULT_BODY_WEIGHT_KG = 75;

export function estimateSessionCalories(sessionType: string, durationMinutes: number, bodyWeightKg: number | null): number {
  const met = MET_BY_SESSION_TYPE[sessionType] ?? MET_BY_SESSION_TYPE.annet;
  const weight = bodyWeightKg ?? DEFAULT_BODY_WEIGHT_KG;
  return Math.max(0, Math.round(met * weight * (durationMinutes / 60)));
}
