"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useHousehold, type Member } from "@/components/HouseholdContext";
import { Avatar, Card, SectionLabel } from "@/components/ui";
import IosCalendarFeed from "@/components/IosCalendarFeed";
import CalendarImports from "@/components/CalendarImports";
import { signOut } from "@/app/app/actions";
import { LogOut, Copy, Check, UserPlus, Baby, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModuleSettings } from "@/lib/modules";

export default function FamiliePage() {
  const { household, members, myHouseholds, myHouseholdRole } = useHousehold();
  const { settings, update: updateModules } = useModuleSettings(household?.id ?? null);
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const isGuest = myHouseholdRole === "gjest";

  const [invite, setInvite] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<"medlem" | "gjest">("medlem");
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [childName, setChildName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const adults = members.filter((m) => m.role === "adult");
  const kids = members.filter((m) => m.role === "child");

  async function genInvite() {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("create_invite", { p_ttl_hours: 168, p_role: inviteRole });
    setBusy(false);
    if (error) setMsg(error.message);
    else setInvite(data as string);
  }

  async function copyInvite() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMsg("Marker koden manuelt og kopier.");
    }
  }

  async function join() {
    if (!code.trim()) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("join_household", { p_code: code.trim() });
    setBusy(false);
    if (error) setMsg(error.message);
    else { setCode(""); router.refresh(); }
  }

  async function switchHousehold(hid: string) {
    if (hid === household.id) return;
    await supabase.rpc("set_active_household", { p_hid: hid });
    router.refresh();
  }

  async function addChild() {
    const n = childName.trim();
    if (!n) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("add_child", { p_name: n, p_color: "#7c5cff" });
    setBusy(false);
    if (error) setMsg(error.message);
    else { setChildName(""); router.refresh(); }
  }

  async function leave() {
    if (!confirm(`Forlate «${household.name}»?`)) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("leave_household", { p_hid: household.id });
    setBusy(false);
    if (error) setMsg(error.message);
    else router.refresh();
  }

  return (
    <div className="max-w-[420px] mx-auto">
      {/* Header */}
      <div className="px-[18px] pt-[14px] pb-4 flex items-start justify-between">
        <div>
          <p className="text-[12.5px] font-[600] text-text-3 tracking-[0.02em]">Medlemmer & roller</p>
          <h1 className="text-[27px] font-[700] tracking-tight27 text-fg mt-[3px] leading-[1.05]">{household.name}</h1>
        </div>
        <form action={signOut}>
          <button className="mt-1 flex items-center gap-1.5 text-[13px] font-[550] text-text-3 bg-surface border border-border shadow-card rounded-[12px] px-3 py-2 hover:bg-surface-2 transition-colors">
            <LogOut size={14} strokeWidth={1.8} />
            Logg ut
          </button>
        </form>
      </div>

      <div className="px-[18px] pb-28 space-y-4">
        {msg && (
          <div className="px-4 py-3 rounded-[13px] bg-rose-50 border border-rose-200 text-rose-600 text-[13px]">{msg}</div>
        )}

        {/* Members */}
        <div>
          <SectionLabel title="Familiemedlemmer" />
          <Card>
            {adults.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[11px] font-[600] uppercase tracking-wide12 text-text-3">Voksne</span>
                </div>
                {adults.map((m, i) => <MemberRow key={m.id} m={m} divider={i > 0} />)}
              </>
            )}
            {kids.length > 0 && (
              <>
                <div className={cn("px-4 pt-3 pb-1", adults.length > 0 && "border-t border-border mt-1")}>
                  <span className="text-[11px] font-[600] uppercase tracking-wide12 text-text-3">Barn</span>
                </div>
                {kids.map((m, i) => <MemberRow key={m.id} m={m} divider={i > 0} />)}
              </>
            )}

            {/* Add child */}
            {!isGuest && (
              <div className="border-t border-border mt-1 px-4 py-3 flex gap-2">
                <div className="w-[22px] h-[22px] rounded-full flex-shrink-0 bg-surface-2 flex items-center justify-center">
                  <Baby size={13} className="text-text-3" />
                </div>
                <input
                  className="flex-1 bg-transparent text-[15px] text-fg placeholder:text-text-3 outline-none"
                  placeholder="Legg til barn…"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addChild()}
                />
                {childName.trim() && (
                  <button onClick={addChild} disabled={busy}
                    className="text-accent text-[13px] font-[600] hover:opacity-80 transition-opacity disabled:opacity-40">
                    Legg til
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Invite */}
        {!isGuest && (
        <div>
          <SectionLabel title="Inviter noen" />
          <Card>
            <div className="px-4 py-4">
              {!invite ? (
                <>
                  <p className="text-[13px] text-text-2 mb-3">
                    Lager en engangskode som utløper etter 7 dager.
                  </p>
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={() => setInviteRole("medlem")}
                      className={cn("flex-1 py-2 text-[13px] rounded-[11px] border-2 font-[550] transition-all",
                        inviteRole === "medlem" ? "border-accent text-accent bg-accent-weak" : "border-border text-text-2")}>
                      Fullt medlem
                    </button>
                    <button type="button" onClick={() => setInviteRole("gjest")}
                      className={cn("flex-1 py-2 text-[13px] rounded-[11px] border-2 font-[550] transition-all",
                        inviteRole === "gjest" ? "border-accent text-accent bg-accent-weak" : "border-border text-text-2")}>
                      Gjest
                    </button>
                  </div>
                  {inviteRole === "gjest" && (
                    <p className="text-[12px] text-text-3 mb-3">
                      Gjester ser kalenderen, men har ikke tilgang til lister, gjøremål eller familie-innstillinger.
                    </p>
                  )}
                  <button
                    onClick={genInvite} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-[13px] font-[600] text-[15px] hover:opacity-90 active:scale-[.98] disabled:opacity-40 transition-all"
                  >
                    <UserPlus size={16} strokeWidth={2} />
                    {busy ? "Genererer…" : "Generer invitasjonskode"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-text-2 mb-3">
                    Gyldig i 7 dager · kan brukes én gang. Del med den du vil invitere.
                  </p>
                  <div className="bg-surface-2 rounded-[13px] px-4 py-3 flex items-center justify-between mb-3">
                    <span className="text-[24px] font-[700] tracking-[0.1em] text-fg">{invite}</span>
                    <button
                      onClick={copyInvite}
                      className="flex items-center gap-1.5 text-[13px] font-[600] text-accent hover:opacity-80 transition-opacity"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Kopiert!" : "Kopier"}
                    </button>
                  </div>
                  <button onClick={() => setInvite(null)} className="text-[12.5px] text-text-3 hover:text-fg transition-colors">
                    Generer ny kode
                  </button>
                </>
              )}
            </div>
          </Card>
        </div>
        )}

        {/* Join */}
        <div>
          <SectionLabel title="Bli med via kode" />
          <Card>
            <div className="px-4 py-3 flex gap-2">
              <input
                className="flex-1 rounded-[13px] border border-border bg-surface-2 px-4 py-2.5 text-[15px] uppercase tracking-widest outline-none focus:border-accent transition-colors"
                placeholder="Invitasjonskode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={10}
              />
              <button
                onClick={join} disabled={busy || !code.trim()}
                className="bg-accent text-white rounded-[13px] px-5 font-[600] text-[15px] disabled:opacity-40 hover:opacity-90 transition-all"
              >
                {busy ? "…" : "Bli med"}
              </button>
            </div>
          </Card>
        </div>

        {/* Switch household */}
        {myHouseholds.length > 1 && (
          <div>
            <SectionLabel title="Mine husholdninger" />
            <Card>
              {myHouseholds.map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => switchHousehold(h.id)}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors", i > 0 && "border-t border-border")}
                >
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", h.id === household.id ? "bg-accent" : "bg-border")} />
                  <span className={cn("flex-1 text-[15px] font-[550]", h.id === household.id ? "text-fg" : "text-text-2")}>
                    {h.name}
                  </span>
                  {h.id === household.id && (
                    <span className="text-[11px] font-[600] text-accent uppercase tracking-wide12">Aktiv</span>
                  )}
                </button>
              ))}
            </Card>
          </div>
        )}

        {/* Module visibility */}
        <div>
          <SectionLabel title="Moduler" />
          <Card>
            {([
              { key: "maaltider" as const, label: "Måltider", sub: "Måltidsplanlegging og oppskriftsbank" },
            ]).map(({ key, label, sub }, i) => (
              <div key={key} className={cn("flex items-center justify-between px-4 py-3", i > 0 && "border-t border-border")}>
                <div>
                  <p className="text-[15px] font-[550] text-fg">{label}</p>
                  <p className="text-[12.5px] text-text-3">{sub}</p>
                </div>
                <button type="button" onClick={() => updateModules({ [key]: !settings[key] })}
                  className={cn(
                    "relative w-[44px] h-[26px] rounded-full transition-colors duration-200 flex-shrink-0",
                    settings[key] ? "bg-accent" : "bg-border"
                  )}>
                  <span className={cn(
                    "absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white shadow-sm transition-transform duration-200",
                    settings[key] ? "translate-x-[21px]" : "translate-x-[3px]"
                  )} />
                </button>
              </div>
            ))}
          </Card>
          <p className="text-[12px] text-text-3 px-1 mt-1.5">
            Skjulte moduler vises ikke i snarveier.
          </p>
        </div>

        <IosCalendarFeed householdId={household?.id ?? null} />

        <CalendarImports householdId={household?.id ?? null} />

        {/* Leave */}
        <button
          onClick={leave} disabled={busy}
          className="w-full py-3 text-rose-500 text-[14px] font-[550] hover:text-rose-700 transition-colors disabled:opacity-40"
        >
          Forlat «{household.name}»
        </button>
      </div>
    </div>
  );
}

