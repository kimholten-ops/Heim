import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { veilederEnabled } from "@/lib/veileder";
import KostholdLogClient from "./KostholdLogClient";

export default async function KostholdLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("active_household_id").eq("id", user.id).maybeSingle();
  const hid = profile?.active_household_id ?? null;
  if (!hid) redirect("/app");

  const { data: me } = await supabase
    .from("members").select("id, role, household_role").eq("household_id", hid).eq("auth_user_id", user.id).maybeSingle();
  if (!me || me.role !== "adult") redirect("/app");

  // Se samme merknad i /app/helse/page.tsx: gjester skal ikke se
  // "Forslag til kvelds?"-knappen, siden den trigger et betalt AI-kall.
  const showVeileder = veilederEnabled() && me.household_role === "medlem";

  return <KostholdLogClient memberId={me.id} householdId={hid} veilederEnabled={showVeileder} />;
}
