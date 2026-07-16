import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stravaEnabled, getAdultMember, exchangeCodeForToken } from "@/lib/strava";

export const runtime = "nodejs";

// GET /api/strava/callback — Strava sender brukeren hit etter godkjenning
// (eller avslag). Bytter koden mot access/refresh-token og lagrer koblingen
// på det innloggede medlemmet.
export async function GET(req: NextRequest) {
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, req.url));
  if (!stravaEnabled()) return redirectTo("/app/helse");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const expectedState = req.cookies.get("strava_oauth_state")?.value;

  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set("strava_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (error) return clearStateCookie(redirectTo("/app/helse?strava=avslatt"));
  if (!code || !state || !expectedState || state !== expectedState) {
    return clearStateCookie(redirectTo("/app/helse?strava=feil"));
  }

  const supabase = await createClient();
  const member = await getAdultMember(supabase);
  if (!member) return clearStateCookie(redirectTo("/login"));

  try {
    const token = await exchangeCodeForToken(code);
    await supabase.from("strava_connections").upsert({
      member_id: member.memberId,
      athlete_id: token.athlete?.id ?? 0,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(token.expires_at * 1000).toISOString(),
    }, { onConflict: "member_id" });
  } catch {
    return clearStateCookie(redirectTo("/app/helse?strava=feil"));
  }

  return clearStateCookie(redirectTo("/app/helse?strava=tilkoblet"));
}
