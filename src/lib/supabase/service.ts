import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Service-role-klient — omgår RLS fullstendig. Skal KUN brukes der RLS av
// design gjør noe uoppnåelig for vanlige klienter:
//   - ip_rate_limits (0011): tabell uten RLS-policies i det hele tatt.
//   - push_subscriptions (0013): et abonnement er kun lesbart av eieren selv,
//     men server-varsling må kunne sende push til ANDRE husstands-medlemmer
//     (src/lib/push.ts, kalt fra /api/notifications/check).
// ALDRI bruk denne klienten mot noen annen tabell — RLS er det eneste som
// holder husholdninger adskilt i resten av appen, og denne klienten omgår den.
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
