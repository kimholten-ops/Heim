import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = { title: "Roadmap" };

type Status = "done" | "soon" | "planned";
const STATUS: Record<Status, { emoji: string; label: string; bg: string; text: string }> = {
  done:    { emoji: "✅", label: "Live",    bg: "bg-emerald-50", text: "text-emerald-700" },
  soon:    { emoji: "🚧", label: "Snart",   bg: "bg-amber-50",   text: "text-amber-700"  },
  planned: { emoji: "⏳", label: "Planlagt", bg: "bg-gray-100",   text: "text-gray-600"   },
};

const ITEMS: { status: Status; title: string; desc: string }[] = [
  { status: "done",    title: "Innlogging + husholdninger",     desc: "Registrering, dele husholdning med invitasjonskode, bytte." },
  { status: "done",    title: "Handlelister",                   desc: "Sanntids-synk, optimistisk UI, flervalg av lister." },
  { status: "done",    title: "Gjøremål",                       desc: "Prioritet, frist, tildeling til familiemedlemmer." },
  { status: "done",    title: "Kalender",                       desc: "Agenda, hendelser, deltakere, gjentakelse." },
  { status: "done",    title: "Måltidsplanlegging",             desc: "Ukeplan, oppskriftsbank, generer handleliste." },
  { status: "done",    title: "iOS Kalender-synk",              desc: "Abonner på Heim-kalenderen via webcal://-lenke." },
  { status: "done",    title: "Moderne redesign",               desc: "Linear/iOS-inspirert UI. Geist-font. Grønn aksent." },
  { status: "soon",    title: "Ukepenger",                      desc: "Belønningspoeng, sparemål og godkjenning fra foreldre." },
  { status: "soon",    title: "Push-varsler",                   desc: "Bli varslet når noen legger til hendelse eller gjøremål." },
  { status: "soon",    title: "Barneprofil med PIN",            desc: "Enkel innlogging for barn på delt nettbrett." },
  { status: "planned", title: "Tavlevisning (entré-tablet)",    desc: "Helskjerm-oversikt for nettbrett i gangen." },
  { status: "planned", title: "Native iOS/Android-app",        desc: "React Native-app med EventKit for ekte kalender-synk." },
  { status: "planned", title: "Google Kalender-import",        desc: "Hent jobb- og skole-hendelser fra Google." },
  { status: "planned", title: "Kjørelogg / henteplan",         desc: "Hvem henter hvem og når?" },
];

export default function RoadmapPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <nav className="border-b border-[var(--border)] px-5 h-14 flex items-center justify-between"
        style={{ background: "var(--surface)" }}>
        <Link href="/"><Image src="/logo.svg" alt="Heim" width={80} height={25} /></Link>
        <Link href="/login"
          className="text-[14px] font-[550] px-4 py-2 rounded-[10px] text-white hover:opacity-90 transition-opacity"
          style={{ background: "var(--accent)" }}>
          Logg inn
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-5 py-12">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] text-[13px] font-[550] mb-4"
            style={{ background: "var(--surface)", color: "var(--text-2)" }}>
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" /> Aktiv utvikling
          </div>
          <h1 className="text-[28px] font-[800] tracking-[-0.02em] mb-2">Heim Roadmap</h1>
          <p className="text-[15px]" style={{ color: "var(--text-2)" }}>
            Her er hva som er ferdig og hva som kommer. Innspill er velkomne på{" "}
            <a href="mailto:kim@heim.app" style={{ color: "var(--accent)" }} className="underline">
              kim@heim.app
            </a>
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {Object.values(STATUS).map(s => (
            <span key={s.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-[550] ${s.bg} ${s.text}`}>
              {s.emoji} {s.label}
            </span>
          ))}
        </div>

        {/* Items */}
        <div className="space-y-2">
          {ITEMS.map(({ status, title, desc }) => {
            const s = STATUS[status];
            return (
              <div key={title} className="flex items-start gap-4 p-4 rounded-[14px] border border-[var(--border)]"
                style={{ background: "var(--surface)" }}>
                <span className="text-xl flex-shrink-0 mt-0.5">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-[600]" style={{ color: "var(--foreground)" }}>{title}</p>
                  <p className="text-[13px] mt-0.5" style={{ color: "var(--text-2)" }}>{desc}</p>
                </div>
                <span className={`flex-shrink-0 text-[11px] font-[600] px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-10 p-5 rounded-[16px] border border-[var(--border)]"
          style={{ background: "var(--accent-weak)" }}>
          <p className="text-[15px] font-[600] mb-1" style={{ color: "var(--accent)" }}>
            Savner du noe?
          </p>
          <p className="text-[14px]" style={{ color: "var(--text-2)" }}>
            Send oss en e-post: <a href="mailto:kim@heim.app" className="underline font-[550]" style={{ color: "var(--accent)" }}>kim@heim.app</a>
          </p>
        </div>
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
        <Link href="/" className="hover:opacity-80">← Tilbake til Heim</Link>
        <span className="mx-3">·</span>
        <Link href="/privacy" className="hover:opacity-80">Personvern</Link>
        <span className="mx-3">·</span>
        <Link href="/terms" className="hover:opacity-80">Vilkår</Link>
      </footer>
    </div>
  );
}
