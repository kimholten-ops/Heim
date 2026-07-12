"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Product = { ean: string; name: string; brand: string | null; price: number | null; store: string | null };
type Item = { id: string; list_id: string; text: string; done: boolean; product?: Product | null; created_at: string };

export default function ShoppingList({ listId }: { listId: string }) {
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const pendingProductRef = useRef<Product | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("list_items")
      .select("id, list_id, text, done, product, created_at")
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

  function onTextChange(v: string) {
    setText(v);
    pendingProductRef.current = null;
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = v.trim();
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/varer?q=${encodeURIComponent(q)}`);
        if (!res.ok) { setSuggestions([]); return; }
        const data = await res.json();
        setSuggestions(Array.isArray(data?.products) ? data.products : []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function pickSuggestion(p: Product) {
    setText(p.name);
    pendingProductRef.current = p;
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, -1)); return; }
      if (e.key === "Escape") { setShowSuggestions(false); setActiveIndex(-1); return; }
      if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); pickSuggestion(suggestions[activeIndex]); return; }
    }
    if (e.key === "Enter") add();
  }

  async function add() {
    const t = text.trim();
    if (!t) return;
    const product = pendingProductRef.current;
    setText(""); setErr(null); setSuggestions([]); setShowSuggestions(false); setActiveIndex(-1);
    pendingProductRef.current = null;
    inputRef.current?.focus();
    const id = crypto.randomUUID();
    const optimistic: Item = { id, list_id: listId, text: t, done: false, product, created_at: new Date().toISOString() };
    setItems((cur) => [...cur, optimistic]);
    const { error } = await supabase.from("list_items").insert({ id, list_id: listId, text: t, product });
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
  const withPrice = open.filter((i) => typeof i.product?.price === "number");
  const priceSum = withPrice.reduce((sum, i) => sum + (i.product?.price ?? 0), 0);

  return (
    <div>
      {/* Add input */}
      <div className="relative pb-3 border-b border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 rounded-[13px] border border-border bg-surface-2 px-4 py-2.5 text-[15px] outline-none focus:border-accent focus:bg-surface transition-colors"
            placeholder="Legg til vare…"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            autoComplete="off"
          />
          <button
            onClick={add}
            className="bg-accent text-white rounded-[13px] px-5 font-[600] text-[15px] hover:opacity-90 active:scale-95 transition-all"
          >
            Legg til
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute left-0 right-[86px] top-full mt-1 z-10 bg-white border border-border rounded-[13px] shadow-lg overflow-hidden">
            {suggestions.map((p, i) => (
              <li key={p.ean}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(p)}
                  className={cn(
                    "w-full text-left px-4 py-2 flex items-center justify-between gap-2 transition-colors",
                    i === activeIndex ? "bg-surface-2" : "hover:bg-surface-2",
                    i > 0 && "border-t border-border"
                  )}
                >
                  <span className="text-[14px] font-[550] text-fg truncate">{p.name}</span>
                  <span className="text-[12px] text-text-3 flex-shrink-0">
                    {p.brand ? `${p.brand} · ` : ""}{p.price != null ? `fra ${p.price} kr` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
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

      {withPrice.length > 0 && (
        <p className="text-[12.5px] text-text-3 mt-3 pt-3 border-t border-border" title="Priser fra Kassalapp, oppdateres daglig — kan avvike i butikk.">
          Ca. {priceSum % 1 === 0 ? priceSum : priceSum.toFixed(2)} kr · basert på {withPrice.length} av {open.length} varer
        </p>
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
