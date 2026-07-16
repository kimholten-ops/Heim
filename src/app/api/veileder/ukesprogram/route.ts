import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGatedMember } from "@/lib/veileder-auth";
import { veilederEnabled, callVeileder, parseUkesprogram } from "@/lib/veileder";
import { checkAIRateLimit, aiErrorResponse } from "@/lib/ai";
import { buildProfileBlock, buildTrainingContext } from "@/lib/veileder-context";

export const runtime = "nodejs";
// AI-kall kan i sjeldne tilfeller ta lenger enn plattformens standard
// funksjonstidsavbrudd (spesielt store maxTokens-svar eller bilde-tolkning)
// — utvid grensen eksplisitt i stedet for å stole på default.
export const maxDuration = 60;

const VALID_MAL = ["styrke", "generelt", "utholdenhet"] as const;

// POST /api/veileder/ukesprogram — foreslår et ukesprogram som ren JSON.
// Brukeren ser en forhåndsvisning, redigerer, og lagrer selv som mal
// (samme godkjenningsmønster som Smart Add — aldri auto-lagre).
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
  const mal = VALID_MAL.includes(body?.mal) ? body.mal : "generelt";
  const okterPerUke = Math.min(5, Math.max(2, Number(body?.okterPerUke) || 3));
  const utstyr: string[] = Array.isArray(body?.utstyr) && body.utstyr.every((u: unknown) => typeof u === "string")
    ? body.utstyr
    : ["kroppsvekt"];

  const { data: exerciseRows } = await supabase
    .from("exercises").select("id, name_no, muscle_groups, equipment")
    .in("equipment", utstyr.length ? utstyr : ["kroppsvekt"])
    .limit(80);
  const candidates = exerciseRows ?? [];
  const validExerciseIds = new Set(candidates.map((e) => e.id));

  const candidateLines = candidates
    .map((e) => `${e.id}: ${e.name_no} (${e.muscle_groups.join(", ")}${e.equipment ? `, ${e.equipment}` : ""})`)
    .join("\n");

  const [profileBlock, trainingCtx] = await Promise.all([
    buildProfileBlock(supabase, gated.memberId),
    buildTrainingContext(supabase, gated.memberId),
  ]);
  const dynamicContext = [
    trainingCtx,
    `Tilgjengelige øvelser (bruk exercise_id fra denne listen når det finnes en god match; ellers exercise_id: null og skriv navnet i "navn"):\n${candidateLines}`,
  ].join("\n\n");

  const instruction =
    `Lag et ukesprogram for styrketrening. Mål: ${mal}. Ønsket antall økter per uke: ${okterPerUke}.\n\n` +
    `Svar med KUN gyldig JSON i dette skjemaet, ingen annen tekst:\n` +
    `{"okter": [{"navn": string, "ovelser": [{"exercise_id": string|null, "navn": string, "sett": int, "reps": string, "kommentar": string|null}]}]}`;

  const result = await callVeileder({
    supabase, memberId: gated.memberId, kind: "ukesprogram",
    profileBlock, dynamicContext,
    messages: [{ role: "user", content: instruction }],
  });
  if ("error" in result) return aiErrorResponse(result.error);

  const program = parseUkesprogram(result.text, validExerciseIds);
  if (!program) {
    return NextResponse.json({ error: "Klarte ikke lage et gyldig program — prøv igjen." }, { status: 422 });
  }
  return NextResponse.json({ program });
}
