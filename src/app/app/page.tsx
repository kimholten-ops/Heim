"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Bell, LogOut, ShoppingCart, SquareCheck, Calendar,
  Utensils, Wallet, Users, ChevronRight,
} from "lucide-react";
import {
  AppHeader, IconButton, Chip, SectionLabel, Card,
  EmptyState, ShortcutTile, NotificationRow, TodoRow, EventRow,
} from "@/components/ui";
import { useHousehold } from "@/components/HouseholdContext";
import { useModuleSettings } from "@/lib/modules";

/* â”€â”€ Types â”€â”€ */
type EventItem = {
  id: string; title: string; start_at: string; end_at: string;
  all_day: boolean; location: string | null; recurrence: string;
  event_members: { user_id: string }[];
};
type TodoItem = {
  id: string; title: string; priority: "low"|"normal"|"high";
  due_date: string|null; assigned_to: string|null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  todo_lists: any;
};

/* â”€â”€ Helpers â”€â”€ */
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
  { href:"/app/lister",    label:"Lister",    Icon:ShoppingCart, iconBg:"var(--accent-weak)", iconColor:"var(--accent)",  module:null       },
  { href:"/app/gjoremal",  label:"Gjøremål",  Icon:SquareCheck,  iconBg:"#e7f4ee",            iconColor:"var(--accent)",  module:null       },
  { href:"/app/kalender",  label:"Kalender",  Icon:Calendar,     iconBg:"#eef0f7",            iconColor:"#5b6bd6",        module:null       },
  { href:"/app/maaltider", label:"Måltider",  Icon:Utensils,     iconBg:"#fdeee2",            iconColor:"var(--m-coral)", module:"maaltider"},
  { href:"/app/familie",   label:"Ukepenger", Icon:Wallet,       iconBg:"#fef3e0",            iconColor:"#d9920a",        module:"ukepenger"},
  { href:"/app/familie",   label:"Familie",   Icon:Users,        iconBg:"#f1edff",            iconColor:"var(--m-violet)",module:null       },
] as const;

