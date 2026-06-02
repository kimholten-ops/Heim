"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { id: string; list_id: string; text: string; done: boolean; created_at: string };

export default function ShoppingList({ listId }: { listId: string }) {
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("list_items")
      .select("id, list_id, text, done, created_at")
      .eq("list_id", listId)
      .order("created_at")
      .then(({ data }) => {
        if (active) { setItems((data ?? []) as Item[]); setLoading(false); }
      });

    const channel = supabase
      .channel("list-items-" + listId)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "list_items", filter: `list_id=eq.${listId}`
      }, (payload) => {
        setItems((cur) => {
          if (payload.eventType === "INSERT") {
            const n = payload.new as Item;
            return cur.some((i) => i.id === n.id) ? cur : [...cur, n];
          }
          if (payload.eventType === "UPDATE") {
            const n = payload.new as Item;
            return cur.map((i) => (i.id === n.id ? n : i));
          }
          if (payload.eventType === "DELETE") {
            const o = payload.old as { id: string };
            return cur.filter((i) => i.id !== o.id);
          }
          return cur;
        });
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [supabase, listId]);

  async function add() {
    const t = text.trim();
    if (!t) return;
    setText(""); setErr(null);
    inputRef.current?.focus();
    const id = crypto.randomUUID();
    const optimistic: Item = { id, list_id: listId, text: t, done: false, created_at: new Date().toISOString() };
    setItems((cur) => [...cur, optimistic]);
    const { error } = await supabase.from("list_items").insert({ id, list_id: listId, text: t });
    if (error) { setItems((cur) => cur.filter((i) => i.id !== id)); setErr("Kunne ikke lagre."); }
  }

  async function toggle(it: Item) {
    setErr(null);
    setItems((cur) => cur.map((i) => (i.id === it.id ? { ...i, done: !i.done } : i)));
    const { error } = await supabase.from("list_items").update({ done: !it.done, updated_at: new Date().toISOString() }).eq("id", it.id);
    if (error) setItems((cur) => cur.map((i) => (i.id === it.id ? { ...i, done: it.done } : i)));
  }

  async function remove(it: Item) {
    setErr(null);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== it.id));
    const { error } = await supabase.from("list_items").delete().eq("id", it.id);
    if (error) { setItems(prev); setErr("Kunne ikke slette."); }
  }

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div>
      {/* Add input */}
      <div className="flex gap-2 pb-3 border-b border-border">
        <input
          ref={inputRef}
          className="flex-1 rounded-[13px] border border-border bg-surface-2 px-4 py-2.5 text-[15px] outline-none focus:border-accent focus:bg-surface transition-colors"
          placeholder="Legg til vare…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          className="bg-accent text-white rounded-[13px] px-5 font-[600] text-[15px] hover:opacity-90 active:scale-95 transition-all"
        >
          Legg til
        </button>
      </div>

      {err && <p className="text-rose-500 text-[13px] mt-2">{err}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-text-3 text-[14px]">Laster…</div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-text-3 text-[14px]">
          Tom liste — legg til noe over.
        </div>
      ) : (
        <ul>
          {open.map((it, i) => (
            <ListRow key={it.id} it={it} divider={i > 0} onToggle={() => toggle(it)} onRemove={() => remove(it)} />
          ))}
          {done.length > 0 && (
            <>
              <li className="px-1 pt-4 pb-1.5">
                <span className="text-[11px] font-[600] uppercase tracking-wide12 text-text-3">
                  Fullført ({done.length})
                </span>
              </li>
              {done.map((it, i) => (
                <ListRow key={it.id} it={it} divider={i > 0} onToggle={() => toggle(it)} onRemove={() => remove(it)} />
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}

function ListRow({ it, divider, onToggle, onRemove }: {
  it: Item; divider: boolean; onToggle: () => void; onRemove: () => void;
}) {
  return (
    <li className={cn("flex items-center gap-3 py-[13px]", divider && "border-t border-border")}>
      <button
        onClick={onToggle}
        className={cn(
          "w-[22px] h-[22px] rounded-check border-2 flex-shrink-0 flex items-center justify-center transition-colors",
          it.done ? "bg-accent border-accent" : "border-[#d6dae1]"
        )}
      >
        {it.done && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4.5l3 3L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className={cn("flex-1 text-[15px] font-[550]", it.done ? "line-through text-text-3" : "text-fg")}>
        {it.text}
      </span>
      <button onClick={onRemove} className="text-text-3 hover:text-red-400 transition-colors p-1">
        <X size={15} strokeWidth={2} />
      </button>
    </li>
  );
}
