"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/HouseholdContext";
import {
  Calendar, Smartphone, Copy, Check, RefreshCw,
  Plus, X, MapPin, RefreshCcw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ── Types ── */
type CalView = "agenda" | "3day" | "week" | "month";

type EventItem = {
  id: string; title: string; start_at: string; end_at: string;
  all_day: boolean; color: string; location: string | null; recurrence: string;
  event_members: { user_id: string }[];
  event_children: { child_id: string }[];
};

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
  householdId, existingFeedToken,
}: { householdId: string|null; existingFeedToken: string|null }) {
  const [supabase] = useState(() => createClient());
  const { members } = useHousehold();

  const [view, setView]       = useState<CalView>("agenda");
  const [anchor, setAnchor]   = useState(() => new Date());
  const [events, setEvents]   = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [viewEvent, setViewEvent]     = useState<EventItem|null>(null);
  const [feedToken, setFeedToken]     = useState(existingFeedToken);
  const [feedBusy, setFeedBusy]       = useState(false);
  const [copied, setCopied]           = useState<"url"|"webcal"|null>(null);
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
      .select("id,title,start_at,end_at,all_day,color,location,recurrence,event_members(user_id),event_children(child_id)")
      .eq("household_id", householdId)
      .gte("start_at", start.toISOString())
      .lte("start_at", end.toISOString())
      .order("start_at");
    setEvents((data ?? []) as unknown as EventItem[]);
    setLoading(false);
  }, [householdId, view, anchor, supabase]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  /* ─ Feed helpers ─ */
  const origin     = typeof window !== "undefined" ? window.location.origin : "";
  const icsUrl     = feedToken ? `${origin}/api/ics/${feedToken}` : null;
  const webcalUrl  = icsUrl ? icsUrl.replace(/^https?:\/\//, "webcal://") : null;

  async function generateFeed() {
    if (!householdId) return;
    setFeedBusy(true);
    const { data: token } = await supabase.rpc("create_calendar_feed", { p_label: "Heim-kalender" });
    setFeedToken(token as string);
    setFeedBusy(false);
  }
  async function copy(type: "url"|"webcal") {
    const url = type === "webcal" ? webcalUrl : icsUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(type); setTimeout(() => setCopied(null), 2000);
  }

  /* ─ Form ─ */
  function openAdd(day?: Date) {
    const d = day ?? new Date();
    setFDate(toDateStr(d)); setFEndDate(toDateStr(d));
    setFTitle(""); setFLocation(""); setFRecurrence("none");
    setFAllDay(false); setFTime("12:00"); setFEndTime("13:00"); setFParticipants([]);
    setSelectedDay(null);
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

    const { data: ev } = await supabase.from("events").insert({
      household_id: householdId, title: fTitle.trim(), start_at, end_at,
      all_day: fAllDay, color: "#12936b",
      location: fLocation.trim() || null, recurrence: fRecurrence,
    }).select().single();

    if (ev && fParticipants.length) {
      await supabase.from("event_members").insert(fParticipants.map(uid => ({ event_id: ev.id, user_id: uid })));
    }
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
    return ev.event_members.map(m => memberMap[m.user_id]).filter(Boolean);
  }
  function dotColor(ev: EventItem) {
    return getParticipants(ev)[0]?.color ?? "var(--accent)";
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
              const sub: string[] = [];
              if (ev.all_day) sub.push("Hele dagen"); else sub.push(`${fmtTime(ev.start_at)}–${fmtTime(ev.end_at)}`);
              if (ev.location) sub.push(`📍 ${ev.location}`);
              if (ev.recurrence !== "none" && RECURRENCE_LABELS[ev.recurrence]) sub.push(`🔁 ${RECURRENCE_LABELS[ev.recurrence]}`);

              return (
                <button key={ev.id} onClick={() => setViewEvent(ev)}
                  className={cn("w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors",
                    i > 0 && "border-t border-[var(--border)]")}>
                  <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: dotColor(ev) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-[600] text-[var(--foreground)]">{ev.title}</p>
                    <p className="text-[12.5px] text-[var(--text-2)] mt-0.5">{sub.join("  ·  ")}</p>
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
                              <p className="text-[12.5px] mt-0.5" style={{ color:"var(--text-2)" }}>
                                {ev.all_day ? "Hele dagen" : `${fmtTime(ev.start_at)}–${fmtTime(ev.end_at)}`}
                                {ev.location && ` · 📍 ${ev.location}`}
                                {ev.recurrence !== "none" && RECURRENCE_LABELS[ev.recurrence] && ` · 🔁 ${RECURRENCE_LABELS[ev.recurrence]}`}
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
                            <p className="text-[12px]" style={{ color:"var(--text-2)" }}>
                              {ev.all_day ? "Hele dagen" : fmtTime(ev.start_at)}
                              {ev.location && ` · 📍 ${ev.location}`}
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

        {/* iOS feed section */}
        <div className="mt-6">
          <SectionLabel title="📱 iOS Kalender-abonnement" />
          <Card>
            <div className="px-4 py-4">
              {!feedToken ? (
                <>
                  <p className="text-[13px] mb-3" style={{ color:"var(--text-2)" }}>Abonner på Heim-kalenderen i iPhone/iPad. Enveis, automatisk oppdatering.</p>
                  <button onClick={generateFeed} disabled={feedBusy||!householdId}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[13px] text-white font-[600] text-[15px] hover:opacity-90 disabled:opacity-40 transition-all"
                    style={{ background:"var(--accent)" }}>
                    <Calendar size={16} /> {feedBusy ? "Genererer…" : "Generer kalender-URL"}
                  </button>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="rounded-[13px] p-3 flex items-center gap-2" style={{ background:"var(--surface-2)" }}>
                    <code className="flex-1 text-[11px] truncate" style={{ color:"var(--text-2)" }}>{icsUrl}</code>
                    <button onClick={() => copy("url")} className="flex-shrink-0 flex items-center gap-1 text-[13px] font-[600]" style={{ color:"var(--accent)" }}>
                      {copied==="url" ? <Check size={13}/> : <Copy size={13}/>} {copied==="url" ? "Kopiert" : "Kopier"}
                    </button>
                  </div>
                  <a href={webcalUrl??""} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[13px] text-white font-[600] text-[14px] hover:opacity-90"
                    style={{ background:"var(--accent)", display:"flex" }}>
                    <Calendar size={15}/> Åpne i Kalender-appen
                  </a>
                  <button onClick={() => copy("webcal")}
                    className="w-full py-2 rounded-[13px] text-[13px] font-[550] flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity"
                    style={{ border:"1px solid var(--border)", color:"var(--text-2)" }}>
                    {copied==="webcal" ? <Check size={13} style={{color:"var(--accent)"}}/> : <Copy size={13}/>}
                    {copied==="webcal" ? "Kopiert!" : "Kopier webcal://"}
                  </button>
                  <button onClick={async () => {
                    await supabase.from("calendar_feeds").update({revoked_at:new Date().toISOString()}).eq("token",feedToken);
                    setFeedToken(null);
                  }} className="flex items-center gap-1.5 text-[12px] transition-colors hover:opacity-70"
                    style={{ color:"var(--text-3)" }}>
                    <RefreshCw size={11}/> Tilbakekall og generer ny
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Add event sheet ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background:"rgba(0,0,0,.4)", backdropFilter:"blur(4px)" }}
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background:"var(--border)" }} />
            <h2 className="text-[19px] font-[700] mb-5" style={{ color:"var(--foreground)" }}>Ny hendelse</h2>
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
                {saving ? "Lagrer…" : "Lagre hendelse"}
              </button>
            </form>
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
                {viewEvent.location && <p className="text-[13.5px] mt-1" style={{ color:"var(--text-2)" }}>📍 {viewEvent.location}</p>}
                {viewEvent.recurrence !== "none" && RECURRENCE_LABELS[viewEvent.recurrence] && (
                  <p className="text-[13px] mt-0.5" style={{ color:"var(--text-3)" }}>🔁 {RECURRENCE_LABELS[viewEvent.recurrence]}</p>
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
            <button onClick={() => deleteEvent(viewEvent.id)}
              className="w-full mt-5 py-3 rounded-[13px] font-[550] text-[14px] transition-colors"
              style={{ border:"1px solid #fecaca", color:"#ef4444" }}
              onMouseEnter={e => (e.currentTarget.style.background="#fef2f2")}
              onMouseLeave={e => (e.currentTarget.style.background="transparent")}>
              Slett hendelse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
