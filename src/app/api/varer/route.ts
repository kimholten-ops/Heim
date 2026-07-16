import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, checkIpRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export type Nutrition100g = { kcal: number; protein_g: number; karbo_g: number; fett_g: number };
export type KassalappProduct = {
  ean: string; name: string; brand: string | null; price: number | null; store: string | null;
  nutrition100g: Nutrition100g | null;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { data: KassalappProduct[]; expires: number }>();

function pickPrice(r: Record<string, unknown>): number | null {
  const current = r.current_price as Record<string, unknown> | undefined;
  const p = current?.price ?? r.price;
  return typeof p === "number" ? p : null;
}

function pickStore(r: Record<string, unknown>): string | null {
  const current = r.current_price as Record<string, unknown> | undefined;
  const store = current?.store ?? r.store;
  if (typeof store === "string") return store;
  if (store && typeof store === "object") {
    const name = (store as Record<string, unknown>).name;
    if (typeof name === "string") return name;
  }
  return null;
}

// Kassalapp sitt eksakte nærings-skjema er ikke verifisert mot et ekte svar i
// denne økten (ingen API-nøkkel tilgjengelig, og API-dokumentasjonen var
// utilgjengelig). Tolererer derfor flere plausible former defensivt — samme
// stil som pickPrice/pickStore over — og returnerer null (ikke krasj) hvis
// ingenting gjenkjennes, som UI-et viser som "mangler næringsdata".
function pickNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function pickNutrition(r: Record<string, unknown>): Nutrition100g | null {
  // Form A: en flat "nutrition"-liste med navngitte poster (vanlig i EU-stil
  // næringsdeklarasjoner), typisk deklarert per 100 g.
  const list = r.nutrition ?? r.nutrients ?? r.nutritional_information;
  if (Array.isArray(list)) {
    const find = (...keys: string[]) => {
      for (const item of list) {
        if (typeof item !== "object" || item === null) continue;
        const o = item as Record<string, unknown>;
        const label = String(o.code ?? o.name ?? o.display_name ?? "").toLowerCase();
        if (keys.some((k) => label.includes(k))) {
          const n = pickNumber(o.amount ?? o.value ?? o.quantity);
          if (n !== null) return n;
        }
      }
      return null;
    };
    const kcal = find("energi_kcal", "energy_kcal", "kcal") ?? find("energi", "energy");
    const protein = find("protein");
    const karbo = find("karbohydrat", "carbohydrate");
    const fett = find("fett", "fat");
    if (kcal !== null) {
      return { kcal, protein_g: protein ?? 0, karbo_g: karbo ?? 0, fett_g: fett ?? 0 };
    }
  }

  // Form B: flate felt direkte på produktobjektet.
  const kcalFlat = pickNumber(r.energy_kcal ?? r.kcal);
  if (kcalFlat !== null) {
    return {
      kcal: kcalFlat,
      protein_g: pickNumber(r.protein) ?? 0,
      karbo_g: pickNumber(r.carbohydrates ?? r.karbohydrat) ?? 0,
      fett_g: pickNumber(r.fat ?? r.fett) ?? 0,
    };
  }

  return null;
}

function rowToProduct(r: Record<string, unknown>): KassalappProduct | null {
  const ean = String(r.ean ?? r.gtin ?? r.id ?? "");
  const name = typeof r.name === "string" ? r.name : "";
  if (!ean || !name) return null;
  return {
    ean,
    name,
    brand: typeof r.brand === "string" ? r.brand : null,
    price: pickPrice(r),
    store: pickStore(r),
    nutrition100g: pickNutrition(r),
  };
}

// Kassalapp har et eget EAN-oppslagsendepunkt (/v1/products/ean/{ean}), men det
// eksakte svarskjemaet er ikke verifisert mot et ekte svar i denne økten (ingen
// API-nøkkel/internett-tilgang). Prøver det først, faller tilbake til
// tekstsøk-med-EAN-som-streng og filtrerer på eksakt EAN-treff hvis det feiler
// eller ikke gir treff — samme forsvarlige stil som pickNutrition over.
async function lookupByEan(ean: string, apiKey: string): Promise<KassalappProduct | null> {
  try {
    const res = await fetch(`https://kassal.app/api/v1/products/ean/${encodeURIComponent(ean)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const row = Array.isArray(json?.data) ? json.data[0] : json?.data;
      if (row && typeof row === "object") {
        const product = rowToProduct(row as Record<string, unknown>);
        if (product) return product;
      }
    }
  } catch {
    // faller videre til søk-fallback
  }

  try {
    const res = await fetch(
      `https://kassal.app/api/v1/products?search=${encodeURIComponent(ean)}&size=20`,
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const rows: unknown[] = Array.isArray(json?.data) ? json.data : [];
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue;
        const r = row as Record<string, unknown>;
        if (String(r.ean ?? r.gtin ?? "") !== ean) continue;
        const product = rowToProduct(r);
        if (product) return product;
      }
    }
  } catch {
    // ingen treff — returner null under
  }

  return null;
}

// GET /api/varer?q=melk — proxy mot Kassalapp produktsøk (kassal.app/api), brukt til
// autofullføring på handlelisten. Feiler alltid stille (tom liste) — skal aldri blokkere
// brukeren fra å skrive fritekst.
// GET /api/varer?ean=7020097009021 — strekkodeoppslag, brukt av kamera-skanneren i
// kostholdslogging. Feiler alltid stille (product: null).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ products: [] }, { status: 401 });

  const ean = (req.nextUrl.searchParams.get("ean") ?? "").trim();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const apiKey = process.env.KASSALAPP_API_KEY;

  if (ean) {
    if (!apiKey) return NextResponse.json({ product: null });

    const allowed = await checkRateLimit(supabase, "varer", 300, 60);
    if (!allowed) return NextResponse.json({ product: null });
    const ipAllowed = await checkIpRateLimit(getClientIp(req), "varer", 1000, 60);
    if (!ipAllowed) return NextResponse.json({ product: null });

    const cacheKey = `ean:${ean}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({ product: cached.data[0] ?? null });
    }

    const product = await lookupByEan(ean, apiKey);
    cache.set(cacheKey, { data: product ? [product] : [], expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json({ product });
  }

  if (q.length < 2) return NextResponse.json({ products: [] });
  if (!apiKey) return NextResponse.json({ products: [] });

  // Rate-limitert stille (som manglende nøkkel) — autofullføring skal aldri vise feil,
  // bare slutte å foreslå.
  const allowed = await checkRateLimit(supabase, "varer", 300, 60);
  if (!allowed) return NextResponse.json({ products: [] });

  const ipAllowed = await checkIpRateLimit(getClientIp(req), "varer", 1000, 60);
  if (!ipAllowed) return NextResponse.json({ products: [] });

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ products: cached.data });
  }

  let products: KassalappProduct[] = [];
  try {
    const res = await fetch(
      `https://kassal.app/api/v1/products?search=${encodeURIComponent(q)}&size=8`,
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const rows: unknown[] = Array.isArray(json?.data) ? json.data : [];
      const seen = new Set<string>();
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue;
        const r = row as Record<string, unknown>;
        const product = rowToProduct(r);
        if (!product || seen.has(product.ean)) continue;
        seen.add(product.ean);
        products.push(product);
        if (products.length >= 8) break;
      }
    }
  } catch {
    products = [];
  }

  cache.set(cacheKey, { data: products, expires: Date.now() + CACHE_TTL_MS });
  return NextResponse.json({ products });
}
