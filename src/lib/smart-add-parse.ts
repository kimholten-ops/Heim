// Regelbasert tekstgjenkjenning for Smart Add — ingen AI, ingen eksternt kall.
// Ren funksjon: tar limt-inn tekst (f.eks. fra en SFO-mail), returnerer en
// kandidatliste brukeren alltid må godkjenne/redigere før noe lagres.

export type SmartAddCandidate = {
  title: string;
  date: string | null;       // YYYY-MM-DD
  startTime: string | null;  // HH:MM
  endTime: string | null;    // HH:MM
  location: string | null;
  raw: string;
  confidence: "high" | "low";
};

const WEEKDAYS: Record<string, number> = {
  søndag: 0, søn: 0,
  mandag: 1, man: 1,
  tirsdag: 2, tir: 2,
  onsdag: 3, ons: 3,
  torsdag: 4, tor: 4,
  fredag: 5, fre: 5,
  lørdag: 6, lør: 6,
};

const MONTHS: Record<string, number> = {
  januar: 0, jan: 0, februar: 1, feb: 1, mars: 2, mar: 2, april: 3, apr: 3,
  mai: 4, juni: 5, jun: 5, juli: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, oktober: 9, okt: 9, november: 10, nov: 10, desember: 11, des: 11,
};

const WEEKDAY_KEYS = Object.keys(WEEKDAYS).join("|");
const MONTH_KEYS = Object.keys(MONTHS).join("|");

function pad(n: string | number): string { return String(n).padStart(2, "0"); }
function startOfToday(now: Date): Date { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toISO(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Hvis en dato uten årstall allerede har passert med god margin (>200 dager),
// anta at den refererer til neste år (unngår at "15. januar" limt inn i
// desember tolkes som 11 måneder tilbake i tid).
function resolveYearlessDate(day: number, month: number, now: Date): Date {
  const today = startOfToday(now);
  let candidate = new Date(today.getFullYear(), month, day);
  if (candidate.getTime() < today.getTime() && today.getTime() - candidate.getTime() > 200 * 86_400_000) {
    candidate = new Date(today.getFullYear() + 1, month, day);
  }
  return candidate;
}

function nextWeekdayOccurrence(now: Date, targetDow: number): Date {
  const today = startOfToday(now);
  const diff = (targetDow - today.getDay() + 7) % 7;
  return addDays(today, diff);
}

function findDateInLine(line: string, now: Date): { date: string; matchText: string } | null {
  const monthNameRe = new RegExp(`\\b(\\d{1,2})\\.?\\s+(${MONTH_KEYS})\\b\\.?`, "i");
  const m1 = monthNameRe.exec(line);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = MONTHS[m1[2].toLowerCase()];
    if (day >= 1 && day <= 31) {
      return { date: toISO(resolveYearlessDate(day, month, now)), matchText: m1[0] };
    }
  }

  const numericRe = /\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/;
  const m2 = numericRe.exec(line);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = parseInt(m2[2], 10) - 1;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      if (m2[3]) {
        const year = m2[3].length === 2 ? 2000 + parseInt(m2[3], 10) : parseInt(m2[3], 10);
        return { date: toISO(new Date(year, month, day)), matchText: m2[0] };
      }
      return { date: toISO(resolveYearlessDate(day, month, now)), matchText: m2[0] };
    }
  }

  if (/\bi\s+dag\b/i.test(line)) {
    const m = /\bi\s+dag\b/i.exec(line)!;
    return { date: toISO(startOfToday(now)), matchText: m[0] };
  }
  if (/\bi\s+morgen\b/i.test(line)) {
    const m = /\bi\s+morgen\b/i.exec(line)!;
    return { date: toISO(addDays(startOfToday(now), 1)), matchText: m[0] };
  }

  const wdRe = new RegExp(`\\b(på\\s+)?(${WEEKDAY_KEYS})\\b\\.?`, "i");
  const m4 = wdRe.exec(line);
  if (m4) {
    const dow = WEEKDAYS[m4[2].toLowerCase()];
    return { date: toISO(nextWeekdayOccurrence(now, dow)), matchText: m4[0] };
  }

  return null;
}

