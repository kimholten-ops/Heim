import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = { title: "Vilkår for tjenesten" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[18px] font-[700] mb-3" style={{ color: "var(--foreground)" }}>{title}</h2>
      <div className="text-[14.5px] leading-relaxed space-y-2" style={{ color: "var(--text-2)" }}>
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <nav className="border-b border-[var(--border)] px-5 h-14 flex items-center" style={{ background: "var(--surface)" }}>
        <Link href="/"><Image src="/logo.svg" alt="Heim" width={80} height={25} /></Link>
      </nav>

      <main className="max-w-2xl mx-auto px-5 py-12">
        <h1 className="text-[28px] font-[800] tracking-[-0.02em] mb-2">Vilkår for tjenesten</h1>
        <p className="text-[13px] mb-10" style={{ color: "var(--text-3)" }}>Sist oppdatert: juni 2026</p>

        <Section title="Bruk av Heim">
          <p>Heim er en gratis familieplanlegger i beta. Ved å bruke tjenesten godtar du disse vilkårene.</p>
          <p>Det er ikke tillatt å bruke Heim til:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Spam eller uønsket kontakt</li>
            <li>Lagring av ulovlig innhold</li>
            <li>Reverse-engineering av tjenesten</li>
            <li>Kommersiell videreselging</li>
          </ul>
        </Section>

        <Section title="Beta-periode">
          <p>Heim er i aktiv utvikling. Det betyr at:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Funksjoner kan endres eller fjernes</li>
            <li>Vi kan ha nedetid uten forvarsel</li>
            <li>Vi kan slette inaktive konti etter 12 måneder</li>
          </ul>
        </Section>

        <Section title="Dine data">
          <p>Du eier dine data. Vi lagrer dem for at tjenesten skal fungere. Du kan be om eksport eller sletting når som helst.</p>
        </Section>

        <Section title="Ansvar">
          <p>Heim tilbys «som det er». Vi er ikke ansvarlige for:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Datatap ved tekniske problemer</li>
            <li>Uautorisert tilgang (vi gjør tiltak for å forhindre det)</li>
            <li>Tap som følge av nedetid</li>
          </ul>
          <p>Vi anbefaler å ikke lagre kritisk informasjon kun i Heim.</p>
        </Section>

        <Section title="Endringer i vilkår">
          <p>Vi kan endre disse vilkårene. Vesentlige endringer varsles per e-post 30 dager i forveien. Fortsatt bruk = du godtar de nye vilkårene.</p>
        </Section>

        <Section title="Betaling (fremtid)">
          <p>Heim er gratis i beta. Når premium-funksjoner introduseres:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Pris vises klart før kjøp</li>
            <li>Ingen skjulte gebyrer</li>
            <li>Angrerett 14 dager</li>
          </ul>
        </Section>

        <Section title="Kontakt">
          <p>Spørsmål om vilkår: <a href="mailto:kim@heim.app" className="underline" style={{ color: "var(--accent)" }}>kim@heim.app</a></p>
        </Section>
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
        <Link href="/" className="hover:opacity-80">← Tilbake til Heim</Link>
        <span className="mx-3">·</span>
        <Link href="/privacy" className="hover:opacity-80">Personvern</Link>
      </footer>
    </div>
  );
}
