import { createClient } from "@supabase/supabase-js";

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) { out.push(" " + line.slice(i, i + 74)); i += 74; }
  return out.join("\r\n");
}
function toDate(iso: string, allDay: boolean): string {
  if (allDay) return iso.replace(/[-:]/g, "").split("T")[0];
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace(/[+-]\d{4}$/, "Z");
}
function addDay(iso: string): string {
  const d = new Date(iso); d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
const RRULE: Record<string, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};

export async function GET(_req: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: events, error } = await supabase.rpc("get_feed_events", { p_token: token });
  if (error) return new Response("Ikke funnet", { status: 404 });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Heim//Familieplanlegger//NO",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Heim", "X-WR-TIMEZONE:Europe/Oslo",
  ];

  for (const ev of (events ?? []) as { event_id: string; title: string; location: string | null; notes: string | null; start_at: string; end_at: string; all_day: boolean; recurrence: string }[]) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.event_id}@heim.app`);
    lines.push(`DTSTAMP:${stamp}`);
    if (ev.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${toDate(ev.start_at, true)}`);
      lines.push(`DTEND;VALUE=DATE:${addDay(ev.end_at)}`);
    } else {
      lines.push(`DTSTART:${toDate(ev.start_at, false)}`);
      lines.push(`DTEND:${toDate(ev.end_at, false)}`);
    }
    lines.push(fold(`SUMMARY:${esc(ev.title)}`));
    if (ev.location) lines.push(fold(`LOCATION:${esc(ev.location)}`));
    if (ev.notes) lines.push(fold(`DESCRIPTION:${esc(ev.notes)}`));
    if (ev.recurrence && ev.recurrence !== "none" && RRULE[ev.recurrence]) {
      lines.push(`RRULE:${RRULE[ev.recurrence]}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="heim.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
