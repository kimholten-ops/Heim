import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIGatedMember, callAI, aiErrorResponse, parseAIJson } from "@/lib/ai";

export const runtime = "nodejs";
// AI-kall kan i sjeldne tilfeller ta lenger enn plattformens standard
// funksjonstidsavbrudd (spesielt store maxTokens-svar eller bilde-tolkning)
// — utvid grensen eksplisitt i stedet for å stole på default.
export const maxDuration = 60;

type UkesmenyIngrediens = { name: string; amount?: string; unit?: string };
type UkesmenyDag = {
  date: string; recipe_id: string | null; fritekst: string | null; begrunnelse: string | null;
  ingredienser: UkesmenyIngrediens[] | null; fremgangsmate: string | null;
};

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildSystemPrompt(varyProteins: boolean, quickWeekdays: boolean): string {
  const constraints = [
    varyProteins ? "Varier proteinkilder gjennom uken — ikke foreslå samme type kjøtt/fisk/vegetar to dager på rad." : null,
    quickWeekdays ? "Prioriter raske middager (helst under 30 minutter) på hverdager (mandag–fredag)." : null,
  ].filter(Boolean).join(" ");
  return (
    "Du foreslår en ukesmeny for en norsk husholdning, basert på husholdningens oppskriftsbank og hva de har spist siste 14 dager. " +
    'Returner KUN gyldig JSON: {"dager":[{"date":"YYYY-MM-DD","recipe_id":string|null,"fritekst":string|null,' +
    '"begrunnelse":string|null,"ingredienser":[{"name":string,"amount":string|null,"unit":string|null}]|null,"fremgangsmate":string|null}]} ' +
    "med nøyaktig 7 dager, én per dato i uken du får oppgitt. Bruk KUN recipe_id-er som finnes i oppskriftsbanken — " +
    "hvis ingen oppskrift passer en dag, sett recipe_id til null og bruk fritekst i stedet. " +
    "For hver dag der recipe_id er null MÅ du også fylle ut ingredienser (med mengde og enhet der det er naturlig) og " +
    "fremgangsmate (nummererte steg adskilt med linjeskift), slik at fritekst-forslaget er en komplett oppskrift — " +
    "ikke bare et navn. Når recipe_id er satt, sett ingredienser og fremgangsmate til null (oppskriften finnes allerede). " +
    "Unngå å foreslå retter som står i listen over nylig spist. " + constraints +
    " begrunnelse skal være en kort setning. Ingen forklaring, ingen markdown."
  );
}

function validateUkesmeny(validIds: Set<string>, weekDates: Set<string>) {
  return (parsed: unknown): UkesmenyDag[] | null => {
    if (typeof parsed !== "object" || parsed === null || !("dager" in parsed)) return null;
    const raw = (parsed as { dager: unknown }).dager;
    if (!Array.isArray(raw)) return null;

    const dager: UkesmenyDag[] = [];
    for (const d of raw) {
      if (typeof d !== "object" || d === null) continue;
      const r = d as Record<string, unknown>;
      if (typeof r.date !== "string" || !weekDates.has(r.date)) continue;
      const recipeId = typeof r.recipe_id === "string" && validIds.has(r.recipe_id) ? r.recipe_id : null;

      // Ingredienser/fremgangsmåte er kun relevant når det IKKE er en kjent
      // oppskrift — den har allerede sine egne, og vi vil ikke risikere at
      // AI-en hallusinerer avvikende data for en eksisterende oppskrift.
      let ingredienser: UkesmenyIngrediens[] | null = null;
      let fremgangsmate: string | null = null;
      if (!recipeId) {
        const rawIngredienser = Array.isArray(r.ingredienser) ? r.ingredienser : [];
        const parsed: UkesmenyIngrediens[] = [];
        for (const ing of rawIngredienser) {
          if (typeof ing !== "object" || ing === null) continue;
          const io = ing as Record<string, unknown>;
          if (typeof io.name !== "string" || !io.name.trim()) continue;
          parsed.push({
            name: io.name.trim(),
            amount: typeof io.amount === "string" ? io.amount : undefined,
            unit: typeof io.unit === "string" ? io.unit : undefined,
          });
        }
        ingredienser = parsed.length ? parsed : null;
        fremgangsmate = typeof r.fremgangsmate === "string" && r.fremgangsmate.trim() ? r.fremgangsmate.trim() : null;
      }

      dager.push({
        date: r.date,
        recipe_id: recipeId,
        fritekst: typeof r.fritekst === "string" && r.fritekst.trim() ? r.fritekst.trim() : null,
        begrunnelse: typeof r.begrunnelse === "string" && r.begrunnelse.trim() ? r.begrunnelse.trim() : null,
        ingredienser, fremgangsmate,
      });
    }
    return dager.length ? dager : null;
  };
}

// POST /api/ai/ukesmeny — AI-forslag til ukesmeny basert på husholdningens
// oppskriftsbank og siste 14 dagers middager (kun titler, for å unngå
// gjentakelser). recipe_id valideres mot den faktiske kandidatlisten som ble
// sendt til modellen — en ukjent id forkastes til fordel for fritekst, aldri
// stolt på blindt.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const gated = await getAIGatedMember(supabase);
  if (!gated) return NextResponse.json({ error: "Ikke tilgang." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const weekStart = typeof body?.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.weekStart) ? body.weekStart : null;
  if (!weekStart) return NextResponse.json({ error: "Mangler ukestart." }, { status: 400 });
  const varyProteins = !!body?.varyProteins;
  const quickWeekdays = !!body?.quickWeekdays;

  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
  const lookbackStart = addDaysIso(weekStart, -14);
  const lookbackEnd = addDaysIso(weekStart, -1);

  const [{ data: recipesRaw }, { data: recentMeals }] = await Promise.all([
    supabase.from("recipes").select("id, title, total_time_minutes, ingredients")
      .eq("household_id", gated.householdId).order("times_used", { ascending: false }).limit(60),
    supabase.from("meals").select("title")
      .eq("household_id", gated.householdId).gte("date", lookbackStart).lte("date", lookbackEnd).not("title", "is", null),
  ]);

  const recipeBank = (recipesRaw ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    minutter: r.total_time_minutes as number | null,
    ingredienser: (Array.isArray(r.ingredients) ? (r.ingredients as { name?: string }[]) : [])
      .slice(0, 5).map((i) => i.name).filter(Boolean),
  }));
  const validIds = new Set(recipeBank.map((r) => r.id));
  const nyligSpist = (recentMeals ?? []).map((m) => (m as { title: string }).title).filter(Boolean);

  const context = { uke: weekDates, oppskrifter: recipeBank, nylig_spist: nyligSpist };

  const result = await callAI({
    supabase, memberId: gated.memberId, kind: "ukesmeny",
    system: buildSystemPrompt(varyProteins, quickWeekdays),
    messages: [{ role: "user", content: JSON.stringify(context) }],
  });
  if ("error" in result) return aiErrorResponse(result.error);

  const dager = parseAIJson(result.text, validateUkesmeny(validIds, new Set(weekDates)));
  if (!dager) {
    return NextResponse.json({ error: "Klarte ikke lage et ukesmeny-forslag — prøv igjen." }, { status: 422 });
  }
  return NextResponse.json({ dager });
}
