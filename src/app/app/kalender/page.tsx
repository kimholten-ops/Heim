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

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const end = new Date(); end.setDate(end.getDate() + 90);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let events: any[] = [];
  let feedToken: string | null = null;

  if (hid) {
    const [{ data: ev }, { data: feed }] = await Promise.all([
      supabase.from("events")
        .select("id, title, start_at, end_at, all_day, color, location, event_members(user_id), event_children(child_id)")
        .eq("household_id", hid)
        .gte("start_at", now.toISOString())
        .lte("start_at", end.toISOString())
        .order("start_at"),
      supabase.from("calendar_feeds")
        .select("token").eq("household_id", hid).is("revoked_at", null)
        .order("created_at").limit(1).maybeSingle(),
    ]);
    events = ev ?? [];
    feedToken = feed?.token ?? null;
  }

  return <KalenderClient householdId={hid} initialEvents={events} existingFeedToken={feedToken} />;
}
