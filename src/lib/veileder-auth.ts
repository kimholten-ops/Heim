import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Sb = SupabaseClient<Database>;

export type GatedMember = { memberId: string; householdId: string };

// Samme rolle-gate som alle andre /app/helse-sider (kun voksne), PLUSS en
// household_role-sjekk som er strengere enn resten av helse-modulen: gjester
// (household_role='gjest', fra 0015_guest_access.sql) beholder lesetilgang
// til trening/kosthold-dataene sine (ingen endring der), men skal ikke kunne
// trigge Veilederen — det er den eneste betalte tjenesten i appen, og en
// midlertidig gjest bør ikke kunne bruke av husholdningens delte AI-kvote
// (600 kall/mnd). Brukes fra API-rutene siden de ikke går via en
// server-side page-komponent.
export async function getGatedMember(supabase: Sb): Promise<GatedMember | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles").select("active_household_id").eq("id", user.id).maybeSingle();
  const hid = profile?.active_household_id ?? null;
  if (!hid) return null;

  const { data: me } = await supabase
    .from("members").select("id, role, household_role").eq("household_id", hid).eq("auth_user_id", user.id).maybeSingle();
  if (!me || me.role !== "adult" || me.household_role !== "medlem") return null;

  return { memberId: me.id, householdId: hid };
}

// Rate-limit-sjekk og usage-logging bor nå i src/lib/ai.ts (checkAIRateLimit/
// logAIUsage) — delt av ALLE AI-funksjoner, ikke bare veilederen. callAI()
// kaller dem selv, så rutene her trenger dem kun for det tidlige
// early-exit-kallet (unngå å bygge kontekst for en rate-limitert bruker).
