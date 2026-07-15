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

// GET /api/varer?q=melk — proxy mot Kassalapp produktsøk (kassal.app/api), brukt til
// autofullføring på handlelisten. Feiler alltid stille (tom liste) — skal aldri blokkere
// brukeren fra å skrive fritekst.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ products: [] }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ products: [] });

  const apiKey = process.env.KASSALAPP_API_KEY;
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
        const ean = String(r.ean ?? r.gtin ?? r.id ?? "");
        const name = typeof r.name === "string" ? r.name : "";
        if (!ean || !name || seen.has(ean)) continue;
        seen.add(ean);
        products.push({
          ean,
          name,
          brand: typeof r.brand === "string" ? r.brand : null,
          price: pickPrice(r),
          store: pickStore(r),
          nutrition100g: pickNutrition(r),
        });
        if (products.length >= 8) break;
      }
    }
  } catch {
    products = [];
  }

  cache.set(cacheKey, { data: products, expires: Date.now() + CACHE_TTL_MS });
  return NextResponse.json({ products });
}
