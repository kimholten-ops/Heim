"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronLeft, ChevronRight, Plus, X, Search, Star, Utensils,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";
import { Card, Sheet } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  type Macros, type LoggableItem, scaleMacros, toISODate, todayISO, addDays,
  getLastGrams, setLastGrams, getFavorites, toggleFavorite,
} from "@/lib/nutrition";
import type { KassalappProduct } from "@/app/api/varer/route";

type Entry = {
  id: string; slot: string; matvare_id: string | null; matvare_navn: string | null; product: unknown;
  custom_name: string | null; grams: number;
  kcal: number; protein_g: number; karbo_g: number; fett_g: number;
};
type Matvare = { id: string; navn: string; kcal: number; protein_g: number; karbo_g: number; fett_g: number };

const SLOTS = [
  { key: "frokost", label: "Frokost" },
  { key: "lunsj", label: "Lunsj" },
  { key: "middag", label: "Middag" },
  { key: "kvelds", label: "Kvelds" },
] as const;

function entryName(e: Entry): string {
  return e.custom_name ?? e.matvare_navn ?? (e.product as { name?: string } | null)?.name ?? "Ukjent";
}
function entryKey(e: Entry): string {
  if (e.matvare_id) return `mv:${e.matvare_id}`;
  const ean = (e.product as { ean?: string } | null)?.ean;
  if (ean) return `kl:${ean}`;
  return `custom:${e.custom_name ?? ""}`;
}
// Gjenskaper "per 100 g"-raten fra en allerede lagret (skalert) rad — slik at
// gram-redigering ikke krever et nytt oppslag mot matvarer/Kassalapp.
function impliedPer100g(e: Entry): Macros {
  const factor = e.grams > 0 ? 100 / e.grams : 1;
  return {
    kcal: e.kcal * factor, protein_g: e.protein_g * factor,
    karbo_g: e.karbo_g * factor, fett_g: e.fett_g * factor,
  };
}

