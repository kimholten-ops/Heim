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
  title: { default: "Heim — familiekalender, handleliste og gjøremål. Gratis.", template: "%s | Heim" },
  description: "Norsk familieapp med delt kalender, handlelister og gjøremål i sanntid. Moderne design, ingen annonser, helt gratis.",
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
    title: "Heim — familiekalender, handleliste og gjøremål. Gratis.",
    description: "Norsk familieapp med delt kalender, handlelister og gjøremål i sanntid. Moderne design, ingen annonser, helt gratis.",
    url: BASE_URL,
    siteName: "Heim",
    locale: "no_NO",
    type: "website",
    images: [{ url: "/heim-512.png", width: 512, height: 512, alt: "Heim" }],
  },
  twitter: {
    card: "summary",
    title: "Heim — familiekalender, handleliste og gjøremål. Gratis.",
    description: "Norsk familieapp med delt kalender, handlelister og gjøremål i sanntid. Moderne design, ingen annonser, helt gratis.",
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
