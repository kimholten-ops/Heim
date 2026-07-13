// Malbasert dagens-briefing — ingen AI, ingen eksternt kall. Ren funksjon som
// settes sammen av det som uansett lastes på Hjem-skjermen (events/todos/meal).

export type BriefingEvent = { title: string; start_at: string; all_day: boolean };
// todos skal være forhåndsfiltrert av kalleren til kun de som forfaller i dag
// eller allerede er forfalt — funksjonen her filtrerer ikke selv.
export type BriefingTodo = { title: string; due_date: string | null };

const CALM_MESSAGES = [
  "Ingenting planlagt i dag — nyt roen.",
  "En åpen dag. Ingenting på planen akkurat nå.",
  "Ingen hendelser eller gjøremål i dag.",
];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Stabil "tilfeldig" indeks basert på dagens dato, så samme rolige setning
// vises hele dagen (ikke ny ved hver sideinnlasting).
function daySeed(now: Date): number {
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

export function buildDailyBriefing(
  input: { events: BriefingEvent[]; todos: BriefingTodo[]; meal?: string | null },
  now: Date = new Date()
): string {
  const { events, todos, meal } = input;
  const parts: string[] = [];

  if (events.length === 1) {
    const ev = events[0];
    parts.push(ev.all_day ? ev.title : `${ev.title} kl. ${fmtTime(ev.start_at)}`);
  } else if (events.length > 1) {
    const first = [...events].sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
    const firstLabel = first.all_day ? first.title : `${first.title} kl. ${fmtTime(first.start_at)}`;
    parts.push(`${events.length} hendelser i dag, første er ${firstLabel}`);
  }

  const todayStr = now.toISOString().split("T")[0];
  if (todos.length === 1) {
    const t = todos[0];
    const overdue = t.due_date != null && t.due_date < todayStr;
    parts.push(overdue ? `${t.title} er forfalt` : `${t.title} skal gjøres i dag`);
  } else if (todos.length > 1) {
    parts.push(`${todos.length} gjøremål venter i dag`);
  }

  if (meal) {
    parts.push(`middag: ${meal}`);
  }

  if (parts.length === 0) {
    return CALM_MESSAGES[daySeed(now) % CALM_MESSAGES.length];
  }
  if (parts.length === 1) {
    return `${capitalize(parts[0])}.`;
  }
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1);
  return `${capitalize(rest.join(", "))}, og ${last}.`;
}
