"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Heim app error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-5"
      style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <div className="bg-white border border-[var(--border)] rounded-[18px] shadow-[var(--shadow-card)] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={28} className="text-red-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-[21px] font-[700] text-[var(--foreground)] mb-2">
            Noe gikk galt
          </h1>
          <p className="text-[14.5px] text-[var(--text-2)] mb-8 leading-relaxed">
            Vi jobber med å fikse det. Prøv å laste siden på nytt, eller gå hjem.
          </p>
          {process.env.NODE_ENV === "development" && error?.message && (
            <pre className="text-left text-xs bg-red-50 text-red-700 rounded-[10px] p-3 mb-6 overflow-auto max-h-32">
              {error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-[var(--border)] rounded-[12px] text-[14px] font-[550] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <RefreshCw size={14} /> Prøv igjen
            </button>
            <Link
              href="/app"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--accent)] text-white rounded-[12px] text-[14px] font-[600] hover:opacity-90 transition-opacity"
            >
              <Home size={14} /> Hjem
            </Link>
          </div>
        </div>
        <p className="text-center text-[12px] text-[var(--text-3)] mt-4">
          Feil-ID: {error?.digest ?? "ukjent"}
        </p>
      </div>
    </div>
  );
}
