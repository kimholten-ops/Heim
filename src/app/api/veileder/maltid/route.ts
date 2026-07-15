import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGatedMember } from "@/lib/veileder-auth";
import { veilederEnabled, callVeileder } from "@/lib/veileder";
import { checkAIRateLimit, aiErrorResponse } from "@/lib/ai";
import { buildProfileBlock, buildRemainingToday } from "@/lib/veileder-context";

export const runtime = "nodejs";

// POST /api/veileder/maltid — måltidsforslag basert på gjenstående kcal/protein
// i dag. Beregnes server-side (aldri stol på klient-oppgitte gjenværende tall),
// sendt sammen med en kandidatliste proteinrike basisvarer fra Matvaretabellen.
export async function POST() {
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

  const [profileBlock, remaining, { data: matvarer }] = await Promise.all([
    buildProfileBlock(supabase, gated.memberId),
    buildRemainingToday(supabase, gated.memberId),
    supabase.from("matvarer").select("navn, kcal, protein_g, karbo_g, fett_g").order("protein_g", { ascending: false }).limit(20),
  ]);

  const candidateLines = (matvarer ?? [])
    .map((m) => `${m.navn}: ${m.kcal} kcal, ${m.protein_g} g protein, ${m.karbo_g} g karbo, ${m.fett_g} g fett (per 100 g)`)
    .join("\n");
  const dynamicContext = [remaining.context, `Kandidatmatvarer (proteinrike basisvarer):\n${candidateLines}`].join("\n\n");

  const result = await callVeileder({
    supabase, memberId: gated.memberId, kind: "maltid",
    profileBlock, dynamicContext,
    messages: [{ role: "user", content: "Foreslå 3 konkrete måltider for resten av dagen, med omtrentlige mengder, basert på hva som gjenstår." }],
  });
  if ("error" in result) return aiErrorResponse(result.error);
  return NextResponse.json({ text: result.text });
}
