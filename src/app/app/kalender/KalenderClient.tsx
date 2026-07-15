"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/HouseholdContext";
import {
  Calendar,
  Plus, X, MapPin, RefreshCcw, ChevronLeft, ChevronRight, Rss, ClipboardPaste, Trash2, Sparkles,
} from "lucide-react";
import { Card, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/utils";
import { parseSmartAddText, type SmartAddCandidate } from "@/lib/smart-add-parse";

/* ── Types ── */
type CalView = "agenda" | "3day" | "week" | "month";

type EventItem = {
  id: string; title: string; start_at: string; end_at: string;
  all_day: boolean; color: string; location: string | null; recurrence: string;
  import_id: string | null;
  calendar_imports: { label: string } | { label: string }[] | null;
  event_members: { member_id: string }[];
};

type SmartAddRow = SmartAddCandidate & { id: string; checked: boolean };

/* ── Constants ── */
const VIEWS: { key: CalView; label: string }[] = [
  { key: "agenda", label: "Agenda" },
  { key: "3day",   label: "3 dager" },
  { key: "week",   label: "Uke" },
  { key: "month",  label: "Måned" },
];

const DAY_NAMES_SHORT = ["Man","Tir","Ons","Tor","Fre","Lør","Søn"];

const RECURRENCE_LABELS: Record<string, string> = {
  weekly:"Ukentlig", biweekly:"Annenhver uke", monthly:"Månedlig", yearly:"Årlig",
};

const RECURRENCE_OPTIONS = [
  { value: "none",     label: "Ingen gjentakelse" },
  { value: "weekly",   label: "Ukentlig" },
  { value: "biweekly", label: "Annenhver uke" },
  { value: "monthly",  label: "Månedlig" },
] as const;

function SmartAddRowCard({ row, onChange, onRemove }: {
  row: SmartAddRow; onChange: (patch: Partial<SmartAddRow>) => void; onRemove: () => void;
}) {
  return (
    <div className="rounded-[13px] p-3" style={{ border:"1px solid var(--border)", background: row.date ? "var(--surface)" : "var(--surface-2)" }}>
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={row.checked} disabled={!row.date}
          onChange={e => onChange({ checked: e.target.checked })}
          className="w-5 h-5 rounded accent-[var(--accent)] mt-1 flex-shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <input type="text" value={row.title} onChange={e => onChange({ title: e.target.value })}
            className="w-full text-[14.5px] font-[600] outline-none bg-transparent" style={{ color:"var(--foreground)" }} />
          <div className="grid grid-cols-3 gap-1.5">
            <input type="date" value={row.date ?? ""}
              onChange={e => onChange({ date: e.target.value || null, checked: e.target.value ? row.checked : false })}
              className="rounded-[8px] px-1.5 py-1.5 text-[12px] outline-none" style={{ border:"1px solid var(--border)" }} />
            <input type="time" value={row.startTime ?? ""} onChange={e => onChange({ startTime: e.target.value || null })}
              className="rounded-[8px] px-1.5 py-1.5 text-[12px] outline-none" style={{ border:"1px solid var(--border)" }} />
            <input type="time" value={row.endTime ?? ""} onChange={e => onChange({ endTime: e.target.value || null })}
              className="rounded-[8px] px-1.5 py-1.5 text-[12px] outline-none" style={{ border:"1px solid var(--border)" }} />
          </div>
          <input type="text" placeholder="Sted (valgfritt)" value={row.location ?? ""} onChange={e => onChange({ location: e.target.value || null })}
            className="w-full rounded-[8px] px-2 py-1.5 text-[12.5px] outline-none" style={{ border:"1px solid var(--border)" }} />
        </div>
        <button type="button" onClick={onRemove} className="p-1 flex-shrink-0 transition-colors hover:opacity-70"
          style={{ color:"var(--text-3)" }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getMonday(d: Date): Date {
  const r = new Date(d); const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
  r.setHours(0,0,0,0); return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nb-NO", { hour:"2-digit", minute:"2-digit" });
}

function getRange(view: CalView, anchor: Date): { start: Date; end: Date } {
  switch (view) {
    case "agenda": {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = addDays(start, 90); end.setHours(23,59,59,999);
      return { start, end };
    }
    case "3day": {
      const start = new Date(anchor); start.setHours(0,0,0,0);
      const end = addDays(anchor, 2); end.setHours(23,59,59,999);
      return { start, end };
    }
    case "week": {
      const mon = getMonday(anchor);
      const end = addDays(mon, 6); end.setHours(23,59,59,999);
      return { start: mon, end };
    }
    case "month": {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const end   = new Date(anchor.getFullYear(), anchor.getMonth()+1, 0, 23, 59, 59);
      return { start, end };
    }
  }
}

function getPeriodLabel(view: CalView, anchor: Date): string {
  switch (view) {
    case "agenda": return "Kommende hendelser";
    case "3day": {
      const end = addDays(anchor, 2);
      return `${anchor.toLocaleDateString("nb-NO",{day:"numeric",month:"short"})} – ${end.toLocaleDateString("nb-NO",{day:"numeric",month:"short"})}`;
    }
    case "week": {
      const mon = getMonday(anchor);
      const sun = addDays(mon, 6);
      return `${mon.toLocaleDateString("nb-NO",{day:"numeric",month:"short"})} – ${sun.toLocaleDateString("nb-NO",{day:"numeric",month:"short"})}`;
    }
    case "month": {
      return anchor.toLocaleDateString("nb-NO",{month:"long",year:"numeric"}).replace(/^\w/, c => c.toUpperCase());
    }
  }
}

function navigate(view: CalView, anchor: Date, dir: 1|-1): Date {
  const d = new Date(anchor);
  if (view === "3day")  d.setDate(d.getDate() + dir*3);
  if (view === "week")  d.setDate(d.getDate() + dir*7);
  if (view === "month") d.setMonth(d.getMonth() + dir);
  return d;
}

/* ── Main component ── */
export default function KalenderClient({
  householdId, aiEnabled,
}: { householdId: string|null; aiEnabled: boolean }) {
  const [supabase] = useState(() => createClient());
  const { members } = useHousehold();

  const [view, setView]       = useState<CalView>("week");
  const [anchor, setAnchor]   = useState(() => new Date());
  const [events, setEvents]   = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editEventId, setEditEventId] = useState<string|null>(null); // null = new, string = editing
  const [viewEvent, setViewEvent]     = useState<EventItem|null>(null);
  const [selectedDay, setSelectedDay] = useState<Date|null>(null);
  const [saving, setSaving]           = useState(false);

  // Form state
  const [fTitle, setFTitle]         = useState("");
  const [fDate, setFDate]           = useState(toDateStr(new Date()));
  const [fEndDate, setFEndDate]     = useState(toDateStr(new Date()));
  const [fTime, setFTime]           = useState("12:00");
  const [fEndTime, setFEndTime]     = useState("13:00");
  const [fAllDay, setFAllDay]       = useState(false);
  const [fLocation, setFLocation]   = useState("");
  const [fRecurrence, setFRecurrence] = useState<"none"|"weekly"|"biweekly"|"monthly">("none");
  const [fParticipants, setFParticipants] = useState<string[]>([]);

  // Smart Add — regelbasert tekstgjenkjenning, ingen AI
  const [smartAddMode, setSmartAddMode] = useState(false);
  const [smartAddText, setSmartAddText] = useState("");
  const [smartAddRows, setSmartAddRows] = useState<SmartAddRow[]>([]);
  const [smartAddParticipants, setSmartAddParticipants] = useState<string[]>([]);
  const [smartAddSaving, setSmartAddSaving] = useState(false);
  // AI-tolkning — opt-in løft over regex-parseren over. Regex-veien er
  // fortsatt default og eneste vei uten ANTHROPIC_API_KEY.
  const [smartAddAIBusy, setSmartAddAIBusy] = useState(false);
  const [smartAddAIError, setSmartAddAIError] = useState<string | null>(null);

  const allMemberIds = members.map(m => m.id);
  const allSelected  = fParticipants.length === members.length && members.length > 0;

  function toggleParticipant(id: string) {
    setFParticipants(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  const fetchEvents = useCallback(async () => {
    if (!householdId) { setLoading(false); return; }
    setLoading(true);
    const { start, end } = getRange(view, anchor);
    const { data } = await supabase
      .from("events")
      .select("id,title,start_at,end_at,all_day,color,location,recurrence,import_id,calendar_imports(label),event_members(member_id)")
      .eq("household_id", householdId)
      .gte("start_at", start.toISOString())
      .lte("start_at", end.toISOString())
      .order("start_at");
    setEvents((data ?? []) as unknown as EventItem[]);
    setLoading(false);
  }, [householdId, view, anchor, supabase]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  /* ─ Form ─ */
  function resetForm() {
    setFTitle(""); setFLocation(""); setFRecurrence("none");
    setFAllDay(false); setFTime("12:00"); setFEndTime("13:00");
    setFParticipants([]); setEditEventId(null); setSelectedDay(null);
    resetSmartAdd();
  }

  /* ─ Smart Add ─ */
  function resetSmartAdd() {
    setSmartAddMode(false); setSmartAddText(""); setSmartAddRows([]);
    setSmartAddParticipants([]); setSmartAddSaving(false);
    setSmartAddAIBusy(false); setSmartAddAIError(null);
  }

  function runSmartAddParse() {
    const parsed = parseSmartAddText(smartAddText);
    setSmartAddRows(parsed.map(c => ({ ...c, id: crypto.randomUUID(), checked: c.confidence === "high" })));
  }

  type AIEvent = { title: string; date: string; startTime: string | null; endTime: string | null; location: string | null; notes: string | null };

  async function submitSmartAddAI(payload: { text?: string; imageBase64?: string; mediaType?: string }) {
    setSmartAddAIBusy(true);
    setSmartAddAIError(null);
    try {
      const res = await fetch("/api/ai/smart-add", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSmartAddAIError(json.error ?? "Kunne ikke tolke med AI akkurat nå.");
        return;
      }
      const events: AIEvent[] = json.events ?? [];
      setSmartAddMode(true);
      setSmartAddRows(events.map((e) => ({
        title: e.title, date: e.date, startTime: e.startTime, endTime: e.endTime,
        location: e.location, raw: e.notes ?? e.title, confidence: "high",
        id: crypto.randomUUID(), checked: true,
      })));
    } catch {
      setSmartAddAIError("Kunne ikke tolke med AI akkurat nå.");
    }
    setSmartAddAIBusy(false);
  }

  // Skalerer bildet til maks ~1568px lengste side og prøver progressivt
  // lavere JPEG-kvalitet til det er under ~1 MB, før det sendes som base64.
  async function compressImageForAI(file: File): Promise<{ data: string; mediaType: string }> {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1568;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    let quality = 0.85;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length * 0.75 > 1_000_000 && quality > 0.4) {
      quality -= 0.15;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
  }

  async function handleSmartAddImage(file: File) {
    const { data, mediaType } = await compressImageForAI(file);
    await submitSmartAddAI({ imageBase64: data, mediaType });
  }

  function updateSmartAddRow(id: string, patch: Partial<SmartAddRow>) {
    setSmartAddRows(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function removeSmartAddRow(id: string) {
    setSmartAddRows(rows => rows.filter(r => r.id !== id));
  }

  function addOneHour(time: string): string {
    const [h, m] = time.split(":").map(Number);
    return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  async function saveSmartAddRows() {
    if (!householdId) return;
    const toSave = smartAddRows.filter(r => r.checked && r.date);
    if (toSave.length === 0) return;
    setSmartAddSaving(true);

    for (const row of toSave) {
      const date = row.date!;
      const allDay = !row.startTime;
      const start_at = allDay
        ? new Date(`${date}T00:00:00`).toISOString()
        : new Date(`${date}T${row.startTime}`).toISOString();
      const end_at = allDay
        ? new Date(`${date}T23:59:59`).toISOString()
        : new Date(`${date}T${row.endTime ?? addOneHour(row.startTime!)}`).toISOString();

      const { data: ev } = await supabase.from("events").insert({
        id: crypto.randomUUID(), household_id: householdId, title: row.title,
        start_at, end_at, all_day: allDay, color: "#12936b",
        location: row.location, recurrence: "none",
      }).select().single();
      if (ev && smartAddParticipants.length) {
        await supabase.from("event_members").insert(smartAddParticipants.map(mid => ({ event_id: ev.id, member_id: mid })));
      }
    }

    setSmartAddSaving(false);
    resetForm();
    setShowForm(false);
    await fetchEvents();
  }

  function openAdd(day?: Date) {
    resetForm();
    const d = day ?? new Date();
    setFDate(toDateStr(d)); setFEndDate(toDateStr(d));
    setShowForm(true);
  }

  async function openEdit(ev: EventItem) {
    setViewEvent(null); // close detail sheet
    // Pre-fill form from existing event
    setEditEventId(ev.id);
    setFTitle(ev.title);
    setFLocation(ev.location ?? "");
    setFRecurrence(ev.recurrence as "none"|"weekly"|"biweekly"|"monthly");
    setFAllDay(ev.all_day);

    const start = new Date(ev.start_at);
    const end   = new Date(ev.end_at);
    setFDate(toDateStr(start));
    setFEndDate(toDateStr(end));
    setFTime(`${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}`);
    setFEndTime(`${String(end.getHours()).padStart(2,"0")}:${String(end.getMinutes()).padStart(2,"0")}`);

    // Pre-fill participants
    const { data: mems } = await supabase.from("event_members").select("member_id").eq("event_id", ev.id);
    setFParticipants((mems ?? []).map(m => m.member_id));

    setShowForm(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!fTitle.trim() || !householdId) return;
    setSaving(true);

    const start_at = fAllDay ? new Date(fDate+"T00:00:00").toISOString()
      : new Date(fDate+"T"+fTime).toISOString();
    const end_at = fAllDay ? new Date((fEndDate||fDate)+"T23:59:59").toISOString()
      : new Date((fEndDate||fDate)+"T"+fEndTime).toISOString();

    const payload = {
      title: fTitle.trim(), start_at, end_at,
      all_day: fAllDay, color: "#12936b",
      location: fLocation.trim() || null,
      recurrence: fRecurrence,
    };

    if (editEventId) {
      // UPDATE existing event
      await supabase.from("events").update(payload).eq("id", editEventId);
      // Replace participants
      await supabase.from("event_members").delete().eq("event_id", editEventId);
      if (fParticipants.length) {
        await supabase.from("event_members").insert(fParticipants.map(mid => ({ event_id: editEventId, member_id: mid })));
      }
    } else {
      // INSERT new event
      const { data: ev } = await supabase.from("events")
        .insert({ household_id: householdId, ...payload }).select().single();
      if (ev && fParticipants.length) {
        await supabase.from("event_members").insert(fParticipants.map(mid => ({ event_id: ev.id, member_id: mid })));
      }
    }

    resetForm();
    setSaving(false); setShowForm(false);
    await fetchEvents();
  }

  async function deleteEvent(id: string) {
    await supabase.from("events").delete().eq("id", id);
    setViewEvent(null);
    await fetchEvents();
  }

  /* ─ Derived values for views ─ */
  function eventsOnDay(day: Date): EventItem[] {
    const s = toDateStr(day);
    return events.filter(ev => ev.start_at.startsWith(s) || toDateStr(new Date(ev.start_at)) === s);
  }

  function getParticipants(ev: EventItem) {
    return ev.event_members.map(m => memberMap[m.member_id]).filter(Boolean);
  }
  function dotColor(ev: EventItem) {
    if (ev.import_id) return ev.color;
    return getParticipants(ev)[0]?.color ?? "var(--accent)";
  }

  function importLabel(ev: EventItem): string | null {
    if (!ev.import_id) return null;
    const rel = ev.calendar_imports;
    if (!rel) return null;
    return Array.isArray(rel) ? rel[0]?.label ?? null : rel.label ?? null;
  }

  /* ─ Day row used in agenda / 3-day / week views ─ */
  function DayBlock({ day, divider = false }: { day: Date; divider?: boolean }) {
    const dayEvs  = eventsOnDay(day);
    const isToday = toDateStr(day) === toDateStr(new Date());
    const label   = day.toLocaleDateString("nb-NO",{weekday:"long",day:"numeric",month:"long"})
                       .replace(/^\w/, c => c.toUpperCase());

    return (
      <div className={cn(divider && "border-t border-[var(--border)] pt-3")}>
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-full flex flex-col items-center justify-center flex-shrink-0",
              isToday ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)]")}>
              <span className={cn("text-[14px] font-[700] leading-none", isToday ? "text-white" : "text-[var(--foreground)]")}>
                {day.getDate()}
              </span>
            </div>
            <span className={cn("text-[13px] font-[600] capitalize",
              isToday ? "text-[var(--accent)]" : "text-[var(--text-3)]")}>
              {label}
            </span>
          </div>
          <button onClick={() => openAdd(day)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--accent-weak)] transition-colors">
            <Plus size={15} strokeWidth={2.5} />
          </button>
        </div>

        {dayEvs.length > 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[14px] overflow-hidden"
            style={{ boxShadow:"0 1px 2px rgba(20,22,28,.04),0 2px 8px rgba(20,22,28,.05)" }}>
            {dayEvs.map((ev, i) => {
              const parts = getParticipants(ev);

              return (
                <button key={ev.id} onClick={() => setViewEvent(ev)}
                  className={cn("w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors",
                    i > 0 && "border-t border-[var(--border)]")}>
                  <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: dotColor(ev) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-[600] text-[var(--foreground)]">{ev.title}</p>
                    <p className="text-[12.5px] text-[var(--text-2)] mt-0.5 flex items-center gap-1 flex-wrap">
                      <span>{ev.all_day ? "Hele dagen" : `${fmtTime(ev.start_at)}–${fmtTime(ev.end_at)}`}</span>
                      {ev.location && (
                        <span className="flex items-center gap-0.5">· <MapPin size={11} strokeWidth={2} /> {ev.location}</span>
                      )}
                      {ev.recurrence !== "none" && RECURRENCE_LABELS[ev.recurrence] && (
                        <span className="flex items-center gap-0.5">· <RefreshCcw size={11} strokeWidth={2} /> {RECURRENCE_LABELS[ev.recurrence]}</span>
                      )}
                      {importLabel(ev) && (
                        <span className="flex items-center gap-0.5">· <Rss size={11} strokeWidth={2} /> {importLabel(ev)}</span>
                      )}
                    </p>
                  </div>
                  {parts.length > 0 && (
                    <div className="flex -space-x-1 flex-shrink-0">
                      {parts.slice(0,3).map(m => (
                        <span key={m.id} className="w-[20px] h-[20px] rounded-full border border-white flex items-center justify-center text-[10px] font-[700] text-white"
                          style={{ background: m.color }}>
                          {m.name[0]?.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <button onClick={() => openAdd(day)}
            className="w-full border border-dashed border-[var(--border)] rounded-[14px] px-4 py-2.5 text-[13px] text-[var(--text-3)] text-left hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            + Legg til hendelse
          </button>
        )}
      </div>
    );
  }

  /* ─ Render views ─ */
  const isAgenda    = view === "agenda";
  const canNavigate = view !== "agenda";

  const listDays: Date[] = (() => {
    if (view === "3day")  return [0,1,2].map(i => addDays(anchor,i));
    if (view === "week")  return [0,1,2,3,4,5,6].map(i => addDays(getMonday(anchor),i));
    return [];
  })();

  const monthGridDays: Date[] = (() => {
    if (view !== "month") return [];
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = getMonday(first);
    return Array.from({length:42}, (_, i) => addDays(start, i));
  })();

  const agendaGrouped: [string, EventItem[]][] = (() => {
    if (view !== "agenda") return [];
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      const key = ev.start_at.slice(0,10);
      if (!map.has(key)) map.set(key,[]);
      map.get(key)!.push(ev);
    }
    return [...map.entries()];
  })();

  return (
    <div className="max-w-[420px] mx-auto">
      {/* Header */}
      <div className="px-[18px] pt-[14px] pb-3 flex items-center justify-between"
        style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
        <div>
          <p className="text-[12px] font-[600] uppercase tracking-[0.07em]" style={{ color:"var(--text-3)" }}>Kalender</p>
          <p className="text-[15px] font-[700]" style={{ color:"var(--foreground)" }}>{getPeriodLabel(view, anchor)}</p>
        </div>
        <button onClick={() => openAdd()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[11px] text-white text-[13px] font-[600] hover:opacity-90 active:scale-95 transition-all"
          style={{ background:"var(--accent)" }}>
          <Plus size={14} strokeWidth={2.5} /> Hendelse
        </button>
      </div>

      {/* View switcher */}
      <div className="flex px-[18px] py-2 gap-1.5" style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
        {VIEWS.map(v => (
          <button key={v.key} onClick={() => { setView(v.key); if (v.key !== "agenda") setAnchor(new Date()); }}
            className={cn("flex-1 py-1.5 rounded-[8px] text-[12px] font-[600] transition-all",
              view === v.key
                ? "text-white" : "text-[var(--text-2)] hover:bg-[var(--surface-2)]")}
            style={view === v.key ? { background:"var(--accent)" } : {}}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Navigation bar (not for agenda) */}
      {canNavigate && (
        <div className="flex items-center justify-between px-[18px] py-2"
          style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
          <button onClick={() => setAnchor(a => navigate(view, a, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface-2)] transition-colors">
            <ChevronLeft size={18} strokeWidth={2} style={{ color:"var(--text-2)" }} />
          </button>
          <button onClick={() => setAnchor(new Date())}
            className="text-[12.5px] font-[600] px-3 py-1 rounded-full hover:bg-[var(--accent-weak)] transition-colors"
            style={{ color:"var(--accent)" }}>
            I dag
          </button>
          <button onClick={() => setAnchor(a => navigate(view, a, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface-2)] transition-colors">
            <ChevronRight size={18} strokeWidth={2} style={{ color:"var(--text-2)" }} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-[18px] py-4 pb-28 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16 text-[var(--text-3)] text-[14px]">Laster…</div>
        ) : (

          /* ── AGENDA ── */
          view === "agenda" ? (
            <div className="space-y-3">
              {agendaGrouped.length === 0 ? (
                <Card>
                  <div className="flex items-center gap-3 px-4 py-4 text-[14.5px]" style={{ color:"var(--text-2)" }}>
                    <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{ background:"var(--surface-2)", color:"var(--text-3)" }}>
                      <Calendar size={18} strokeWidth={1.7} />
                    </span>
                    Ingen kommende hendelser
                  </div>
                </Card>
              ) : agendaGrouped.map(([dateStr, dayEvs], gi) => {
                const d = new Date(dateStr+"T12:00:00");
                const isToday = dateStr === toDateStr(new Date());
                const label = isToday ? "I dag"
                  : d.toLocaleDateString("nb-NO",{weekday:"long",day:"numeric",month:"long"})
                      .replace(/^\w/, c => c.toUpperCase());
                return (
                  <div key={dateStr}>
                    <p className={cn("text-[12px] font-[600] uppercase tracking-[0.06em] mb-1.5 px-1",
                      isToday ? "text-[var(--accent)]" : "text-[var(--text-3)]")}>
                      {label}
                    </p>
                    <div className="bg-white border border-[var(--border)] rounded-[14px] overflow-hidden"
                      style={{ boxShadow:"0 1px 2px rgba(20,22,28,.04),0 2px 8px rgba(20,22,28,.05)" }}>
                      {dayEvs.map((ev, i) => {
                        const parts = getParticipants(ev);
                        return (
                          <button key={ev.id} onClick={() => setViewEvent(ev)}
                            className={cn("w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors",
                              i > 0 && "border-t border-[var(--border)]")}>
                            <div className="w-1 self-stretch rounded-full mt-0.5" style={{ background: dotColor(ev) }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-[600]" style={{ color:"var(--foreground)" }}>{ev.title}</p>
                              <p className="text-[12.5px] mt-0.5 flex items-center gap-1 flex-wrap" style={{ color:"var(--text-2)" }}>
                                <span>{ev.all_day ? "Hele dagen" : `${fmtTime(ev.start_at)}–${fmtTime(ev.end_at)}`}</span>
                                {ev.location && (
                                  <span className="flex items-center gap-0.5">· <MapPin size={11} strokeWidth={2} /> {ev.location}</span>
                                )}
                                {ev.recurrence !== "none" && RECURRENCE_LABELS[ev.recurrence] && (
                                  <span className="flex items-center gap-0.5">· <RefreshCcw size={11} strokeWidth={2} /> {RECURRENCE_LABELS[ev.recurrence]}</span>
                                )}
                                {importLabel(ev) && (
                                  <span className="flex items-center gap-0.5">· <Rss size={11} strokeWidth={2} /> {importLabel(ev)}</span>
                                )}
                              </p>
                            </div>
                            {parts.length > 0 && (
                              <div className="flex -space-x-1 flex-shrink-0">
                                {parts.slice(0,3).map(m => (
                                  <span key={m.id} className="w-[20px] h-[20px] rounded-full border border-white flex items-center justify-center text-[10px] font-[700] text-white"
                                    style={{ background:m.color }}>
                                    {m.name[0]?.toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

          /* ── 3-DAY / WEEK ── */
          ) : view === "3day" || view === "week" ? (
            <div className="space-y-4">
              {listDays.map((day, i) => <DayBlock key={i} day={day} divider={i > 0} />)}
            </div>

          /* ── MONTH ── */
          ) : (
            <div>
              {/* Day name header */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_NAMES_SHORT.map(d => (
                  <div key={d} className="text-center text-[10px] font-[600] uppercase tracking-[0.05em] py-1.5"
                    style={{ color:"var(--text-3)" }}>{d}</div>
                ))}
              </div>
              {/* Grid */}
              <div className="grid grid-cols-7 gap-px" style={{ background:"var(--border)", borderRadius:"14px", overflow:"hidden" }}>
                {monthGridDays.map((day, idx) => {
                  const dayEvs      = eventsOnDay(day);
                  const inMonth     = day.getMonth() === anchor.getMonth();
                  const isToday     = toDateStr(day) === toDateStr(new Date());
                  const hasEvents   = dayEvs.length > 0;

                  return (
                    <button key={idx} onClick={() => openAdd(day)}
                      className="flex flex-col items-center pt-1.5 pb-2 min-h-[54px] transition-colors hover:opacity-80"
                      style={{ background: inMonth ? "var(--surface)" : "var(--surface-2)", opacity: inMonth ? 1 : 0.4 }}>
                      <span className={cn("text-[13px] font-[700] w-6 h-6 flex items-center justify-center rounded-full mb-1",
                        isToday ? "text-white" : "text-[var(--foreground)]")}
                        style={isToday ? { background:"var(--accent)" } : {}}>
                        {day.getDate()}
                      </span>
                      {/* Event dots / labels */}
                      {hasEvents && (
                        <div className="flex gap-[3px] flex-wrap justify-center px-1">
                          {dayEvs.slice(0,3).map(ev => (
                            <span key={ev.id} className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                              style={{ background: dotColor(ev) }} />
                          ))}
                        </div>
                      )}
                      {dayEvs.length > 0 && (
                        <span className="text-[9px] mt-0.5 font-[600] truncate max-w-[42px]"
                          style={{ color:"var(--text-3)" }}>
                          {dayEvs.length > 1 ? `${dayEvs.length} stk` : dayEvs[0].title}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Month event list below grid */}
              {events.length > 0 && (
                <div className="mt-5 space-y-3">
                  <SectionLabel title="Denne måneden" />
                  <div className="bg-white border border-[var(--border)] rounded-[14px] overflow-hidden"
                    style={{ boxShadow:"0 1px 2px rgba(20,22,28,.04),0 2px 8px rgba(20,22,28,.05)" }}>
                    {events.map((ev, i) => {
                      const d = new Date(ev.start_at);
                      return (
                        <button key={ev.id} onClick={() => setViewEvent(ev)}
                          className={cn("w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors",
                            i > 0 && "border-t border-[var(--border)]")}>
                          <div className="w-9 h-9 rounded-[10px] flex flex-col items-center justify-center flex-shrink-0"
                            style={{ background:"var(--surface-2)" }}>
                            <span className="text-[14px] font-[700] leading-none" style={{ color:"var(--foreground)" }}>{d.getDate()}</span>
                            <span className="text-[9px] font-[600] uppercase" style={{ color:"var(--text-3)" }}>
                              {d.toLocaleDateString("nb-NO",{weekday:"short"})}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-[600] truncate" style={{ color:"var(--foreground)" }}>{ev.title}</p>
                            <p className="text-[12px] flex items-center gap-1 flex-wrap" style={{ color:"var(--text-2)" }}>
                              <span>{ev.all_day ? "Hele dagen" : fmtTime(ev.start_at)}</span>
                              {ev.location && (
                                <span className="flex items-center gap-0.5">· <MapPin size={10} strokeWidth={2} /> {ev.location}</span>
                              )}
                            </p>
                          </div>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor(ev) }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        )}

      </div>

      {/* ── Add event sheet ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background:"rgba(0,0,0,.4)", backdropFilter:"blur(4px)" }}
          onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background:"var(--border)" }} />
            <h2 className="text-[19px] font-[700] mb-4" style={{ color:"var(--foreground)" }}>
              {editEventId ? "Rediger hendelse" : "Ny hendelse"}
            </h2>

            {!editEventId && !smartAddMode && (
              <div className="flex gap-2 mb-4">
                <button type="button" onClick={() => setSmartAddMode(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[13px] border border-dashed text-[13.5px] font-[600] transition-colors"
                  style={{ borderColor:"var(--accent)", color:"var(--accent)" }}>
                  <ClipboardPaste size={14} strokeWidth={2} /> Lim inn tekst
                </button>
                {aiEnabled && (
                  <>
                    <button type="button" onClick={() => document.getElementById("smart-add-image-input")?.click()}
                      disabled={smartAddAIBusy}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[13px] border border-dashed text-[13.5px] font-[600] transition-colors disabled:opacity-40"
                      style={{ borderColor:"var(--accent)", color:"var(--accent)" }}>
                      <Sparkles size={14} strokeWidth={2} /> {smartAddAIBusy ? "Tolker…" : "Last opp bilde"}
                    </button>
                    <input id="smart-add-image-input" type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSmartAddImage(f); e.target.value = ""; }} />
                  </>
                )}
              </div>
            )}
            {!editEventId && !smartAddMode && smartAddAIError && (
              <p className="text-[12.5px] mb-3" style={{ color:"#e11d48" }}>{smartAddAIError}</p>
            )}

            {smartAddMode ? (
              <div className="space-y-3">
                {smartAddRows.length === 0 ? (
                  <>
                    <textarea rows={6} value={smartAddText} onChange={e => setSmartAddText(e.target.value)} autoFocus
                      placeholder="Lim inn teksten her — f.eks. fra en e-post om ukeplanen"
                      className="w-full rounded-[13px] px-4 py-3 text-[14.5px] outline-none resize-none"
                      style={{ border:"1px solid var(--border)" }} />
                    <p className="text-[12px]" style={{ color:"var(--text-3)" }}>
                      Vi prøver å finne datoer og tidspunkt automatisk — sjekk alltid gjennom forslagene.
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={runSmartAddParse} disabled={!smartAddText.trim()}
                        className="flex-1 py-3 rounded-[13px] text-white font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all"
                        style={{ background:"var(--accent)" }}>
                        Tolk tekst
                      </button>
                      <button type="button" onClick={resetSmartAdd}
                        className="px-4 py-3 rounded-[13px] text-[14px] transition-colors"
                        style={{ border:"1px solid var(--border)", color:"var(--text-2)" }}>
                        Avbryt
                      </button>
                    </div>
                    {aiEnabled && (
                      <button type="button" onClick={() => submitSmartAddAI({ text: smartAddText })}
                        disabled={!smartAddText.trim() || smartAddAIBusy}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[13px] text-[13.5px] font-[600] transition-colors disabled:opacity-40"
                        style={{ border:"1px solid var(--accent)", color:"var(--accent)" }}>
                        <Sparkles size={14} strokeWidth={2} /> {smartAddAIBusy ? "Tolker…" : "Tolk med AI i stedet"}
                      </button>
                    )}
                    {smartAddAIError && (
                      <p className="text-[12.5px]" style={{ color:"#e11d48" }}>{smartAddAIError}</p>
                    )}
                  </>
                ) : (() => {
                  const withDate = smartAddRows.filter(r => r.date);
                  const withoutDate = smartAddRows.filter(r => !r.date);
                  const checkedCount = smartAddRows.filter(r => r.checked && r.date).length;
                  return (
                    <>
                      {smartAddRows.length === 0 ? (
                        <p className="text-[13.5px] text-center py-4" style={{ color:"var(--text-3)" }}>
                          Fant ingenting å foreslå. Prøv å fylle ut skjemaet direkte i stedet.
                        </p>
                      ) : (
                        <>
                          {withDate.map(row => (
                            <SmartAddRowCard key={row.id} row={row}
                              onChange={p => updateSmartAddRow(row.id, p)}
                              onRemove={() => removeSmartAddRow(row.id)} />
                          ))}
                          {withoutDate.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[11px] font-[600] uppercase tracking-[0.07em] pt-1" style={{ color:"var(--text-3)" }}>
                                Usikre linjer — fyll inn dato for å ta med
                              </p>
                              {withoutDate.map(row => (
                                <SmartAddRowCard key={row.id} row={row}
                                  onChange={p => updateSmartAddRow(row.id, p)}
                                  onRemove={() => removeSmartAddRow(row.id)} />
                              ))}
                            </div>
                          )}
                          {members.length > 0 && (
                            <div>
                              <p className="text-[11px] font-[600] uppercase tracking-[0.07em] mb-2" style={{ color:"var(--text-3)" }}>
                                Hvem deltar? (gjelder valgte hendelser)
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {members.map(m => {
                                  const sel = smartAddParticipants.includes(m.id);
                                  return (
                                    <button key={m.id} type="button"
                                      onClick={() => setSmartAddParticipants(p => sel ? p.filter(x => x !== m.id) : [...p, m.id])}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-[550] transition-all"
                                      style={{
                                        border:`1px solid ${sel?m.color:"var(--border)"}`,
                                        background:sel?m.color:"transparent",
                                        color:sel?"white":"var(--foreground)",
                                      }}>
                                      <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] text-white font-[700]"
                                        style={{ background:m.color }}>{m.name[0]?.toUpperCase()}</span>
                                      {m.name.split(" ")[0]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <button type="button" onClick={saveSmartAddRows} disabled={smartAddSaving || checkedCount === 0}
                            className="w-full py-3 rounded-[13px] text-white font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all"
                            style={{ background:"var(--accent)" }}>
                            {smartAddSaving ? "Legger til…" : `Legg til ${checkedCount} hendelser`}
                          </button>
                          <button type="button" onClick={resetSmartAdd}
                            className="w-full py-2 text-[13px] transition-colors" style={{ color:"var(--text-3)" }}>
                            Avbryt
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
            <form onSubmit={saveEvent} className="space-y-3">
              <input type="text" placeholder="Tittel *" value={fTitle} onChange={e=>setFTitle(e.target.value)} autoFocus required
                className="w-full rounded-[13px] px-4 py-3 text-[15px] outline-none transition-colors"
                style={{ border:"1px solid var(--border)" }}
                onFocus={e => e.target.style.borderColor="var(--accent)"}
                onBlur={e => e.target.style.borderColor="var(--border)"} />

              <div className="flex items-center gap-3 px-4 py-3 rounded-[13px]" style={{ border:"1px solid var(--border)" }}>
                <MapPin size={16} style={{ color:"var(--text-3)", flexShrink:0 }} />
                <input type="text" placeholder="Sted (valgfritt)" value={fLocation} onChange={e=>setFLocation(e.target.value)}
                  className="flex-1 text-[15px] outline-none bg-transparent" style={{ color:"var(--foreground)" }} />
              </div>

              <label className="flex items-center gap-3 px-4 py-3 rounded-[13px] cursor-pointer" style={{ border:"1px solid var(--border)" }}>
                <input type="checkbox" checked={fAllDay} onChange={e=>setFAllDay(e.target.checked)} className="w-5 h-5 rounded accent-[var(--accent)]" />
                <span className="text-[15px]" style={{ color:"var(--foreground)" }}>Hele dagen</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                {["Fra","Til"].map((lbl, li) => (
                  <div key={lbl}>
                    <p className="text-[11px] font-[600] uppercase tracking-[0.07em] mb-1" style={{ color:"var(--text-3)" }}>{lbl}</p>
                    <input type="date" value={li===0?fDate:fEndDate}
                      onChange={e => { if (li===0){setFDate(e.target.value); if(e.target.value>fEndDate)setFEndDate(e.target.value);} else setFEndDate(e.target.value); }}
                      min={li===1?fDate:undefined}
                      className="w-full rounded-[13px] px-3 py-2.5 text-[14px] outline-none" style={{ border:"1px solid var(--border)", color:"var(--foreground)" }} />
                  </div>
                ))}
              </div>

              {!fAllDay && (
                <div className="grid grid-cols-2 gap-2">
                  {["Kl. fra","Kl. til"].map((lbl,li) => (
                    <div key={lbl}>
                      <p className="text-[11px] font-[600] uppercase tracking-[0.07em] mb-1" style={{ color:"var(--text-3)" }}>{lbl}</p>
                      <input type="time" value={li===0?fTime:fEndTime}
                        onChange={e=>{
                          if(li===0){setFTime(e.target.value); if(fDate===fEndDate&&e.target.value>=fEndTime){const[h]=e.target.value.split(":").map(Number); setFEndTime(`${String(Math.min(h+1,23)).padStart(2,"0")}:${e.target.value.split(":")[1]}`);}}
                          else setFEndTime(e.target.value);
                        }}
                        className="w-full rounded-[13px] px-3 py-2.5 text-[14px] outline-none" style={{ border:"1px solid var(--border)", color:"var(--foreground)" }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Recurrence */}
              <div className="grid grid-cols-2 gap-2">
                {RECURRENCE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setFRecurrence(opt.value as typeof fRecurrence)}
                    className={cn("py-2.5 px-3 rounded-[13px] text-[13px] font-[550] flex items-center gap-1.5 justify-center transition-all",
                      fRecurrence === opt.value ? "text-white" : "hover:opacity-80")}
                    style={{
                      border: `1px solid ${fRecurrence===opt.value ? "var(--accent)" : "var(--border)"}`,
                      background: fRecurrence===opt.value ? "var(--accent)" : "var(--surface)",
                      color: fRecurrence===opt.value ? "white" : "var(--foreground)",
                    }}>
                    {opt.value!=="none" && <RefreshCcw size={11}/>}
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Participants */}
              {members.length > 0 && (
                <div>
                  <p className="text-[11px] font-[600] uppercase tracking-[0.07em] mb-2" style={{ color:"var(--text-3)" }}>Hvem deltar?</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setFParticipants(allSelected ? [] : [...allMemberIds])}
                      className={cn("px-3 py-1.5 rounded-full text-[13px] font-[550] transition-all")}
                      style={{
                        border:`1px solid ${allSelected?"var(--foreground)":"var(--border)"}`,
                        background:allSelected?"var(--foreground)":"transparent",
                        color:allSelected?"white":"var(--foreground)",
                      }}>
                      Alle
                    </button>
                    {members.map(m => {
                      const sel = fParticipants.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleParticipant(m.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-[550] transition-all"
                          style={{
                            border:`1px solid ${sel?m.color:"var(--border)"}`,
                            background:sel?m.color:"transparent",
                            color:sel?"white":"var(--foreground)",
                          }}>
                          <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] text-white font-[700]"
                            style={{ background:m.color }}>{m.name[0]?.toUpperCase()}</span>
                          {m.name.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button type="submit" disabled={saving||!fTitle.trim()}
                className="w-full py-3 text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all"
                style={{ background:"var(--accent)" }}>
                {saving ? "Lagrer…" : editEventId ? "Lagre endringer" : "Lagre hendelse"}
              </button>
            </form>
            )}
          </div>
        </div>
      )}

      {/* ── View event sheet ── */}
      {viewEvent && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background:"rgba(0,0,0,.4)", backdropFilter:"blur(4px)" }}
          onClick={() => setViewEvent(null)}>
          <div className="bg-white rounded-t-[24px] p-6 pb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background:"var(--border)" }} />
            <div className="flex items-start gap-3">
              <div className="w-4 h-4 rounded-full mt-1.5 flex-shrink-0" style={{ background: dotColor(viewEvent) }} />
              <div className="flex-1">
                <h2 className="text-[21px] font-[700]" style={{ color:"var(--foreground)" }}>{viewEvent.title}</h2>
                <p className="text-[14px] mt-1" style={{ color:"var(--text-2)" }}>
                  {new Date(viewEvent.start_at).toLocaleDateString("nb-NO",{weekday:"long",day:"numeric",month:"long"})}
                  {!viewEvent.all_day && ` · ${fmtTime(viewEvent.start_at)}–${fmtTime(viewEvent.end_at)}`}
                </p>
                {viewEvent.location && (
                  <p className="text-[13.5px] mt-1 flex items-center gap-1.5" style={{ color:"var(--text-2)" }}>
                    <MapPin size={13} strokeWidth={2} /> {viewEvent.location}
                  </p>
                )}
                {viewEvent.recurrence !== "none" && RECURRENCE_LABELS[viewEvent.recurrence] && (
                  <p className="text-[13px] mt-0.5 flex items-center gap-1.5" style={{ color:"var(--text-3)" }}>
                    <RefreshCcw size={12} strokeWidth={2} /> {RECURRENCE_LABELS[viewEvent.recurrence]}
                  </p>
                )}
                {importLabel(viewEvent) && (
                  <p className="text-[13px] mt-0.5 flex items-center gap-1.5" style={{ color:"var(--text-3)" }}>
                    <Rss size={12} strokeWidth={2} /> Importert fra {importLabel(viewEvent)}
                  </p>
                )}
                {getParticipants(viewEvent).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {getParticipants(viewEvent).map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[13px] font-[550]"
                        style={{ background:m.color }}>
                        <span className="font-[700]">{m.name[0]?.toUpperCase()}</span>
                        {m.name.split(" ")[0]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {viewEvent.import_id ? (
              <div className="mt-5">
                <p className="text-[12.5px] mb-3" style={{ color:"var(--text-3)" }}>
                  Importerte hendelser kan ikke redigeres i Heim — fjern eller rediger dem i kildekalenderen.
                </p>
                <button onClick={() => setViewEvent(null)}
                  className="w-full py-3 rounded-[13px] font-[600] text-[14px] transition-colors hover:opacity-90"
                  style={{ background:"var(--surface-2)", color:"var(--foreground)" }}>
                  Lukk
                </button>
              </div>
            ) : (
              <div className="flex gap-3 mt-5">
                <button onClick={() => openEdit(viewEvent)}
                  className="flex-1 py-3 rounded-[13px] font-[600] text-[14px] transition-colors hover:opacity-90"
                  style={{ background:"var(--accent)", color:"white" }}>
                  Rediger
                </button>
                <button onClick={() => deleteEvent(viewEvent.id)}
                  className="flex-1 py-3 rounded-[13px] font-[550] text-[14px] transition-colors"
                  style={{ border:"1px solid #fecaca", color:"#ef4444" }}
                  onMouseEnter={e => (e.currentTarget.style.background="#fef2f2")}
                  onMouseLeave={e => (e.currentTarget.style.background="transparent")}>
                  Slett
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
