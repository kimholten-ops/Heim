import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIGatedMember, checkAIRateLimit, aiErrorResponse, callAI, parseAIJson } from "@/lib/ai";
import type Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
// AI-kall kan i sjeldne tilfeller ta lenger enn plattformens standard
// funksjonstidsavbrudd (spesielt store maxTokens-svar eller bilde-tolkning)
// — utvid grensen eksplisitt i stedet for å stole på default.
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 1_500_000; // litt takhøyde over klientens ~1 MB-mål

type SmartAddAIEvent = { title: string; date: string; startTime: string | null; endTime: string | null; location: string | null; notes: string | null };

function buildSystemPrompt(): string {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    `Du leser norske ukeplaner/skoleskriv (tekst eller bilde). Dagens dato er ${iso}, tidssone Europe/Oslo. ` +
    `Returner KUN gyldig JSON: {"events":[{"title":string,"date":"YYYY-MM-DD","startTime":"HH:MM"|null,` +
    `"endTime":"HH:MM"|null,"location":string|null,"notes":string|null}]} ` +
    `Ukedager uten dato = førstkommende forekomst. Ta bare med reelle aktiviteter/hendelser — ikke generell info. ` +
    `Ingen forklaring, ingen markdown.`
  );
}

function validateEvents(parsed: unknown): SmartAddAIEvent[] | null {
  if (typeof parsed !== "object" || parsed === null || !("events" in parsed)) return null;
  const raw = (parsed as { events: unknown }).events;
  if (!Array.isArray(raw)) return null;

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const events: SmartAddAIEvent[] = [];
  for (const e of raw) {
    if (typeof e !== "object" || e === null) continue;
    const r = e as Record<string, unknown>;
    if (typeof r.title !== "string" || !r.title.trim()) continue;
    if (typeof r.date !== "string" || !dateRe.test(r.date)) continue;
    events.push({
      title: r.title.trim(),
      date: r.date,
      startTime: typeof r.startTime === "string" ? r.startTime : null,
      endTime: typeof r.endTime === "string" ? r.endTime : null,
      location: typeof r.location === "string" ? r.location : null,
      notes: typeof r.notes === "string" ? r.notes : null,
    });
  }
  return events;
}

// POST /api/ai/smart-add — AI-tolkning av limt-inn tekst ELLER et bilde av
// en ukeplan, som et opt-in løft over den regelbaserte parseren i
// src/lib/smart-add-parse.ts (som fortsatt kjører umiddelbart og gratis, og
// er eneste vei når AI er utilgjengelig). Resultatet går inn i NØYAKTIG
// samme forslagsliste/godkjenningsflyt som regex-varianten.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const gated = await getAIGatedMember(supabase);
  if (!gated) return NextResponse.json({ error: "Ikke tilgang." }, { status: 403 });

  const allowed = await checkAIRateLimit(supabase, gated.memberId);
  if (!allowed) return aiErrorResponse("rate_limited");

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : null;
  const mediaType = typeof body?.mediaType === "string" ? body.mediaType : "image/jpeg";

  if (!text && !imageBase64) {
    return NextResponse.json({ error: "Ingen tekst eller bilde å tolke." }, { status: 400 });
  }
  // Base64 er ~4/3 av rå byte-størrelse.
  if (imageBase64 && imageBase64.length * 0.75 > MAX_IMAGE_BYTES * 3) {
    return NextResponse.json({ error: "Bildet er for stort." }, { status: 413 });
  }

  const messages: Anthropic.MessageParam[] = imageBase64
    ? [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: imageBase64 } },
          { type: "text", text: "Les denne ukeplanen/skoleskrivet og list hendelsene." },
        ],
      }]
    : [{ role: "user", content: text }];

  const result = await callAI({ supabase, memberId: gated.memberId, kind: "smartadd", system: buildSystemPrompt(), messages });
  if ("error" in result) return aiErrorResponse(result.error);

  const events = parseAIJson(result.text, validateEvents);
  if (!events) {
    return NextResponse.json({ error: "Klarte ikke tolke teksten/bildet med AI — prøv igjen eller bruk forslagene under." }, { status: 422 });
  }
  return NextResponse.json({ events });
}
