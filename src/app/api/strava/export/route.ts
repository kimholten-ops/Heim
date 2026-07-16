import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdultMember, getValidAccessToken, createStravaActivity } from "@/lib/strava";

export const runtime = "nodejs";

const TYPE_LABELS: Record<string, string> = { styrke: "Styrke", cardio: "Cardio", yoga: "Yoga", mobilitet: "Mobilitet", annet: "Trening" };

// POST /api/strava/export — deler én fullført økt til Strava som en manuell
// aktivitet (ingen fil-generering nødvendig, kun feltene Strava selv støtter
// for POST /activities). Idempotent: en økt som allerede er delt returnerer
// bare lenken på nytt i stedet for å opprette en duplikat-aktivitet.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const member = await getAdultMember(supabase);
  if (!member) return NextResponse.json({ error: "Ikke tilgang." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) return NextResponse.json({ error: "Mangler økt-id." }, { status: 400 });

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, template_id, type, started_at, finished_at, distance_km, ai_review, strava_activity_id")
    .eq("id", sessionId).eq("member_id", member.memberId).maybeSingle();
  if (!session) return NextResponse.json({ error: "Fant ikke økten." }, { status: 404 });
  if (!session.finished_at) return NextResponse.json({ error: "Økten er ikke avsluttet ennå." }, { status: 400 });

  if (session.strava_activity_id) {
    return NextResponse.json({ url: `https://www.strava.com/activities/${session.strava_activity_id}`, activityId: session.strava_activity_id, cached: true });
  }

  const accessToken = await getValidAccessToken(supabase, member.memberId);
  if (!accessToken) return NextResponse.json({ error: "Ikke koblet til Strava." }, { status: 400 });

  let name = `${TYPE_LABELS[session.type] ?? "Trening"}-økt`;
  if (session.type === "styrke" && session.template_id) {
    const { data: template } = await supabase.from("workout_templates").select("name").eq("id", session.template_id).maybeSingle();
    if (template?.name) name = template.name;
  }

  const elapsedTimeSeconds = (new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) / 1000;

  try {
    const activity = await createStravaActivity(accessToken, {
      name,
      sessionType: session.type,
      startDateLocal: session.started_at,
      elapsedTimeSeconds,
      distanceMeters: session.distance_km != null ? session.distance_km * 1000 : undefined,
      description: session.ai_review ? `AI-coach: ${session.ai_review}` : undefined,
    });
    await supabase.from("workout_sessions").update({ strava_activity_id: activity.id }).eq("id", sessionId);
    return NextResponse.json({ url: `https://www.strava.com/activities/${activity.id}`, activityId: activity.id, cached: false });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Klarte ikke dele til Strava." }, { status: 502 });
  }
}
