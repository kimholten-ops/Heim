"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (!data.session) {
          // E-postbekreftelse er på. Slå den av i dev (se README) eller bekreft e-posten.
          setInfo("Konto opprettet. Sjekk e-posten din for å bekrefte, og logg inn.");
          setMode("in");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push("/app");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-7">
        <h1 className="text-3xl font-semibold text-brand">Heim</h1>
        <p className="text-stone-500 mt-1 mb-6">
          {mode === "in" ? "Logg inn på familien din" : "Opprett en konto"}
        </p>

        {mode === "up" && (
          <input
            className="w-full mb-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none"
            placeholder="Navn"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="w-full mb-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none"
          placeholder="E-post"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full mb-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none"
          placeholder="Passord"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {error && <p className="text-rose-600 text-sm mb-3">{error}</p>}
        {info && <p className="text-emerald-700 text-sm mb-3">{info}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full bg-brand text-white rounded-xl py-3 font-bold disabled:opacity-50"
        >
          {busy ? "..." : mode === "in" ? "Logg inn" : "Opprett konto"}
        </button>

        <button
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
            setInfo(null);
          }}
          className="w-full text-stone-500 mt-4 text-sm"
        >
          {mode === "in"
            ? "Har du ikke konto? Opprett en"
            : "Har du allerede konto? Logg inn"}
        </button>
      </div>
    </main>
  );
}
