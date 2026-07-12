import type { SupabaseClient } from "@supabase/supabase-js";

// Sjekker og registrerer ett kall mot check_rate_limit()-funksjonen i databasen
// (se supabase/migrations/0010_rate_limits.sql). Teller per innlogget bruker,
// ikke per IP — riktig for et innlogget produkt der IP-adresser deles av hele
// husholdninger bak samme ruter.
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
