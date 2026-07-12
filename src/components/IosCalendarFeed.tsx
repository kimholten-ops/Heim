"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar, Copy, Check, RefreshCw } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui";

export default function IosCalendarFeed({ householdId }: { householdId: string | null }) {
  const [supabase] = useState(() => createClient());
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "webcal" | null>(null);

  useEffect(() => {
    let active = true;
    if (!householdId) { setLoaded(true); return; }
    supabase
      .from("calendar_feeds")
      .select("token")
      .eq("household_id", householdId)
      .is("revoked_at", null)
      .order("created_at")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) { setFeedToken(data?.token ?? null); setLoaded(true); }
      });
    return () => { active = false; };
  }, [householdId, supabase]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const icsUrl = feedToken ? `${origin}/api/ics/${feedToken}` : null;
  const webcalUrl = icsUrl ? icsUrl.replace(/^https?:\/\//, "webcal://") : null;

  async function generateFeed() {
    if (!householdId) return;
    setFeedBusy(true);
    setFeedError(null);
    const { data: token, error } = await supabase.rpc("create_calendar_feed", { p_label: "Heim-kalender" });
    if (error) {
      setFeedError(error.message ?? "Kunne ikke generere URL. Prøv igjen.");
    } else {
      setFeedToken(token as string);
    }
    setFeedBusy(false);
  }

  async function copy(type: "url" | "webcal") {
    const url = type === "webcal" ? webcalUrl : icsUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(type); setTimeout(() => setCopied(null), 2000);
  }

  if (!loaded) return null;

  return (
    <div>
      <SectionLabel title="iOS Kalender-abonnement" />
      <Card>
        <div className="px-4 py-4">
          {!feedToken ? (
            <>
              <p className="text-[13px] mb-3" style={{ color: "var(--text-2)" }}>Abonner på Heim-kalenderen i iPhone/iPad. Enveis, automatisk oppdatering.</p>
              {feedError && (
                <div className="mb-3 px-3 py-2 rounded-[10px] text-[13px]"
                  style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca" }}>
                  {feedError}
                </div>
              )}
              <button onClick={generateFeed} disabled={feedBusy || !householdId}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[13px] text-white font-[600] text-[15px] hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ background: "var(--accent)" }}>
                <Calendar size={16} /> {feedBusy ? "Genererer…" : "Generer kalender-URL"}
              </button>
            </>
          ) : (
            <div className="space-y-2.5">
              <div className="rounded-[13px] p-3 flex items-center gap-2" style={{ background: "var(--surface-2)" }}>
                <code className="flex-1 text-[11px] truncate" style={{ color: "var(--text-2)" }}>{icsUrl}</code>
                <button onClick={() => copy("url")} className="flex-shrink-0 flex items-center gap-1 text-[13px] font-[600]" style={{ color: "var(--accent)" }}>
                  {copied === "url" ? <Check size={13} /> : <Copy size={13} />} {copied === "url" ? "Kopiert" : "Kopier"}
                </button>
              </div>
              <a href={webcalUrl ?? ""} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[13px] text-white font-[600] text-[14px] hover:opacity-90"
                style={{ background: "var(--accent)", display: "flex" }}>
                <Calendar size={15} /> Åpne i Kalender-appen
              </a>
              <button onClick={() => copy("webcal")}
                className="w-full py-2 rounded-[13px] text-[13px] font-[550] flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity"
                style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}>
                {copied === "webcal" ? <Check size={13} style={{ color: "var(--accent)" }} /> : <Copy size={13} />}
                {copied === "webcal" ? "Kopiert!" : "Kopier webcal://"}
              </button>
              <button onClick={async () => {
                await supabase.from("calendar_feeds").update({ revoked_at: new Date().toISOString() }).eq("token", feedToken);
                setFeedToken(null);
              }} className="flex items-center gap-1.5 text-[12px] transition-colors hover:opacity-70"
                style={{ color: "var(--text-3)" }}>
                <RefreshCw size={11} /> Tilbakekall og generer ny
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
