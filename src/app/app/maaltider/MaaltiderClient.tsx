"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/HouseholdContext";
import { useRouter } from "next/navigation";
import { Plus, X, ChevronLeft, ChevronRight, ShoppingCart, BookOpen, Link as LinkIcon, Wand2, Clock, Users, Search, Sparkles } from "lucide-react";
import { Card, SectionLabel, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

type Recipe = {
  id: string; title: string; body: string | null; url: string | null;
  image_url: string | null; servings: number | null; total_time_minutes: number | null;
  ingredients: Ingredient[]; times_used: number;
};
type Meal = {
  id: string; date: string; title: string | null; cook_id: string | null;
  notes: string | null; recipe_id: string | null;
};
type Ingredient = { name: string; amount?: string; unit?: string };
type UkesmenyDag = { date: string; recipe_id: string | null; fritekst: string | null; begrunnelse: string | null };

const DAY_NAMES = ["Man","Tir","Ons","Tor","Fre","Lør","Søn"];
const PALETTE = ["#0d9488","#f59e0b","#7c5cff","#f97316","#12936b","#ef4444","#3b82f6","#ec4899"];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtWeek(mon: Date): string {
  const sun = addDays(mon, 6);
  const fmt = (d: Date) => d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

export default function MaaltiderClient({
  householdId, initialRecipes, initialMeals, aiEnabled,
}: {
  householdId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialRecipes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialMeals: any[];
  aiEnabled: boolean;
}) {
  const [supabase] = useState(() => createClient());
  const { members } = useHousehold();
  const router = useRouter();

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes as Recipe[]);
  const [meals, setMeals] = useState<Meal[]>(initialMeals as Meal[]);

  // Meal edit sheet
  const [editDay, setEditDay] = useState<string | null>(null);
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [mTitle, setMTitle] = useState("");
  const [mRecipeId, setMRecipeId] = useState<string>("");
  const [mRecipeSearch, setMRecipeSearch] = useState("");
  const [mCookId, setMCookId] = useState<string>("");
  const [mNotes, setMNotes] = useState("");
  const [mSaving, setMSaving] = useState(false);

  // Recipe bank search
  const [recipeSearch, setRecipeSearch] = useState("");

  // Add ingredients to shopping list
  const [addToList, setAddToList] = useState<{ lines: string[]; label: string } | null>(null);
  const [shoppingLists, setShoppingLists] = useState<{ id: string; name: string }[] | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");
  const [addingToList, setAddingToList] = useState(false);
  const [addToListDone, setAddToListDone] = useState(false);

  // Recipe sheet
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [rTitle, setRTitle] = useState("");
  const [rBody, setRBody] = useState("");
  const [rUrl, setRUrl] = useState("");
  const [rImageUrl, setRImageUrl] = useState<string | null>(null);
  const [rServings, setRServings] = useState<string>("");
  const [rTotalTime, setRTotalTime] = useState<string>("");
  const [rIngredients, setRIngredients] = useState<Ingredient[]>([]);
  const [rSaving, setRSaving] = useState(false);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);

  // Import from URL
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Ukesmeny-forslag (AI)
  const [showUkesmeny, setShowUkesmeny] = useState(false);
  const [ukesmenyBusy, setUkesmenyBusy] = useState(false);
  const [ukesmenyApplying, setUkesmenyApplying] = useState(false);
  const [ukesmenyError, setUkesmenyError] = useState<string | null>(null);
  const [ukesmenyPlan, setUkesmenyPlan] = useState<UkesmenyDag[] | null>(null);
  const [varyProteins, setVaryProteins] = useState(true);
  const [quickWeekdays, setQuickWeekdays] = useState(false);
  const [ukesmenySwapDay, setUkesmenySwapDay] = useState<string | null>(null);
  const [ukesmenySwapSearch, setUkesmenySwapSearch] = useState("");

  const memberColorMap = Object.fromEntries(members.map((m, i) => [m.id, PALETTE[i % PALETTE.length]]));

  // Fetch meals for current week
  const fetchMeals = useCallback(async () => {
    if (!householdId) return;
    const end = addDays(weekStart, 13);
    const { data } = await supabase.from("meals").select("id, date, title, cook_id, notes, recipe_id")
      .eq("household_id", householdId)
      .gte("date", toDateStr(weekStart))
      .lte("date", toDateStr(end));
    setMeals((data ?? []) as Meal[]);
  }, [householdId, weekStart, supabase]);

  function openEdit(dateStr: string) {
    const existing = meals.find(m => m.date === dateStr);
    setEditDay(dateStr);
    setEditMeal(existing ?? null);
    setMTitle(existing?.title ?? "");
    setMRecipeId(existing?.recipe_id ?? "");
    setMRecipeSearch("");
    setMCookId(existing?.cook_id ?? "");
    setMNotes(existing?.notes ?? "");
  }

  async function saveMeal(e: React.FormEvent) {
    e.preventDefault();
    if (!editDay || !householdId) return;
    setMSaving(true);
    const recipe = recipes.find(r => r.id === mRecipeId);
    const payload = {
      household_id: householdId, date: editDay,
      title: mTitle.trim() || recipe?.title || null,
      recipe_id: mRecipeId || null,
      cook_id: mCookId || null,
      notes: mNotes.trim() || null,
    };
    if (editMeal) {
      await supabase.from("meals").update(payload).eq("id", editMeal.id);
    } else {
      await supabase.from("meals").insert(payload);
    }
    if (mRecipeId && !editMeal?.recipe_id) {
      await supabase.from("recipes").update({ times_used: (recipe?.times_used ?? 0) + 1 }).eq("id", mRecipeId);
      setRecipes(prev => prev.map(r => r.id === mRecipeId ? { ...r, times_used: r.times_used + 1 } : r));
    }
    setMSaving(false); setEditDay(null);
    await fetchMeals();
  }

  async function deleteMeal() {
    if (!editMeal) return;
    await supabase.from("meals").delete().eq("id", editMeal.id);
    setEditDay(null);
    await fetchMeals();
  }

  function ingredientLines(ings: Ingredient[]): string[] {
    return (ings ?? [])
      .filter(i => i.name?.trim())
      .map(i => [i.amount, i.unit, i.name].filter(Boolean).join(" ").trim());
  }

  async function openAddToList(lines: string[], label: string) {
    if (lines.length === 0) return;
    setAddToList({ lines, label });
    setNewListName(""); setAddToListDone(false);
    if (shoppingLists === null && householdId) {
      const { data } = await supabase.from("lists").select("id, name")
        .eq("household_id", householdId).eq("type", "shopping").order("created_at");
      const found = data ?? [];
      setShoppingLists(found);
      setSelectedListId(found.length > 0 ? found[0].id : "__new__");
    } else {
      setSelectedListId(shoppingLists && shoppingLists.length > 0 ? shoppingLists[0].id : "__new__");
    }
  }

  async function confirmAddToList() {
    if (!addToList || !householdId || !selectedListId) return;
    setAddingToList(true);
    let listId = selectedListId;
    if (listId === "__new__") {
      const n = newListName.trim() || "Handleliste";
      const { data } = await supabase.from("lists").insert({ household_id: householdId, name: n, type: "shopping" }).select().single();
      if (!data) { setAddingToList(false); return; }
      const created = data as { id: string; name: string };
      listId = created.id;
      setShoppingLists(prev => [...(prev ?? []), created]);
    }
    const rows = addToList.lines.map(text => ({ id: crypto.randomUUID(), list_id: listId, text }));
    await supabase.from("list_items").insert(rows);
    setSelectedListId(listId);
    setAddingToList(false);
    setAddToListDone(true);
  }

  function generateList() {
    const weekMeals = meals.filter(m => {
      const d = new Date(m.date);
      return d >= weekStart && d <= addDays(weekStart, 6) && m.recipe_id;
    });
    const lines = weekMeals.flatMap(m => {
      const recipe = recipes.find(r => r.id === m.recipe_id);
      return recipe ? ingredientLines(recipe.ingredients) : [];
    });
    if (lines.length === 0) { alert("Ingen av middagene denne uken har oppskrift med ingredienser."); return; }
    openAddToList(lines, `Ukesplanen (${fmtWeek(weekStart)})`);
  }

  // ── Recipe form ──
  function openNewRecipe() {
    setEditRecipe(null); setRTitle(""); setRBody(""); setRUrl("");
    setRImageUrl(null); setRServings(""); setRTotalTime(""); setRIngredients([]);
    setShowImport(false); setImportUrl(""); setImportError(null); setImportNotice(null);
    setShowRecipeForm(true);
  }
  function openEditRecipe(r: Recipe) {
    setEditRecipe(r); setRTitle(r.title); setRBody(r.body ?? "");
    setRUrl(r.url ?? ""); setRImageUrl(r.image_url ?? null);
    setRServings(r.servings != null ? String(r.servings) : "");
    setRTotalTime(r.total_time_minutes != null ? String(r.total_time_minutes) : "");
    setRIngredients([...(r.ingredients ?? [])]);
    setShowImport(false); setImportUrl(""); setImportError(null); setImportNotice(null);
    setShowRecipeForm(true);
  }

  async function importFromUrl() {
    if (!importUrl.trim()) return;
    setImporting(true); setImportError(null); setImportNotice(null);
    try {
      const res = await fetch("/api/recipe-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRUrl(importUrl.trim());
        if (data?.error === "no_structured_data") {
          setImportError("Fant ingen strukturert oppskrift-data på denne siden. Fyll ut skjemaet under manuelt — lenken er allerede lagret som kilde.");
        } else {
          setImportError(data?.error ?? "Klarte ikke hente oppskriften.");
        }
        return;
      }
      const r = data.recipe;
      setRTitle(r.title ?? "");
      setRBody(r.body ?? "");
      setRUrl(r.url ?? importUrl.trim());
      setRImageUrl(r.image_url ?? null);
      setRServings(r.servings != null ? String(r.servings) : "");
      setRTotalTime(r.total_time_minutes != null ? String(r.total_time_minutes) : "");
      setRIngredients(Array.isArray(r.ingredients) && r.ingredients.length ? r.ingredients : []);
      if (data.aiParsed) setImportNotice("Tolket med AI — sjekk verdiene før du lagrer.");
      setShowImport(false);
    } catch {
      setImportError("Klarte ikke hente oppskriften. Sjekk lenken og prøv igjen.");
    } finally {
      setImporting(false);
    }
  }

  // ── Ukesmeny-forslag (AI) ──
  function openUkesmeny() {
    setUkesmenyError(null); setUkesmenyPlan(null); setUkesmenySwapDay(null);
    setShowUkesmeny(true);
  }

  async function suggestUkesmeny() {
    setUkesmenyBusy(true); setUkesmenyError(null); setUkesmenyPlan(null);
    try {
      const res = await fetch("/api/ai/ukesmeny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: toDateStr(weekStart), varyProteins, quickWeekdays }),
      });
      const json = await res.json();
      if (!res.ok) {
        setUkesmenyError(json.error ?? "Kunne ikke lage forslag akkurat nå.");
        return;
      }
      setUkesmenyPlan(json.dager ?? []);
    } catch {
      setUkesmenyError("Kunne ikke lage forslag akkurat nå.");
    } finally {
      setUkesmenyBusy(false);
    }
  }

  function updateUkesmenyDay(date: string, patch: Partial<UkesmenyDag>) {
    setUkesmenyPlan(prev => prev ? prev.map(d => d.date === date ? { ...d, ...patch } : d) : prev);
  }

  async function applyUkesmenyPlan() {
    if (!ukesmenyPlan || !householdId) return;
    const overwriting = ukesmenyPlan.some(d => {
      if (!d.recipe_id && !d.fritekst) return false;
      const existing = meals.find(m => m.date === d.date);
      return existing && (existing.title || existing.recipe_id);
    });
    if (overwriting && !confirm("Noen dager i uken har allerede en middag satt opp. Overskriv med forslaget?")) return;

    setUkesmenyApplying(true);
    for (const d of ukesmenyPlan) {
      if (!d.recipe_id && !d.fritekst) continue;
      const recipe = d.recipe_id ? recipes.find(r => r.id === d.recipe_id) : null;
      const payload = {
        household_id: householdId, date: d.date,
        title: d.fritekst || recipe?.title || null,
        recipe_id: d.recipe_id || null,
      };
      const existing = meals.find(m => m.date === d.date);
      if (existing) {
        await supabase.from("meals").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("meals").insert(payload);
      }
    }
    setUkesmenyApplying(false);
    setShowUkesmeny(false);
    setUkesmenyPlan(null);
    await fetchMeals();
  }

  async function saveRecipe(e: React.FormEvent) {
    e.preventDefault();
    if (!rTitle.trim() || !householdId) return;
    setRSaving(true);
    const payload = {
      household_id: householdId, title: rTitle.trim(),
      body: rBody.trim() || null, url: rUrl.trim() || null,
      image_url: rImageUrl || null,
      servings: rServings.trim() ? Number(rServings) : null,
      total_time_minutes: rTotalTime.trim() ? Number(rTotalTime) : null,
      ingredients: rIngredients.filter(i => i.name.trim()),
    };
    if (editRecipe) {
      await supabase.from("recipes").update(payload).eq("id", editRecipe.id);
      setRecipes(prev => prev.map(r => r.id === editRecipe.id ? { ...r, ...payload } : r));
    } else {
      const { data } = await supabase.from("recipes").insert({ ...payload, times_used: 0 }).select().single();
      if (data) setRecipes(prev => [data as Recipe, ...prev]);
    }
    setRSaving(false); setShowRecipeForm(false); setEditRecipe(null);
  }

  async function deleteRecipe(id: string) {
    if (!confirm("Slett oppskrift?")) return;
    await supabase.from("recipes").delete().eq("id", id);
    setRecipes(prev => prev.filter(r => r.id !== id));
    setViewRecipe(null); setShowRecipeForm(false);
  }

  function addIngredient() { setRIngredients(prev => [...prev, { name: "", amount: "", unit: "" }]); }
  function updateIng(i: number, field: keyof Ingredient, val: string) {
    setRIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing));
  }
  function removeIng(i: number) { setRIngredients(prev => prev.filter((_, idx) => idx !== i)); }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hasMeals = meals.some(m => {
    const d = new Date(m.date);
    return d >= weekStart && d <= addDays(weekStart, 6);
  });

  return (
    <div className="max-w-[420px] mx-auto">
      {/* Header */}
      <div className="px-[18px] pt-[14px] pb-4 flex items-start justify-between">
        <div>
          <p className="text-[12.5px] font-[600] text-text-3 tracking-[0.02em]">Familiens middager</p>
          <h1 className="text-[27px] font-[700] tracking-tight27 text-fg mt-[3px] leading-[1.05]">Måltider</h1>
        </div>
      </div>

      <div className="px-[18px] pb-28 space-y-5">

        {/* Week navigator */}
        <div className="flex items-center justify-between">
          <button onClick={() => { setWeekStart(w => addDays(w, -7)); setTimeout(fetchMeals, 0); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-border shadow-card hover:bg-surface-2 transition-colors">
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <span className="text-[14px] font-[600] text-fg">{fmtWeek(weekStart)}</span>
          <button onClick={() => { setWeekStart(w => addDays(w, 7)); setTimeout(fetchMeals, 0); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-border shadow-card hover:bg-surface-2 transition-colors">
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </div>

        {aiEnabled && (
          <button onClick={openUkesmeny}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[13px] border border-dashed border-accent/40 text-accent text-[13.5px] font-[600] hover:bg-accent-weak transition-colors">
            <Sparkles size={14} strokeWidth={2} /> Foreslå ukesmeny
          </button>
        )}

        {/* Week plan */}
        <div>
          <SectionLabel title="Ukeplan" />
          <div className="space-y-2">
            {weekDays.map((day, i) => {
              const dateStr = toDateStr(day);
              const meal = meals.find(m => m.date === dateStr);
              const recipe = meal?.recipe_id ? recipes.find(r => r.id === meal.recipe_id) : null;
              const displayTitle = meal?.title || recipe?.title;
              const cook = meal?.cook_id ? members.find(m => m.id === meal.cook_id) : null;
              const isToday = dateStr === toDateStr(new Date());

              return (
                <button key={dateStr} onClick={() => openEdit(dateStr)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-[16px] px-4 py-3 text-left transition-all",
                    displayTitle
                      ? "bg-surface border border-border shadow-card hover:shadow-md"
                      : "bg-surface/60 border-2 border-dashed border-border hover:border-accent hover:bg-surface"
                  )}>
                  {/* Date tile */}
                  <div className={cn(
                    "w-[46px] h-[46px] rounded-[13px] flex flex-col items-center justify-center flex-shrink-0",
                    isToday ? "bg-accent text-white" : "bg-surface-2"
                  )}>
                    <span className={cn("text-[17px] font-[700] leading-none", isToday ? "text-white" : "text-fg")}>
                      {day.getDate()}
                    </span>
                    <span className={cn("text-[10px] font-[600] uppercase tracking-[0.04em] mt-[2px]", isToday ? "text-white/80" : "text-text-3")}>
                      {DAY_NAMES[i]}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {displayTitle ? (
                      <>
                        <p className="text-[15px] font-[600] text-fg truncate">{displayTitle}</p>
                        <div className="flex items-center gap-2 mt-[2px] text-[12.5px] text-text-2">
                          {recipe && <span className="flex items-center gap-1"><BookOpen size={11} /> Oppskrift</span>}
                          {cook && (
                            <span className="flex items-center gap-1.5">
                              <span className="w-[14px] h-[14px] rounded-full flex-shrink-0"
                                style={{ background: memberColorMap[cook.id] ?? "var(--accent)" }} />
                              {cook.name.split(" ")[0]} lager
                            </span>
                          )}
                          {meal?.notes && <span className="truncate text-text-3">{meal.notes}</span>}
                        </div>
                      </>
                    ) : (
                      <p className="text-[14px] text-text-3">+ Legg til middag</p>
                    )}
                  </div>

                  {displayTitle && (
                    <ChevronRight size={16} className="text-text-3 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate shopping list */}
        {hasMeals && (
          <button onClick={generateList}
            className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] hover:opacity-90 active:scale-[.98] transition-all">
            <ShoppingCart size={17} strokeWidth={2} />
            Legg ingredienser til handleliste
          </button>
        )}

        {/* Recipe bank */}
        <div>
          <div className="flex items-center justify-between px-1 pb-2">
            <SectionLabel title="Oppskriftsbank" />
            <button onClick={openNewRecipe}
              className="flex items-center gap-1 text-[13px] font-[600] text-accent hover:opacity-80 transition-opacity">
              <Plus size={13} strokeWidth={2.5} /> Ny
            </button>
          </div>

          {recipes.length === 0 ? (
            <Card>
              <EmptyState icon={<BookOpen size={18} strokeWidth={1.7} />}
                text="Ingen oppskrifter ennå — legg til din første." />
            </Card>
          ) : (
            <>
              {recipes.length > 5 && (
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
                  <input type="text" placeholder="Søk i oppskrifter…" value={recipeSearch}
                    onChange={e => setRecipeSearch(e.target.value)}
                    className="w-full rounded-[13px] border border-border bg-surface pl-9 pr-4 py-2.5 text-[14px] placeholder:text-text-3 outline-none focus:border-accent" />
                </div>
              )}
              {(() => {
                const q = recipeSearch.trim().toLowerCase();
                const filtered = q ? recipes.filter(r => r.title.toLowerCase().includes(q)) : recipes;
                if (filtered.length === 0) {
                  return <p className="text-[13px] text-text-3 px-1 py-3">Ingen oppskrifter matcher «{recipeSearch}».</p>;
                }
                return (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(r => (
                <button key={r.id} onClick={() => setViewRecipe(r)}
                  className="bg-surface border border-border rounded-[16px] shadow-card overflow-hidden text-left hover:shadow-md active:scale-[.98] transition-all">
                  {r.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="w-full h-24 object-cover" />
                  )}
                  <div className="p-3.5">
                    <p className="text-[14.5px] font-[600] text-fg leading-tight truncate">{r.title}</p>
                    <div className="flex items-center gap-2 flex-wrap text-[12px] text-text-3 mt-1">
                      {r.servings && <span className="flex items-center gap-1"><Users size={10} /> {r.servings}</span>}
                      {r.total_time_minutes && <span className="flex items-center gap-1"><Clock size={10} /> {r.total_time_minutes} min</span>}
                      {!r.servings && !r.total_time_minutes && <span>{r.ingredients?.length ?? 0} ingredienser</span>}
                      {r.times_used > 0 && <span>· {r.times_used}× brukt</span>}
                    </div>
                    {r.url && <span className="flex items-center gap-1 text-[11px] text-accent mt-1"><LinkIcon size={10} /> Lenke</span>}
                  </div>
                </button>
              ))}
            </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* ── Meal edit sheet ── */}
      {editDay && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm" onClick={() => setEditDay(null)}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[19px] font-[700] text-fg">
                {DAY_NAMES[weekDays.findIndex(d => toDateStr(d) === editDay)]}
                {" · "}{new Date(editDay).getDate()}.
              </h2>
              {editMeal && (
                <button onClick={deleteMeal} className="text-[13px] text-rose-500 hover:text-rose-700 font-[550]">Slett</button>
              )}
            </div>

            <form onSubmit={saveMeal} className="space-y-4">
              {/* Recipe picker */}
              <div>
                <p className="text-[11px] font-[600] text-text-3 mb-2 uppercase tracking-wide12">Velg fra oppskriftsbank</p>
                {recipes.length > 5 && (
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                    <input type="text" placeholder="Søk…" value={mRecipeSearch}
                      onChange={e => setMRecipeSearch(e.target.value)}
                      className="w-full rounded-[10px] border border-border bg-surface pl-8 pr-3 py-2 text-[13.5px] placeholder:text-text-3 outline-none focus:border-accent" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setMRecipeId("")}
                    className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                      !mRecipeId ? "bg-fg text-white border-fg" : "border-border text-fg")}>
                    Ingen
                  </button>
                  {recipes
                    .filter(r => !mRecipeSearch.trim() || r.title.toLowerCase().includes(mRecipeSearch.trim().toLowerCase()))
                    .map(r => (
                    <button key={r.id} type="button" onClick={() => { setMRecipeId(r.id); setMTitle(""); }}
                      className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                        mRecipeId === r.id ? "bg-fg text-white border-fg" : "border-border text-fg hover:bg-surface-2")}>
                      {r.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Free text (if no recipe) */}
              {!mRecipeId && (
                <input type="text" placeholder="Eller skriv fritt (f.eks. Tacos)" value={mTitle}
                  onChange={e => setMTitle(e.target.value)}
                  className="w-full rounded-[13px] border border-border px-4 py-3 text-[15px] placeholder:text-text-3 outline-none focus:border-accent" />
              )}

              {/* Cook picker */}
              {members.length > 0 && (
                <div>
                  <p className="text-[11px] font-[600] text-text-3 mb-2 uppercase tracking-wide12">Hvem lager mat?</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setMCookId("")}
                      className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                        !mCookId ? "bg-fg text-white border-fg" : "border-border text-fg")}>
                      Ingen
                    </button>
                    {members.map((m, i) => {
                      const col = PALETTE[i % PALETTE.length];
                      const sel = mCookId === m.id;
                      return (
                        <button key={m.id} type="button" onClick={() => setMCookId(m.id)}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                            sel ? "border-transparent text-white" : "border-border text-fg")}
                          style={sel ? { background: col, borderColor: col } : {}}>
                          <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] text-white"
                            style={{ background: col }}>{m.name[0]?.toUpperCase()}</span>
                          {m.name.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <input type="text" placeholder="Notat (valgfritt, f.eks. glutenfri)" value={mNotes}
                onChange={e => setMNotes(e.target.value)}
                className="w-full rounded-[13px] border border-border px-4 py-3 text-[15px] placeholder:text-text-3 outline-none focus:border-accent" />

              <button type="submit" disabled={mSaving || (!mTitle.trim() && !mRecipeId)}
                className="w-full py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all">
                {mSaving ? "Lagrer…" : "Lagre"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Recipe view sheet ── */}
      {viewRecipe && !showRecipeForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm" onClick={() => setViewRecipe(null)}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            {viewRecipe.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewRecipe.image_url} alt="" className="w-full h-40 object-cover rounded-[14px] mb-4" />
            )}
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-[21px] font-[700] text-fg flex-1 mr-3">{viewRecipe.title}</h2>
              <div className="flex gap-2">
                <button onClick={() => openEditRecipe(viewRecipe)}
                  className="text-[13px] font-[550] text-accent border border-accent/30 rounded-[10px] px-3 py-1.5 hover:bg-accent-weak">
                  Rediger
                </button>
                <button onClick={() => deleteRecipe(viewRecipe.id)}
                  className="text-[13px] font-[550] text-rose-500 border border-rose-200 rounded-[10px] px-3 py-1.5 hover:bg-rose-50">
                  Slett
                </button>
              </div>
            </div>

            {(viewRecipe.servings || viewRecipe.total_time_minutes) && (
              <div className="flex items-center gap-3 text-[13px] text-text-2 mb-4">
                {viewRecipe.servings && <span className="flex items-center gap-1"><Users size={13} /> {viewRecipe.servings} porsjoner</span>}
                {viewRecipe.total_time_minutes && <span className="flex items-center gap-1"><Clock size={13} /> {viewRecipe.total_time_minutes} min</span>}
              </div>
            )}

            {viewRecipe.url && (
              <a href={viewRecipe.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-accent text-[13px] font-[550] mb-4 hover:opacity-80">
                <LinkIcon size={13} /> Åpne oppskriftslenke
              </a>
            )}

            {(viewRecipe.ingredients?.length ?? 0) > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-[600] text-text-3 uppercase tracking-wide12">Ingredienser</p>
                  <button onClick={() => openAddToList(ingredientLines(viewRecipe.ingredients), viewRecipe.title)}
                    className="flex items-center gap-1 text-[12.5px] font-[600] text-accent hover:opacity-80 transition-opacity">
                    <ShoppingCart size={12} strokeWidth={2} /> Legg til handleliste
                  </button>
                </div>
                <div className="bg-surface-2 rounded-[13px] divide-y divide-border overflow-hidden">
                  {viewRecipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-[14px] text-fg">
                      <span className="text-text-3 w-16 text-right flex-shrink-0">
                        {[ing.amount, ing.unit].filter(Boolean).join(" ")}
                      </span>
                      <span>{ing.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewRecipe.body && (
              <div>
                <p className="text-[11px] font-[600] text-text-3 uppercase tracking-wide12 mb-2">Fremgangsmåte</p>
                <p className="text-[14.5px] text-fg leading-relaxed whitespace-pre-wrap">{viewRecipe.body}</p>
              </div>
            )}

            <p className="text-[12px] text-text-3 mt-4">{viewRecipe.times_used}× brukt i måltidsplanen</p>
          </div>
        </div>
      )}

      {/* ── Recipe form sheet ── */}
      {showRecipeForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm" onClick={() => { setShowRecipeForm(false); setEditRecipe(null); }}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            <h2 className="text-[19px] font-[700] text-fg mb-4">
              {editRecipe ? "Rediger oppskrift" : "Ny oppskrift"}
            </h2>

            {!editRecipe && (
              <div className="mb-4">
                {!showImport ? (
                  <button type="button" onClick={() => setShowImport(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[13px] border border-dashed border-accent/40 text-accent text-[13.5px] font-[600] hover:bg-accent-weak transition-colors">
                    <Wand2 size={14} strokeWidth={2} /> Importer fra lenke
                  </button>
                ) : (
                  <div className="bg-surface-2 rounded-[13px] p-3">
                    <div className="flex gap-2">
                      <input type="url" placeholder="Lim inn lenke til oppskrift" value={importUrl}
                        onChange={e => setImportUrl(e.target.value)} autoFocus
                        className="flex-1 rounded-[10px] border border-border bg-white px-3 py-2 text-[14px] placeholder:text-text-3 outline-none focus:border-accent" />
                      <button type="button" onClick={importFromUrl} disabled={importing || !importUrl.trim()}
                        className="px-4 rounded-[10px] bg-accent text-white text-[13.5px] font-[600] disabled:opacity-40 hover:opacity-90 transition-all">
                        {importing ? "Henter…" : "Hent"}
                      </button>
                    </div>
                    {importError && <p className="text-[12.5px] text-rose-500 mt-2">{importError}</p>}
                    <p className="text-[11.5px] text-text-3 mt-2">Henter tittel, ingredienser og fremgangsmåte automatisk der det er mulig — sjekk gjerne over før du lagrer.</p>
                  </div>
                )}
              </div>
            )}

            {importNotice && (
              <p className="text-[12.5px] text-accent bg-accent-weak rounded-[10px] px-3 py-2 mb-3">{importNotice}</p>
            )}

            <form onSubmit={saveRecipe} className="space-y-3">
              {rImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rImageUrl} alt="" className="w-full h-32 object-cover rounded-[13px]" />
              )}

              <input type="text" placeholder="Navn på rett *" value={rTitle} onChange={e => setRTitle(e.target.value)} required
                className="w-full rounded-[13px] border border-border px-4 py-3 text-[15px] placeholder:text-text-3 outline-none focus:border-accent" />

              <div className="flex gap-2">
                <input type="number" min={1} placeholder="Porsjoner" value={rServings} onChange={e => setRServings(e.target.value)}
                  className="w-1/2 rounded-[13px] border border-border px-4 py-3 text-[15px] placeholder:text-text-3 outline-none focus:border-accent" />
                <input type="number" min={1} placeholder="Minutter" value={rTotalTime} onChange={e => setRTotalTime(e.target.value)}
                  className="w-1/2 rounded-[13px] border border-border px-4 py-3 text-[15px] placeholder:text-text-3 outline-none focus:border-accent" />
              </div>

              <input type="url" placeholder="Lenke til oppskrift (valgfritt)" value={rUrl} onChange={e => setRUrl(e.target.value)}
                className="w-full rounded-[13px] border border-border px-4 py-3 text-[15px] placeholder:text-text-3 outline-none focus:border-accent" />

              <textarea placeholder="Fremgangsmåte (valgfritt)" value={rBody} onChange={e => setRBody(e.target.value)} rows={3}
                className="w-full rounded-[13px] border border-border px-4 py-3 text-[15px] placeholder:text-text-3 outline-none focus:border-accent resize-none" />

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-[600] text-text-3 uppercase tracking-wide12">Ingredienser</p>
                  <button type="button" onClick={addIngredient}
                    className="flex items-center gap-1 text-[13px] font-[550] text-accent hover:opacity-80">
                    <Plus size={13} /> Legg til
                  </button>
                </div>
                {rIngredients.length === 0 && (
                  <p className="text-[13px] text-text-3 italic">Ingen ingredienser ennå — disse brukes til å generere handleliste.</p>
                )}
                <div className="space-y-2">
                  {rIngredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" placeholder="Mengde" value={ing.amount ?? ""} onChange={e => updateIng(i, "amount", e.target.value)}
                        className="w-20 rounded-[10px] border border-border px-3 py-2 text-[14px] outline-none focus:border-accent" />
                      <input type="text" placeholder="Enhet" value={ing.unit ?? ""} onChange={e => updateIng(i, "unit", e.target.value)}
                        className="w-20 rounded-[10px] border border-border px-3 py-2 text-[14px] outline-none focus:border-accent" />
                      <input type="text" placeholder="Ingrediens *" value={ing.name} onChange={e => updateIng(i, "name", e.target.value)}
                        className="flex-1 rounded-[10px] border border-border px-3 py-2 text-[14px] outline-none focus:border-accent" />
                      <button type="button" onClick={() => removeIng(i)} className="text-text-3 hover:text-rose-500 p-1 transition-colors">
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={rSaving || !rTitle.trim()}
                className="w-full py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all">
                {rSaving ? "Lagrer…" : editRecipe ? "Oppdater oppskrift" : "Legg til oppskrift"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Add to shopping list sheet ── */}
      {addToList && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm" onClick={() => setAddToList(null)}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            {addToListDone ? (
              <>
                <h2 className="text-[19px] font-[700] text-fg mb-2">Lagt til!</h2>
                <p className="text-[14px] text-text-2 mb-5">
                  {addToList.lines.length} {addToList.lines.length === 1 ? "vare er" : "varer er"} lagt til handlelisten fra {addToList.label}.
                </p>
                <button onClick={() => { setAddToList(null); router.push("/app/lister"); }}
                  className="w-full py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] hover:opacity-90 transition-all">
                  Åpne handleliste
                </button>
              </>
            ) : (
              <>
                <h2 className="text-[19px] font-[700] text-fg mb-1">Legg til handleliste</h2>
                <p className="text-[13px] text-text-3 mb-4">{addToList.lines.length} ingredienser fra {addToList.label}</p>
                {shoppingLists === null ? (
                  <p className="text-[13px] text-text-3 mb-3">Laster lister…</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {shoppingLists.map(l => (
                      <button key={l.id} type="button" onClick={() => setSelectedListId(l.id)}
                        className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550] transition-all",
                          selectedListId === l.id ? "bg-fg text-white border-fg" : "border-border text-fg hover:bg-surface-2")}>
                        {l.name}
                      </button>
                    ))}
                    <button type="button" onClick={() => setSelectedListId("__new__")}
                      className={cn("px-3 py-1.5 rounded-chip border text-[13px] font-[550] flex items-center gap-1 transition-all",
                        selectedListId === "__new__" ? "bg-fg text-white border-fg" : "border-dashed border-border text-text-3 hover:text-accent hover:border-accent")}>
                      <Plus size={12} /> Ny liste
                    </button>
                  </div>
                )}
                {selectedListId === "__new__" && (
                  <input autoFocus placeholder="Navn på ny liste" value={newListName} onChange={e => setNewListName(e.target.value)}
                    className="w-full rounded-[13px] border border-border px-4 py-2.5 text-[15px] placeholder:text-text-3 outline-none focus:border-accent mb-3" />
                )}
                <button onClick={confirmAddToList} disabled={addingToList || !selectedListId || shoppingLists === null}
                  className="w-full py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all">
                  {addingToList ? "Legger til…" : `Legg til ${addToList.lines.length} varer`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Ukesmeny-forslag sheet ── */}
      {showUkesmeny && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm" onClick={() => setShowUkesmeny(false)}>
          <div className="bg-white rounded-t-[24px] p-5 pb-10 max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            <h2 className="text-[19px] font-[700] text-fg mb-1">Foreslå ukesmeny</h2>
            <p className="text-[13px] text-text-3 mb-4">{fmtWeek(weekStart)} — basert på oppskriftsbanken og hva dere har spist nylig.</p>

            {!ukesmenyPlan ? (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[14px] text-fg">
                  <input type="checkbox" checked={varyProteins} onChange={e => setVaryProteins(e.target.checked)} />
                  Varier proteinkilder
                </label>
                <label className="flex items-center gap-2 text-[14px] text-fg">
                  <input type="checkbox" checked={quickWeekdays} onChange={e => setQuickWeekdays(e.target.checked)} />
                  Raske middager på hverdager
                </label>
                {ukesmenyError && <p className="text-[12.5px] text-rose-500">{ukesmenyError}</p>}
                <button onClick={suggestUkesmeny} disabled={ukesmenyBusy}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all">
                  <Sparkles size={15} strokeWidth={2} /> {ukesmenyBusy ? "Lager forslag…" : "Lag forslag"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {ukesmenyPlan.map((d, i) => {
                  const recipe = d.recipe_id ? recipes.find(r => r.id === d.recipe_id) : null;
                  const displayTitle = d.fritekst || recipe?.title;
                  const dayIdx = weekDays.findIndex(day => toDateStr(day) === d.date);
                  return (
                    <div key={d.date} className="bg-surface-2 rounded-[13px] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-[600] text-text-3 uppercase tracking-wide12">
                            {dayIdx >= 0 ? DAY_NAMES[dayIdx] : ""} {new Date(d.date).getDate()}.
                          </p>
                          <p className="text-[14.5px] font-[600] text-fg truncate">{displayTitle || "Ingenting foreslått"}</p>
                          {d.begrunnelse && <p className="text-[12px] text-text-3 mt-[2px]">{d.begrunnelse}</p>}
                        </div>
                        <button type="button"
                          onClick={() => { setUkesmenySwapDay(ukesmenySwapDay === d.date ? null : d.date); setUkesmenySwapSearch(""); }}
                          className="text-[12.5px] font-[600] text-accent flex-shrink-0 hover:opacity-80">
                          Bytt
                        </button>
                      </div>

                      {ukesmenySwapDay === d.date && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <input type="text" placeholder="Søk i oppskrifter…" value={ukesmenySwapSearch} autoFocus
                            onChange={e => setUkesmenySwapSearch(e.target.value)}
                            className="w-full rounded-[10px] border border-border bg-white px-3 py-2 text-[13.5px] placeholder:text-text-3 outline-none focus:border-accent mb-2" />
                          <div className="flex flex-wrap gap-2 mb-2">
                            <button type="button"
                              onClick={() => { updateUkesmenyDay(d.date, { recipe_id: null }); setUkesmenySwapDay(null); }}
                              className="px-3 py-1.5 rounded-chip border border-border text-[13px] font-[550] text-fg hover:bg-surface-2">
                              Ingen oppskrift
                            </button>
                            {recipes
                              .filter(r => !ukesmenySwapSearch.trim() || r.title.toLowerCase().includes(ukesmenySwapSearch.trim().toLowerCase()))
                              .slice(0, 20)
                              .map(r => (
                                <button key={r.id} type="button"
                                  onClick={() => { updateUkesmenyDay(d.date, { recipe_id: r.id, fritekst: null }); setUkesmenySwapDay(null); }}
                                  className="px-3 py-1.5 rounded-chip border border-border text-[13px] font-[550] text-fg hover:bg-surface-2">
                                  {r.title}
                                </button>
                              ))}
                          </div>
                          <input type="text" placeholder="…eller skriv fritt (f.eks. Tacos)"
                            defaultValue={d.fritekst ?? ""}
                            onBlur={e => { const v = e.target.value.trim(); if (v) { updateUkesmenyDay(d.date, { fritekst: v, recipe_id: null }); setUkesmenySwapDay(null); } }}
                            className="w-full rounded-[10px] border border-border px-3 py-2 text-[13.5px] placeholder:text-text-3 outline-none focus:border-accent" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {ukesmenyError && <p className="text-[12.5px] text-rose-500">{ukesmenyError}</p>}

                <div className="flex gap-2 pt-1">
                  <button onClick={applyUkesmenyPlan} disabled={ukesmenyApplying}
                    className="flex-1 py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all">
                    {ukesmenyApplying ? "Lagrer…" : "Bruk denne planen"}
                  </button>
                  <button onClick={suggestUkesmeny} disabled={ukesmenyBusy}
                    className="px-4 py-3 rounded-[13px] text-[14px] border border-border text-text-2 disabled:opacity-40 hover:bg-surface-2 transition-colors">
                    Foreslå på nytt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
