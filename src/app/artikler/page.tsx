import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { articles } from "@/content/articles";

export const metadata: Metadata = {
  title: "Artikler om familieplanlegging",
  description: "Nøkterne guider om familiekalendere, delte handlelister og familieplanlegging for norske familier.",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

export default function ArtiklerPage() {
  const sorted = [...articles].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <nav className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: "rgba(245,246,248,.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Heim" width={90} height={28} />
          </Link>
          <Link href="/login?tab=signup"
            className="text-[14px] font-[600] px-4 py-2 rounded-[10px] text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)" }}>
            Kom i gang
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-14">
        <h1 className="text-[34px] sm:text-[42px] font-[800] tracking-[-0.02em] mb-3">Artikler</h1>
        <p className="text-[16px] mb-12" style={{ color: "var(--text-2)" }}>
          Nøkterne guider om familiekalendere, delte handlelister og familieplanlegging — skrevet for norske familier.
        </p>

        <div className="space-y-4">
          {sorted.map((a) => (
            <Link key={a.slug} href={`/artikler/${a.slug}`}
              className="block rounded-[18px] border border-[var(--border)] bg-white p-6 hover:border-[var(--accent)] transition-colors group">
              <p className="text-[12px] font-[600] uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>
                {fmtDate(a.date)}
              </p>
              <h2 className="text-[19px] font-[700] mb-2 flex items-start gap-2 justify-between">
                <span>{a.title}</span>
                <ChevronRight size={18} className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--accent)" }} />
              </h2>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>{a.description}</p>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-3xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Heim" width={70} height={22} />
            <span className="text-[13px]" style={{ color: "var(--text-3)" }}>— Delt familieplanlegger</span>
          </div>
          <div className="flex items-center gap-5 text-[13px]" style={{ color: "var(--text-3)" }}>
            <Link href="/" className="hover:text-[var(--foreground)] transition-colors">Hjem</Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Personvern</Link>
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">Vilkår</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
