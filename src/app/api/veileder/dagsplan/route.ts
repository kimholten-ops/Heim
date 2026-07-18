import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGatedMember } from "@/lib/veileder-auth";
import { veilederEnabled, callVeileder } from "@/lib/veileder";
import { checkAIRateLimit, aiErrorResponse } from "@/lib/ai";
import { buildProfileBlock, buildDagsplanContext } from "@/lib/veileder-context";

export const runtime = "nodejs";
// AI-kall kan i sjeldne tilfeller ta lenger enn plattformens standard
// funksjonstidsavbrudd (spesielt store maxTokens-svar eller bilde-tolkning)
// — utvid grensen eksplisitt i stedet for å stole på default.
export const maxDuration = 60;

// POST /api/veileder/dagsplan — foreslår en måltidsplan for resten av dagen
// (frokost, lunsj, kvelds, og middag hvis den ikke allerede er planlagt i
// ukesmenyen), basert på kalori-/proteinmål og dagens treningsøkter. Rene
// fritekst-forslag i samme stil som /api/veileder/maltid — brukeren logger
// selv det de faktisk spiser, dette er kun et forslag.
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

  const [profileBlock, dagsplan, { data: matvarer }] = await Promise.all([
    buildProfileBlock(supabase, gated.memberId),
    buildDagsplanContext(supabase, gated.memberId, gated.householdId),
    supabase.from("matvarer").select("navn, kcal, protein_g, karbo_g, fett_g").order("protein_g", { ascending: false }).limit(20),
  ]);

  if (dagsplan.missingSlots.length === 0) {
    return NextResponse.json({ text: "Alle måltider er allerede logget eller planlagt for i dag — ingenting å foreslå." });
  }

  const candidateLines = (matvarer ?? [])
    .map((m) => `${m.navn}: ${m.kcal} kcal, ${m.protein_g} g protein, ${m.karbo_g} g karbo, ${m.fett_g} g fett (per 100 g)`)
    .join("\n");
  const dynamicContext = [dagsplan.context, `Kandidatmatvarer (proteinrike basisvarer):\n${candidateLines}`].join("\n\n");

  const result = await callVeileder({
    supabase, memberId: gated.memberId, kind: "dagsplan",
    profileBlock, dynamicContext,
    messages: [{
      role: "user",
      content: `Lag en enkel måltidsplan som dekker ${dagsplan.missingSlots.join(", ")} i dag. Gi ett konkret forslag per måltid med omtrentlige mengder — ikke lange oppskrifter. Hold deg samlet innenfor det oppgitte gjenstående kalori- og proteinbudsjettet for disse måltidene.`,
    }],
  });
  if ("error" in result) return aiErrorResponse(result.error);
  return NextResponse.json({ text: result.text });
}
