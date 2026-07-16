import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { veilederEnabled } from "@/lib/veileder";
import { stravaEnabled } from "@/lib/strava";
import HelseClient from "./HelseClient";

export default async function HelsePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("active_household_id").eq("id", user.id).maybeSingle();
  const hid = profile?.active_household_id ?? null;
  if (!hid) redirect("/app");

  const { data: me } = await supabase
    .from("members").select("id, role, household_role").eq("household_id", hid).eq("auth_user_id", user.id).maybeSingle();
  // Helse/trening er kun for voksne — barn skal ikke se ruten i det hele tatt.
  if (!me || me.role !== "adult") redirect("/app");

  // Veilederen er den eneste betalte tjenesten i appen — gjester (household_role
  // 'gjest') beholder full tilgang til trening/kosthold som før, men skal ikke
  // kunne bruke av husholdningens delte AI-kvote.
  const showVeileder = veilederEnabled() && me.household_role === "medlem";

  return <HelseClient memberId={me.id} householdId={hid} veilederEnabled={showVeileder} stravaEnabled={stravaEnabled()} />;
}
