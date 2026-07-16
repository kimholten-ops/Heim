import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Strava-eksport: hver bruker kobler sin egen Strava-konto (OAuth), og kan
// dele en fullført økt dit som en aktivitet. STRAVA_CLIENT_ID/SECRET kommer
// fra en gratis, selv-registrert "API Application" på strava.com/settings/api
// — mangler de, er stravaEnabled() false og hele funksjonen skjules stille i
// UI-et (samme mønster som ANTHROPIC_API_KEY-graderingen i src/lib/ai.ts).
// Appen fungerer 100 % uten.
type Sb = SupabaseClient<Database>;

const BASE_URL = "https://heim-virid.vercel.app";
const REDIRECT_URI = `${BASE_URL}/api/strava/callback`;

export function stravaEnabled(): boolean {
  return !!process.env.STRAVA_CLIENT_ID && !!process.env.STRAVA_CLIENT_SECRET;
}

// Samme rolle-gate som resten av helse-modulen (kun voksne), men UTEN
// household_role-innskrenkingen veilederen har — Strava-kobling er personlig
// og gratis (ingen delt AI-kvote å beskytte), så gjester som er voksne skal
// kunne koble til sin egen konto akkurat som de allerede logger egne økter.
export type AdultMember = { memberId: string };

export async function getAdultMember(supabase: Sb): Promise<AdultMember | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles").select("active_household_id").eq("id", user.id).maybeSingle();
  const hid = profile?.active_household_id ?? null;
  if (!hid) return null;

  const { data: me } = await supabase
    .from("members").select("id, role").eq("household_id", hid).eq("auth_user_id", user.id).maybeSingle();
  if (!me || me.role !== "adult") return null;

  return { memberId: me.id };
}

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:write",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token: string; refresh_token: string; expires_at: number;
  athlete?: { id: number };
};

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token-utveksling feilet (${res.status}).`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Strava token-fornyelse feilet (${res.status}).`);
  return res.json();
}

// Henter en gyldig access token for medlemmet, og fornyer (+ lagrer) den
// automatisk hvis den er utløpt eller snart går ut. Returnerer null hvis
// medlemmet ikke har koblet til Strava.
export async function getValidAccessToken(supabase: Sb, memberId: string): Promise<string | null> {
  const { data: conn } = await supabase
    .from("strava_connections").select("access_token, refresh_token, expires_at").eq("member_id", memberId).maybeSingle();
  if (!conn) return null;

  const expiresAt = new Date(conn.expires_at).getTime();
  const soonExpired = expiresAt < Date.now() + 5 * 60_000; // 5 min buffer
  if (!soonExpired) return conn.access_token;

  const fresh = await refreshAccessToken(conn.refresh_token);
  await supabase.from("strava_connections").update({
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token,
    expires_at: new Date(fresh.expires_at * 1000).toISOString(),
  }).eq("member_id", memberId);
  return fresh.access_token;
}

const SPORT_TYPE_BY_SESSION_TYPE: Record<string, string> = {
  styrke: "WeightTraining",
  cardio: "Run",
  yoga: "Yoga",
  mobilitet: "Workout",
  annet: "Workout",
};

export function mapSportType(sessionType: string): { type: string; sport_type: string } {
  const sportType = SPORT_TYPE_BY_SESSION_TYPE[sessionType] ?? "Workout";
  return { type: sportType, sport_type: sportType };
}

export type StravaActivityInput = {
  name: string;
  sessionType: string;
  startDateLocal: string; // ISO 8601
  elapsedTimeSeconds: number;
  distanceMeters?: number;
  description?: string;
};

// Oppretter en manuell aktivitet på Strava (ikke fil-opplasting — trenger
// ingen FIT/TCX-generering, kun feltene aktiviteten faktisk har).
export async function createStravaActivity(accessToken: string, input: StravaActivityInput): Promise<{ id: number }> {
  const { type, sport_type } = mapSportType(input.sessionType);
  const params = new URLSearchParams({
    name: input.name,
    type,
    sport_type,
    start_date_local: input.startDateLocal,
    elapsed_time: String(Math.max(1, Math.round(input.elapsedTimeSeconds))),
  });
  if (input.distanceMeters != null) params.set("distance", String(Math.round(input.distanceMeters)));
  if (input.description) params.set("description", input.description);

  const res = await fetch("https://www.strava.com/api/v3/activities", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Strava avviste aktiviteten (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}
