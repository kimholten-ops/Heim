import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCalendarImport } from "@/lib/calendar-import-sync";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

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
