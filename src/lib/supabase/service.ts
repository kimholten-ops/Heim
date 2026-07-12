import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Service-role-klient — omgår RLS fullstendig. Brukes UTELUKKENDE til IP-basert
// rate limiting (ip_rate_limits, se supabase/migrations/0011_ip_rate_limits.sql),
// som er en tabell uten RLS-policies og derfor uoppnåelig for vanlige klienter
// uansett. ALDRI bruk denne klienten mot noen annen tabell — RLS er det eneste
// som holder husholdninger adskilt i resten av appen, og denne klienten omgår den.
//
// Krever SUPABASE_SERVICE_ROLE_KEY (server-only, ALDRI NEXT_PUBLIC_) satt i Vercel.
// Returnerer null hvis nøkkelen mangler — IP-rate-limiting skal da bare skrus av
// stille, ikke krasje appen.
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}
