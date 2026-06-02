"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/HouseholdContext";
import { Calendar, Smartphone, Copy, Check, RefreshCw, Plus, X, MapPin, RefreshCcw } from "lucide-react";
import { Card, SectionLabel, EventRow } from "@/components/ui";
import { cn } from "@/lib/utils";

type EventItem = {
  id: string; title: string; start_at: string; end_at: string;
  all_day: boolean; color: string; location: string | null;
  recurrence: string;
  event_members: { user_id: string }[];
  event_children: { child_id: string }[];
};

const RECURRENCE_OPTIONS = [
  { value: "none",     label: "Ingen gjentakelse" },
  { value: "weekly",   label: "Ukentlig" },
  { value: "biweekly", label: "Annenhver uke" },
  { value: "monthly",  label: "Månedlig" },
] as const;

const RECURRENCE_LABEL: Record<string, string> = {
  weekly: "Ukentlig", biweekly: "Annenhver uke", monthly: "Månedlig",
};

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function groupByDay(events: EventItem[]): [string, EventItem[]][] {
  const map = new Map<string, EventItem[]>();
  for (const ev of events) {
    const key = ev.start_at.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return [...map.entries()];
}
function fmtDayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = toDateStr(new Date());
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));
  if (dateStr === today) return "I dag";
  if (dateStr === tomorrow) return "I morgen";
  return d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

