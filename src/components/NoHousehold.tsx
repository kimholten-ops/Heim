"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NoHousehold({ meName }: { meName: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("create_household", { p_name: name.trim() || "Min husholdning" });
    setBusy(false);
    if (error) setMsg(error.message);
    else router.refresh();
  }
  async function join() {
    if (!code.trim()) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("join_household", { p_code: code.trim() });
    setBusy(false);
    if (error) setMsg(error.message);
    else router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-7">
        <h1 className="text-2xl font-semibold text-brand mb-1">Hei {meName}</h1>
        <p className="text-stone-500 mb-6">Du er ikke med i noen husholdning ennå.</p>

        {msg && <p className="text-rose-600 text-sm mb-3">{msg}</p>}

        <p className="text-xs font-bold text-stone-400 uppercase mb-2">Opprett en ny</p>
        <div className="flex gap-2 mb-5">
          <input
            className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 outline-none"
            placeholder="Navn på husholdning"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={create} disabled={busy} className="bg-brand text-white rounded-xl px-4 font-bold disabled:opacity-50">
            Opprett
          </button>
        </div>

        <p className="text-xs font-bold text-stone-400 uppercase mb-2">Eller bli med via kode</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 outline-none uppercase"
            placeholder="Invitasjonskode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button onClick={join} disabled={busy} className="bg-brandsoft text-brand rounded-xl px-4 font-bold disabled:opacity-50">
            Bli med
          </button>
        </div>
      </div>
    </main>
  );
}
