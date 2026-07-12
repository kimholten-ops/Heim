"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/components/HouseholdContext";
import { Sparkles, ImagePlus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Suggestion = {
  key: string;
  selected: boolean;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export default function SmartAddPanel({
  householdId, members, onAdded, onCancel,
}: {
  householdId: string;
  members: Member[];
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState("image/jpeg");
  const [imageName, setImageName] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function clearImage() {
    setImageBase64(null);
    setImageName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Bildet er for stort (maks 4 MB).");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1] ?? "";
      setImageBase64(base64);
      setImageMediaType(file.type || "image/jpeg");
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function analyze() {
    if (!text.trim() && !imageBase64) {
      setError("Lim inn tekst eller last opp et bilde.");
      return;
    }
    setLoading(true); setError(null); setSuggestions(null);
    try {
      const res = await fetch("/api/smart-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          imageBase64: imageBase64 || undefined,
          mediaType: imageBase64 ? imageMediaType : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Klarte ikke lese planen — prøv å lime inn teksten direkte.");
        return;
      }
      const events = Array.isArray(data.events) ? data.events : [];
      setSuggestions(
        events.map((ev: Record<string, unknown>, i: number) => ({
          key: `${i}-${String(ev.title)}-${String(ev.date)}`,
          selected: true,
          title: typeof ev.title === "string" ? ev.title : "",
          date: typeof ev.date === "string" ? ev.date : "",
          startTime: typeof ev.startTime === "string" ? ev.startTime : null,
          endTime: typeof ev.endTime === "string" ? ev.endTime : null,
          location: typeof ev.location === "string" ? ev.location : null,
          notes: typeof ev.notes === "string" ? ev.notes : null,
        }))
      );
    } catch {
      setError("Klarte ikke lese planen — prøv å lime inn teksten direkte.");
    } finally {
      setLoading(false);
    }
  }

  function updateSuggestion(key: string, patch: Partial<Suggestion>) {
    setSuggestions((prev) => prev?.map((s) => (s.key === key ? { ...s, ...patch } : s)) ?? null);
  }
  function toggleParticipant(id: string) {
    setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  const selectedCount = suggestions?.filter((s) => s.selected && s.title.trim() && s.date).length ?? 0;

  async function addSelected() {
    if (!suggestions || selectedCount === 0) return;
    setSaving(true); setError(null);
    try {
      for (const s of suggestions) {
        if (!s.selected || !s.title.trim() || !s.date) continue;
        const allDay = !s.startTime;
        const start_at = allDay
          ? new Date(`${s.date}T00:00:00`).toISOString()
          : new Date(`${s.date}T${s.startTime}`).toISOString();
        const end_at = allDay
          ? new Date(`${s.date}T23:59:59`).toISOString()
          : new Date(`${s.date}T${s.endTime || s.startTime}`).toISOString();

        const { data: ev, error: insErr } = await supabase
          .from("events")
          .insert({
            household_id: householdId,
            title: s.title.trim(),
            location: s.location || null,
            notes: s.notes || null,
            start_at, end_at, all_day: allDay,
            color: "#12936b",
            recurrence: "none",
          })
          .select()
          .single();
        if (insErr) throw insErr;

        if (ev && participants.length) {
          await supabase.from("event_members").insert(
            participants.map((mid) => ({ event_id: ev.id, member_id: mid }))
          );
        }
      }
      onAdded();
    } catch {
      setError("Klarte ikke lagre hendelsene. Prøv igjen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="px-4 py-3 rounded-[13px] text-[13px]" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#e11d48" }}>
          {error}
        </div>
      )}

      {!suggestions && (
        <>
          <textarea
            placeholder="Lim inn ukeplanen her …"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full rounded-[13px] px-4 py-3 text-[15px] outline-none resize-none transition-colors"
            style={{ border: "1px solid var(--border)" }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />

          <input ref={fileInputRef} type="file" accept="image/*" onChange={onImagePick} className="hidden" id="smart-add-image" />
          {imageName ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-[13px]" style={{ border: "1px solid var(--border)" }}>
              <ImagePlus size={16} style={{ color: "var(--text-3)", flexShrink: 0 }} />
              <span className="flex-1 text-[13.5px] truncate" style={{ color: "var(--foreground)" }}>{imageName}</span>
              <button type="button" onClick={clearImage} className="p-1" style={{ color: "var(--text-3)" }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <label htmlFor="smart-add-image"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[13px] text-[13.5px] font-[550] cursor-pointer transition-colors"
              style={{ border: "1px dashed var(--border)", color: "var(--text-3)" }}>
              <ImagePlus size={15} strokeWidth={2} /> Last opp bilde
            </label>
          )}

          <button type="button" onClick={analyze} disabled={loading || (!text.trim() && !imageBase64)}
            className="w-full flex items-center justify-center gap-2 py-3 text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all"
            style={{ background: "var(--accent)" }}>
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Leser planen …
              </>
            ) : (
              <>
                <Sparkles size={15} /> Finn hendelser
              </>
            )}
          </button>
        </>
      )}

      {suggestions && (
        <>
          <div className="rounded-[13px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {suggestions.map((s, i) => (
              <div key={s.key} className={cn("px-3 py-3 flex gap-3", i > 0 && "border-t")} style={{ borderColor: "var(--border)" }}>
                <input type="checkbox" checked={s.selected} onChange={(e) => updateSuggestion(s.key, { selected: e.target.checked })}
                  className="w-5 h-5 mt-1 rounded accent-[var(--accent)] flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input type="text" value={s.title} onChange={(e) => updateSuggestion(s.key, { title: e.target.value })}
                    placeholder="Tittel"
                    className="w-full text-[14.5px] font-[600] outline-none bg-transparent" style={{ color: "var(--foreground)" }} />
                  <div className="flex flex-wrap gap-1.5">
                    <input type="date" value={s.date} onChange={(e) => updateSuggestion(s.key, { date: e.target.value })}
                      className="rounded-[9px] px-2 py-1 text-[12.5px] outline-none" style={{ border: "1px solid var(--border)", color: "var(--foreground)" }} />
                    <input type="time" value={s.startTime ?? ""} onChange={(e) => updateSuggestion(s.key, { startTime: e.target.value || null })}
                      className="rounded-[9px] px-2 py-1 text-[12.5px] outline-none" style={{ border: "1px solid var(--border)", color: "var(--foreground)" }} />
                    <input type="time" value={s.endTime ?? ""} onChange={(e) => updateSuggestion(s.key, { endTime: e.target.value || null })}
                      className="rounded-[9px] px-2 py-1 text-[12.5px] outline-none" style={{ border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  </div>
                  {(s.location || s.notes) && (
                    <p className="text-[12px] truncate" style={{ color: "var(--text-3)" }}>
                      {[s.location, s.notes].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {members.length > 0 && (
            <div>
              <p className="text-[11px] font-[600] uppercase tracking-[0.07em] mb-2" style={{ color: "var(--text-3)" }}>
                Hvem deltar? (gjelder alle valgte)
              </p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const sel = participants.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggleParticipant(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-[550] transition-all"
                      style={{
                        border: `1px solid ${sel ? m.color : "var(--border)"}`,
                        background: sel ? m.color : "transparent",
                        color: sel ? "white" : "var(--foreground)",
                      }}>
                      <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] text-white font-[700]"
                        style={{ background: m.color }}>{m.name[0]?.toUpperCase()}</span>
                      {m.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => { setSuggestions(null); setError(null); }}
              className="flex-1 py-3 rounded-[13px] font-[550] text-[14px] transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}>
              Prøv på nytt
            </button>
            <button type="button" onClick={addSelected} disabled={saving || selectedCount === 0}
              className="flex-[2] py-3 text-white rounded-[13px] font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all"
              style={{ background: "var(--accent)" }}>
              {saving ? "Lagrer…" : `Legg til ${selectedCount} hendelse${selectedCount === 1 ? "" : "r"}`}
            </button>
          </div>
        </>
      )}

      <button type="button" onClick={onCancel} className="w-full text-center text-[13px] py-1" style={{ color: "var(--text-3)" }}>
        Avbryt
      </button>
    </div>
  );
}
