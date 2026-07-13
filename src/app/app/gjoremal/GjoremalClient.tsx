"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/HouseholdContext";
import { Plus, X, SquareCheck, Repeat, SkipForward } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { checkRotations, skipRotationRound, type TodoRotation } from "@/lib/rotations";

type TodoList = { id: string; name: string; icon: string; color: string };
type Todo = {
  id: string; todo_list_id: string; title: string;
  priority: "low" | "normal" | "high"; due_date: string | null;
  assigned_to: string | null;
  completed: boolean;
  rotation_id: string | null;
};

const PRIORITY_COLOR = { high: "#ef4444", normal: "#f59e0b", low: "#12936b" };
const PRIORITY_LABEL = { high: "Høy", normal: "Normal", low: "Lav" };

function dueBadge(due: string) {
  const d = new Date(due + "T12:00:00"), t = new Date(); t.setHours(0,0,0,0);
  const diff = Math.ceil((d.getTime()-t.getTime())/86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d over tid`, over: true };
  if (diff === 0) return { label: "I dag", over: false };
  if (diff === 1) return { label: "I morgen", over: false };
  return { label: d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }), over: false };
}

export default function GjoremalClient({
  householdId, initialLists,
}: { householdId: string | null; initialLists: TodoList[] }) {
  const [supabase] = useState(() => createClient());
  const { members } = useHousehold();

  const [lists, setLists] = useState<TodoList[]>(initialLists);
  const [activeList, setActiveList] = useState<string | null>(initialLists[0]?.id ?? null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Member filter: null = Alle, string = specific member id
  const [memberFilter, setMemberFilter] = useState<string | null>(null);

  // New list form
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  // New todo form
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fPriority, setFPriority] = useState<"low"|"normal"|"high">("normal");
  const [fDue, setFDue] = useState("");
  const [fAssignees, setFAssignees] = useState<string[]>([]); // multi-select
  const [saving, setSaving] = useState(false);

  // Rotasjoner
  const [rotations, setRotations] = useState<TodoRotation[]>([]);
  const [showRotationForm, setShowRotationForm] = useState(false);
  const [rTitle, setRTitle] = useState("");
  const [rListId, setRListId] = useState<string | null>(null);
  const [rMemberOrder, setRMemberOrder] = useState<string[]>([]);
  const [rFrequency, setRFrequency] = useState<"daily" | "weekly">("weekly");
  const [savingRotation, setSavingRotation] = useState(false);
  const [busyRotationId, setBusyRotationId] = useState<string | null>(null);

  const allMemberIds = members.map(m => m.id);
  const allAssigned = fAssignees.length === members.length && members.length > 0;

  function toggleAssignee(id: string) {
    setFAssignees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleAllAssignees() {
    setFAssignees(allAssigned ? [] : [...allMemberIds]);
  }

  const activeListObj = lists.find(l => l.id === activeList);
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  const fetchTodos = useCallback(async () => {
    if (!activeList) return;
    setTodosLoading(true);
    const { data } = await supabase.from("todos").select("*")
      .eq("todo_list_id", activeList).order("created_at");
    setTodos((data ?? []) as Todo[]);
    setTodosLoading(false);
  }, [activeList, supabase]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const fetchRotations = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase.from("todo_rotations").select("*")
      .eq("household_id", householdId).eq("active", true).order("created_at");
    setRotations((data ?? []) as TodoRotation[]);
  }, [householdId, supabase]);

  useEffect(() => {
    if (!householdId) return;
    (async () => {
      await checkRotations(supabase, householdId);
      await fetchRotations();
      await fetchTodos();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  function toggleRotationMember(id: string) {
    setRMemberOrder(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function addRotation(e: React.FormEvent) {
    e.preventDefault();
    const listId = rListId ?? activeList;
    if (!rTitle.trim() || !listId || !householdId || rMemberOrder.length === 0) return;
    setSavingRotation(true);
    const today = new Date();
    const nextDue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await supabase.from("todo_rotations").insert({
      household_id: householdId, todo_list_id: listId, title: rTitle.trim(),
      member_order: rMemberOrder, frequency: rFrequency, next_due: nextDue,
    });
    setRTitle(""); setRMemberOrder([]); setRFrequency("weekly"); setRListId(null);
    setShowRotationForm(false); setSavingRotation(false);
    await checkRotations(supabase, householdId);
    await fetchRotations();
    await fetchTodos();
  }

  async function handleSkipRotation(rotation: TodoRotation) {
    setBusyRotationId(rotation.id);
    await skipRotationRound(supabase, rotation);
    await fetchRotations();
    setBusyRotationId(null);
  }

  async function deleteRotation(id: string) {
    if (!confirm("Slett rotasjonen? Allerede opprettede gjøremål beholdes.")) return;
    setBusyRotationId(id);
    await supabase.from("todo_rotations").delete().eq("id", id);
    await fetchRotations();
    setBusyRotationId(null);
  }

  async function addList() {
    const n = newListName.trim();
    if (!n || !householdId) return;
    setNewListName(""); setAddingList(false);
    const { data } = await supabase.from("todo_lists")
      .insert({ household_id: householdId, name: n, icon: "✅", color: "#12936b" })
      .select().single();
    if (data) {
      setLists(prev => [...prev, data as TodoList]);
      setActiveList((data as TodoList).id);
    }
  }

  async function deleteList(id: string) {
    const list = lists.find(l => l.id === id);
    if (!confirm(`Slett listen «${list?.name ?? ""}»? Alle gjøremål slettes også.`)) return;
    setDeleting(id);
    await supabase.from("todos").delete().eq("todo_list_id", id);
    await supabase.from("todo_lists").delete().eq("id", id);
    const remaining = lists.filter(l => l.id !== id);
    setLists(remaining);
    if (activeList === id) { setActiveList(remaining[0]?.id ?? null); setTodos([]); }
    setDeleting(null);
  }

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!fTitle.trim() || !activeList || !householdId) return;
    setSaving(true);

    // For "Alle" (all members selected) or multiple — create one todo per assignee,
    // or one with no assignee if none selected.
    const assigneeIds = fAssignees.length === 0 ? [null] : fAssignees;

    for (const assigneeId of assigneeIds) {
      await supabase.from("todos").insert({
        todo_list_id: activeList, household_id: householdId,
        title: fTitle.trim(), priority: fPriority,
        due_date: fDue || null,
        assigned_to: assigneeId,
      });
    }

    setFTitle(""); setFDue(""); setFPriority("normal"); setFAssignees([]);
    setShowTodoForm(false); setSaving(false);
    await fetchTodos();
  }

  async function toggleTodo(todo: Todo) {
    const completed = !todo.completed;
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed } : t));
    await supabase.from("todos").update({ completed }).eq("id", todo.id);
  }

  async function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
    await supabase.from("todos").delete().eq("id", id);
  }

  // Apply member filter
  const visibleTodos = memberFilter
    ? todos.filter(t => t.assigned_to === memberFilter)
    : todos;

  const open = visibleTodos.filter(t => !t.completed).sort((a,b) =>
    ["high","normal","low"].indexOf(a.priority) - ["high","normal","low"].indexOf(b.priority));
  const done = visibleTodos.filter(t => t.completed);
  const currentColor = activeListObj?.color ?? "#12936b";

  return (
    <div className="max-w-[420px] mx-auto">
      {/* Header */}
      <div className="px-[18px] pt-[14px] pb-4 flex items-start justify-between">
        <div>
          <p className="text-[12.5px] font-[600] text-text-3 tracking-[0.02em]">Ansvarsroller</p>
          <h1 className="text-[27px] font-[700] tracking-tight27 text-fg mt-[3px] leading-[1.05]">Gjøremål</h1>
        </div>
        {activeList && (
          <button onClick={() => setShowTodoForm(true)}
            className="mt-1 flex items-center gap-1.5 text-[13px] font-[600] text-white rounded-[12px] px-3 py-2 hover:opacity-90 active:scale-95 transition-all shadow-card"
            style={{ background: currentColor }}>
            <Plus size={14} strokeWidth={2.5} /> Legg til
          </button>
        )}
      </div>

      <div className="px-[18px] pb-28 space-y-4">
        {/* List picker with delete */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {lists.map(l => (
            <div key={l.id} className="relative group flex-shrink-0">
              <button onClick={() => setActiveList(l.id)}
                className={cn(
                  "whitespace-nowrap rounded-chip pl-4 pr-8 py-[7px] text-[13px] font-[550] border shadow-card transition-all",
                  l.id === activeList ? "bg-fg text-white border-fg" : "bg-surface text-fg border-border hover:bg-surface-2"
                )}>
                {l.icon} {l.name}
              </button>
              <button onClick={e => { e.stopPropagation(); deleteList(l.id); }} disabled={deleting === l.id}
                className={cn("absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity",
                  l.id === activeList ? "text-white/70 hover:text-white" : "text-text-3 hover:text-rose-500")}>
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
          ))}
          <button onClick={() => setAddingList(true)}
            className="whitespace-nowrap rounded-chip px-4 py-[7px] text-[13px] font-[550] border border-dashed border-border text-text-3 hover:text-accent hover:border-accent flex-shrink-0 flex items-center gap-1.5 transition-colors">
            <Plus size={13} strokeWidth={2.5} /> Ny liste
          </button>
        </div>

        {addingList && (
          <div className="flex gap-2">
            <input autoFocus placeholder="Navn på liste" value={newListName} onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addList(); if (e.key === "Escape") { setAddingList(false); setNewListName(""); } }}
              className="flex-1 rounded-[13px] border border-border px-4 py-2.5 text-[15px] outline-none focus:border-accent" />
            <button onClick={addList} className="bg-accent text-white rounded-[13px] px-4 font-[600] text-[15px]">Lag</button>
            <button onClick={() => { setAddingList(false); setNewListName(""); }} className="text-text-3 px-2"><X size={18} /></button>
          </div>
        )}

        {/* Member filter — Alle + each member */}
        {members.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={() => setMemberFilter(null)}
              className={cn("whitespace-nowrap rounded-chip px-3 py-[5px] text-[12px] font-[600] border transition-all flex-shrink-0",
                !memberFilter ? "bg-fg text-white border-fg" : "bg-surface text-fg border-border hover:bg-surface-2")}>
              Alle
            </button>
            {members.map(m => (
              <button key={m.id} onClick={() => setMemberFilter(memberFilter === m.id ? null : m.id)}
                className={cn("whitespace-nowrap rounded-chip pl-2 pr-3 py-[5px] text-[12px] font-[600] border transition-all flex-shrink-0 flex items-center gap-1.5",
                  memberFilter === m.id ? "border-transparent text-white" : "bg-surface text-fg border-border hover:bg-surface-2")}
                style={memberFilter === m.id ? { background: m.color, borderColor: m.color } : {}}>
                <span className="w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] text-white font-[700]"
                  style={{ background: m.color }}>{m.name[0]?.toUpperCase()}</span>
                {m.name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}

        {/* Roterende gjøremål */}
        {householdId && (
          <div>
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[12px] font-[600] uppercase tracking-wide12 text-text-3">Roterende gjøremål</h2>
              <button onClick={() => setShowRotationForm(true)}
                className="text-[12px] font-[600] text-accent flex items-center gap-1">
                <Plus size={12} strokeWidth={2.5} /> Ny rotasjon
              </button>
            </div>
            {rotations.length > 0 && (
              <Card>
                {rotations.map((r, i) => {
                  const assigneeId = r.member_order[r.current_index % r.member_order.length];
                  const member = memberMap[assigneeId];
                  return (
                    <div key={r.id} className={cn("flex items-center gap-3 px-4 py-[13px] group", i > 0 && "border-t border-border")}>
                      <Repeat size={16} className="text-text-3 flex-shrink-0" strokeWidth={2} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-[550] text-fg">{r.title}</p>
                        {member && (
                          <p className="text-[12.5px] text-text-3 mt-[1px] flex items-center gap-1.5">
                            <span className="w-[10px] h-[10px] rounded-full" style={{ background: member.color }} />
                            {member.name.split(" ")[0]} · {r.frequency === "daily" ? "daglig" : "ukentlig"}
                          </p>
                        )}
                      </div>
                      <button onClick={() => handleSkipRotation(r)} disabled={busyRotationId === r.id}
                        title="Hopp over denne runden"
                        className="text-text-3 hover:text-accent transition-colors p-1 disabled:opacity-40">
                        <SkipForward size={15} />
                      </button>
                      <button onClick={() => deleteRotation(r.id)} disabled={busyRotationId === r.id}
                        className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-rose-500 transition-all p-1 disabled:opacity-40">
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        )}

        {/* Todo list */}
        {activeList ? (
          todosLoading ? (
            <div className="flex justify-center py-10 text-text-3 text-[14px]">Laster…</div>
          ) : (
            <div>
              {open.length > 0 ? (
                <Card>
                  {open.map((todo, i) => {
                    const assignedId = todo.assigned_to;
                    const member = assignedId ? memberMap[assignedId] : null;
                    const due = todo.due_date ? dueBadge(todo.due_date) : null;
                    return (
                      <div key={todo.id} className={cn("flex items-center gap-3 px-4 py-[13px] group", i > 0 && "border-t border-border")}>
                        <button onClick={() => toggleTodo(todo)}
                          className="w-[22px] h-[22px] rounded-check border-2 border-[#d6dae1] flex-shrink-0 flex items-center justify-center hover:border-accent transition-colors" />
                        <div className="flex-1 min-w-0"
                          style={{ borderLeft: `3px solid ${PRIORITY_COLOR[todo.priority]}`, borderRadius: "3px", paddingLeft: "12px" }}>
                          <p className="text-[15px] font-[550] text-fg flex items-center gap-1.5">
                            {todo.rotation_id && <Repeat size={12} className="text-text-3 flex-shrink-0" strokeWidth={2} />}
                            {todo.title}
                          </p>
                          {(due || member) && (
                            <p className="text-[12.5px] text-text-3 mt-[1px] flex items-center gap-2 flex-wrap">
                              {member && (
                                <span className="flex items-center gap-1">
                                  <span className="w-[10px] h-[10px] rounded-full" style={{ background: member.color }} />
                                  {member.name.split(" ")[0]}
                                </span>
                              )}
                              {due && <span className={due.over ? "text-rose-500 font-[600]" : ""}>{due.label}</span>}
                            </p>
                          )}
                        </div>
                        <button onClick={() => deleteTodo(todo.id)}
                          className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-rose-500 transition-all p-1">
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </Card>
              ) : (
                <Card>
                  <EmptyState icon={<SquareCheck size={18} strokeWidth={1.7} />}
                    text={memberFilter ? `Ingen gjøremål for ${memberMap[memberFilter]?.name ?? "valgt person"}` : "Ingen aktive gjøremål."} />
                </Card>
              )}

              {done.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => setShowDone(v => !v)}
                    className="w-full flex items-center justify-between px-1 py-2 text-[12px] font-[600] uppercase tracking-wide12 text-text-3">
                    <span>Fullført ({done.length})</span>
                    <span>{showDone ? "▲" : "▼"}</span>
                  </button>
                  {showDone && (
                    <Card>
                      {done.map((todo, i) => (
                        <div key={todo.id} className={cn("flex items-center gap-3 px-4 py-[13px] opacity-50 group", i > 0 && "border-t border-border")}>
                          <button onClick={() => toggleTodo(todo)}
                            className="w-[22px] h-[22px] rounded-check border-2 flex-shrink-0 flex items-center justify-center"
                            style={{ borderColor: currentColor, background: currentColor }}>
                            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                              <path d="M1 4.5l3 3L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <span className="flex-1 text-[15px] font-[550] text-text-3 line-through">{todo.title}</span>
                          <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-rose-500 p-1 transition-all">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </Card>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <Card>
            <EmptyState icon={<SquareCheck size={18} strokeWidth={1.7} />} text="Lag en liste for å komme i gang." />
          </Card>
        )}
      </div>

      {/* ── Add todo sheet ── */}
      {showTodoForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setShowTodoForm(false)}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            <h2 className="text-[19px] font-[700] text-fg mb-5">Nytt gjøremål</h2>
            <form onSubmit={addTodo} className="space-y-3">
              <input type="text" placeholder="Hva skal gjøres? *" value={fTitle}
                onChange={e => setFTitle(e.target.value)} autoFocus required
                className="w-full rounded-[13px] border border-border px-4 py-3 text-[15px] outline-none focus:border-accent" />

              {/* Priority */}
              <div className="flex gap-2">
                {(["low","normal","high"] as const).map(p => (
                  <button key={p} type="button" onClick={() => setFPriority(p)}
                    className={cn("flex-1 py-2.5 text-[13px] rounded-[13px] border-2 font-[550] transition-all",
                      fPriority === p ? "border-transparent text-white" : "border-border text-text-2")}
                    style={fPriority === p ? { background: PRIORITY_COLOR[p] } : {}}>
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>

              {/* Assignee — multi + Alle */}
              {members.length > 0 && (
                <div>
                  <p className="text-[11px] font-[600] text-text-3 mb-2 uppercase tracking-wide12">Tildel til</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setFAssignees([])}
                      className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                        fAssignees.length === 0 ? "bg-fg text-white border-fg" : "border-border text-fg hover:bg-surface-2")}>
                      Ingen
                    </button>
                    <button type="button" onClick={toggleAllAssignees}
                      className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                        allAssigned ? "bg-fg text-white border-fg" : "border-border text-fg hover:bg-surface-2")}>
                      Alle
                    </button>
                    {members.map(m => {
                      const sel = fAssignees.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)}
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
                  {fAssignees.length > 1 && !allAssigned && (
                    <p className="text-[12px] text-text-3 mt-1">Lager {fAssignees.length} gjøremål — ett per person</p>
                  )}
                  {allAssigned && (
                    <p className="text-[12px] text-text-3 mt-1">Lager ett gjøremål per familiemedlem</p>
                  )}
                </div>
              )}

              {/* Due date */}
              <div>
                <p className="text-[11px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">Frist (valgfritt)</p>
                <input type="date" value={fDue} onChange={e => setFDue(e.target.value)}
                  className="w-full rounded-[13px] border border-border px-4 py-2.5 text-[15px] outline-none focus:border-accent" />
              </div>

              <button type="submit" disabled={saving || !fTitle.trim()}
                className="w-full py-3 text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all"
                style={{ background: currentColor }}>
                {saving ? "Lagrer…" : allAssigned || fAssignees.length > 1 ? `Legg til (${fAssignees.length || 1} stk)` : "Legg til gjøremål"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── New rotation sheet ── */}
      {showRotationForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setShowRotationForm(false)}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            <h2 className="text-[19px] font-[700] text-fg mb-5">Ny rotasjon</h2>
            <form onSubmit={addRotation} className="space-y-3">
              <input type="text" placeholder="Hva skal rotere? (f.eks. Ta ut søppel) *" value={rTitle}
                onChange={e => setRTitle(e.target.value)} autoFocus required
                className="w-full rounded-[13px] border border-border px-4 py-3 text-[15px] outline-none focus:border-accent" />

              {lists.length > 1 && (
                <div>
                  <p className="text-[11px] font-[600] text-text-3 mb-2 uppercase tracking-wide12">Liste</p>
                  <div className="flex flex-wrap gap-2">
                    {lists.map(l => (
                      <button key={l.id} type="button" onClick={() => setRListId(l.id)}
                        className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                          (rListId ?? activeList) === l.id ? "bg-fg text-white border-fg" : "border-border text-fg hover:bg-surface-2")}>
                        {l.icon} {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Member order — klikk i rekkefølge */}
              <div>
                <p className="text-[11px] font-[600] text-text-3 mb-2 uppercase tracking-wide12">Rekkefølge (klikk i ønsket rekkefølge)</p>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => {
                    const pos = rMemberOrder.indexOf(m.id);
                    const sel = pos !== -1;
                    return (
                      <button key={m.id} type="button" onClick={() => toggleRotationMember(m.id)}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                          sel ? "border-transparent text-white" : "border-border text-fg")}
                        style={sel ? { background: m.color, borderColor: m.color } : {}}>
                        {sel && <span className="text-[11px] font-[700]">{pos + 1}.</span>}
                        <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] text-white font-[700]"
                          style={{ background: m.color }}>{m.name[0]?.toUpperCase()}</span>
                        {m.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
                {rMemberOrder.length > 0 && (
                  <p className="text-[12px] text-text-3 mt-1">
                    Starter med {memberMap[rMemberOrder[0]]?.name.split(" ")[0]}, roterer videre til neste.
                  </p>
                )}
              </div>

              {/* Frequency */}
              <div className="flex gap-2">
                {(["weekly", "daily"] as const).map(f => (
                  <button key={f} type="button" onClick={() => setRFrequency(f)}
                    className={cn("flex-1 py-2.5 text-[13px] rounded-[13px] border-2 font-[550] transition-all",
                      rFrequency === f ? "border-accent text-accent bg-accent-weak" : "border-border text-text-2")}>
                    {f === "weekly" ? "Ukentlig" : "Daglig"}
                  </button>
                ))}
              </div>

              <button type="submit" disabled={savingRotation || !rTitle.trim() || rMemberOrder.length === 0 || !(rListId ?? activeList)}
                className="w-full py-3 text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all bg-accent">
                {savingRotation ? "Lagrer…" : "Lag rotasjon"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
