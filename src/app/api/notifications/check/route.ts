import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, checkIpRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

// Ingen cron/pg_cron finnes ennå, så denne kalles klient-side når appen
// lastes (se src/lib/notifications.ts). Idempotent: en unik indeks på
// (member_id, type, ref_id) i notifications hindrer dobbel-varsling selv om
// flere familiemedlemmer trigger sjekken samtidig.
const WINDOW_BEFORE_MIN = 5;
const WINDOW_AHEAD_MIN = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const allowed = await checkRateLimit(supabase, "notifications-check", 30, 10);
  if (!allowed) return NextResponse.json({ error: "For mange forsøk. Vent litt og prøv igjen." }, { status: 429 });
  const ipAllowed = await checkIpRateLimit(getClientIp(req), "notifications-check", 100, 10);
  if (!ipAllowed) return NextResponse.json({ error: "For mange forsøk fra denne tilkoblingen." }, { status: 429 });

  let householdId = "";
  try {
    const body = await req.json();
    householdId = String(body?.householdId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  if (!householdId) return NextResponse.json({ error: "Mangler householdId." }, { status: 400 });

  const { data: myMember } = await supabase
    .from("members").select("id")
    .eq("household_id", householdId).eq("auth_user_id", user.id).maybeSingle();
  if (!myMember) return NextResponse.json({ error: "Ikke medlem av husstanden." }, { status: 403 });

  const now = Date.now();
  const from = new Date(now - WINDOW_BEFORE_MIN * 60_000).toISOString();
  const to = new Date(now + WINDOW_AHEAD_MIN * 60_000).toISOString();

  type EventRow = {
    id: string; title: string; start_at: string; location: string | null;
    event_members: { member_id: string }[];
  };
  const { data: eventsData } = await supabase
    .from("events")
    .select("id, title, start_at, location, all_day, event_members(member_id)")
    .eq("household_id", householdId)
    .eq("all_day", false)
    .gte("start_at", from)
    .lte("start_at", to);
  const events = (eventsData ?? []) as unknown as EventRow[];

  const { data: members } = await supabase
    .from("members").select("id, auth_user_id").eq("household_id", householdId);
  const allMemberIds = (members ?? []).map((m) => m.id);
  const authByMember = new Map((members ?? []).map((m) => [m.id, m.auth_user_id]));

  const serviceClient = createServiceClient();
  let created = 0;

  for (const ev of events) {
    const invited = (ev.event_members ?? []).map((em) => em.member_id);
    const targets = invited.length > 0 ? invited : allMemberIds;
    const startLabel = new Date(ev.start_at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    const body = `Starter ${startLabel}${ev.location ? " · " + ev.location : ""}`;

    for (const memberId of targets) {
      // Ingen pre-sjekk her: RLS gjør at denne brukeren uansett ikke kan lese
      // andre medlemmers notifications-rader, så duplikat-vern skjer alene
      // via den unike indeksen (member_id, type, ref_id) på innsetting.
      const { error: insertError } = await supabase.from("notifications").insert({
        household_id: householdId, member_id: memberId, type: "event_reminder",
        title: ev.title, body, url: "/app/kalender", ref_id: ev.id,
      });
      if (insertError) continue;
      created++;

      const authUserId = authByMember.get(memberId);
      if (authUserId && serviceClient) {
        await sendPushToUser(serviceClient, authUserId, { title: ev.title, body, url: "/app/kalender" });
      }
    }
  }

  return NextResponse.json({ created });
}
