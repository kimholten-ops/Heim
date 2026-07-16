import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stravaEnabled, getAdultMember, getAuthorizeUrl } from "@/lib/strava";

export const runtime = "nodejs";

// GET /api/strava/connect — starter OAuth-flyten. Lagrer en state-verdi i en
// httpOnly-cookie for å verifisere at callback-en faktisk kommer fra en
// forespørsel vi selv startet (CSRF-beskyttelse), og sender brukeren til
// Strava for godkjenning.
export async function GET() {
  if (!stravaEnabled()) {
    return NextResponse.json({ error: "Strava-integrasjonen er ikke tilgjengelig." }, { status: 404 });
  }

  const supabase = await createClient();
  const member = await getAdultMember(supabase);
  if (!member) return NextResponse.json({ error: "Ikke tilgang." }, { status: 403 });

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(getAuthorizeUrl(state));
  res.cookies.set("strava_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
  return res;
}
