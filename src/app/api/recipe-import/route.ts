import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeFetchText } from "@/lib/safe-fetch";
import { checkRateLimit, checkIpRateLimit, getClientIp } from "@/lib/rate-limit";
import { getAIGatedMember, callAI, parseAIJson } from "@/lib/ai";

export const runtime = "nodejs";

type ImportedIngredient = { name: string; amount?: string; unit?: string };
type ImportedRecipe = {
  title: string;
  image_url: string | null;
  servings: number | null;
  total_time_minutes: number | null;
  ingredients: ImportedIngredient[];
  body: string | null;
};

const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

async function safeFetchHtml(rawUrl: string): Promise<string> {
  return safeFetchText(rawUrl, {
    maxBytes: MAX_BYTES,
    timeoutMs: FETCH_TIMEOUT_MS,
    userAgent: "Heim/1.0 (+https://heim-virid.vercel.app)",
  });
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      // hopp over ugyldig blokk
    }
  }
  return blocks;
}

function findRecipeNode(blocks: unknown[]): Record<string, unknown> | null {
  let found: Record<string, unknown> | null = null;
  function visit(node: unknown) {
    if (found || node == null) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const type = obj["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (types.includes("Recipe")) {
        found = obj;
        return;
      }
      if (Array.isArray(obj["@graph"])) visit(obj["@graph"]);
    }
  }
  for (const b of blocks) visit(b);
  return found;
}

function parseDurationMinutes(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return null;
  const days = Number(m[1] ?? 0), hours = Number(m[2] ?? 0), mins = Number(m[3] ?? 0);
  const total = days * 1440 + hours * 60 + mins;
  return total > 0 ? total : null;
}

function parseServings(y: unknown): number | null {
  if (typeof y === "number") return Math.round(y);
  if (typeof y === "string") {
    const m = /\d+/.exec(y);
    return m ? Number(m[0]) : null;
  }
  if (Array.isArray(y) && y.length > 0) return parseServings(y[0]);
  return null;
}

function extractImageUrl(img: unknown): string | null {
  if (typeof img === "string") return img;
  if (Array.isArray(img) && img.length > 0) return extractImageUrl(img[0]);
  if (img && typeof img === "object") {
    const url = (img as Record<string, unknown>).url;
    if (typeof url === "string") return url;
  }
  return null;
}

function extractInstructionSteps(ri: unknown): string[] {
  const steps: string[] = [];
  function visit(node: unknown) {
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    if (typeof node === "string") {
      steps.push(node.trim());
      return;
    }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (typeof o.text === "string") { steps.push(o.text.trim()); return; }
      if (Array.isArray(o.itemListElement)) visit(o.itemListElement);
    }
  }
  visit(ri);
  return steps.filter(Boolean);
}

const UNIT_WORDS = new Set(["g", "kg", "ml", "dl", "l", "ss", "ts", "stk", "boks", "bokser", "pk", "pakke", "fedd", "never", "klype", "kopp", "kopper"]);

function splitIngredient(raw: string): ImportedIngredient {
  const trimmed = raw.trim();
  const m = /^([\d/.,]+(?:\s*-\s*[\d/.,]+)?)\s+([a-zA-ZæøåÆØÅ.]+)?\s*(.*)$/.exec(trimmed);
  if (m) {
    const [, amount, unitRaw, rest] = m;
    const unitMatches = unitRaw && UNIT_WORDS.has(unitRaw.toLowerCase());
    const unit = unitMatches ? unitRaw : undefined;
    const name = (unitMatches ? rest : [unitRaw, rest].filter(Boolean).join(" ")).trim();
    if (name) return { name, amount: amount.trim(), unit };
  }
  return { name: trimmed };
}

function stepsToBody(steps: string[]): string | null {
  return steps.length ? steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : null;
}