/* â”€â”€ Component â”€â”€ */
export default function HomePage() {
  const [supabase] = useState(() => createClient());
  const { meName, household, members } = useHousehold();
  const router = useRouter();
  const { settings: moduleSettings } = useModuleSettings(household?.id ?? null);

  const [activeChip, setActiveChip] = useState<string|null>(null);
  const [todayEvents, setTodayEvents]   = useState<EventItem[]>([]);
  const [weekEvents, setWeekEvents]     = useState<EventItem[]>([]);
  const [urgentTodos, setUrgentTodos]   = useState<TodoItem[]>([]);
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

    const [{ data: te }, { data: we }, { data: td }] = await Promise.all([
      supabase.from("events")
        .select("id,title,start_at,end_at,all_day,location,recurrence,event_members(user_id)")
        .eq("household_id", household.id)
        .gte("start_at", todayStart.toISOString())
        .lte("start_at", todayEnd.toISOString())
        .order("start_at"),
      supabase.from("events")
        .select("id,title,start_at,end_at,all_day,location,recurrence,event_members(user_id)")
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
    ]);

    setTodayEvents((te ?? []) as unknown as EventItem[]);
    setWeekEvents((we ?? []) as unknown as EventItem[]);

    const filtered = ((td ?? []) as unknown as TodoItem[])
      .filter(t => !t.due_date || t.due_date <= weekEndStr || t.priority === "high")
      .sort((a,b) => (["high","normal","low"].indexOf(a.priority)) - (["high","normal","low"].indexOf(b.priority)))
      .slice(0, 6);
    setUrgentTodos(filtered);
    setLoading(false);
  }, [household?.id, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* â”€â”€ Member filter â”€â”€ */
  const filterEvent = (ev: EventItem) => {
    if (!activeChip) return true;
    return ev.event_members.some(m => m.user_id === activeChip);
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
              <IconButton badgeDot><Bell size={18} strokeWidth={1.7} /></IconButton>
              <IconButton onClick={() => router.push("/login")}>
                <LogOut size={17} strokeWidth={1.7} />
              </IconButton>
            </>
          }
        />

        {/* Member filter chips */}
        {members.length > 0 && (
          <div className="flex gap-2 flex-wrap" style={{ paddingBottom:"var(--chip-gap)" }}>
            <Chip name="Alle" color="#d6dae1" active={activeChip === null} onClick={() => setActiveChip(null)} />
            {members.map((m, i) => (
              <Chip key={m.id} name={m.name} color={SPEC[i%SPEC.length]}
                active={activeChip === m.id}
                onClick={() => setActiveChip(activeChip === m.id ? null : m.id)} />
            ))}
          </div>
        )}

        {/* I dag */}
        <div style={{ marginBottom:"var(--section-gap)" }}>
          <SectionLabel title="I dag" href="/app/kalender" linkText="Kalender" />
          {loading ? (
            <div className="h-14 rounded-[18px] animate-pulse" style={{ background:"var(--surface-2)" }} />
          ) : visibleToday.length === 0 ? (
            <Card><EmptyState icon={<Calendar size={18} strokeWidth={1.7} />} text="Ingen hendelser i dag" /></Card>
          ) : (
            <Card>
              {visibleToday.map((ev, i) => {
                const parts = ev.event_members.map(m => ({ id: m.user_id, name: memberName[m.user_id]??'?', color: memberColor[m.user_id]??"var(--accent)" }));
                return (
                  <Link key={ev.id} href="/app/kalender"
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${i>0?"border-t border-[var(--border)]":""}`}>
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: parts[0]?.color ?? "var(--accent)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-[600]" style={{ color:"var(--foreground)" }}>{ev.title}</p>
                      <p className="text-[12.5px] mt-0.5" style={{ color:"var(--text-2)" }}>
                        {ev.all_day ? "Hele dagen" : `${fmtTime(ev.start_at)}–${fmtTime(ev.end_at)}`}
                        {ev.location && ` · ${ev.location}`}
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

        {/* Gjøremål */}
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

                const parts = [];
                if (list) parts.push(list.name); // Removed emoji icon
                if (due) parts.push(<span key="due" style={{ color: due.over ? "#ef4444" : "inherit", fontWeight: due.over ? 600 : "inherit" }}>{due.label}</span>);

                return (
                  <Link key={t.id} href="/app/gjoremal" className={i > 0 ? "block border-t border-[var(--border)]" : "block"}>
                    <TodoRow
                      title={t.title}
                      barColor={PRIORITY_COLOR[t.priority]}
                      checked={false}
                      sub={
                        <span className="flex items-center gap-1.5">
                          {assignee && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: memberColor[assignee.id] ?? "var(--accent)" }} />
                              <span>{assignee.name}</span>
                              {(parts.length > 0) && <span>·</span>}
                            </>
                          )}
                          {parts.map((p, idx) => (
                            <span key={idx} className="flex items-center gap-1.5">
                              {p}
                              {idx < parts.length - 1 && <span>·</span>}
                            </span>
                          ))}
                        </span>
                      }
                    />
                  </Link>
                );
              })}
            </Card>
          )}
        </div>

        {/* Resten av uken */}
        {(loading || visibleWeek.length > 0) && (
          <div style={{ marginBottom:"var(--section-gap)" }}>
            <SectionLabel title="Resten av uken" />
            {loading ? (
              <div className="h-16 rounded-[18px] animate-pulse" style={{ background:"var(--surface-2)" }} />
            ) : (
              <Card>
                {visibleWeek.map((ev, i) => {
                  const d = new Date(ev.start_at);
                  const firstMemberColor = memberColor[ev.event_members[0]?.user_id];

                  return (
                    <Link key={ev.id} href="/app/kalender" className={i > 0 ? "block border-t border-[var(--border)]" : "block"}>
                      <EventRow
                        day={d.getDate()}
                        weekday={d.toLocaleDateString("nb-NO", { weekday: "short" })}
                        title={ev.title}
                        sub={ev.all_day ? "Hele dagen" : `${fmtTime(ev.start_at)}${ev.location ? ` · ${ev.location}` : ""}`}
                        dotColor={firstMemberColor}
                        divider={false} // Handled by Link wrapper
                      />
                    </Link>
                  );
                })}
              </Card>
            )}
          </div>
        )}

        {/* Snarveier */}
        <div style={{ marginBottom:"var(--section-gap)" }}>
          <SectionLabel title="Snarveier" />
          <div className="grid grid-cols-3 gap-[10px]">
            {ALL_SHORTCUTS
              .filter(s => !s.module || moduleSettings[s.module as keyof typeof moduleSettings])
              .map(({ href, label, Icon, iconBg, iconColor }) => (
                <ShortcutTile key={label} href={href} label={label}
                  icon={<Icon size={19} strokeWidth={1.7} />}
                  iconBg={iconBg} iconColor={iconColor} />
              ))}
          </div>
        </div>

        {/* â”€â”€ Varsler â”€â”€ */}
        <NotificationRow href="/app/familie"
          icon={<Bell size={18} strokeWidth={1.7} />}
          title="Varsler"
          sub="Tildelinger, godkjenninger og hendelser" />

      </div>
    </div>
  );
}
