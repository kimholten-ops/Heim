import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCalendarImport } from "@/lib/calendar-import-sync";
import { checkRateLimit, checkIpRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const allowed = await checkRateLimit(supabase, "calendar-imports-sync", 30, 60);
  if (!allowed) return NextResponse.json({ error: "For mange synk-forsøk. Vent litt og prøv igjen." }, { status: 429 });

  const ipAllowed = await checkIpRateLimit(getClientIp(req), "calendar-imports-sync", 100, 60);
  if (!ipAllowed) return NextResponse.json({ error: "For mange synk-forsøk fra denne tilkoblingen. Vent litt og prøv igjen." }, { status: 429 });

  let importId = "";
  try {
    const body = await req.json();
    importId = String(body?.importId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  if (!importId) return NextResponse.json({ error: "Mangler importId." }, { status: 400 });

  const result = await syncCalendarImport(importId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ count: result.count });
}