function mapRecipeNode(node: Record<string, unknown>): ImportedRecipe {
  const title = typeof node.name === "string" && node.name.trim() ? node.name.trim() : "Uten tittel";
  const image_url = extractImageUrl(node.image);
  const servings = parseServings(node.recipeYield);
  const totalTime = parseDurationMinutes(node.totalTime);
  const cookPrep = (parseDurationMinutes(node.prepTime) ?? 0) + (parseDurationMinutes(node.cookTime) ?? 0);
  const total_time_minutes = totalTime ?? (cookPrep > 0 ? cookPrep : null);
  const rawIngredients = Array.isArray(node.recipeIngredient) ? (node.recipeIngredient as unknown[]) : [];
  const ingredients = rawIngredients.filter((i): i is string => typeof i === "string").map(splitIngredient);
  const body = stepsToBody(extractInstructionSteps(node.recipeInstructions));
  return { title, image_url, servings, total_time_minutes, ingredients, body };
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Microdata/RDFa-fallback for eldre oppskriftssider uten JSON-LD. Ingen DOM-parser
// tilgjengelig server-side her, så dette er en regex-basert best-effort-tilnærming
// (samme ånd som JSON-LD-parsingen over) — ikke skop-bevisst på nøstede itemscope,
// men det er greit siden brukeren uansett godkjenner/redigerer før noe lagres.
function hasRecipeMicrodata(html: string): boolean {
  return /itemtype=["'][^"']*schema\.org\/Recipe["']/i.test(html);
}

function extractItemPropValues(html: string, prop: string): string[] {
  const values: string[] = [];
  const re = new RegExp(`<([a-zA-Z0-9]+)([^>]*\\bitemprop=["']${prop}["'][^>]*)>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const contentMatch = /\bcontent=["']([^"']*)["']/i.exec(attrs);
    const datetimeMatch = /\bdatetime=["']([^"']*)["']/i.exec(attrs);
    const srcMatch = /\bsrc=["']([^"']*)["']/i.exec(attrs);
    if (tag === "meta" && contentMatch) { values.push(contentMatch[1]); continue; }
    if (tag === "time" && datetimeMatch) { values.push(datetimeMatch[1]); continue; }
    if (tag === "img" && srcMatch) { values.push(srcMatch[1]); continue; }
    if (contentMatch) { values.push(contentMatch[1]); continue; }
    const closeIdx = html.indexOf(`</${tag}`, re.lastIndex);
    if (closeIdx !== -1 && closeIdx - re.lastIndex < 5000) {
      const inner = html.slice(re.lastIndex, closeIdx);
      const text = inner.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      if (text) values.push(text);
    }
  }
  return values;
}

function extractMicrodataRecipe(html: string): ImportedRecipe | null {
  if (!hasRecipeMicrodata(html)) return null;

  const names = extractItemPropValues(html, "name");
  const title = names[0]?.trim() || "Uten tittel";
  const image_url = extractItemPropValues(html, "image")[0] ?? null;

  const yields = extractItemPropValues(html, "recipeYield");
  const servings = yields.length ? parseServings(yields[0]) : null;

  const totalTimes = extractItemPropValues(html, "totalTime");
  const prepTimes = extractItemPropValues(html, "prepTime");
  const cookTimes = extractItemPropValues(html, "cookTime");
  const totalTime = totalTimes.length ? parseDurationMinutes(totalTimes[0]) : null;
  const cookPrep = (prepTimes.length ? parseDurationMinutes(prepTimes[0]) ?? 0 : 0)
    + (cookTimes.length ? parseDurationMinutes(cookTimes[0]) ?? 0 : 0);
  const total_time_minutes = totalTime ?? (cookPrep > 0 ? cookPrep : null);

  const ingredients = extractItemPropValues(html, "recipeIngredient").map(splitIngredient);
  const steps = extractItemPropValues(html, "recipeInstructions");
  const body = stepsToBody(steps);

  if (ingredients.length === 0 && !body) return null;
  return { title, image_url, servings, total_time_minutes, ingredients, body };
}

function buildOppskriftSystemPrompt(): string {
  return (
    "Du leser rå tekst fra en nettside og skal finne om den inneholder en matoppskrift. " +
    "Returner KUN gyldig JSON. Hvis dette er en oppskrift: " +
    '{"title":string,"servings":number|null,"total_time_minutes":number|null,' +
    '"ingredients":[{"name":string,"amount":string|null,"unit":string|null}],"body":string|null} ' +
    "(body = nummererte fremgangsmåte-steg adskilt med linjeskift). " +
    'Hvis siden IKKE er en oppskrift, returner nøyaktig {"error":"ikke_oppskrift"}. ' +
    "Ingen forklaring, ingen markdown."
  );
}

function validateImportedRecipe(parsed: unknown): ImportedRecipe | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  if (typeof r.error === "string") return null; // f.eks. ikke_oppskrift
  if (typeof r.title !== "string" || !r.title.trim()) return null;

  const rawIngredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  const ingredients: ImportedIngredient[] = [];
  for (const ing of rawIngredients) {
    if (typeof ing !== "object" || ing === null) continue;
    const io = ing as Record<string, unknown>;
    if (typeof io.name !== "string" || !io.name.trim()) continue;
    ingredients.push({
      name: io.name.trim(),
      amount: typeof io.amount === "string" ? io.amount : undefined,
      unit: typeof io.unit === "string" ? io.unit : undefined,
    });
  }

  return {
    title: r.title.trim(),
    image_url: null,
    servings: typeof r.servings === "number" ? Math.round(r.servings) : null,
    total_time_minutes: typeof r.total_time_minutes === "number" ? Math.round(r.total_time_minutes) : null,
    ingredients,
    body: typeof r.body === "string" && r.body.trim() ? r.body.trim() : null,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const allowed = await checkRateLimit(supabase, "recipe-import", 20, 1440);
  if (!allowed) return NextResponse.json({ error: "For mange importer i dag. Prøv igjen i morgen." }, { status: 429 });

  const ipAllowed = await checkIpRateLimit(getClientIp(req), "recipe-import", 60, 1440);
  if (!ipAllowed) return NextResponse.json({ error: "For mange importer fra denne tilkoblingen i dag. Prøv igjen i morgen." }, { status: 429 });

  let url = "";
  let pastedText = "";
  try {
    const body = await req.json();
    url = String(body?.url ?? "").trim();
    pastedText = String(body?.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  if (!url && !pastedText) return NextResponse.json({ error: "Mangler lenke eller tekst." }, { status: 400 });

  // ── Limt inn tekst (f.eks. bildetekst fra et Instagram-innlegg) — det finnes
  // ingen side å hente eller strukturert data å parse, så dette går rett på
  // AI-tolkning. Uten AI (avslått/rate-limitert/utilgjengelig) er det ingen
  // fallback utover manuelt skjema, siden regex-parserne over krever HTML.
  if (!url && pastedText) {
    const gated = await getAIGatedMember(supabase);
    if (gated) {
      const plainText = pastedText.slice(0, 12_000);
      const result = await callAI({
        supabase, memberId: gated.memberId, kind: "oppskrift",
        system: buildOppskriftSystemPrompt(),
        messages: [{ role: "user", content: plainText }],
      });
      if (!("error" in result)) {
        const parsed = parseAIJson(result.text, validateImportedRecipe);
        if (parsed) return NextResponse.json({ recipe: { ...parsed, url: null }, aiParsed: true });
      }
    }
    return NextResponse.json(
      { error: "no_structured_data", rawTextPreview: pastedText.slice(0, 500) },
      { status: 422 }
    );
  }

  let html: string;
  try {
    html = await safeFetchHtml(url);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Klarte ikke hente siden." }, { status: 400 });
  }

  const node = findRecipeNode(extractJsonLdBlocks(html));
  let recipe = node ? mapRecipeNode(node) : extractMicrodataRecipe(html);
  let aiParsed = false;

  // AI-fallback KUN når verken JSON-LD eller Microdata/RDFa fant noe —
  // degraderer stille til manuelt skjema om AI er avslått/rate-limitert/feiler.
  if (!recipe) {
    const gated = await getAIGatedMember(supabase);
    if (gated) {
      const plainText = htmlToPlainText(html).slice(0, 12_000);
      const result = await callAI({
        supabase, memberId: gated.memberId, kind: "oppskrift",
        system: buildOppskriftSystemPrompt(),
        messages: [{ role: "user", content: plainText }],
      });
      if (!("error" in result)) {
        const parsed = parseAIJson(result.text, validateImportedRecipe);
        if (parsed) { recipe = parsed; aiParsed = true; }
      }
    }
  }

  if (!recipe) {
    const rawTextPreview = htmlToPlainText(html).slice(0, 500);
    return NextResponse.json(
      { error: "no_structured_data", rawTextPreview },
      { status: 422 }
    );
  }

  return NextResponse.json({ recipe: { ...recipe, url }, aiParsed });
}
