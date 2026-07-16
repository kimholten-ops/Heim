import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Delt AI-infrastruktur — ÉN Anthropic-klient, ÉTT rate-limit-budsjett og
// ÉN usage-logg for ALLE AI-drevne funksjoner i Heim (helse-veilederen,
// Smart Add-tolkning, oppskriftsimport-fallback, ukesmeny-forslag). Ingen
// funksjon får sin egen kvote — kall fra ulike `kind`-verdier teller mot de
// samme grensene (ai_check_rate_limit fra 0020: 25/dag per medlem,
// 600/mnd per husholdning), slik at totalkostnaden ikke vokser med antall
// AI-funksjoner.
//
// ANTHROPIC_API_KEY skal ALDRI være NEXT_PUBLIC_ — mangler den, er
// aiEnabled() false og ALLE AI-innganger i UI-et skal skjules stille
// (samme mønster som Kassalapp-degraderingen i /api/varer). Appen fungerer
// 100 % uten.
const MODEL = "claude-haiku-4-5";

export const MAX_TOKENS = {
  chat: 500,
  maltid: 600,
  gjennomgang: 700,
  ukesprogram: 1500,
  smartadd: 1200,
  oppskrift: 1000,
  ukesmeny: 1800,
} as const;

export type AIKind = keyof typeof MAX_TOKENS;

type Sb = SupabaseClient<Database>;

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}

export async function checkAIRateLimit(supabase: Sb, memberId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("ai_check_rate_limit", { p_member_id: memberId });
  if (error) return false; // fail closed — dette er et betalt kall, ikke en gratis funksjon
  return data === true;
}

export async function logAIUsage(
  supabase: Sb,
  memberId: string,
  kind: AIKind,
  usage: { input_tokens: number; output_tokens: number; cache_read_tokens: number }
) {
  await supabase.from("ai_usage").insert({
    member_id: memberId,
    kind,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read_tokens,
  });
}

export type AIGatedMember = { memberId: string; householdId: string };

// Delt gate for AI-funksjoner som IKKE er voksne-only (Smart Add, oppskrift,
// ukesmeny — i motsetning til helse-veilederen, som har sin egen strengere
// gate i veileder-auth.ts). Ekskluderer likevel gjester (household_role=
// 'gjest'), samme prinsipp som helse-veilederen: gjester skal ikke kunne
// bruke av husholdningens delte, betalte AI-kvote — samme
// gjest-eksklusjonsmønster som allerede brukes for lister (se
// src/app/app/lister/page.tsx).
export async function getAIGatedMember(supabase: Sb): Promise<AIGatedMember | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles").select("active_household_id").eq("id", user.id).maybeSingle();
  const hid = profile?.active_household_id ?? null;
  if (!hid) return null;

  const { data: me } = await supabase
    .from("members").select("id, household_role").eq("household_id", hid).eq("auth_user_id", user.id).maybeSingle();
  if (!me || me.household_role !== "medlem") return null;

  return { memberId: me.id, householdId: hid };
}

export type AISystemPart = { text: string; cache?: boolean };
export type AIUsage = { input_tokens: number; output_tokens: number; cache_read_tokens: number };
export type AIError = { error: "rate_limited" | "unavailable" | "disabled" };
export type AISuccess = { text: string; usage: AIUsage };
export type AIResult = AISuccess | AIError;

function isImageContent(content: Anthropic.MessageParam["content"]): boolean {
  return Array.isArray(content) && content.some((b) => b.type === "image");
}

// callAI() er den ENESTE veien inn til Anthropic i hele appen. Den håndhever
// feature-flagget, rate-limiten og usage-loggingen selv — en kaller kan
// aldri glemme å sjekke kvoten før et betalt kall går ut. Kallere som vil
// unngå unødvendig kontekstbygging for en bruker som uansett er
// rate-limitert, kan sjekke checkAIRateLimit() selv FØR de bygger kontekst
// (som helse-veilederens ruter gjør) — callAI sjekker uansett på nytt som et
// sikkerhetsnett, siden det er billig (ett RPC-kall) sammenlignet med
// risikoen for et ubevoktet betalt kall.
export async function callAI(opts: {
  supabase: Sb;
  memberId: string;
  kind: AIKind;
  system: string | AISystemPart[];
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  cacheSystem?: boolean; // gjelder kun når system er en ren streng; default true
}): Promise<AIResult> {
  if (!aiEnabled()) return { error: "disabled" };
  const anthropic = getClient();
  if (!anthropic) return { error: "disabled" };

  const allowed = await checkAIRateLimit(opts.supabase, opts.memberId);
  if (!allowed) return { error: "rate_limited" };

  const systemBlocks =
    typeof opts.system === "string"
      ? [
          {
            type: "text" as const,
            text: opts.system,
            ...(opts.cacheSystem !== false ? { cache_control: { type: "ephemeral" as const } } : {}),
          },
        ]
      : opts.system.map((p) => ({
          type: "text" as const,
          text: p.text,
          ...(p.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
        }));

  // Bilde-innhold (Smart Add-bilde-tolkning) kan ta merkbart lenger tid å
  // behandle enn ren tekst — gi den litt mer takhøyde enn standard 20s.
  const timeout = opts.messages.some((m) => isImageContent(m.content)) ? 45_000 : 20_000;

  try {
    const response = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: opts.maxTokens ?? MAX_TOKENS[opts.kind],
        system: systemBlocks,
        messages: opts.messages,
      },
      { timeout }
    );

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const usage: AIUsage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
    };
    await logAIUsage(opts.supabase, opts.memberId, opts.kind, usage);

    return { text, usage };
  } catch {
    return { error: "unavailable" };
  }
}

// Delt oversettelse av AIError -> HTTP-svar, brukt av alle AI-ruter slik at
// feilmeldingene er konsistente på tvers av funksjonene.
export function aiErrorResponse(error: AIError["error"]): NextResponse {
  switch (error) {
    case "disabled":
      return NextResponse.json({ error: "Ikke tilgjengelig." }, { status: 404 });
    case "rate_limited":
      return NextResponse.json(
        { error: "Har nådd dagens AI-grense — prøv igjen i morgen." },
        { status: 429 }
      );
    case "unavailable":
      return NextResponse.json(
        { error: "Utilgjengelig akkurat nå — prøv igjen senere." },
        { status: 502 }
      );
  }
}

// Defensiv JSON-parsing delt av alle strukturerte AI-svar (ukesprogram,
// Smart Add, oppskrift, ukesmeny): modellen kan pakke JSON-en i
// kodeblokk-fences eller legge på litt tekst rundt selv når den er bedt om
// KUN gyldig JSON. Strippes, parses, og valideres av en kallerspesifikk
// validator-funksjon som også får luke ut ugyldige felt (f.eks. en
// exercise_id/recipe_id som ikke finnes i kandidatlisten) — feiler noe av
// dette, returneres null.
export function parseAIJson<T>(raw: string, validate: (parsed: unknown) => T | null): T | null {
  try {
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed: unknown = JSON.parse(stripped);
    return validate(parsed);
  } catch {
    return null;
  }
}
