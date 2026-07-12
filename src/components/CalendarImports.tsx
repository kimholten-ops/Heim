"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Rss, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/utils";

type Import = {
  id: string; label: string; source_url: string; color: string;
  last_synced_at: string | null; last_error: string | null;
};

const PALETTE = ["#7c5cff", "#0d9488", "#f59e0b", "#f97316", "#ec4899", "#3b82f6"];

function relTime(iso: string | null): string {
  if (!iso) return "Aldri synket";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "Synket akkurat nå";
  if (diffMin < 60) return `Synket for ${diffMin} min siden`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Synket for ${diffH}t siden`;
  const diffD = Math.round(diffH / 24);
  return `Synket for ${diffD}d siden`;
}

export default function CalendarImports({ householdId }: { householdId: string | null }) {
  const [supabase] = useState(() => createClient());
  const [imports, setImports] = useState<Import[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!householdId) { setImports([]); return; }
    supabase.from("calendar_imports")
      .select("id, label, source_url, color, last_synced_at, last_error")
      .eq("household_id", householdId)
      .order("created_at")
      .then(({ data }) => { if (active) setImports((data ?? []) as Import[]); });
    return () => { active = false; };
  }, [householdId, supabase]);

  async function sync(id: string) {
    setSyncingId(id);
    const res = await fetch("/api/calendar-imports/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ importId: id }),
    });
    const data = await res.json().catch(() => ({}));
    setSyncingId(null);
    if (householdId) {
      const { data: fresh } = await supabase.from("calendar_imports")
        .select("id, label, source_url, color, last_synced_at, last_error")
        .eq("household_id", householdId).order("created_at");
      setImports((fresh ?? []) as Import[]);
    }
    return data;
  }

  async function addImport() {
    if (!householdId || !label.trim() || !url.trim()) return;
    setSaving(true); setAddError(null);
    const { data, error } = await supabase.from("calendar_imports")
      .insert({ household_id: householdId, label: label.trim(), source_url: url.trim(), color })
      .select("id, label, source_url, color, last_synced_at, last_error").single();
    if (error || !data) { setSaving(false); setAddError("Kunne ikke lagre kalenderen."); return; }
    setImports(prev => [...(prev ?? []), data as Import]);
    setLabel(""); setUrl(""); setColor(PALETTE[0]); setShowAdd(false);
    setSaving(false);
    const result = await sync(data.id);
    if (result?.error) setAddError(result.error);
  }

  async function removeImport(id: string) {
    if (!confirm("Fjerne denne kalenderen? Alle importerte hendelser slettes også.")) return;
    await supabase.from("calendar_imports").delete().eq("id", id);
    setImports(prev => (prev ?? []).filter(i => i.id !== id));
  }

  if (imports === null) return null;

  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-2">
        <SectionLabel title="Importerte kalendere" />
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-[13px] font-[600] text-accent hover:opacity-80 transition-opacity">
            <Plus size={13} strokeWidth={2.5} /> Legg til
          </button>
        )}
      </div>

      <Card>
        {imports.length === 0 && !showAdd && (
          <div className="px-4 py-4 flex items-center gap-3 text-[13.5px]" style={{ color: "var(--text-2)" }}>
            <Rss size={16} strokeWidth={1.7} style={{ color: "var(--text-3)" }} />
            Ingen importerte kalendere ennå — f.eks. skole eller SFO.
          </div>
        )}

        {imports.map((imp, i) => (
          <div key={imp.id} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-border")}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: imp.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-[14.5px] font-[550] text-fg truncate">{imp.label}</p>
              <p className={cn("text-[12px]", imp.last_error ? "text-rose-500" : "text-text-3")}>
                {imp.last_error ?? relTime(imp.last_synced_at)}
              </p>
            </div>
            <button onClick={() => sync(imp.id)} disabled={syncingId === imp.id}
              className="p-1.5 text-text-3 hover:text-accent disabled:opacity-40 transition-colors flex-shrink-0">
              <RefreshCw size={15} strokeWidth={2} className={syncingId === imp.id ? "animate-spin" : ""} />
            </button>
            <button onClick={() => removeImport(imp.id)}
              className="p-1.5 text-text-3 hover:text-rose-500 transition-colors flex-shrink-0">
              <Trash2 size={15} strokeWidth={2} />
            </button>
          </div>
        ))}

        {showAdd && (
          <div className={cn("px-4 py-4 space-y-2.5", imports.length > 0 && "border-t border-border")}>
            <input type="text" placeholder="Navn (f.eks. Skole)" value={label} onChange={e => setLabel(e.target.value)}
              autoFocus className="w-full rounded-[10px] border border-border px-3 py-2 text-[14px] placeholder:text-text-3 outline-none focus:border-accent" />
            <input type="url" placeholder="Kalender-lenke (ics/webcal)" value={url} onChange={e => setUrl(e.target.value)}
              className="w-full rounded-[10px] border border-border px-3 py-2 text-[14px] placeholder:text-text-3 outline-none focus:border-accent" />
            <div className="flex gap-2">
              {PALETTE.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: c, outline: color === c ? "2px solid var(--foreground)" : "none", outlineOffset: 2 }} />
              ))}
            </div>
            {addError && <p className="text-[12.5px] text-rose-500">{addError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={addImport} disabled={saving || !label.trim() || !url.trim()}
                className="flex-1 py-2 bg-accent text-white rounded-[10px] font-[600] text-[13.5px] disabled:opacity-40 hover:opacity-90 transition-all">
                {saving ? "Lagrer…" : "Legg til og synk"}
              </button>
              <button onClick={() => { setShowAdd(false); setAddError(null); }}
                className="px-4 py-2 text-text-3 hover:text-fg text-[13.5px] transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        )}
      </Card>
      <p className="text-[12px] text-text-3 px-1 mt-1.5">
        Synkes manuelt med «Synk nå» — kildekalenderen bestemmer hvor ofte innholdet endrer seg.
      </p>
    </div>
  );
}
