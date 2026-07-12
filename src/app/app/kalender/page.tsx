import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KalenderClient from "./KalenderClient";

export default async function KalenderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("active_household_id").eq("id", user.id).maybeSingle();
  const hid = profile?.active_household_id ?? null;

  return <KalenderClient householdId={hid} />;
}
