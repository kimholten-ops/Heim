import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGatedMember } from "@/lib/veileder-auth";
import { veilederEnabled, callVeileder } from "@/lib/veileder";
import { checkAIRateLimit, aiErrorResponse } from "@/lib/ai";
import { buildProfileBlock, buildTrainingContext, buildSessionBlock } from "@/lib/veileder-context";

export const runtime = "nodejs";

// POST /api/veileder/trening — treningscoach for én ferdig økt: vurderer
// økta mot de siste 4 ukene og foreslår konkrete endringer til neste gang
// (JEFIT-stil). Kjøres automatisk rett etter at brukeren avslutter en økt,
// og cacher svaret på selve økten (workout_sessions.ai_review) — én
// vurdering per økt, uansett hvor mange ganger den vises igjen senere.
export async function POST(req: NextRequest) {
  if (!veilederEnabled()) {
    return NextResponse.json({ error: "Veilederen er ikke tilgjengelig." }, { status: 404 });
  }

  const supabase = await createClient();
  const gated = await getGatedMember(supabase);
  if (!gated) return NextResponse.json({ error: "Ikke tilgang." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) return NextResponse.json({ error: "Mangler økt-id." }, { status: 400 });

  const { data: session } = await supabase
    .from("workout_sessions").select("id, ai_review, finished_at")
    .eq("id", sessionId).eq("member_id", gated.memberId).maybeSingle();
  if (!session) return NextResponse.json({ error: "Fant ikke økten." }, { status: 404 });
  if (!session.finished_at) return NextResponse.json({ error: "Økten er ikke avsluttet ennå." }, { status: 400 });
  if (session.ai_review) return NextResponse.json({ text: session.ai_review, cached: true });

  const allowed = await checkAIRateLimit(supabase, gated.memberId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Veilederen har nådd dagens grense — prøv igjen i morgen." },
      { status: 429 }
    );
  }

  const [profileBlock, trainingCtx, sessionBlock] = await Promise.all([
    buildProfileBlock(supabase, gated.memberId),
    buildTrainingContext(supabase, gated.memberId),
    buildSessionBlock(supabase, sessionId),
  ]);

  const result = await callVeileder({
    supabase, memberId: gated.memberId, kind: "trening",
    profileBlock, dynamicContext: `${trainingCtx}\n\n${sessionBlock}`,
    messages: [{
      role: "user",
      content: "Gi en kort vurdering av denne treningsøkta sammenlignet med tidligere økter, og foreslå konkrete, "
        + "gjennomførbare endringer til neste økt (f.eks. vekt- eller reps-justering per øvelse for styrke, "
        + "eller tempo/varighet for kondisjon/yoga/mobilitet). Maks noen få setninger.",
    }],
  });
  if ("error" in result) return aiErrorResponse(result.error);

  await supabase.from("workout_sessions").update({ ai_review: result.text }).eq("id", sessionId);
  return NextResponse.json({ text: result.text, cached: false });
}