function MemberRow({ m, divider }: { m: Member; divider: boolean }) {
  const router = useRouter();
  const { myHouseholdRole } = useHousehold();
  const [supabase] = useState(() => createClient());
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(m.name);
  const [saving, setSaving] = useState(false);
  const canEdit = myHouseholdRole === "medlem";

  async function save() {
    const n = name.trim();
    if (!n || n === m.name) { setEditing(false); setName(m.name); return; }
    setSaving(true);
    const { error } = await supabase.rpc("rename_member", { p_member_id: m.id, p_name: n });
    setSaving(false);
    if (error) { setName(m.name); return; }
    setEditing(false);
    router.refresh();
  }

  function cancel() { setName(m.name); setEditing(false); }

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", divider && "border-t border-border")}>
      <Avatar name={m.name} color={m.color} size={34} />
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
            disabled={saving}
            className="w-full text-[15px] font-[550] text-fg bg-surface-2 rounded-[8px] px-2 py-1 -mx-2 outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <p className="text-[15px] font-[550] text-fg truncate">{m.name}</p>
        )}
        <p className="text-[12.5px] text-text-3 flex items-center gap-1.5">
          {m.role === "adult" ? "Voksen" : "Barn"}
          {m.household_role === "gjest" && (
            <span className="text-[10px] font-[700] uppercase tracking-wide12 text-accent bg-accent-weak rounded-chip px-1.5 py-[1px]">Gjest</span>
          )}
        </p>
      </div>
      {editing ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={save} disabled={saving} className="p-1.5 text-accent hover:opacity-80 disabled:opacity-40 transition-opacity">
            <Check size={16} strokeWidth={2.2} />
          </button>
          <button onClick={cancel} disabled={saving} className="p-1.5 text-text-3 hover:text-fg transition-colors">
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
      ) : (
        <>
          {canEdit && (
          <button onClick={() => setEditing(true)} className="p-1.5 text-text-3 hover:text-accent transition-colors flex-shrink-0">
            <Pencil size={14} strokeWidth={2} />
          </button>
          )}
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: m.color }}
          />
        </>
      )}
    </div>
  );
}
