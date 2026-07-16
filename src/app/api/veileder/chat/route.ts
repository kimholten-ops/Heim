import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGatedMember } from "@/lib/veileder-auth";
import { veilederEnabled, callVeileder } from "@/lib/veileder";
import { checkAIRateLimit, aiErrorResponse } from "@/lib/ai";
import { buildProfileBlock, buildTrainingContext, buildKostholdContext, buildMealContext } from "@/lib/veileder-context";
import type Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
// AI-kall kan i sjeldne tilfeller ta lenger enn plattformens standard
// funksjonstidsavbrudd (spesielt store maxTokens-svar eller bilde-tolkning)
// — utvid grensen eksplisitt i stedet for å stole på default.
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

// POST /api/veileder/chat — fri chat med veilederen. Meldingshistorikk
// (maks siste 10) holdes klient-side og sendes inn hver gang — ingen
// samtale-lagring i DB i v1.
export async function POST(req: NextRequest) {
  if (!veilederEnabled()) {
    return NextResponse.json({ error: "Veilederen er ikke tilgjengelig." }, { status: 404 });
  }

  const supabase = await createClient();
  const gated = await getGatedMember(supabase);
  if (!gated) return NextResponse.json({ error: "Ikke tilgang." }, { status: 403 });

  const allowed = await checkAIRateLimit(supabase, gated.memberId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Veilederen har nådd dagens grense — prøv igjen i morgen." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const rawMessages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
  // Behold kun de siste 10, og sørg for at den første er en bruker-melding
  // (Anthropic-API-et krever at samtalen starter med role: "user").
  let trimmed = rawMessages.slice(-10).filter((m) => m.role === "user" || m.role === "assistant");
  const firstUserIdx = trimmed.findIndex((m) => m.role === "user");
  trimmed = firstUserIdx >= 0 ? trimmed.slice(firstUserIdx) : [];
  if (trimmed.length === 0) {
    return NextResponse.json({ error: "Ingen melding å svare på." }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = trimmed.map((m) => ({ role: m.role, content: m.content }));

  const [profileBlock, trainingCtx, kostholdCtx, mealCtx] = await Promise.all([
    buildProfileBlock(supabase, gated.memberId),
    buildTrainingContext(supabase, gated.memberId),
    buildKostholdContext(supabase, gated.memberId),
    buildMealContext(supabase, gated.householdId),
  ]);
  const dynamicContext = [trainingCtx, kostholdCtx, mealCtx].join("\n\n");

  const result = await callVeileder({ supabase, memberId: gated.memberId, kind: "chat", profileBlock, dynamicContext, messages });
  if ("error" in result) return aiErrorResponse(result.error);
  return NextResponse.json({ text: result.text });
}
