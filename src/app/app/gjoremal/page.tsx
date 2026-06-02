import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GjoremalClient from "./GjoremalClient";

export default async function GjoremalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("active_household_id").eq("id", user.id).maybeSingle();

  const hid = profile?.active_household_id ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let todoLists: any[] = [];
  if (hid) {
    const { data } = await supabase.from("todo_lists")
      .select("id, name, icon, color").eq("household_id", hid).order("created_at");
    todoLists = data ?? [];
  }

  return <GjoremalClient householdId={hid} initialLists={todoLists} />;
}
