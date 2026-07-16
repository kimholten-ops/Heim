import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { veilederEnabled } from "@/lib/veileder";
import { stravaEnabled } from "@/lib/strava";
import ActiveSessionClient from "./ActiveSessionClient";

export default async function OktPage() {
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

  // Samme regel som resten av veilederen: gjester beholder full tilgang til
  // å logge økter, men skal ikke bruke av husholdningens delte AI-kvote.
  const aiCoachEnabled = veilederEnabled() && me.household_role === "medlem";

  return (
    <Suspense>
      <ActiveSessionClient memberId={me.id} aiCoachEnabled={aiCoachEnabled} stravaEnabled={stravaEnabled()} />
    </Suspense>
  );
}
