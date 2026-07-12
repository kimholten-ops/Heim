import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Sjekker og registrerer ett kall mot check_rate_limit()-funksjonen i databasen
// (se supabase/migrations/0010_rate_limits.sql). Teller per innlogget bruker.
// Trygt å kalle med klientens egen Supabase-sesjon: funksjonen leser auth.uid()
// fra JWT-en server-side, den stoler ikke på noe brukeren selv oppgir.
export async function checkRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  endpoint: string,
  max: number,
  windowMinutes: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_endpoint: endpoint,
    p_max: max,
    p_window_minutes: windowMinutes,
  });
  if (error) return true; // fail open — en DB-feil skal ikke blokkere brukeren
  return data === true;
}

// Ekte klient-IP fra Vercels edge (x-forwarded-for settes av Vercel selv og kan
// ikke forfalskes av klienten). Brukes KUN server-side, aldri sendt av klienten.
export function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

// IP-basert rate limiting, i tillegg til checkRateLimit() over. Formålet er å
// hindre at noen omgår per-bruker-grensen ved å opprette flere kontoer — derfor
// må denne gå via service-role (src/lib/supabase/service.ts), IKKE en klient-
// kallbar RPC: en IP oppgitt av klienten selv kan ikke stoles på, mens
// x-forwarded-for fra Vercel kan. Feiler åpent (skrur seg selv av) hvis
// SUPABASE_SERVICE_ROLE_KEY ikke er satt ennå, eller ved DB-feil.
export async function checkIpRateLimit(
  ip: string | null,
  endpoint: string,
  max: number,
  windowMinutes: number
): Promise<boolean> {
  if (!ip) return true;
  const supabase = createServiceClient();
  if (!supabase) return true;

  const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  await supabase
    .from("ip_rate_limits")
    .delete()
    .eq("ip_address", ip)
    .eq("endpoint", endpoint)
    .lt("created_at", windowStart);

  const { count, error } = await supabase
    .from("ip_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .eq("endpoint", endpoint)
    .gte("created_at", windowStart);
  if (error) return true;
  if ((count ?? 0) >= max) return false;

  await supabase.from("ip_rate_limits").insert({ ip_address: ip, endpoint });
  return true;
}
