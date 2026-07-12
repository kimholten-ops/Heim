import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-5";
const DAILY_LIMIT = 20;
const MAX_IMAGE_BASE64_CHARS = 6_000_000; // ~4.5 MB rådata, litt slakk for base64-overhead
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const FRIENDLY_PARSE_ERROR = "Klarte ikke lese planen — prøv å lime inn teksten direkte.";

type SmartAddEvent = {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
};

function systemPrompt(today: string) {
  return `Du får tekst eller bilde av en norsk ukeplan/skoleskriv/aktivitetsplan. Ekstraher kalenderhendelser. Dagens dato er ${today}, tidssone Europe/Oslo. Returner KUN gyldig JSON:
{"events":[{"title":string,"date":"YYYY-MM-DD","startTime":"HH:MM"|null,"endTime":"HH:MM"|null,"location":string|null,"notes":string|null}]}
Ukedager uten dato = førstkommende. Ingen markdown, ingen forklaring.`;
}

function parseEvents(raw: string): SmartAddEvent[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("parse");
  }

  const events = (parsed as { events?: unknown })?.events;
  if (!Array.isArray(events)) throw new Error("parse");

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const timeRe = /^\d{2}:\d{2}$/;

  return events
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      title: typeof e.title === "string" ? e.title.trim().slice(0, 200) : "",
      date: typeof e.date === "string" && dateRe.test(e.date) ? e.date : "",
      startTime: typeof e.startTime === "string" && timeRe.test(e.startTime) ? e.startTime : null,
      endTime: typeof e.endTime === "string" && timeRe.test(e.endTime) ? e.endTime : null,
      location: typeof e.location === "string" && e.location.trim() ? e.location.trim().slice(0, 200) : null,
      notes: typeof e.notes === "string" && e.notes.trim() ? e.notes.trim().slice(0, 500) : null,
    }))
    .filter((e) => e.title && e.date)
    .slice(0, 50);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("smart-add: ANTHROPIC_API_KEY mangler");
    return NextResponse.json({ error: "Smart Add er ikke konfigurert ennå." }, { status: 500 });
  }

  let body: { text?: unknown; imageBase64?: unknown; mediaType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, 8000) : "";
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const rawMediaType = typeof body.mediaType === "string" ? body.mediaType : "";

  if (!text && !imageBase64) {
    return NextResponse.json({ error: "Lim inn tekst eller last opp et bilde." }, { status: 400 });
  }
  if (imageBase64 && imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    return NextResponse.json({ error: "Bildet er for stort (maks ca. 4 MB)." }, { status: 400 });
  }

  const { data: usageCount, error: usageError } = await supabase.rpc("increment_smart_add_usage");
  if (usageError) {
    console.error("smart-add usage rpc error:", usageError);
    return NextResponse.json({ error: "Noe gikk galt. Prøv igjen." }, { status: 500 });
  }
  if ((usageCount ?? 0) > DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Du har brukt opp dagens Smart Add-grense (${DAILY_LIMIT} per dag). Prøv igjen i morgen.` },
      { status: 429 }
    );
  }

  const mediaType = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(rawMediaType)
    ? (rawMediaType as (typeof ALLOWED_IMAGE_TYPES)[number])
    : "image/jpeg";

  const content: Anthropic.Messages.ContentBlockParam[] = [];
  if (imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } });
  }
  content.push({ type: "text", text: text || "Se vedlagt bilde av ukeplanen." });

  const today = new Date().toISOString().slice(0, 10);
  const anthropic = new Anthropic({ apiKey });

  let raw: string;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt(today),
      messages: [{ role: "user", content }],
    });
    const block = message.content.find((b) => b.type === "text");
    raw = block && block.type === "text" ? block.text : "";
  } catch (err) {
    console.error("smart-add anthropic error:", err);
    return NextResponse.json({ error: FRIENDLY_PARSE_ERROR }, { status: 502 });
  }

  let events: SmartAddEvent[];
  try {
    events = parseEvents(raw);
  } catch {
    return NextResponse.json({ error: FRIENDLY_PARSE_ERROR }, { status: 502 });
  }

  if (events.length === 0) {
    return NextResponse.json({ error: "Fant ingen hendelser i planen. Prøv å lime inn teksten direkte." }, { status: 422 });
  }

  return NextResponse.json({ events });
}
