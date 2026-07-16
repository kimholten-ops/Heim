import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdultMember } from "@/lib/strava";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const member = await getAdultMember(supabase);
  if (!member) return NextResponse.json({ error: "Ikke tilgang." }, { status: 403 });

  await supabase.from("strava_connections").delete().eq("member_id", member.memberId);
  return NextResponse.json({ ok: true });
}
