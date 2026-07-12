import dns from "node:dns/promises";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

const MAX_REDIRECTS = 5;

// Blokkerer private/loopback/link-local IP-er.
function isPrivateIp(ip: string): boolean {
  const v4 = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip;
  if (v4.includes(".")) {
    const parts = v4.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

// Node sitt lookup-kontraktsformat er tvetydig: når options.all er satt (Happy
// Eyeballs / autoSelectFamily, som er default i moderne Node) forventes
// callback(err, addresses[]) — ellers callback(err, address, family). Å bruke
// feil form feiler stille inn i undici (TypeError: fetch failed / "Invalid IP
// address: undefined") uten at det er åpenbart hvorfor — verifisert empirisk,
// ikke bare antatt, siden dette er nettopp den typen feil som er lett å anta
// fungerer uten faktisk å teste den.
type LookupOptions = { all?: boolean };
type LookupCallback = (err: Error | null, address: string | { address: string; family: number }[], family?: number) => void;

// Denne lookup-funksjonen kjøres av undici ved selve TCP-tilkoblingen — samme
// oppslag brukes til både validering og connect, så det er intet DNS-rebinding-
// vindu mellom sjekk og connect. VIKTIG: undici (som Node sin net.connect) hopper
// over denne funksjonen helt når hostname i URL-en allerede er en literal IP —
// derfor må literal-IP-er sjekkes eksplisitt FØR fetch, se assertUrlIsSafe under.
function pinnedDnsAgent(): Agent {
  return new Agent({
    connect: {
      lookup(hostname: string, options: LookupOptions, callback: LookupCallback) {
        dns.lookup(hostname, { all: true })
          .then((addresses) => {
            const safe = addresses.filter((a) => !isPrivateIp(a.address));
            if (safe.length === 0) {
              callback(new Error("Denne adressen peker til et privat nettverk og kan ikke hentes."), "");
              return;
            }
            if (options.all) {
              callback(null, safe);
            } else {
              callback(null, safe[0].address, safe[0].family);
            }
          })
          .catch((err: unknown) => {
            callback(err instanceof Error ? err : new Error("DNS-oppslag feilet."), "");
          });
      },
    },
  });
}

function assertUrlIsSafe(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Kun http/https/webcal-lenker støttes.");
  }
  // Literal IP i URL-en (f.eks. http://127.0.0.1/ eller http://169.254.169.254/) —
  // undici sin connect.lookup blir ALDRI kalt for disse, må sjekkes her direkte.
  if (net.isIP(url.hostname) && isPrivateIp(url.hostname)) {
    throw new Error("Denne adressen kan ikke hentes.");
  }
}

export async function safeFetchText(
  rawUrl: string,
  opts: { maxBytes: number; timeoutMs: number; userAgent: string }
): Promise<string> {
  let current: URL;
  try {
    current = new URL(rawUrl.replace(/^webcal:\/\//i, "https://"));
  } catch {
    throw new Error("Ugyldig lenke.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
  const agent = pinnedDnsAgent();
  try {
    for (let hop = 0; ; hop++) {
      assertUrlIsSafe(current);
      const res = await undiciFetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        dispatcher: agent,
        headers: { "User-Agent": opts.userAgent },
      });

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        if (hop >= MAX_REDIRECTS) throw new Error("For mange omdirigeringer.");
        current = new URL(res.headers.get("location")!, current);
        continue;
      }

      if (!res.ok) throw new Error(`Kilden svarte med feil (${res.status}).`);
      const reader = res.body?.getReader();
      if (!reader) return await res.text();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > opts.maxBytes) throw new Error("Innholdet er for stort.");
        chunks.push(value);
      }
      return Buffer.concat(chunks).toString("utf-8");
    }
  } finally {
    clearTimeout(timeout);
    await agent.close().catch(() => {});
  }
}
