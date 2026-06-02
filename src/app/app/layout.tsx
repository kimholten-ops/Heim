import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HouseholdProvider, type HouseholdRef, type Member } from "@/components/HouseholdContext";
import BottomNav from "@/components/BottomNav";
import NoHousehold from "@/components/NoHousehold";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, active_household_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: myMembers } = await supabase
    .from("members")
    .select("household_id")
    .eq("auth_user_id", user.id);

  const ids = (myMembers ?? []).map((m) => m.household_id);
  const { data: households } = ids.length
    ? await supabase.from("households").select("id, name").in("id", ids)
    : { data: [] as HouseholdRef[] };

  const myHouseholds: HouseholdRef[] = households ?? [];
  const activeId = profile?.active_household_id ?? null;
  const active = activeId ? myHouseholds.find((h) => h.id === activeId) ?? null : null;
  const meName = profile?.display_name ?? "Meg";

  if (!active) {
    return <NoHousehold meName={meName} />;
  }

  const { data: members } = await supabase
    .from("members")
    .select("id, name, color, role, can_login")
    .eq("household_id", active.id)
    .order("role");

  return (
    <HouseholdProvider
      value={{ meName, household: active, members: (members ?? []) as Member[], myHouseholds }}
    >
      <div className="min-h-[100dvh] max-w-md mx-auto" style={{ paddingBottom:"clamp(60px,10vh,82px)" }}>{children}</div>
      <BottomNav />
    </HouseholdProvider>
  );
}
