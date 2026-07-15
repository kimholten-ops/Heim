import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGatedMember, checkVeilederRateLimit, logVeilederUsage } from "@/lib/veileder-auth";
import { veilederEnabled, callVeileder } from "@/lib/veileder";
import { buildProfileBlock, buildWeekTrainingContext, buildKostholdContext, isoWeekStart } from "@/lib/veileder-context";
import { todayISO } from "@/lib/nutrition";

export const runtime = "nodejs";

// GET /api/veileder/gjennomgang — ukesgjennomgang. Sjekker ai_weekly_reviews
// for inneværende uke FØRST (cache) — finnes den, returneres den uten
// API-kall. Én gjennomgang per medlem per uke.
export async function GET() {
  if (!veilederEnabled()) {
    return NextResponse.json({ error: "Veilederen er ikke tilgjengelig." }, { status: 404 });
  }

  const supabase = await createClient();
  const gated = await getGatedMember(supabase);
  if (!gated) return NextResponse.json({ error: "Ikke tilgang." }, { status: 403 });

  const weekStart = isoWeekStart(todayISO());

  const { data: cached } = await supabase
    .from("ai_weekly_reviews").select("text").eq("member_id", gated.memberId).eq("week_start", weekStart).maybeSingle();
  if (cached) {
    return NextResponse.json({ text: cached.text, cached: true });
  }

  const allowed = await checkVeilederRateLimit(supabase, gated.memberId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Veilederen har nådd dagens grense — prøv igjen i morgen." },
      { status: 429 }
    );
  }

  const [profileBlock, trainingCtx, kostholdCtx] = await Promise.all([
    buildProfileBlock(supabase, gated.memberId),
    buildWeekTrainingContext(supabase, gated.memberId),
    buildKostholdContext(supabase, gated.memberId),
  ]);
  const dynamicContext = [trainingCtx, kostholdCtx].join("\n\n");

  try {
    const result = await callVeileder({
      kind: "gjennomgang",
      profileBlock,
      dynamicContext,
      messages: [{ role: "user", content: "Gi en kort ukesgjennomgang av trening og kosthold denne uken, basert på konteksten over." }],
    });
    if (!result) return NextResponse.json({ error: "Veilederen er ikke tilgjengelig." }, { status: 404 });

    await logVeilederUsage(supabase, gated.memberId, "gjennomgang", result.usage);
    await supabase.from("ai_weekly_reviews")
      .upsert({ member_id: gated.memberId, week_start: weekStart, text: result.text }, { onConflict: "member_id,week_start" });

    return NextResponse.json({ text: result.text, cached: false });
  } catch {
    return NextResponse.json(
      { error: "Veilederen er utilgjengelig akkurat nå — prøv igjen senere." },
      { status: 502 }
    );
  }
}