export default function KalenderClient({
  householdId, initialEvents, existingFeedToken,
}: {
  householdId: string | null;
  initialEvents: EventItem[];
  existingFeedToken: string | null;
}) {
  const [supabase] = useState(() => createClient());
  const { members } = useHousehold();

  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [feedToken, setFeedToken] = useState<string | null>(existingFeedToken);
  const [feedBusy, setFeedBusy] = useState(false);
  const [copied, setCopied] = useState<"url" | "webcal" | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [fTitle, setFTitle] = useState("");
  const [fDate, setFDate] = useState(toDateStr(new Date()));
  const [fEndDate, setFEndDate] = useState(toDateStr(new Date()));
  const [fTime, setFTime] = useState("12:00");
  const [fEndTime, setFEndTime] = useState("13:00");
  const [fAllDay, setFAllDay] = useState(false);
  const [fLocation, setFLocation] = useState("");
  const [fRecurrence, setFRecurrence] = useState<"none"|"weekly"|"biweekly"|"monthly">("none");
  const [fParticipants, setFParticipants] = useState<string[]>([]);

  const allMemberIds = members.map(m => m.id);
  const allSelected = fParticipants.length === members.length && members.length > 0;

  function toggleParticipant(id: string) {
    setFParticipants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleAll() {
    setFParticipants(allSelected ? [] : [...allMemberIds]);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const icsUrl = feedToken ? `${origin}/api/ics/${feedToken}` : null;
  const webcalUrl = icsUrl ? icsUrl.replace(/^https?:\/\//, "webcal://") : null;

  async function generateFeed() {
    if (!householdId) return;
    setFeedBusy(true);
    const { data: token } = await supabase.rpc("create_calendar_feed", { p_label: "Heim-kalender" });
    setFeedToken(token as string);
    setFeedBusy(false);
  }

  async function copy(type: "url" | "webcal") {
    const url = type === "webcal" ? webcalUrl : icsUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(type); setTimeout(() => setCopied(null), 2000);
  }

  function resetForm() {
    setFTitle(""); setFDate(toDateStr(new Date())); setFEndDate(toDateStr(new Date()));
    setFTime("12:00"); setFEndTime("13:00"); setFAllDay(false);
    setFLocation(""); setFRecurrence("none"); setFParticipants([]);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!fTitle.trim() || !householdId) return;
    setSaving(true);

    // Map biweekly → weekly with interval stored in notes (ICS handles it)
    const rruleValue = fRecurrence === "biweekly" ? "weekly" : fRecurrence;

    const start_at = fAllDay
      ? new Date(fDate + "T00:00:00").toISOString()
      : new Date(fDate + "T" + fTime).toISOString();
    const end_at = fAllDay
      ? new Date((fEndDate || fDate) + "T23:59:59").toISOString()
      : new Date((fEndDate || fDate) + "T" + fEndTime).toISOString();

    const { data: ev } = await supabase.from("events").insert({
      household_id: householdId,
      title: fTitle.trim(),
      start_at, end_at,
      all_day: fAllDay,
      color: "#12936b",          // fixed accent — no colour picker
      location: fLocation.trim() || null,
      recurrence: fRecurrence,   // store original value inc. biweekly
    }).select().single();

    if (ev) {
      if (fParticipants.length) {
        await supabase.from("event_members").insert(
          fParticipants.map(uid => ({ event_id: ev.id, user_id: uid }))
        );
      }
      const newEv: EventItem = {
        ...ev,
        event_members: fParticipants.map(uid => ({ user_id: uid })),
        event_children: [],
      };
      setEvents(prev =>
        [...prev, newEv].sort((a, b) => a.start_at.localeCompare(b.start_at))
      );
    }
    resetForm(); setShowForm(false); setSaving(false);
  }

  async function deleteEvent(id: string) {
    await supabase.from("events").delete().eq("id", id);
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));
  const grouped = groupByDay(events);

  return (
    <div className="max-w-[420px] mx-auto">
      {/* Header */}
      <div className="px-[18px] pt-[14px] pb-4 flex items-start justify-between">
        <div>
          <p className="text-[12.5px] font-[600] text-text-3 tracking-[0.02em]">Familiens hendelser</p>
          <h1 className="text-[27px] font-[700] tracking-tight27 text-fg mt-[3px] leading-[1.05]">Kalender</h1>
        </div>
        <button onClick={() => setShowForm(true)}
          className="mt-1 flex items-center gap-1.5 text-[13px] font-[600] text-white bg-accent rounded-[12px] px-3 py-2 hover:opacity-90 active:scale-95 transition-all shadow-card">
          <Plus size={14} strokeWidth={2.5} /> Hendelse
        </button>
      </div>

      <div className="px-[18px] pb-28 space-y-4">

        {/* ── Agenda ── */}
        <div>
          <SectionLabel title="Kommende" />
          {grouped.length === 0 ? (
            <Card>
              <div className="flex items-center gap-3 px-4 py-4 text-text-2 text-[14.5px]">
                <span className="w-[34px] h-[34px] rounded-[10px] bg-surface-2 text-text-3 flex items-center justify-center flex-shrink-0">
                  <Calendar size={18} strokeWidth={1.7} />
                </span>
                Ingen kommende hendelser
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {grouped.map(([dateStr, dayEvents]) => {
                const d = new Date(dateStr + "T12:00:00");
                const isToday = dateStr === toDateStr(new Date());
                return (
                  <div key={dateStr}>
                    <div className={cn("text-[12px] font-[600] uppercase tracking-wide12 px-1 pb-1.5 capitalize",
                      isToday ? "text-accent" : "text-text-3")}>
                      {fmtDayLabel(dateStr)}
                    </div>
                    <Card>
                      {dayEvents.map((ev, i) => {
                        const participants = ev.event_members.map(m => memberMap[m.user_id]).filter(Boolean);
                        const dotColor = participants[0]?.color ?? "var(--accent)";

                        const subParts: string[] = [];
                        if (ev.all_day) subParts.push("Hele dagen");
                        else subParts.push(`${fmtTime(ev.start_at)}–${fmtTime(ev.end_at)}`);
                        if (ev.location) subParts.push(`📍 ${ev.location}`);
                        if (ev.recurrence !== "none") subParts.push(`🔁 ${RECURRENCE_LABEL[ev.recurrence] ?? ev.recurrence}`);

                        return (
                          <div key={ev.id} className="group">
                            <EventRow
                              day={d.getDate()}
                              weekday={d.toLocaleDateString("nb-NO", { weekday: "short" }).toUpperCase()}
                              title={ev.title}
                              sub={subParts.join("  ·  ") || undefined}
                              dotColor={dotColor}
                              divider={i > 0}
                            />
                            {/* Participants & delete */}
                            <div className="hidden group-hover:flex items-center justify-between px-4 pb-2">
                              {participants.length > 0 ? (
                                <div className="flex -space-x-1">
                                  {participants.map(m => (
                                    <span key={m.id}
                                      className="w-[20px] h-[20px] rounded-full border border-white flex items-center justify-center text-[10px] font-[700] text-white"
                                      style={{ background: m.color }}>
                                      {m.name[0]?.toUpperCase()}
                                    </span>
                                  ))}
                                </div>
                              ) : <span />}
                              <button onClick={() => deleteEvent(ev.id)}
                                className="text-[12px] text-text-3 hover:text-rose-500 transition-colors flex items-center gap-1">
                                <X size={12} /> Slett
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── iOS Calendar feed ── */}
        <div>
          <SectionLabel title="📱 iOS Kalender-abonnement" />
          <Card>
            <div className="px-4 py-4">
              <div className="flex items-start gap-3 mb-4">
                <span className="w-[38px] h-[38px] rounded-[11px] bg-accent-weak text-accent flex items-center justify-center flex-shrink-0">
                  <Smartphone size={18} strokeWidth={1.7} />
                </span>
                <div>
                  <p className="text-[15px] font-[600] text-fg">Abonner i iOS Kalender</p>
                  <p className="text-[13px] text-text-2 mt-1">Enveis-synk · oppdateres automatisk.</p>
                </div>
              </div>
              {!feedToken ? (
                <button onClick={generateFeed} disabled={feedBusy || !householdId}
                  className="w-full py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                  <Calendar size={16} /> {feedBusy ? "Genererer…" : "Generer kalender-URL"}
                </button>
              ) : (
                <div className="space-y-2.5">
                  <div className="bg-surface-2 rounded-[13px] p-3 flex items-center gap-2">
                    <code className="flex-1 text-[11px] text-text-2 truncate">{icsUrl}</code>
                    <button onClick={() => copy("url")} className="flex-shrink-0 flex items-center gap-1 text-[13px] font-[600] text-accent hover:opacity-80">
                      {copied === "url" ? <Check size={13} /> : <Copy size={13} />}
                      {copied === "url" ? "Kopiert" : "Kopier"}
                    </button>
                  </div>
                  <a href={webcalUrl ?? "#"} className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-[13px] font-[600] text-[14px] hover:opacity-90">
                    <Calendar size={15} /> Åpne i Kalender-appen
                  </a>
                  <button onClick={() => copy("webcal")} className="w-full py-2 border border-border rounded-[13px] text-[13px] font-[550] text-text-2 hover:bg-surface-2 flex items-center justify-center gap-1.5">
                    {copied === "webcal" ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
                    {copied === "webcal" ? "Kopiert!" : "Kopier webcal://"}
                  </button>
                </div>
              )}
            </div>
            {feedToken && (
              <div className="border-t border-border px-4 py-2.5">
                <button onClick={async () => {
                  await supabase.from("calendar_feeds").update({ revoked_at: new Date().toISOString() }).eq("token", feedToken);
                  setFeedToken(null);
                }} className="flex items-center gap-1.5 text-[12px] text-text-3 hover:text-rose-500 transition-colors">
                  <RefreshCw size={11} /> Tilbakekall og generer ny lenke
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Add event sheet ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm" onClick={() => { resetForm(); setShowForm(false); }}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            <h2 className="text-[19px] font-[700] text-fg mb-5">Ny hendelse</h2>

            <form onSubmit={saveEvent} className="space-y-3">
              {/* Title */}
              <input type="text" placeholder="Tittel *" value={fTitle} onChange={e => setFTitle(e.target.value)} autoFocus required
                className="w-full rounded-[13px] border border-border px-4 py-3 text-[15px] placeholder:text-text-3 outline-none focus:border-accent" />

              {/* Location */}
              <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-[13px]">
                <MapPin size={16} className="text-text-3 flex-shrink-0" />
                <input type="text" placeholder="Sted (valgfritt)" value={fLocation} onChange={e => setFLocation(e.target.value)}
                  className="flex-1 text-[15px] placeholder:text-text-3 outline-none bg-transparent" />
              </div>

              {/* All day */}
              <label className="flex items-center gap-3 px-4 py-3 border border-border rounded-[13px] cursor-pointer">
                <input type="checkbox" checked={fAllDay} onChange={e => setFAllDay(e.target.checked)} className="w-5 h-5 accent-accent rounded" />
                <span className="text-[15px] text-fg">Hele dagen</span>
              </label>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">Fra</p>
                  <input type="date" value={fDate}
                    onChange={e => { setFDate(e.target.value); if (e.target.value > fEndDate) setFEndDate(e.target.value); }}
                    className="w-full rounded-[13px] border border-border px-3 py-2.5 text-[14px] outline-none focus:border-accent" />
                </div>
                <div>
                  <p className="text-[11px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">Til</p>
                  <input type="date" value={fEndDate} min={fDate} onChange={e => setFEndDate(e.target.value)}
                    className="w-full rounded-[13px] border border-border px-3 py-2.5 text-[14px] outline-none focus:border-accent" />
                </div>
              </div>

              {/* Times */}
              {!fAllDay && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">Kl. fra</p>
                    <input type="time" value={fTime} onChange={e => {
                      setFTime(e.target.value);
                      if (fDate === fEndDate && e.target.value >= fEndTime) {
                        const [h] = e.target.value.split(":").map(Number);
                        setFEndTime(`${String(Math.min(h+1,23)).padStart(2,"0")}:${e.target.value.split(":")[1]}`);
                      }
                    }} className="w-full rounded-[13px] border border-border px-3 py-2.5 text-[14px] outline-none focus:border-accent" />
                  </div>
                  <div>
                    <p className="text-[11px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">Kl. til</p>
                    <input type="time" value={fEndTime} onChange={e => setFEndTime(e.target.value)}
                      className="w-full rounded-[13px] border border-border px-3 py-2.5 text-[14px] outline-none focus:border-accent" />
                  </div>
                </div>
              )}

              {/* Recurrence */}
              <div>
                <p className="text-[11px] font-[600] text-text-3 mb-2 uppercase tracking-wide12">Gjentas</p>
                <div className="grid grid-cols-2 gap-2">
                  {RECURRENCE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setFRecurrence(opt.value as typeof fRecurrence)}
                      className={cn("py-2.5 px-3 rounded-[13px] border text-[13px] font-[550] transition-all flex items-center gap-1.5 justify-center",
                        fRecurrence === opt.value
                          ? "border-accent bg-accent-weak text-accent"
                          : "border-border text-fg hover:bg-surface-2"
                      )}>
                      {opt.value !== "none" && <RefreshCcw size={12} strokeWidth={2} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participants — multi-select + Alle */}
              {members.length > 0 && (
                <div>
                  <p className="text-[11px] font-[600] text-text-3 mb-2 uppercase tracking-wide12">Hvem deltar?</p>
                  <div className="flex flex-wrap gap-2">
                    {/* Alle */}
                    <button type="button" onClick={toggleAll}
                      className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                        allSelected ? "bg-fg text-white border-fg" : "border-border text-fg hover:bg-surface-2")}>
                      Alle
                    </button>
                    {members.map(m => {
                      const sel = fParticipants.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleParticipant(m.id)}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                            sel ? "border-transparent text-white" : "border-border text-fg")}
                          style={sel ? { background: m.color, borderColor: m.color } : {}}>
                          <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] text-white font-[700]"
                            style={{ background: m.color }}>{m.name[0]?.toUpperCase()}</span>
                          {m.name.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                  {fParticipants.length > 0 && !allSelected && (
                    <p className="text-[12px] text-text-3 mt-1.5">{fParticipants.length} valgt</p>
                  )}
                </div>
              )}

              <button type="submit" disabled={saving || !fTitle.trim()}
                className="w-full py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all">
                {saving ? "Lagrer…" : "Lagre hendelse"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
