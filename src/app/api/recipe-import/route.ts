import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeFetchText } from "@/lib/safe-fetch";
import { checkRateLimit, checkIpRateLimit, getClientIp } from "@/lib/rate-limit";

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

async function aiFallback(html: string): Promise<ImportedRecipe | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const text = htmlToPlainText(html).slice(0, 15_000);
  if (!text) return null;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        system:
          "Du får rå sidetekst fra en nettside. Avgjør om siden er en matoppskrift. " +
          "Returner KUN gyldig JSON, ingen markdown, ingen forklaring. " +
          'Hvis oppskrift: {"isRecipe":true,"title":string,"servings":number|null,' +
          '"totalTimeMinutes":number|null,"ingredients":[string],"steps":[string]}. ' +
          'Hvis ikke oppskrift: {"isRecipe":false}.',
        messages: [{ role: "user", content: text }],
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const raw = data?.content?.[0]?.text;
  if (typeof raw !== "string") return null;

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (!p.isRecipe) return null;

  const ingredients = Array.isArray(p.ingredients)
    ? (p.ingredients as unknown[]).filter((i): i is string => typeof i === "string").map(splitIngredient)
    : [];
  const steps = Array.isArray(p.steps) ? (p.steps as unknown[]).filter((s): s is string => typeof s === "string") : [];

  return {
    title: typeof p.title === "string" && p.title.trim() ? p.title.trim() : "Uten tittel",
    image_url: null,
    servings: typeof p.servings === "number" ? p.servings : null,
    total_time_minutes: typeof p.totalTimeMinutes === "number" ? p.totalTimeMinutes : null,
    ingredients,
    body: stepsToBody(steps),
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
  try {
    const body = await req.json();
    url = String(body?.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  if (!url) return NextResponse.json({ error: "Mangler lenke." }, { status: 400 });

  let html: string;
  try {
    html = await safeFetchHtml(url);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Klarte ikke hente siden." }, { status: 400 });
  }

  const node = findRecipeNode(extractJsonLdBlocks(html));
  const recipe = node ? mapRecipeNode(node) : await aiFallback(html);

  if (!recipe) {
    return NextResponse.json(
      { error: "Fant ingen oppskrift på denne siden. Prøv å lime inn manuelt i stedet." },
      { status: 422 }
    );
  }

  return NextResponse.json({ recipe: { ...recipe, url } });
}