function findTimeInLine(line: string): { startTime: string; endTime: string | null; matchText: string } | null {
  const rangeWithKl = /kl\.?\s*(\d{1,2})[:.]?(\d{2})?\s*(?:-|–|til)\s*(\d{1,2})[:.]?(\d{2})?/i;
  const mr = rangeWithKl.exec(line);
  if (mr) {
    return {
      startTime: `${pad(mr[1])}:${mr[2] ? pad(mr[2]) : "00"}`,
      endTime: `${pad(mr[3])}:${mr[4] ? pad(mr[4]) : "00"}`,
      matchText: mr[0],
    };
  }

  const rangeNoKl = /\b(\d{1,2})[:.](\d{2})\s*(?:-|–)\s*(\d{1,2})[:.](\d{2})\b/;
  const mr2 = rangeNoKl.exec(line);
  if (mr2) {
    return { startTime: `${pad(mr2[1])}:${mr2[2]}`, endTime: `${pad(mr2[3])}:${mr2[4]}`, matchText: mr2[0] };
  }

  const single = /kl(?:\.|okken)?\s*(\d{1,2})[:.]?(\d{2})?/i;
  const ms = single.exec(line);
  if (ms) {
    return { startTime: `${pad(ms[1])}:${ms[2] ? pad(ms[2]) : "00"}`, endTime: null, matchText: ms[0] };
  }

  return null;
}

function extractLocation(line: string): string | null {
  const sted = /(?:Sted|Hvor)\s*:\s*(.+)$/i.exec(line);
  if (sted) return sted[1].trim();

  // Første ord i stedsnavnet må være stor forbokstav (heuristikk for egennavn),
  // resten av ordene kan være små ("Sentrum skole", "Oslo sentrum" osv.).
  const paa = /\bpå\s+([A-ZÆØÅ][\wæøåÆØÅ.]*(?:\s+[\wæøåÆØÅ.]+){0,2})\s*$/.exec(line.trim());
  if (paa && !(paa[1].toLowerCase() in WEEKDAYS)) return paa[1].trim();

  return null;
}

const FILLER_WORDS = new Set(["den", "kl", "kl.", "klokken"]);

function extractTitle(line: string, dateMatch: string | null, timeMatch: string | null, location: string | null): string {
  let t = line;
  if (dateMatch) t = t.replace(dateMatch, " ");
  if (timeMatch) t = t.replace(timeMatch, " ");
  t = t.replace(/(?:Sted|Hvor)\s*:\s*.+$/i, " ");
  if (location) t = t.replace(new RegExp(`\\bpå\\s+${escapeRegExp(location)}\\b`, "i"), " ");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/^[-–:,.]+\s*/, "").replace(/\s*[-–:,.]+$/, "");
  const words = t.split(/\s+/).filter((w) => w && !FILLER_WORDS.has(w.toLowerCase()));
  return words.join(" ").trim();
}

function isWeekdayHeaderLine(line: string): boolean {
  const re = new RegExp(`^(${WEEKDAY_KEYS})\\.?(\\s+\\d{1,2}\\.?(\\s*(${MONTH_KEYS}))?)?:?$`, "i");
  return re.test(line.trim());
}

export function parseSmartAddText(text: string, now: Date = new Date()): SmartAddCandidate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const candidates: SmartAddCandidate[] = [];
  let currentHeaderDate: string | null = null;

  for (const line of lines) {
    // Tom linje = avsnittsskille — en ukedag-overskrift skal kun gjelde blokken
    // rett under den, ikke lekke inn i et helt urelatert avsnitt lenger nede.
    if (!line) {
      currentHeaderDate = null;
      continue;
    }
    if (isWeekdayHeaderLine(line)) {
      currentHeaderDate = findDateInLine(line, now)?.date ?? currentHeaderDate;
      continue;
    }

    const dateInfo = findDateInLine(line, now);
    const timeInfo = findTimeInLine(line);
    const location = extractLocation(line);
    const title = extractTitle(line, dateInfo?.matchText ?? null, timeInfo?.matchText ?? null, location);

    if (!title) {
      if ((timeInfo || location || dateInfo) && candidates.length > 0) {
        const prev = candidates[candidates.length - 1];
        if (timeInfo) { prev.startTime = prev.startTime ?? timeInfo.startTime; prev.endTime = prev.endTime ?? timeInfo.endTime; }
        if (location) prev.location = prev.location ?? location;
        if (dateInfo) prev.date = prev.date ?? dateInfo.date;
        if (prev.date) prev.confidence = "high";
      }
      continue;
    }

    const date = dateInfo?.date ?? currentHeaderDate ?? null;
    candidates.push({
      title,
      date,
      startTime: timeInfo?.startTime ?? null,
      endTime: timeInfo?.endTime ?? null,
      location,
      raw: line,
      confidence: date ? "high" : "low",
    });
  }

  return candidates;
}
