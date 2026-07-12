import Link from "next/link";
import Image from "next/image";
import { Calendar, ShoppingCart, SquareCheck, Users, Zap, Globe, Lock, ArrowRight, ChevronRight, Utensils, Check } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: "rgba(245,246,248,.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Heim" width={90} height={28} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="text-[14px] font-[550] px-4 py-2 rounded-[10px] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors">
              Logg inn
            </Link>
            <Link href="/login?tab=signup"
              className="text-[14px] font-[600] px-4 py-2 rounded-[10px] text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)" }}>
              Kom i gang
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] text-[13px] font-[550] mb-8"
          style={{ background: "var(--surface)", color: "var(--text-2)" }}>
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          Gratis i beta
        </div>

        <h1 className="text-[42px] sm:text-[56px] font-[800] tracking-[-0.03em] leading-[1.05] mb-5 max-w-2xl mx-auto">
          Samle familien{" "}
          <span style={{ color: "var(--accent)" }}>i én app</span>
        </h1>
        <p className="text-[18px] sm:text-[20px] max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--text-2)" }}>
          Kalender, handlelister og gjøremål — alt synkronisert i sanntid for hele familien.
          Ingen mer «hvem skulle kjøpe melk?»
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link href="/login?tab=signup"
            className="flex items-center gap-2 px-7 py-3.5 rounded-[14px] text-white text-[16px] font-[700] hover:opacity-90 transition-all active:scale-[.98] shadow-lg"
            style={{ background: "var(--accent)", boxShadow: "0 4px 20px rgba(18,147,107,.3)" }}>
            Opprett gratis konto <ArrowRight size={17} />
          </Link>
          <Link href="/login"
            className="flex items-center gap-2 px-7 py-3.5 rounded-[14px] text-[16px] font-[550] border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: "var(--foreground)" }}>
            Logg inn <ChevronRight size={16} />
          </Link>
        </div>
        <p className="text-[13px] mt-4" style={{ color: "var(--text-3)" }}>
          Ingen betalingsmur. Ingen annonser.
        </p>
      </section>

      {/* App preview strip */}
      <div className="max-w-3xl mx-auto px-5 mb-20">
        <div className="rounded-[18px] border border-[var(--border)] bg-white flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
          {[
            { Icon: Calendar, label: "Kalender", sub: "Hvem gjør hva og når" },
            { Icon: ShoppingCart, label: "Lister", sub: "Handle aldri feil vare" },
            { Icon: SquareCheck, label: "Gjøremål", sub: "Del ansvar i familien" },
            { Icon: Utensils, label: "Måltider", sub: "Planlegg ukens middager" },
          ].map(({ Icon, label, sub }) => (
            <div key={label} className="flex-1 flex items-center gap-2.5 px-5 py-4">
              <Icon size={16} strokeWidth={2} style={{ color: "var(--accent)" }} className="flex-shrink-0" />
              <div>
                <p className="text-[13.5px] font-[700] leading-tight">{label}</p>
                <p className="text-[11.5px] leading-tight" style={{ color: "var(--text-3)" }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-5 mb-20">
        <h2 className="text-[28px] font-[700] tracking-[-0.02em] text-center mb-12">
          Alt familien trenger
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { Icon: Calendar, title: "Delt kalender", desc: "Se hvem som gjør hva og når. Synkroniser hendelser direkte til iOS Kalender-appen.", color: "#eef0f7", iconColor: "#5b6bd6" },
            { Icon: ShoppingCart, title: "Handlelister", desc: "Sanntids-oppdatering — krysser Live av, ser Kim det med én gang. Ingen dobbelt-kjøp.", color: "var(--accent-weak)", iconColor: "var(--accent)" },
            { Icon: SquareCheck, title: "Gjøremål", desc: "Tildel oppgaver til barna, sett prioritet og frist. Med belønningspoeng mot ukepenger.", color: "#fdeee2", iconColor: "var(--m-coral)" },
            { Icon: Users, title: "Familie-oversikt", desc: "Inviter med engangskode, legg til barn, bytt mellom husholdninger.", color: "#f1edff", iconColor: "var(--m-violet)" },
          ].map(({ Icon, title, desc, color, iconColor }) => (
            <div key={title} className="bg-white rounded-[18px] border border-[var(--border)] p-5"
              style={{ boxShadow: "0 1px 2px rgba(20,22,28,.04),0 2px 8px rgba(20,22,28,.05)" }}>
              <div className="w-10 h-10 rounded-[11px] flex items-center justify-center mb-4"
                style={{ background: color, color: iconColor }}>
                <Icon size={20} strokeWidth={1.7} />
              </div>
              <h3 className="text-[15px] font-[700] mb-1.5">{title}</h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Selling points */}
      <section className="max-w-5xl mx-auto px-5 mb-20">
        <div className="rounded-[24px] border border-[var(--border)] overflow-hidden"
          style={{ background: "var(--surface)" }}>
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
            {[
              { Icon: Globe, label: "Norsk hele veien", desc: "Laget i Norge, for norske familier. Grensesnittet er på norsk." },
              { Icon: Lock, label: "Data i EU", desc: "Supabase-database i Frankfurt. GDPR-kompatibelt fra dag én." },
              { Icon: Zap, label: "Sanntids-synk", desc: "Endringer dukker opp instantly på alle enheter — ingen refresh." },
            ].map(({ Icon, label, desc }) => (
              <div key={label} className="px-6 py-6">
                <p className="text-[15px] font-[700] mb-1 flex items-center gap-2">
                  <Icon size={16} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
                  {label}
                </p>
                <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-2xl mx-auto px-5 mb-20">
        <h2 className="text-[28px] font-[700] tracking-[-0.02em] text-center mb-3">
          Hvorfor bytte fra Cozi eller en norsk konkurrent?
        </h2>
        <p className="text-[15px] text-center mb-10" style={{ color: "var(--text-2)" }}>
          Vår egen, nøkterne vurdering — basert på offentlig tilgjengelig informasjon per juli 2026.
        </p>
        <div>
          {[
            { label: "Gratis uten begrensninger", note: "Cozi låser kalenderen til 30 dager frem i tid med mindre du betaler for Gold. Norske alternativer tar som regel et månedsabonnement. Heim er gratis, uten grense." },
            { label: "Sanntids-synk", note: "Krysser noen av handlelisten, ser resten av familien det med det samme — ikke etter en manuell oppdatering." },
            { label: "Moderne design", note: "Bygget i 2026, ikke vedlikeholdt siden 2010." },
            { label: "Norsk språk", note: "Grensesnitt, kundeservice og norske helligdager — ikke oversatt fra engelsk." },
            { label: "Data i EU", note: "Supabase i Frankfurt. GDPR-kompatibelt fra dag én." },
          ].map((row, i) => (
            <div key={row.label} className={`flex gap-4 py-5 ${i>0 ? "border-t" : ""}`} style={{ borderColor: "var(--border)" }}>
              <Check size={18} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
              <div>
                <p className="text-[15.5px] font-[700] mb-1">{row.label}</p>
                <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>{row.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why free */}
      <section className="max-w-3xl mx-auto px-5 mb-20 text-center">
        <h2 className="text-[24px] font-[700] tracking-[-0.02em] mb-4">Derfor er Heim gratis</h2>
        <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Heim er bygget av en familie i Norge, for egen bruk — og delt med andre familier som vil ha
          det samme. Ingen investorer å tilfredsstille, ingen annonser å selge inn, ingen data å selge
          videre. Bare en app vi selv bruker hver dag, som vi tror andre familier også vil sette pris på.
        </p>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-5 mb-20 text-center">
        <div className="rounded-[24px] p-10 sm:p-14"
          style={{ background: "var(--accent)", boxShadow: "0 8px 40px rgba(18,147,107,.25)" }}>
          <h2 className="text-[28px] sm:text-[34px] font-[800] tracking-[-0.02em] text-white mb-3">
            Klar til å prøve?
          </h2>
          <p className="text-white/80 text-[17px] mb-8">
            Gratis. Ingen kredittkort. Ta med hele familien.
          </p>
          <Link href="/login?tab=signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-[14px] bg-white font-[700] text-[16px] hover:opacity-90 transition-opacity"
            style={{ color: "var(--accent)" }}>
            Opprett gratis konto <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Heim" width={70} height={22} />
            <span className="text-[13px]" style={{ color: "var(--text-3)" }}>— Delt familieplanlegger</span>
          </div>
          <div className="flex items-center gap-5 text-[13px]" style={{ color: "var(--text-3)" }}>
            <Link href="/artikler" className="hover:text-[var(--foreground)] transition-colors">Artikler</Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Personvern</Link>
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">Vilkår</Link>
            <Link href="/roadmap" className="hover:text-[var(--foreground)] transition-colors">Roadmap</Link>
            <span>© 2026 Heim</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
