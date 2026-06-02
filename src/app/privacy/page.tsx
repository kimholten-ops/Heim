import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = { title: "Personvernserklæring" };

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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <nav className="border-b border-[var(--border)] px-5 h-14 flex items-center" style={{ background: "var(--surface)" }}>
        <Link href="/"><Image src="/logo.svg" alt="Heim" width={80} height={25} /></Link>
      </nav>

      <main className="max-w-2xl mx-auto px-5 py-12">
        <h1 className="text-[28px] font-[800] tracking-[-0.02em] mb-2">Personvernserklæring</h1>
        <p className="text-[13px] mb-10" style={{ color: "var(--text-3)" }}>Sist oppdatert: juni 2026</p>

        <Section title="Oversikt">
          <p>Heim er en familieplanlegger laget av Kim Holten. Vi tar ditt personvern på alvor og samler kun det vi trenger for at appen skal fungere.</p>
        </Section>

        <Section title="Hva vi samler inn">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Konto:</strong> e-postadresse, navn og passord (kryptert)</li>
            <li><strong>Familiedata:</strong> kalender-hendelser, handlelister, gjøremål, familiemedlemmer</li>
            <li><strong>Teknisk:</strong> IP-adresse, nettlesertype og brukslogg (Vercel + Supabase)</li>
          </ul>
        </Section>

        <Section title="Hvor dataene oppbevares">
          <p>All data lagres i <strong>Supabase sin database i Frankfurt, EU</strong>. Dette er GDPR-kompatibelt. Vi bruker også Vercel for hosting, som er GDPR-kompatibelt.</p>
        </Section>

        <Section title="Dine rettigheter">
          <p>Du kan når som helst:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Eksportere dine data</strong> — kontakt oss på kim@heim.app</li>
            <li><strong>Slette din konto og alle data</strong> — kontakt oss</li>
            <li><strong>Rette feil i dataene dine</strong> — kontakt oss</li>
          </ul>
        </Section>

        <Section title="Barn (under 18)">
          <p>Barn legges til i appen av foreldre/foresatte uten egne konti. Vi samler ikke markedsføringsdata om barn. Barna sine aktiviteter (gjøremål, handlelister) er kun synlig for familiemedlemmer i samme husholdning.</p>
        </Section>

        <Section title="Informasjonskapsler">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Sesjons-cookie</strong> (nødvendig for innlogging)</li>
            <li><strong>PWA-cache</strong> (for offline-funksjonalitet)</li>
          </ul>
          <p>Vi bruker ikke tracking- eller markedsføringskapsler.</p>
        </Section>

        <Section title="Deling med tredjepart">
          <p>Vi deler ikke data med tredjepart for markedsføring. Data kan deles med:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Supabase (databaseprovider, EU)</li>
            <li>Vercel (hostingprovider)</li>
          </ul>
        </Section>

        <Section title="Kontakt">
          <p>Har du spørsmål om personvern? Ta kontakt: <a href="mailto:kim@heim.app" className="underline" style={{ color: "var(--accent)" }}>kim@heim.app</a></p>
        </Section>
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
        <Link href="/" className="hover:opacity-80">← Tilbake til Heim</Link>
        <span className="mx-3">·</span>
        <Link href="/terms" className="hover:opacity-80">Vilkår</Link>
      </footer>
    </div>
  );
}
