import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

const BASE_URL = "https://heim-virid.vercel.app";

export const viewport: Viewport = {
  themeColor: "#12936b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: { default: "Heim — Delt familieplanlegger", template: "%s | Heim" },
  description: "Kalender, handlelister og gjøremål — sanntids-synk for hele familien. Norsk, GDPR-kompatibel, gratis.",
  manifest: "/manifest.json",
  metadataBase: new URL(BASE_URL),

  /* Icons */
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/heim-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/heim-180.png", sizes: "180x180", type: "image/png" },
    ],
  },

  /* iOS PWA */
  appleWebApp: {
    capable: true,
    title: "Heim",
    statusBarStyle: "black-translucent",
  },

  openGraph: {
    title: "Heim — Delt familieplanlegger",
    description: "Planlegg familien sammen. Sanntids-synk på alle enheter.",
    url: BASE_URL,
    siteName: "Heim",
    locale: "no_NO",
    type: "website",
    images: [{ url: "/heim-512.png", width: 512, height: 512, alt: "Heim" }],
  },
  twitter: {
    card: "summary",
    title: "Heim — Delt familieplanlegger",
    description: "Planlegg familien sammen. Sanntids-synk på alle enheter.",
    images: ["/heim-512.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className={geist.variable}>
      <body style={{ fontFamily: 'var(--font-geist), -apple-system, "SF Pro Text", system-ui, sans-serif' }}>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
