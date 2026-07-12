import ICAL from "ical.js";
import { createClient } from "@/lib/supabase/server";
import { safeFetchText } from "@/lib/safe-fetch";

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const WINDOW_PAST_MONTHS = 1;
const WINDOW_FUTURE_MONTHS = 12;

type EventRow = {
  household_id: string;
  title: string;
  location: string | null;
  notes: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
  recurrence: string;
  import_id: string;
  external_uid: string;
};

const MAX_OCCURRENCES_PER_EVENT = 500;

function toRows(icsText: string, householdId: string, importId: string, color: string): EventRow[] {
  const from = new Date();
  from.setMonth(from.getMonth() - WINDOW_PAST_MONTHS);
  const to = new Date();
  to.setMonth(to.getMonth() + WINDOW_FUTURE_MONTHS);

  const jcal = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");

  const rows: EventRow[] = [];

  for (const vevent of vevents) {
    let event: ICAL.Event;
    try {
      event = new ICAL.Event(vevent);
    } catch {
      continue;
    }
    if (!event.uid) continue;

    const title = event.summary || "Uten tittel";
    const location = event.location || null;
    const notes = event.description || null;

    if (event.isRecurring()) {
      try {
        const iterator = event.iterator();
        let next: ICAL.Time | null;
        let count = 0;
        while ((next = iterator.next()) && count < MAX_OCCURRENCES_PER_EVENT) {
          count++;
          const jsDate = next.toJSDate();
          if (jsDate > to) break;
          if (jsDate < from) continue;
          const details = event.getOccurrenceDetails(next);
          const startIso = details.startDate.toJSDate().toISOString();
          const endIso = details.endDate.toJSDate().toISOString();
          rows.push({
            household_id: householdId, title, location, notes,
            start_at: startIso, end_at: endIso, all_day: details.startDate.isDate,
            color, recurrence: "none", import_id: importId,
            external_uid: `${event.uid}-${startIso}`,
          });
        }
      } catch {
        // Ugyldig gjentakelsesregel — hopp over denne hendelsen, fortsett med resten.
        continue;
      }
    } else {
      const startIso = event.startDate.toJSDate().toISOString();
      const endIso = (event.endDate ?? event.startDate).toJSDate().toISOString();
      rows.push({
        household_id: householdId, title, location, notes,
        start_at: startIso, end_at: endIso, all_day: event.startDate.isDate,
        color, recurrence: "none", import_id: importId,
        external_uid: event.uid,
      });
    }
  }

  return rows;
}

export async function syncCalendarImport(importId: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: imp, error: impErr } = await supabase
    .from("calendar_imports")
    .select("id, household_id, source_url, color")
    .eq("id", importId)
    .maybeSingle();
  if (impErr || !imp) return { ok: false, error: "Fant ikke importen." };

  let rows: EventRow[];
  try {
    const text = await safeFetchText(imp.source_url, {
      maxBytes: MAX_BYTES,
      timeoutMs: FETCH_TIMEOUT_MS,
      userAgent: "Heim/1.0 (+https://heim-virid.vercel.app)",
    });
    rows = toRows(text, imp.household_id, imp.id, imp.color);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Klarte ikke hente eller lese kalenderen.";
    await supabase.from("calendar_imports").update({ last_error: message }).eq("id", importId);
    return { ok: false, error: message };
  }

  const { error: upsertErr } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "import_id,external_uid" });
  if (upsertErr) {
    await supabase.from("calendar_imports").update({ last_error: upsertErr.message }).eq("id", importId);
    return { ok: false, error: upsertErr.message };
  }

  const keepUids = new Set(rows.map((r) => r.external_uid));
  const { data: existing } = await supabase
    .from("events")
    .select("id, external_uid")
    .eq("import_id", importId);
  const staleIds = (existing ?? [])
    .filter((e) => e.external_uid && !keepUids.has(e.external_uid))
    .map((e) => e.id);
  if (staleIds.length > 0) {
    await supabase.from("events").delete().in("id", staleIds);
  }

  await supabase.from("calendar_imports").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", importId);
  return { ok: true, count: rows.length };
}
