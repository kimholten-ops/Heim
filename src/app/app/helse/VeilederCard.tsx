"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, Send, ChevronRight, X, Search } from "lucide-react";
import { Card, SectionLabel, Sheet } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/lib/exercises";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
type UkesprogramOvelse = { exercise_id: string | null; navn: string; sett: number; reps: string; kommentar: string | null };
type UkesprogramOkt = { navn: string; ovelser: UkesprogramOvelse[] };

const EQUIPMENT_OPTIONS = ["kroppsvekt", "manualer", "vektstang", "kabel", "maskin", "kettlebell", "ez-stang", "annet"];
const MAL_OPTIONS: { value: "styrke" | "generelt" | "utholdenhet"; label: string }[] = [
  { value: "styrke", label: "Styrke" },
  { value: "generelt", label: "Generelt" },
  { value: "utholdenhet", label: "Utholdenhet" },
];

const UNAVAILABLE = "Veilederen er utilgjengelig akkurat nå — prøv igjen senere.";

export default function VeilederCard({ memberId }: { memberId: string }) {
  const [supabase] = useState(() => createClient());

  /* ── Forbruk denne måneden ── */
  const [usageText, setUsageText] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const start = new Date();
      start.setDate(1); start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("ai_usage").select("input_tokens, output_tokens, cache_read_tokens")
        .eq("member_id", memberId).gte("created_at", start.toISOString());
      const rows = data ?? [];
      const totals = rows.reduce(
        (s, r) => ({
          input: s.input + r.input_tokens, output: s.output + r.output_tokens, cacheRead: s.cacheRead + r.cache_read_tokens,
        }),
        { input: 0, output: 0, cacheRead: 0 }
      );
      const usd = (totals.input / 1e6) * 1 + (totals.output / 1e6) * 5 + (totals.cacheRead / 1e6) * 0.1;
      const nok = Math.round(usd * 10.5 * 10) / 10;
      setUsageText(`Veileder-forbruk denne måneden: ${rows.length} spørsmål, estimert ~${nok.toLocaleString("nb-NO")} kr`);
    })();
  }, [memberId, supabase]);

  /* ── Chat ── */
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    const next = [...chatMessages, { role: "user" as const, content: text }];
    setChatMessages(next);
    setChatInput("");
    setChatSending(true);
    try {
      const res = await fetch("/api/veileder/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m.role !== "system").slice(-10) }),
      });
      const json = await res.json();
      if (res.ok) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: json.text }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "system", content: json.error ?? UNAVAILABLE }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "system", content: UNAVAILABLE }]);
    }
    setChatSending(false);
  }

  /* ── Ukesprogram ── */
  const [showProgram, setShowProgram] = useState(false);
  const [pMal, setPMal] = useState<"styrke" | "generelt" | "utholdenhet">("styrke");
  const [pOkterPerUke, setPOkterPerUke] = useState(3);
  const [pUtstyr, setPUtstyr] = useState<string[]>(["kroppsvekt"]);
  const [pGenerating, setPGenerating] = useState(false);
  const [pError, setPError] = useState<string | null>(null);
  const [program, setProgram] = useState<UkesprogramOkt[] | null>(null);
  const [pSaving, setPSaving] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [pickingFor, setPickingFor] = useState<{ oktIdx: number; ovIdx: number } | null>(null);
  const [pickQuery, setPickQuery] = useState("");

  function openProgram() {
    setProgram(null); setPError(null);
    setShowProgram(true);
  }

  function toggleUtstyr(u: string) {
    setPUtstyr((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));
  }

  async function generateProgram() {
    setPGenerating(true); setPError(null);
    try {
      const res = await fetch("/api/veileder/ukesprogram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mal: pMal, okterPerUke: pOkterPerUke, utstyr: pUtstyr }),
      });
      const json = await res.json();
      if (res.ok) {
        setProgram(json.program.okter);
        if (allExercises.length === 0) {
          const { data } = await supabase.from("exercises").select("*");
          setAllExercises((data ?? []) as Exercise[]);
        }
      } else {
        setPError(json.error ?? UNAVAILABLE);
      }
    } catch {
      setPError(UNAVAILABLE);
    }
    setPGenerating(false);
  }

  function removeOvelse(oktIdx: number, ovIdx: number) {
    setProgram((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[oktIdx] = { ...next[oktIdx], ovelser: next[oktIdx].ovelser.filter((_, i) => i !== ovIdx) };
      return next;
    });
  }
  function updateOvelse(oktIdx: number, ovIdx: number, patch: Partial<UkesprogramOvelse>) {
    setProgram((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const ovelser = [...next[oktIdx].ovelser];
      ovelser[ovIdx] = { ...ovelser[ovIdx], ...patch };
      next[oktIdx] = { ...next[oktIdx], ovelser };
      return next;
    });
  }
  function pickExercise(ex: Exercise) {
    if (!pickingFor) return;
    updateOvelse(pickingFor.oktIdx, pickingFor.ovIdx, { exercise_id: ex.id, navn: ex.name_no });
    setPickingFor(null);
  }

  async function saveAsTemplates() {
    if (!program) return;
    setPSaving(true);
    for (const okt of program) {
      const resolved = okt.ovelser.filter((o) => o.exercise_id);
      if (resolved.length === 0) continue;
      const { data: tmpl } = await supabase.from("workout_templates").insert({ member_id: memberId, name: okt.navn }).select().single();
      if (!tmpl) continue;
      await supabase.from("workout_template_exercises").insert(
        resolved.map((o, i) => ({
          template_id: tmpl.id, exercise_id: o.exercise_id as string, position: i,
          target_sets: o.sett, target_reps: o.reps, notes: o.kommentar,
        }))
      );
    }
    setPSaving(false);
    setShowProgram(false);
  }

  const unresolvedCount = program?.reduce((s, o) => s + o.ovelser.filter((x) => !x.exercise_id).length, 0) ?? 0;
  const filteredPick = allExercises.filter((e) => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return true;
    return e.name_no.toLowerCase().includes(q) || e.name_en.toLowerCase().includes(q);
  }).slice(0, 30);

  /* ── Ukens gjennomgang ── */
  const [showReview, setShowReview] = useState(false);
  const [reviewText, setReviewText] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function openReview() {
    setShowReview(true);
    setReviewText(null); setReviewError(null); setReviewLoading(true);
    try {
      const res = await fetch("/api/veileder/gjennomgang");
      const json = await res.json();
      if (res.ok) setReviewText(json.text);
      else setReviewError(json.error ?? UNAVAILABLE);
    } catch {
      setReviewError(UNAVAILABLE);
    }
    setReviewLoading(false);
  }

  return (
    <div className="mt-6">
      <SectionLabel title="Veileder" />
      <Card className="mb-2">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="w-[38px] h-[38px] rounded-[11px] bg-accent-weak text-accent flex items-center justify-center flex-shrink-0">
            <Sparkles size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-[600] text-fg">AI-veileder</p>
            <p className="text-[12.5px] text-text-2 mt-[1px]">Forslag basert på dine egne loggede data</p>
          </div>
        </div>
        <div className="p-2 space-y-1">
          <button onClick={() => setShowChat(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] hover:bg-surface-2 text-left transition-colors">
            <span className="text-[13.5px] font-[550] text-fg">Still et spørsmål</span>
            <ChevronRight size={15} className="text-text-3" />
          </button>
          <button onClick={openProgram}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] hover:bg-surface-2 text-left transition-colors">
            <span className="text-[13.5px] font-[550] text-fg">Foreslå ukesprogram</span>
            <ChevronRight size={15} className="text-text-3" />
          </button>
          <button onClick={openReview}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] hover:bg-surface-2 text-left transition-colors">
            <span className="text-[13.5px] font-[550] text-fg">Ukens gjennomgang</span>
            <ChevronRight size={15} className="text-text-3" />
          </button>
        </div>
        {usageText && <p className="text-[10.5px] text-text-3 px-4 pb-3 pt-1 border-t border-border">{usageText}</p>}
      </Card>
      <p className="text-[11px] text-text-3 px-1">Veilederen kan ta feil — sjekk viktige råd med fagperson.</p>

      {/* ── Chat-sheet ── */}
      <Sheet open={showChat} onClose={() => setShowChat(false)} maxHeight>
        <h2 className="text-[19px] font-[700] text-fg mb-3 flex-shrink-0">Still et spørsmål</h2>
        <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[120px]">
          {chatMessages.length === 0 && (
            <p className="text-[12.5px] text-text-3 py-4 text-center">Spør om trening, øktplanlegging eller kosthold.</p>
          )}
          {chatMessages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-[1.4]",
                m.role === "user" ? "bg-accent text-white" : m.role === "system" ? "bg-surface-2 text-text-3 italic" : "bg-surface-2 text-fg"
              )}>
                {m.content}
              </div>
            </div>
          ))}
          {chatSending && <p className="text-[12.5px] text-text-3 px-1">Tenker…</p>}
        </div>
        <p className="text-[11px] text-text-3 mb-2 flex-shrink-0">Veilederen kan ta feil — sjekk viktige råd med fagperson.</p>
        <div className="flex gap-2 flex-shrink-0">
          <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Skriv en melding…"
            className="flex-1 rounded-[13px] border border-border px-4 py-2.5 text-[14px] outline-none focus:border-accent" />
          <button onClick={sendChat} disabled={chatSending || !chatInput.trim()}
            className="w-11 h-11 flex items-center justify-center rounded-[13px] bg-accent text-white disabled:opacity-40">
            <Send size={16} />
          </button>
        </div>
      </Sheet>

      {/* ── Ukesprogram-sheet ── */}
      <Sheet open={showProgram} onClose={() => setShowProgram(false)} maxHeight>
        <h2 className="text-[19px] font-[700] text-fg mb-3 flex-shrink-0">Foreslå ukesprogram</h2>
        {!program ? (
          <div className="space-y-3.5">
            <div>
              <p className="text-[11px] font-[600] text-text-3 mb-1.5 uppercase tracking-wide12">Mål</p>
              <div className="flex gap-2">
                {MAL_OPTIONS.map((m) => (
                  <button key={m.value} onClick={() => setPMal(m.value)}
                    className={cn("flex-1 py-2 rounded-[10px] border-2 text-[13px] font-[550]", pMal === m.value ? "border-accent text-accent bg-accent-weak" : "border-border text-text-2")}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-[600] text-text-3 mb-1.5 uppercase tracking-wide12">Økter per uke</p>
              <div className="flex gap-2">
                {[2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setPOkterPerUke(n)}
                    className={cn("flex-1 py-2 rounded-[10px] border-2 text-[13px] font-[550]", pOkterPerUke === n ? "border-accent text-accent bg-accent-weak" : "border-border text-text-2")}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-[600] text-text-3 mb-1.5 uppercase tracking-wide12">Tilgjengelig utstyr</p>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT_OPTIONS.map((u) => (
                  <button key={u} onClick={() => toggleUtstyr(u)}
                    className={cn("px-2.5 py-1 rounded-chip border text-[12px] font-[550] capitalize", pUtstyr.includes(u) ? "bg-fg text-white border-fg" : "border-border text-text-2")}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {pError && <p className="text-[12.5px] text-rose-600">{pError}</p>}
            <button onClick={generateProgram} disabled={pGenerating}
              className="w-full py-3 rounded-[13px] bg-accent text-white font-[600] text-[15px] disabled:opacity-40">
              {pGenerating ? "Lager forslag…" : pError ? "Prøv igjen" : "Lag forslag"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="overflow-y-auto -mx-1 px-1 space-y-3 flex-1">
              {program.map((okt, oktIdx) => (
                <div key={oktIdx} className="bg-surface-2 rounded-[13px] p-3">
                  <input type="text" value={okt.navn}
                    onChange={(e) => setProgram((prev) => prev ? prev.map((o, i) => i === oktIdx ? { ...o, navn: e.target.value } : o) : prev)}
                    className="w-full bg-transparent text-[14.5px] font-[600] text-fg mb-2 outline-none" />
                  <div className="space-y-1.5">
                    {okt.ovelser.map((ov, ovIdx) => (
                      <div key={ovIdx} className="bg-white rounded-[10px] px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <p className="flex-1 text-[13px] font-[550] text-fg truncate">{ov.navn}</p>
                          {!ov.exercise_id && (
                            <button onClick={() => { setPickingFor({ oktIdx, ovIdx }); setPickQuery(""); }}
                              className="text-[11px] font-[600] text-accent flex-shrink-0">Velg øvelse</button>
                          )}
                          <button onClick={() => removeOvelse(oktIdx, ovIdx)} className="text-text-3 hover:text-rose-500 p-0.5 flex-shrink-0"><X size={13} /></button>
                        </div>
                        {!ov.exercise_id && (
                          <p className="text-[10.5px] text-text-3 mt-0.5">Ikke i biblioteket ennå — velg en øvelse for å ta den med i malen.</p>
                        )}
                        <div className="flex gap-1.5 mt-1.5">
                          <input type="number" value={ov.sett} onChange={(e) => updateOvelse(oktIdx, ovIdx, { sett: Number(e.target.value) })}
                            className="w-14 rounded-[8px] border border-border px-2 py-1 text-[12.5px] outline-none focus:border-accent" />
                          <input type="text" value={ov.reps} onChange={(e) => updateOvelse(oktIdx, ovIdx, { reps: e.target.value })}
                            className="flex-1 rounded-[8px] border border-border px-2 py-1 text-[12.5px] outline-none focus:border-accent" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {unresolvedCount > 0 && (
                <p className="text-[11.5px] text-text-3">{unresolvedCount} øvelse(r) uten treff i biblioteket blir ikke lagret med mindre du velger en erstatning.</p>
              )}
            </div>
            <div className="flex gap-2 mt-3 flex-shrink-0">
              <button onClick={() => setProgram(null)} className="flex-1 py-3 rounded-[13px] border border-border text-fg font-[600] text-[14px]">Tilbake</button>
              <button onClick={saveAsTemplates} disabled={pSaving}
                className="flex-1 py-3 rounded-[13px] bg-accent text-white font-[600] text-[14px] disabled:opacity-40">
                {pSaving ? "Lagrer…" : "Lagre som maler"}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* ── Velg øvelse (erstatt uten-treff) ── */}
      <Sheet open={!!pickingFor} onClose={() => setPickingFor(null)} maxHeight>
        <h2 className="text-[17px] font-[700] text-fg mb-3 flex-shrink-0">Velg øvelse</h2>
        <div className="relative mb-3 flex-shrink-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
          <input type="text" autoFocus value={pickQuery} onChange={(e) => setPickQuery(e.target.value)}
            placeholder="Søk øvelse" className="w-full rounded-[13px] border border-border pl-9 pr-4 py-2.5 text-[14px] outline-none focus:border-accent" />
        </div>
        <div className="overflow-y-auto space-y-1">
          {filteredPick.map((e) => (
            <button key={e.id} onClick={() => pickExercise(e)}
              className="w-full flex items-center px-3 py-2 rounded-[10px] hover:bg-surface-2 text-left transition-colors">
              <span className="text-[13.5px] font-[550] text-fg">{e.name_no}</span>
            </button>
          ))}
        </div>
      </Sheet>

      {/* ── Ukens gjennomgang-sheet ── */}
      <Sheet open={showReview} onClose={() => setShowReview(false)} maxHeight>
        <h2 className="text-[19px] font-[700] text-fg mb-3 flex-shrink-0">Ukens gjennomgang</h2>
        <div className="overflow-y-auto">
          {reviewLoading && <p className="text-[13px] text-text-3 py-6 text-center">Genererer gjennomgang…</p>}
          {reviewError && <p className="text-[13px] text-rose-600">{reviewError}</p>}
          {reviewText && <p className="text-[14px] text-fg leading-[1.55] whitespace-pre-wrap">{reviewText}</p>}
        </div>
      </Sheet>
    </div>
  );
}
