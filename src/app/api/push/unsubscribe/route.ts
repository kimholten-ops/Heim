import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  let endpoint = "";
  try {
    const body = await req.json();
    endpoint = String(body?.endpoint ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  if (!endpoint) return NextResponse.json({ error: "Mangler endpoint." }, { status: 400 });

  // RLS begrenser sletting til egne rader uansett (auth_user_id = auth.uid()),
  // men filtrerer eksplisitt på endpoint for å ikke slette andre abonnement
  // brukeren måtte ha fra andre enheter.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("auth_user_id", user.id);
  return NextResponse.json({ ok: true });
}
