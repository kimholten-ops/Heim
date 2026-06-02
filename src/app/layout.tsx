import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: "Heim",
  description: "Familieplanlegger",
  manifest: "/manifest.json",
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
      </body>
    </html>
  );
}
