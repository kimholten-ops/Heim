"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  LogOut, ShoppingCart, SquareCheck, Calendar,
  Utensils, Users, ChevronRight, MapPin, Leaf, Sun, Dumbbell,
} from "lucide-react";
import {
  AppHeader, IconButton, Chip, SectionLabel, Card,
  EmptyState, ShortcutTile,
} from "@/components/ui";
import { useHousehold } from "@/components/HouseholdContext";
import { useModuleSettings } from "@/lib/modules";
import { buildDailyBriefing } from "@/lib/daily-briefing";
import { checkEventReminders } from "@/lib/notifications";
import NotificationBell from "@/components/NotificationBell";
import { GUEST_HIDDEN_HREFS } from "@/lib/guest-access";

/* ── Types ── */
type EventItem = {
  id: string; title: string; start_at: string; end_at: string;
  all_day: boolean; location: string | null; recurrence: string;
  event_members: { member_id: string }[];
};
type TodoItem = {
  id: string; title: string; priority: "low"|"normal"|"high";
  due_date: string|null; assigned_to: string|null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  todo_lists: any;
};

/* ── Helpers ── */
function getGreeting() {
  const h = new Date().getHours();
  return h < 5 ? "God natt" : h < 12 ? "God morgen" : h < 17 ? "God dag" : "God kveld";
}
function todayLabel() {
  return new Date().toLocaleDateString("nb-NO", { weekday:"long", day:"numeric", month:"long" })
    .replace(/^\w/, c => c.toUpperCase());
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nb-NO", { hour:"2-digit", minute:"2-digit" });
}
function dueBadge(due: string) {
  const d = new Date(due+"T12:00:00"), t = new Date(); t.setHours(0,0,0,0);
  const diff = Math.ceil((d.getTime()-t.getTime())/86400000);
  if (diff < 0) return { label:`${Math.abs(diff)}d over tid`, over:true };
  if (diff === 0) return { label:"I dag", over:false };
  if (diff === 1) return { label:"I morgen", over:false };
  return { label: d.toLocaleDateString("nb-NO",{weekday:"short",day:"numeric",month:"short"}), over:false };
}

const PRIORITY_COLOR: Record<string,string> = { high:"#ef4444", normal:"#f59e0b", low:"#12936b" };

const ALL_SHORTCUTS = [
  { href:"/app/lister",    label:"Lister",    Icon:ShoppingCart, iconBg:"var(--accent-weak)", iconColor:"var(--accent)",  module:null,        adultOnly:false },
  { href:"/app/gjoremal",  label:"Gjøremål",  Icon:SquareCheck,  iconBg:"#e7f4ee",            iconColor:"var(--accent)",  module:null,        adultOnly:false },
  { href:"/app/kalender",  label:"Kalender",  Icon:Calendar,     iconBg:"#eef0f7",            iconColor:"#5b6bd6",        module:null,        adultOnly:false },
  { href:"/app/maaltider", label:"Måltider",  Icon:Utensils,     iconBg:"#fdeee2",            iconColor:"var(--m-coral)", module:"maaltider", adultOnly:false },
  { href:"/app/helse",     label:"Helse",     Icon:Dumbbell,     iconBg:"#fde8ec",            iconColor:"#e11d48",        module:null,        adultOnly:true  },
  { href:"/app/familie",   label:"Familie",   Icon:Users,        iconBg:"#f1edff",            iconColor:"var(--m-violet)",module:null,        adultOnly:false },
] as const;

