import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGatedMember } from "@/lib/veileder-auth";
import { veilederEnabled, callVeileder, parseGjennomgang } from "@/lib/veileder";
import { checkAIRateLimit, aiErrorResponse } from "@/lib/ai";
import { buildProfileBlock, buildWeekTrainingContext, buildKostholdContext, isoWeekStart } from "@/lib/veileder-context";
import { computeAdaptiveTdee } from "@/lib/adaptive-tdee";
import { todayISO } from "@/lib/nutrition";

export const runtime = "nodejs";
// AI-kall kan i sjeldne tilfeller ta lenger enn plattformens standard
// funksjonstidsavbrudd (spesielt store maxTokens-svar eller bilde-tolkning)
// — utvid grensen eksplisitt i stedet for å stole på default.
export const maxDuration = 60;

// GET /api/veileder/gjennomgang — ukesgjennomgang: kort oppsummering + tre
// konkrete justeringer til neste uke (strukturert JSON, ikke fritekst), pluss
// et deterministisk (ikke AI-generert) forslag til nytt kalorimål basert på
// faktisk vektendring og loggført inntak siste 14 dager. Sjekker
// ai_weekly_reviews for inneværende uke FØRST (cache) — finnes den,
// returneres AI-teksten uten nytt API-kall. Kaloriforslaget er ren
// aritmetikk og regnes derfor alltid ferskt, også ved cache-treff, siden
// vekt/mat-data endrer seg gjennom uken selv om gjennomgangsteksten ikke gjør det.
export async function GET() {
  if (!veilederEnabled()) {
    return NextResponse.json({ error: "Veilederen er ikke tilgjengelig." }, { status: 404 });
  }

  const supabase = await createClient();
  const gated = await getGatedMember(supabase);
  if (!gated) return NextResponse.json({ error: "Ikke tilgang." }, { status: 403 });

  const weekStart = isoWeekStart(todayISO());
  const tdeeForslag = await computeAdaptiveTdee(supabase, gated.memberId);

  const { data: cached } = await supabase
    .from("ai_weekly_reviews").select("text").eq("member_id", gated.memberId).eq("week_start", weekStart).maybeSingle();
  if (cached) {
    const { oppsummering, justeringer } = parseGjennomgang(cached.text);
    return NextResponse.json({ oppsummering, justeringer, tdeeForslag, cached: true });
  }

  const allowed = await checkAIRateLimit(supabase, gated.memberId);
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
  const tdeeBlock = tdeeForslag
    ? `Kaloriberegning: basert på snittinntak (${tdeeForslag.avgKcalLogged} kcal/dag) og vektendring ` +
      `(${tdeeForslag.weightChangeKg > 0 ? "+" : ""}${tdeeForslag.weightChangeKg} kg) siste ${tdeeForslag.daysUsed} dager, ` +
      `ser det egentlige vedlikeholdsnivået ut til å være rundt ${tdeeForslag.suggested} kcal (nåværende mål: ${tdeeForslag.current} kcal).`
    : "";
  const dynamicContext = [trainingCtx, kostholdCtx, tdeeBlock].filter(Boolean).join("\n\n");

  const result = await callVeileder({
    supabase, memberId: gated.memberId, kind: "gjennomgang",
    profileBlock, dynamicContext,
    messages: [{
      role: "user",
      content: "Gi en kort ukesgjennomgang av trening og kosthold denne uken, basert på konteksten over. " +
        'Returner KUN gyldig JSON: {"oppsummering":string,"justeringer":[string,string,string]} — ' +
        "oppsummering er 2-3 setninger, justeringer er nøyaktig tre konkrete, gjennomførbare endringer til neste uke " +
        "(bruk kaloriberegningen over hvis den er med). Ingen forklaring, ingen markdown.",
    }],
  });
  if ("error" in result) return aiErrorResponse(result.error);

  const { oppsummering, justeringer } = parseGjennomgang(result.text);
  await supabase.from("ai_weekly_reviews").upsert(
    { member_id: gated.memberId, week_start: weekStart, text: JSON.stringify({ oppsummering, justeringer }) },
    { onConflict: "member_id,week_start" }
  );

  return NextResponse.json({ oppsummering, justeringer, tdeeForslag, cached: false });
}
