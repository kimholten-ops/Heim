import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, checkIpRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const allowed = await checkRateLimit(supabase, "push-subscribe", 20, 60);
  if (!allowed) return NextResponse.json({ error: "For mange forsøk. Vent litt og prøv igjen." }, { status: 429 });
  const ipAllowed = await checkIpRateLimit(getClientIp(req), "push-subscribe", 60, 60);
  if (!ipAllowed) return NextResponse.json({ error: "For mange forsøk fra denne tilkoblingen." }, { status: 429 });

  let endpoint = "", p256dh = "", authKey = "";
  try {
    const body = await req.json();
    endpoint = String(body?.endpoint ?? "").trim();
    p256dh = String(body?.p256dh ?? "").trim();
    authKey = String(body?.auth ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Mangler abonnementsdata." }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ auth_user_id: user.id, endpoint, p256dh, auth_key: authKey }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Kunne ikke lagre abonnement." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
