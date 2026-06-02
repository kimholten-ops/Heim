"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ShoppingList from "@/components/ShoppingList";
import { ShoppingCart, Plus, X } from "lucide-react";
import { SectionLabel, EmptyState, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

type List = { id: string; name: string; type: string };

export default function ListsClient({ householdId, initialLists }: { householdId: string; initialLists: List[] }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [lists, setLists] = useState<List[]>(initialLists);
  const [active, setActive] = useState<string | null>(initialLists[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function addList() {
    const n = name.trim();
    if (!n) return;
    setName(""); setAdding(false);
    const { data } = await supabase.from("lists").insert({ household_id: householdId, name: n, type: "shopping" }).select().single();
    if (data) {
      setLists(prev => [...prev, data as List]);
      setActive((data as List).id);
    } else {
      router.refresh();
    }
  }

  async function deleteList(id: string) {
    const list = lists.find(l => l.id === id);
    if (!confirm(`Slett listen «${list?.name ?? ""}»? Alle varene slettes også.`)) return;
    setDeleting(id);
    await supabase.from("list_items").delete().eq("list_id", id);
    await supabase.from("lists").delete().eq("id", id);
    const remaining = lists.filter(l => l.id !== id);
    setLists(remaining);
    if (active === id) setActive(remaining[0]?.id ?? null);
    setDeleting(null);
  }

  const activeList = lists.find(l => l.id === active);

  return (
    <div className="max-w-[420px] mx-auto">
      <div className="px-[18px] pt-[14px] pb-4">
        <p className="text-[12.5px] font-[600] text-text-3 tracking-[0.02em]">Handle & huske</p>
        <h1 className="text-[27px] font-[700] tracking-tight27 text-fg mt-[3px] leading-[1.05]">Lister</h1>
      </div>

      {/* List picker with delete */}
      <div className="px-[18px] pb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {lists.map(l => (
            <div key={l.id} className="relative group flex-shrink-0">
              <button
                onClick={() => setActive(l.id)}
                className={cn(
                  "whitespace-nowrap rounded-chip pl-4 pr-8 py-[7px] text-[13px] font-[550] border shadow-card transition-all",
                  l.id === active ? "bg-fg text-white border-fg" : "bg-surface text-fg border-border hover:bg-surface-2"
                )}
              >
                {l.name}
              </button>
              {/* Delete button on the chip */}
              <button
                onClick={e => { e.stopPropagation(); deleteList(l.id); }}
                disabled={deleting === l.id}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity",
                  l.id === active ? "text-white/70 hover:text-white" : "text-text-3 hover:text-rose-500"
                )}
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
          ))}

          <button onClick={() => setAdding(true)}
            className="whitespace-nowrap rounded-chip px-4 py-[7px] text-[13px] font-[550] border border-dashed border-border text-text-3 hover:text-accent hover:border-accent flex-shrink-0 flex items-center gap-1.5 transition-colors">
            <Plus size={13} strokeWidth={2.5} /> Ny liste
          </button>
        </div>

        {adding && (
          <div className="flex gap-2 mt-3">
            <input autoFocus
              className="flex-1 rounded-[13px] border border-border bg-surface px-4 py-2.5 text-[15px] outline-none focus:border-accent"
              placeholder="Navn på liste"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addList(); if (e.key === "Escape") { setAdding(false); setName(""); } }}
            />
            <button onClick={addList} className="bg-accent text-white rounded-[13px] px-4 font-[600] text-[15px]">Lag</button>
            <button onClick={() => { setAdding(false); setName(""); }} className="text-text-3 hover:text-fg transition-colors px-2">
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-[18px]">
        {active && activeList ? (
          <Card className="px-4 pt-3 pb-4">
            <SectionLabel title={activeList.name} />
            <ShoppingList listId={active} />
          </Card>
        ) : lists.length === 0 ? (
          <Card>
            <EmptyState icon={<ShoppingCart size={18} strokeWidth={1.7} />} text="Ingen lister ennå — lag en over." />
          </Card>
        ) : null}
      </div>

      <p className="text-[12px] text-text-3 text-center mt-5 px-4">
        Åpne i to nettlesere og se lista synke i sanntid.
      </p>
    </div>
  );
}
