import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ListsClient from "@/components/ListsClient";

export default async function ListerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_household_id")
    .eq("id", user.id)
    .maybeSingle();

  const hid = profile?.active_household_id;
  if (!hid) redirect("/app");

  const { data: me } = await supabase.from("members")
    .select("household_role").eq("household_id", hid).eq("auth_user_id", user.id).maybeSingle();
  if (me?.household_role === "gjest") redirect("/app");

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, type")
    .eq("household_id", hid)
    .order("created_at");

  return <ListsClient householdId={hid} initialLists={lists ?? []} />;
}
