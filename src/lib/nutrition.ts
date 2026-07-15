// Delte hjelpefunksjoner for kosthold-modulen (mål, vektlogg, matlogging).

export type Macros = { kcal: number; protein_g: number; karbo_g: number; fett_g: number };

export function scaleMacros(per100g: Macros, grams: number): Macros {
  const factor = grams / 100;
  return {
    kcal: Math.round(per100g.kcal * factor * 10) / 10,
    protein_g: Math.round(per100g.protein_g * factor * 10) / 10,
    karbo_g: Math.round(per100g.karbo_g * factor * 10) / 10,
    fett_g: Math.round(per100g.fett_g * factor * 10) / 10,
  };
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

// Et loggbart element, uansett hvilken av de tre kildene det kom fra —
// felles form brukt for søkeresultater, "Nylige" og "Favoritter".
export type LoggableItem = {
  key: string; // "mv:<id>" | "kl:<ean>" | "custom:<navn>"
  label: string;
  source: "matvaretabellen" | "butikkvare" | "egendefinert";
  per100g: Macros | null; // null = butikkvare uten næringsdata (kan ikke velges)
  matvareId?: string;
  product?: unknown;
};

// Husk siste gram-valg per matvare (quality-of-life, ikke kritisk data — greit i localStorage).
export function getLastGrams(key: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`heim-food-grams-${key}`);
  return raw ? Number(raw) : null;
}
export function setLastGrams(key: string, grams: number): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(`heim-food-grams-${key}`, String(grams)); } catch {}
}

// Favoritter er også en ren quality-of-life-liste (ikke husstands-delt data),
// derfor localStorage per medlem — samme mønster som useModuleSettings.
function favoritesKey(memberId: string): string {
  return `heim-food-favorites-${memberId}`;
}
export function getFavorites(memberId: string): LoggableItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(favoritesKey(memberId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export function toggleFavorite(memberId: string, item: LoggableItem): LoggableItem[] {
  const current = getFavorites(memberId);
  const exists = current.some((f) => f.key === item.key);
  const next = exists ? current.filter((f) => f.key !== item.key) : [...current, item];
  if (typeof window !== "undefined") {
    try { localStorage.setItem(favoritesKey(memberId), JSON.stringify(next)); } catch {}
  }
  return next;
}
