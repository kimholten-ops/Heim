import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

const BASE_URL = "https://heim-virid.vercel.app";

export const metadata: Metadata = {
  title: { default: "Heim — Delt familieplanlegger", template: "%s | Heim" },
  description: "Kalender, handlelister og gjøremål — sanntids-synk for hele familien. Norsk, GDPR-kompatibel, gratis.",
  manifest: "/manifest.json",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: "Heim — Delt familieplanlegger",
    description: "Planlegg familien sammen. Sanntids-synk på alle enheter.",
    url: BASE_URL,
    siteName: "Heim",
    locale: "no_NO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Heim — Delt familieplanlegger",
    description: "Planlegg familien sammen. Sanntids-synk på alle enheter.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no" className={geist.variable}>
      <body style={{ fontFamily: 'var(--font-geist), -apple-system, "SF Pro Text", system-ui, sans-serif' }}>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