export default function KostholdLogClient({ memberId, householdId }: { memberId: string; householdId: string }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kcalTarget, setKcalTarget] = useState<number | null>(null);
  const [proteinTarget, setProteinTarget] = useState<number | null>(null);
  const [todaysMeal, setTodaysMeal] = useState<string | null>(null);
  const [weekTotals, setWeekTotals] = useState<{ label: string; date: string; kcal: number }[]>([]);

  const isToday = date === todayISO();

  const fetchDay = useCallback(async () => {
    const { data } = await supabase.from("food_log_entries").select("*")
      .eq("member_id", memberId).eq("date", date).order("created_at");
    setEntries((data ?? []) as Entry[]);
  }, [memberId, date, supabase]);

  const fetchWeek = useCallback(async () => {
    const start = addDays(todayISO(), -6);
    const { data } = await supabase.from("food_log_entries").select("date, kcal")
      .eq("member_id", memberId).gte("date", start).lte("date", todayISO());
    const byDate = new Map<string, number>();
    for (const row of data ?? []) byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.kcal);
    const days: { label: string; date: string; kcal: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(todayISO(), -i);
      days.push({
        date: d,
        label: new Date(d + "T12:00:00").toLocaleDateString("nb-NO", { weekday: "short" }),
        kcal: Math.round(byDate.get(d) ?? 0),
      });
    }
    setWeekTotals(days);
  }, [memberId, supabase]);

  const fetchGoalsAndMeal = useCallback(async () => {
    const [{ data: profile }, { data: meal }] = await Promise.all([
      supabase.from("health_profiles").select("kcal_target, protein_target_g").eq("member_id", memberId).maybeSingle(),
      supabase.from("meals").select("title").eq("household_id", householdId).eq("date", todayISO()).maybeSingle(),
    ]);
    setKcalTarget(profile?.kcal_target ?? null);
    setProteinTarget(profile?.protein_target_g ?? null);
    setTodaysMeal(meal?.title ?? null);
  }, [memberId, householdId, supabase]);

  useEffect(() => { fetchDay(); }, [fetchDay]);
  useEffect(() => { fetchWeek(); fetchGoalsAndMeal(); }, [fetchWeek, fetchGoalsAndMeal]);

  const entriesBySlot = useMemo(() => {
    const m: Record<string, Entry[]> = { frokost: [], lunsj: [], middag: [], kvelds: [] };
    for (const e of entries) if (m[e.slot]) m[e.slot].push(e);
    return m;
  }, [entries]);

  const daySum = useMemo(
    () => entries.reduce((s, e) => ({ kcal: s.kcal + e.kcal, protein_g: s.protein_g + e.protein_g }), { kcal: 0, protein_g: 0 }),
    [entries]
  );

  async function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("food_log_entries").delete().eq("id", id);
  }

  async function updateGrams(entry: Entry, newGrams: number) {
    if (newGrams <= 0) return;
    const per100g = impliedPer100g(entry);
    const scaled = scaleMacros(per100g, newGrams);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, grams: newGrams, ...scaled } : e)));
    await supabase.from("food_log_entries").update({ grams: newGrams, ...scaled }).eq("id", entry.id);
  }

  /* ── Legg til-sheet ── */
  const [showAdd, setShowAdd] = useState(false);
  const [activeSlot, setActiveSlot] = useState<(typeof SLOTS)[number]["key"]>("frokost");
  const [tab, setTab] = useState<"sok" | "egendefinert">("sok");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LoggableItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<LoggableItem | null>(null);
  const [grams, setGrams] = useState(100);
  const [recent, setRecent] = useState<LoggableItem[]>([]);
  const [favorites, setFavorites] = useState<LoggableItem[]>([]);
  const [cName, setCName] = useState("");
  const [cKcal, setCKcal] = useState("");
  const [cProtein, setCProtein] = useState("");
  const [cKarbo, setCKarbo] = useState("");
  const [cFett, setCFett] = useState("");
  const [cGrams, setCGrams] = useState(100);
  const [saving, setSaving] = useState(false);

  function openAdd(slot: (typeof SLOTS)[number]["key"], prefillName?: string) {
    setActiveSlot(slot);
    setQuery(""); setSearchResults([]); setSelected(null);
    setCName(prefillName ?? ""); setCKcal(""); setCProtein(""); setCKarbo(""); setCFett(""); setCGrams(100);
    setTab(prefillName ? "egendefinert" : "sok");
    setFavorites(getFavorites(memberId));
    loadRecent();
    setShowAdd(true);
  }

  async function loadRecent() {
    const { data } = await supabase.from("food_log_entries").select("*")
      .eq("member_id", memberId).order("created_at", { ascending: false }).limit(60);
    const rows = (data ?? []) as Entry[];
    const seen = new Set<string>();
    const items: LoggableItem[] = [];
    for (const e of rows) {
      const key = entryKey(e);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        key, label: entryName(e),
        source: e.matvare_id ? "matvaretabellen" : e.product ? "butikkvare" : "egendefinert",
        per100g: impliedPer100g(e),
        matvareId: e.matvare_id ?? undefined,
        product: e.product ?? undefined,
      });
      if (items.length >= 20) break;
    }
    setRecent(items);
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    const handle = setTimeout(async () => {
      setSearching(true);
      const [{ data: mv }, kassalappRes] = await Promise.all([
        supabase.from("matvarer").select("id, navn, kcal, protein_g, karbo_g, fett_g").ilike("navn", `%${q}%`).order("navn").limit(10),
        fetch(`/api/varer?q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => ({ products: [] })),
      ]);
      const mvItems: LoggableItem[] = ((mv ?? []) as Matvare[]).map((m) => ({
        key: `mv:${m.id}`, label: m.navn, source: "matvaretabellen",
        per100g: { kcal: m.kcal, protein_g: m.protein_g, karbo_g: m.karbo_g, fett_g: m.fett_g },
        matvareId: m.id,
      }));
      const klProducts: KassalappProduct[] = Array.isArray(kassalappRes?.products) ? kassalappRes.products : [];
      const klItems: LoggableItem[] = klProducts.map((p) => ({
        key: `kl:${p.ean}`, label: p.name, source: "butikkvare",
        per100g: p.nutrition100g,
        product: p,
      }));
      setSearchResults([...mvItems, ...klItems]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, supabase]);

  function pickItem(item: LoggableItem) {
    if (!item.per100g) return;
    setSelected(item);
    setGrams(getLastGrams(item.key) ?? 100);
  }

  async function confirmAddSelected() {
    if (!selected?.per100g) return;
    setSaving(true);
    const scaled = scaleMacros(selected.per100g, grams);
    await supabase.from("food_log_entries").insert({
      member_id: memberId, date, slot: activeSlot,
      matvare_id: selected.matvareId ?? null,
      matvare_navn: selected.source === "matvaretabellen" ? selected.label : null,
      product: selected.product ?? null,
      custom_name: selected.source === "egendefinert" ? selected.label : null,
      grams, ...scaled,
    });
    setLastGrams(selected.key, grams);
    setSaving(false);
    setSelected(null);
    setQuery("");
    setSearchResults([]);
    await fetchDay();
    await fetchWeek();
    loadRecent();
  }

  async function confirmAddCustom() {
    const kcal = Number(cKcal); if (!cName.trim() || !kcal) return;
    setSaving(true);
    const per100g: Macros = { kcal, protein_g: Number(cProtein) || 0, karbo_g: Number(cKarbo) || 0, fett_g: Number(cFett) || 0 };
    const scaled = scaleMacros(per100g, cGrams);
    await supabase.from("food_log_entries").insert({
      member_id: memberId, date, slot: activeSlot, custom_name: cName.trim(), grams: cGrams, ...scaled,
    });
    setSaving(false);
    setShowAdd(false);
    await fetchDay();
    await fetchWeek();
  }

  function isFavorite(key: string) { return favorites.some((f) => f.key === key); }
  function onToggleFavorite(item: LoggableItem) {
    setFavorites(toggleFavorite(memberId, item));
  }

  const SLOT_LABEL: Record<string, string> = Object.fromEntries(SLOTS.map((s) => [s.key, s.label]));

  return (
    <div className="max-w-[420px] mx-auto pb-28">
      <div className="px-[18px] pt-[14px] pb-3 flex items-center gap-2">
        <button onClick={() => router.push("/app/helse")} className="text-text-3 hover:text-fg p-1 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[19px] font-[700] text-fg">Kosthold</h1>
      </div>

      {/* Dato-navigasjon */}
      <div className="px-[18px] mb-4 flex items-center justify-between">
        <button onClick={() => setDate((d) => addDays(d, -1))} className="p-2 text-text-3 hover:text-fg">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-[15px] font-[600] text-fg">
            {isToday ? "I dag" : new Date(date + "T12:00:00").toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {!isToday && <button onClick={() => setDate(todayISO())} className="text-[11.5px] text-accent font-[600]">Til i dag</button>}
        </div>
        <button onClick={() => setDate((d) => addDays(d, 1))} className="p-2 text-text-3 hover:text-fg">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="px-[18px] space-y-3">
        {SLOTS.map(({ key, label }) => {
          const rows = entriesBySlot[key] ?? [];
          const showDinnerShortcut = key === "middag" && isToday && todaysMeal && rows.length === 0;
          return (
            <Card key={key}>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-[14px] font-[600] text-fg">{label}</p>
                <button onClick={() => openAdd(key)} className="text-[12px] font-[600] text-accent flex items-center gap-1">
                  <Plus size={12} strokeWidth={2.5} /> Legg til
                </button>
              </div>
              {rows.map((e, i) => (
                <EntryRow key={e.id} entry={e} divider={i > 0} onDelete={() => deleteEntry(e.id)} onGramsChange={(g) => updateGrams(e, g)} />
              ))}
              {showDinnerShortcut && (
                <button onClick={() => openAdd("middag", todaysMeal ?? undefined)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-2 transition-colors">
                  <Utensils size={14} className="text-text-3 flex-shrink-0" />
                  <span className="text-[13px] font-[550] text-accent">Logg middagen: {todaysMeal}</span>
                </button>
              )}
              {rows.length === 0 && !showDinnerShortcut && (
                <p className="px-4 py-3 text-[13px] text-text-3">Ingenting logget.</p>
              )}
            </Card>
          );
        })}

        {/* Dagssummering */}
        <Card>
          <div className="px-4 py-3.5 space-y-3">
            <p className="text-[11px] font-[600] text-text-3 uppercase tracking-wide12">Dagssummering</p>
            <GoalBar label="Kalorier" value={daySum.kcal} target={kcalTarget} unit="kcal" />
            <GoalBar label="Protein" value={daySum.protein_g} target={proteinTarget} unit="g" />
          </div>
        </Card>

        {/* Ukesoversikt */}
        <Card>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-[600] text-text-3 uppercase tracking-wide12 mb-2">Siste 7 dager</p>
            <div className="h-[140px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekTotals} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10.5, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip content={<WeekTooltip />} />
                  {kcalTarget && <ReferenceLine y={kcalTarget} stroke="var(--text-3)" strokeDasharray="4 4" />}
                  <Bar dataKey="kcal" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Legg til-sheet ── */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} maxHeight>
        <h2 className="text-[19px] font-[700] text-fg mb-1 flex-shrink-0">Legg til — {SLOT_LABEL[activeSlot]}</h2>
        <div className="flex gap-2 mb-3 flex-shrink-0">
          <button onClick={() => { setTab("sok"); setSelected(null); }}
            className={cn("flex-1 py-2 rounded-[10px] border-2 text-[13px] font-[550]", tab === "sok" ? "border-accent text-accent bg-accent-weak" : "border-border text-text-2")}>
            Søk
          </button>
          <button onClick={() => { setTab("egendefinert"); setSelected(null); }}
            className={cn("flex-1 py-2 rounded-[10px] border-2 text-[13px] font-[550]", tab === "egendefinert" ? "border-accent text-accent bg-accent-weak" : "border-border text-text-2")}>
            Egendefinert
          </button>
        </div>

        <div className="overflow-y-auto -mx-1 px-1">
          {tab === "sok" && (
            selected ? (
              <div className="space-y-3">
                <p className="text-[15px] font-[600] text-fg">{selected.label}</p>
                <div>
                  <p className="text-[11px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">Gram</p>
                  <input type="number" value={grams} onChange={(e) => setGrams(Number(e.target.value))} autoFocus
                    className="w-full rounded-[13px] border border-border px-4 py-2.5 text-[15px] outline-none focus:border-accent" />
                </div>
                {selected.per100g && (
                  <p className="text-[12.5px] text-text-3">
                    {Math.round(scaleMacros(selected.per100g, grams).kcal)} kcal · {scaleMacros(selected.per100g, grams).protein_g}g protein
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setSelected(null)} className="flex-1 py-3 rounded-[13px] border border-border text-fg font-[600] text-[14px]">Tilbake</button>
                  <button onClick={confirmAddSelected} disabled={saving || grams <= 0}
                    className="flex-1 py-3 rounded-[13px] bg-accent text-white font-[600] text-[14px] disabled:opacity-40">
                    {saving ? "Lagrer…" : "Legg til"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                  <input type="text" autoFocus placeholder="Søk matvare eller butikkvare" value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-[13px] border border-border pl-9 pr-4 py-2.5 text-[14px] outline-none focus:border-accent" />
                </div>

                {query.trim().length < 2 && (
                  <>
                    {favorites.length > 0 && <ItemChipRow title="Favoritter" items={favorites} onPick={pickItem} onStar={onToggleFavorite} isFavorite={isFavorite} />}
                    {recent.length > 0 && <ItemChipRow title="Nylige" items={recent} onPick={pickItem} onStar={onToggleFavorite} isFavorite={isFavorite} />}
                    {favorites.length === 0 && recent.length === 0 && (
                      <p className="text-[12.5px] text-text-3 py-4 text-center">Søk etter en matvare eller butikkvare over.</p>
                    )}
                  </>
                )}

                {searching && <p className="text-[12.5px] text-text-3 py-2">Søker…</p>}
                {!searching && searchResults.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {searchResults.map((item) => (
                      <SearchResultRow key={item.key} item={item} onPick={pickItem} onStar={onToggleFavorite} isFavorite={isFavorite(item.key)} />
                    ))}
                  </div>
                )}
                {!searching && query.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="text-[12.5px] text-text-3 py-2">Ingen treff.</p>
                )}
              </>
            )
          )}

          {tab === "egendefinert" && (
            <div className="space-y-3">
              <input type="text" placeholder="Navn" value={cName} onChange={(e) => setCName(e.target.value)}
                className="w-full rounded-[13px] border border-border px-4 py-2.5 text-[15px] outline-none focus:border-accent" />
              <div className="grid grid-cols-2 gap-2">
                <LabeledInput label="Kcal / 100g" value={cKcal} onChange={setCKcal} />
                <LabeledInput label="Protein / 100g" value={cProtein} onChange={setCProtein} />
                <LabeledInput label="Karbo / 100g" value={cKarbo} onChange={setCKarbo} />
                <LabeledInput label="Fett / 100g" value={cFett} onChange={setCFett} />
              </div>
              <div>
                <p className="text-[11px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">Gram</p>
                <input type="number" value={cGrams} onChange={(e) => setCGrams(Number(e.target.value))}
                  className="w-full rounded-[13px] border border-border px-4 py-2.5 text-[15px] outline-none focus:border-accent" />
              </div>
              <button onClick={confirmAddCustom} disabled={saving || !cName.trim() || !cKcal}
                className="w-full py-3 rounded-[13px] bg-accent text-white font-[600] text-[15px] disabled:opacity-40">
                {saving ? "Lagrer…" : "Legg til"}
              </button>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function EntryRow({ entry, divider, onDelete, onGramsChange }: {
  entry: Entry; divider: boolean; onDelete: () => void; onGramsChange: (g: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(entry.grams));
  function commit() {
    const g = Number(val);
    if (g > 0) onGramsChange(g);
    setEditing(false);
  }
  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5", divider && "border-t border-border")}>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-[550] text-fg truncate">{entryName(entry)}</p>
        {editing ? (
          <input type="number" autoFocus value={val} onChange={(e) => setVal(e.target.value)}
            onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()}
            className="w-16 text-[12px] rounded-[6px] border border-accent px-1.5 py-0.5 outline-none" />
        ) : (
          <button onClick={() => { setVal(String(entry.grams)); setEditing(true); }} className="text-[12px] text-text-3 hover:text-accent">
            {entry.grams} g
          </button>
        )}
      </div>
      <span className="text-[13px] text-text-2 flex-shrink-0">{Math.round(entry.kcal)} kcal</span>
      <button onClick={onDelete} className="text-text-3 hover:text-rose-500 p-1 flex-shrink-0"><X size={14} /></button>
    </div>
  );
}

function ItemChipRow({ title, items, onPick, onStar, isFavorite }: {
  title: string; items: LoggableItem[]; onPick: (i: LoggableItem) => void;
  onStar: (i: LoggableItem) => void; isFavorite: (key: string) => boolean;
}) {
  return (
    <div className="mb-3">
      <p className="text-[11px] font-[600] text-text-3 mb-1.5 uppercase tracking-wide12">{title}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {items.map((item) => (
          <button key={item.key} onClick={() => onPick(item)}
            disabled={!item.per100g}
            className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-chip border border-border text-[12.5px] font-[550] text-fg hover:bg-surface-2 flex-shrink-0 disabled:opacity-40">
            {item.label}
            <Star size={11} className={isFavorite(item.key) ? "fill-accent text-accent" : "text-text-3"}
              onClick={(e) => { e.stopPropagation(); onStar(item); }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchResultRow({ item, onPick, onStar, isFavorite }: {
  item: LoggableItem; onPick: (i: LoggableItem) => void; onStar: (i: LoggableItem) => void; isFavorite: boolean;
}) {
  const disabled = !item.per100g;
  return (
    <button onClick={() => onPick(item)} disabled={disabled}
      className={cn("w-full flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-left transition-colors", disabled ? "opacity-40" : "hover:bg-surface-2")}>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-[550] text-fg truncate">{item.label}</p>
        <p className="text-[11px] text-text-3 flex items-center gap-1.5">
          <span className={cn("px-1.5 py-[1px] rounded-chip text-[10px] font-[600]", item.source === "matvaretabellen" ? "bg-accent-weak text-accent" : "bg-surface-2 text-text-2")}>
            {item.source === "matvaretabellen" ? "Matvaretabellen" : "Butikkvare"}
          </span>
          {disabled && "mangler næringsdata"}
        </p>
      </div>
      {!disabled && (
        <Star size={14} className={cn("flex-shrink-0", isFavorite ? "fill-accent text-accent" : "text-text-3")}
          onClick={(e) => { e.stopPropagation(); onStar(item); }} />
      )}
    </button>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[10.5px] font-[600] text-text-3 mb-1 uppercase tracking-wide12">{label}</p>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-border px-3 py-2 text-[14px] outline-none focus:border-accent" />
    </div>
  );
}

function GoalBar({ label, value, target, unit }: { label: string; value: number; target: number | null; unit: string }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-[550] text-fg">{label}</span>
        <span className="text-[12.5px] text-text-2">
          {Math.round(value)}{target ? ` / ${target}` : ""} {unit}
        </span>
      </div>
      <div className="h-[6px] rounded-full bg-surface-2 overflow-hidden">
        {target && <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}

function WeekTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: { kcal: number } }[]; label?: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-white rounded-[10px] border border-border px-3 py-2 text-[12.5px] shadow-card">
      <p className="font-[600] text-fg">{label}</p>
      <p className="text-text-2">{payload[0].payload.kcal} kcal</p>
    </div>
  );
}