/* ── Component ── */
export default function HomePage() {
  const [supabase] = useState(() => createClient());
  const { meName, household, members, myHouseholdRole, myMemberId } = useHousehold();
  const myRole = members.find((m) => m.id === myMemberId)?.role;
  const router = useRouter();
  const { settings: moduleSettings } = useModuleSettings(household?.id ?? null);

  const [activeChip, setActiveChip] = useState<string|null>(null);
  const [todayEvents, setTodayEvents]   = useState<EventItem[]>([]);
  const [weekEvents, setWeekEvents]     = useState<EventItem[]>([]);
  const [urgentTodos, setUrgentTodos]   = useState<TodoItem[]>([]);
  const [briefing, setBriefing]         = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);

  const SPEC = ["var(--m-teal)","var(--m-amber)","var(--m-violet)","var(--m-coral)"];
  const memberColor = Object.fromEntries(members.map((m,i) => [m.id, SPEC[i%SPEC.length]]));
  const memberName  = Object.fromEntries(members.map(m => [m.id, m.name]));

  const fetchData = useCallback(async () => {
    if (!household?.id) return;
    setLoading(true);

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999);
    const weekEnd    = new Date(now); weekEnd.setDate(weekEnd.getDate()+7); weekEnd.setHours(23,59,59,999);
    const weekEndStr = weekEnd.toISOString().split("T")[0];
    const todayStr   = todayStart.toISOString().split("T")[0];

    const [{ data: te }, { data: we }, { data: td }, { data: tm }] = await Promise.all([
      supabase.from("events")
        .select("id,title,start_at,end_at,all_day,location,recurrence,event_members(member_id)")
        .eq("household_id", household.id)
        .gte("start_at", todayStart.toISOString())
        .lte("start_at", todayEnd.toISOString())
        .order("start_at"),
      supabase.from("events")
        .select("id,title,start_at,end_at,all_day,location,recurrence,event_members(member_id)")
        .eq("household_id", household.id)
        .gt("start_at", todayEnd.toISOString())
        .lte("start_at", weekEnd.toISOString())
        .order("start_at").limit(5),
      supabase.from("todos")
        .select("id,title,priority,due_date,assigned_to,todo_lists(name,icon,color)")
        .eq("household_id", household.id)
        .eq("completed", false)
        .order("due_date", { ascending:true, nullsFirst:false })
        .limit(20),
      supabase.from("meals")
        .select("title")
        .eq("household_id", household.id)
        .eq("date", todayStr)
        .maybeSingle(),
    ]);

    const events = (te ?? []) as unknown as EventItem[];
    const todos = (td ?? []) as unknown as TodoItem[];
    setTodayEvents(events);
    setWeekEvents((we ?? []) as unknown as EventItem[]);

    const filtered = todos
      .filter(t => !t.due_date || t.due_date <= weekEndStr || t.priority === "high")
      .sort((a,b) => (["high","normal","low"].indexOf(a.priority)) - (["high","normal","low"].indexOf(b.priority)))
      .slice(0, 6);
    setUrgentTodos(filtered);

    const dueTodayOrOverdue = todos.filter(t => t.due_date && t.due_date <= todayStr);
    setBriefing(buildDailyBriefing({ events, todos: dueTodayOrOverdue, meal: tm?.title ?? null }));

    setLoading(false);
  }, [household?.id, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Best-effort bakgrunnssjekk for kommende hendelser — genererer varsler
  // og sender push. Blokkerer ikke sideinnlasting; feiler stille.
  useEffect(() => {
    if (household?.id) checkEventReminders(household.id);
  }, [household?.id]);

  /* ── Member filter ── */
  const filterEvent = (ev: EventItem) => {
    if (!activeChip) return true;
    return ev.event_members.some(m => m.member_id === activeChip);
  };
  const filterTodo = (t: TodoItem) => {
    if (!activeChip) return true;
    return t.assigned_to === activeChip;
  };

  const visibleToday = todayEvents.filter(filterEvent);
  const visibleWeek  = weekEvents.filter(filterEvent);
  const visibleTodos = urgentTodos.filter(filterTodo);

  return (
    <div className="max-w-[420px] mx-auto">
      <div className="px-4 pb-24" style={{ paddingLeft:"clamp(12px,4vw,18px)", paddingRight:"clamp(12px,4vw,18px)" }}>

        {/* Header */}
        <AppHeader
          kicker={getGreeting()}
          name={household.name}
          date={todayLabel()}
          right={
            <>
              <NotificationBell />
              <IconButton onClick={() => router.push("/login")}>
                <LogOut size={17} strokeWidth={1.7} />
              </IconButton>
            </>
          }
        />

        {/* ── Dagens briefing ── */}
        {briefing && (
          <Card className="mb-3">
            <div className="flex items-center gap-2.5 px-4 py-3">
              <Sun size={16} strokeWidth={1.8} style={{ color:"var(--accent)" }} className="flex-shrink-0" />
              <p className="text-[14.5px] font-[500]" style={{ color:"var(--foreground)" }}>{briefing}</p>
            </div>
          </Card>
        )}

        {/* Member filter chips */}
        {members.length > 0 && (
          <div className="flex gap-2 flex-wrap" style={{ paddingBottom:"var(--chip-gap)" }}>
            <Chip name="Alle" active={activeChip === null} onClick={() => setActiveChip(null)} />
            {members.map((m, i) => (
              <Chip key={m.id} name={m.name} color={SPEC[i%SPEC.length]}
                active={activeChip === m.id}
                onClick={() => setActiveChip(activeChip === m.id ? null : m.id)} />
            ))}
          </div>
        )}

        {/* ── I dag ── */}
        <div style={{ marginBottom:"var(--section-gap)" }}>
          <SectionLabel title="I dag" href="/app/kalender" linkText="Kalender" />
          {loading ? (
            <div className="h-14 rounded-[18px] animate-pulse" style={{ background:"var(--surface-2)" }} />
          ) : visibleToday.length === 0 ? (
            <Card><EmptyState icon={<Leaf size={18} strokeWidth={1.7} />} text="Ingenting planlagt — nyt roen" /></Card>
          ) : (
            <Card>
              {visibleToday.map((ev, i) => {
                const parts = ev.event_members.map(m => ({ id: m.member_id, name: memberName[m.member_id]??'?', color: memberColor[m.member_id]??"var(--accent)" }));
                return (
                  <Link key={ev.id} href="/app/kalender"
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${i>0?"border-t border-[var(--border)]":""}`}>
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: parts[0]?.color ?? "var(--accent)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-[600]" style={{ color:"var(--foreground)" }}>{ev.title}</p>
                      <p className="text-[12.5px] mt-0.5 flex items-center gap-1 flex-wrap" style={{ color:"var(--text-2)" }}>
                        {ev.all_day ? "Hele dagen" : `${fmtTime(ev.start_at)}–${fmtTime(ev.end_at)}`}
                        {ev.location && (
                          <span className="flex items-center gap-0.5">· <MapPin size={11} strokeWidth={2} /> {ev.location}</span>
                        )}
                      </p>
                    </div>
                    {parts.length > 0 && (
                      <div className="flex -space-x-1.5">
                        {parts.slice(0,3).map(m => (
                          <span key={m.id} className="w-[22px] h-[22px] rounded-full border-2 border-white flex items-center justify-center text-[10px] font-[700] text-white"
                            style={{ background: m.color }}>{m.name[0]?.toUpperCase()}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </Card>
          )}
        </div>

        {/* ── Gjøremål ── */}
        <div style={{ marginBottom:"var(--section-gap)" }}>
          <SectionLabel title="Gjøremål" href="/app/gjoremal" linkText="Se alle" />
          {loading ? (
            <div className="h-20 rounded-[18px] animate-pulse" style={{ background:"var(--surface-2)" }} />
          ) : visibleTodos.length === 0 ? (
            <Card><EmptyState icon={<SquareCheck size={18} strokeWidth={1.7} />} text="Ingen aktive gjøremål" /></Card>
          ) : (
            <Card>
              {visibleTodos.map((t, i) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const list = t.todo_lists as any;
                const due  = t.due_date ? dueBadge(t.due_date) : null;
                const assignee = t.assigned_to ? members.find(m => m.id === t.assigned_to) : null;
                return (
                  <Link key={t.id} href="/app/gjoremal"
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${i>0?"border-t border-[var(--border)]":""}`}>
                    <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ background: PRIORITY_COLOR[t.priority] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-[550] truncate" style={{ color:"var(--foreground)" }}>{t.title}</p>
                      <div className="flex items-center gap-2 text-[12px] flex-wrap" style={{ color:"var(--text-3)" }}>
                        {list && <span>{list.icon} {list.name}</span>}
                        {due && (
                          <span className="flex items-center gap-0.5" style={{ color: due.over?"#ef4444":"var(--text-3)", fontWeight: due.over?"600":"400" }}>
                            <Calendar size={11} strokeWidth={2} /> {due.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {assignee && (
                      <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-[700] text-white flex-shrink-0"
                        style={{ background: memberColor[assignee.id] ?? "var(--accent)" }}>
                        {assignee.name[0]?.toUpperCase()}
                      </span>
                    )}
                  </Link>
                );
              })}
            </Card>
          )}
        </div>

        {/* ── Resten av uken ── */}
        {(loading || visibleWeek.length > 0) && (
          <div style={{ marginBottom:"var(--section-gap)" }}>
            <SectionLabel title="Resten av uken" />
            {loading ? (
              <div className="h-16 rounded-[18px] animate-pulse" style={{ background:"var(--surface-2)" }} />
            ) : (
              <Card>
                {visibleWeek.map((ev, i) => {
                  const d    = new Date(ev.start_at);
                  const parts = ev.event_members.map(m => ({ id:m.member_id, color: memberColor[m.member_id]??"var(--accent)" }));
                  return (
                    <Link key={ev.id} href="/app/kalender"
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${i>0?"border-t border-[var(--border)]":""}`}>
                      <div className="w-10 h-10 rounded-[11px] flex flex-col items-center justify-center flex-shrink-0"
                        style={{ background:"var(--surface-2)" }}>
                        <span className="text-[16px] font-[700] leading-none" style={{ color:"var(--foreground)" }}>{d.getDate()}</span>
                        <span className="text-[9px] font-[600] uppercase mt-[1px]" style={{ color:"var(--text-3)" }}>
                          {d.toLocaleDateString("nb-NO",{weekday:"short"})}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-[600] truncate" style={{ color:"var(--foreground)" }}>{ev.title}</p>
                        <p className="text-[12.5px] flex items-center gap-1 flex-wrap" style={{ color:"var(--text-2)" }}>
                          {ev.all_day ? "Hele dagen" : fmtTime(ev.start_at)}
                          {ev.location && (
                            <span className="flex items-center gap-0.5">· <MapPin size={11} strokeWidth={2} /> {ev.location}</span>
                          )}
                        </p>
                      </div>
                      {parts.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {parts.slice(0,3).map(m => (
                            <span key={m.id} className="w-[20px] h-[20px] rounded-full border-2 border-white" style={{ background:m.color }} />
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </Card>
            )}
          </div>
        )}

        {/* ── Snarveier ── */}
        <div style={{ marginBottom:"var(--section-gap)" }}>
          <SectionLabel title="Snarveier" />
          <div className="grid grid-cols-3 gap-[10px]">
            {ALL_SHORTCUTS
              .filter(s => !s.module || moduleSettings[s.module as keyof typeof moduleSettings])
              .filter(s => myHouseholdRole !== "gjest" || !GUEST_HIDDEN_HREFS.has(s.href))
              .filter(s => !s.adultOnly || myRole === "adult")
              .map(({ href, label, Icon, iconBg, iconColor }) => (
                <ShortcutTile key={label} href={href} label={label}
                  icon={<Icon size={19} strokeWidth={1.7} />}
                  iconBg={iconBg} iconColor={iconColor} />
              ))}
          </div>
        </div>

      </div>
    </div>
  );
}
