import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { callAI, aiEnabled, type AIResult } from "@/lib/ai";

// Helse-veilederens domenespesifikke lag over den delte AI-infrastrukturen
// (src/lib/ai.ts) — persona/systemprompt og trening-spesifikk JSON-parsing
// hører hjemme her, ikke i den delte libben som også brukes av Smart Add,
// oppskriftsimport og ukesmeny.
type Sb = SupabaseClient<Database>;

export type VeilederKind = "chat" | "ukesprogram" | "gjennomgang" | "maltid";

export const SYSTEM_PROMPT = `Du er en rolig, jordnær kosthold- og treningsveileder i familieappen Heim.
Du hjelper voksne med trening (styrke, progresjon, øktplanlegging) og
kosthold (måltidsforslag, makrobalanse) basert på deres egne loggede data.

Absolutte regler:
1. Du gir ALDRI medisinske råd. Ved smerte, skade, sykdom, graviditet,
   spiseforstyrrelser eller medisinbruk: anbefal alltid fastlege eller
   fysioterapeut, kort og vennlig, uten å spekulere.
2. Du foreslår ALDRI kaloriinntak under 1500 kcal/dag, uansett hva
   brukeren ber om. Ved ønske om raskt vekttap: anbefal moderat tempo
   (maks ~0,5 kg/uke) og balansert kosthold.
3. Ingen skam-språk, ingen moralisering over mat («syndig», «fortjent»),
   ingen pressende motivasjonsretorikk. Nøytral og støttende.
4. Hold deg til dataene du får — ikke finn på treningshistorikk eller
   måltider som ikke står i konteksten.
5. Svar på norsk, kort og konkret. Bruk vanlige norske øvelsesnavn
   og matvarer som er vanlige i Norge.
6. Du er et verktøy for oversikt og forslag — ikke en erstatning for
   fagperson, og du minner om det når temaet nærmer seg helse.`;

export function veilederEnabled(): boolean {
  return aiEnabled();
}

// Bygger system-delene med cache_control på profilblokken — det gir
// prefiks-cachet [systemprompt + profilblokk], mens dagens dynamiske
// kontekst legges ukachet etter, slik at den kan endre seg fra kall til
// kall uten å ugyldiggjøre cachen foran.
//
// OBS: Haiku 4.5 krever minimum ~4096 tokens sammenhengende prefiks for at
// caching faktisk skal slå inn (kortere prefiks cacher stille ingenting —
// ingen feil, bare cache_read_input_tokens=0). Systemprompt+profilblokk her
// er typisk godt under den grensen, så i praksis gir cachingen sannsynligvis
// ingen kostnadsbesparelse per i dag — den er likevel riktig strukturert for
// når profilblokken vokser.
export async function callVeileder(opts: {
  supabase: Sb;
  memberId: string;
  kind: VeilederKind;
  profileBlock: string;
  dynamicContext: string;
  messages: Anthropic.MessageParam[];
}): Promise<AIResult> {
  return callAI({
    supabase: opts.supabase,
    memberId: opts.memberId,
    kind: opts.kind,
    system: [
      { text: SYSTEM_PROMPT },
      { text: opts.profileBlock, cache: true },
      { text: opts.dynamicContext },
    ],
    messages: opts.messages,
  });
}

// Defensiv JSON-parsing av ukesprogram-forslag (delt parseAIJson fra
// src/lib/ai.ts + trenings-spesifikk validering: exercise_id må finnes i
// kandidatlisten, ellers forkastes den til fritekst).
export type UkesprogramOvelse = { exercise_id: string | null; navn: string; sett: number; reps: string; kommentar: string | null };
export type UkesprogramOkt = { navn: string; ovelser: UkesprogramOvelse[] };
export type Ukesprogram = { okter: UkesprogramOkt[] };

export function parseUkesprogram(raw: string, validExerciseIds: Set<string>): Ukesprogram | null {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || !("okter" in parsed)) return null;
  const oktRaw = (parsed as { okter: unknown }).okter;
  if (!Array.isArray(oktRaw)) return null;

  const okter: UkesprogramOkt[] = [];
  for (const o of oktRaw) {
    if (typeof o !== "object" || o === null) continue;
    const rec = o as Record<string, unknown>;
    if (typeof rec.navn !== "string" || !Array.isArray(rec.ovelser)) continue;

    const ovelser: UkesprogramOvelse[] = [];
    for (const e of rec.ovelser) {
      if (typeof e !== "object" || e === null) continue;
      const er = e as Record<string, unknown>;
      if (typeof er.navn !== "string" || typeof er.sett !== "number" || typeof er.reps !== "string") continue;
      const exerciseId = typeof er.exercise_id === "string" && validExerciseIds.has(er.exercise_id) ? er.exercise_id : null;
      const kommentar = typeof er.kommentar === "string" ? er.kommentar : null;
      ovelser.push({ exercise_id: exerciseId, navn: er.navn, sett: Math.round(er.sett), reps: er.reps, kommentar });
    }
    if (ovelser.length > 0) okter.push({ navn: rec.navn, ovelser });
  }
  if (okter.length === 0) return null;
  return { okter };
}
