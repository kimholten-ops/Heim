import Anthropic from "@anthropic-ai/sdk";

// Server-only Anthropic-oppsett for AI-veilederen (importeres kun fra API-ruter
// og server-komponenter, samme konvensjon som src/lib/supabase/service.ts).
// ANTHROPIC_API_KEY skal
// ALDRI være NEXT_PUBLIC_ — mangler den, er veilederEnabled() false og hele
// Veileder-UI-et skjules stille (samme mønster som Kassalapp-degraderingen
// i /api/varer). Appen fungerer 100 % uten.
const MODEL = "claude-haiku-4-5";

export const MAX_TOKENS = {
  chat: 500,
  maltid: 600,
  gjennomgang: 700,
  ukesprogram: 1500,
} as const;

export type VeilederKind = keyof typeof MAX_TOKENS;

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
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}

export type VeilederUsage = { input_tokens: number; output_tokens: number; cache_read_tokens: number };
export type VeilederResult = { text: string; usage: VeilederUsage };

// Bygger system-arrayen med cache_control på SISTE cache-verdige blokk
// (profilblokken) — det gir prefiks-cachet [systemprompt + profilblokk],
// mens dagens dynamiske kontekst legges ukachet etter, slik at den kan endre
// seg fra kall til kall uten å ugyldiggjøre cachen foran.
//
// OBS: Haiku 4.5 krever minimum ~4096 tokens sammenhengende prefiks for at
// caching faktisk skal slå inn (kortere prefiks cacher stille ingenting —
// ingen feil, bare cache_read_input_tokens=0). Systemprompt+profilblokk her
// er typisk godt under den grensen, så i praksis gir cachingen sannsynligvis
// ingen kostnadsbesparelse per i dag — den er likevel riktig strukturert for
// når profilblokken vokser, eller ved gjentatte kall i samme økt der Anthropic
// sin infrastruktur uansett kan gjenkjenne identisk prefiks.
function buildSystem(profileBlock: string, dynamicContext: string) {
  return [
    { type: "text" as const, text: SYSTEM_PROMPT },
    { type: "text" as const, text: profileBlock, cache_control: { type: "ephemeral" as const } },
    { type: "text" as const, text: dynamicContext },
  ];
}

export async function callVeileder(opts: {
  kind: VeilederKind;
  profileBlock: string;
  dynamicContext: string;
  messages: Anthropic.MessageParam[];
}): Promise<VeilederResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const response = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS[opts.kind],
      system: buildSystem(opts.profileBlock, opts.dynamicContext),
      messages: opts.messages,
    },
    { timeout: 20_000 }
  );

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    text,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}

// Defensiv JSON-parsing av ukesprogram-forslag: modellen kan pakke JSON-en i
// kodeblokk-fences eller legge på litt tekst rundt, selv når den er bedt om
// KUN gyldig JSON. Strippes, parses, valideres mot et minimalt skjema —
// feiler noe av dette, returneres null (appen viser da "Klarte ikke lage et
// gyldig program — prøv igjen").
export type UkesprogramOvelse = { exercise_id: string | null; navn: string; sett: number; reps: string; kommentar: string | null };
export type UkesprogramOkt = { navn: string; ovelser: UkesprogramOvelse[] };
export type Ukesprogram = { okter: UkesprogramOkt[] };

export function parseUkesprogram(raw: string, validExerciseIds: Set<string>): Ukesprogram | null {
  try {
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed: unknown = JSON.parse(stripped);
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
  } catch {
    return null;
  }
}
