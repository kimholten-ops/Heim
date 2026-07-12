import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export type KassalappProduct = { ean: string; name: string; brand: string | null; price: number | null; store: string | null };

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
