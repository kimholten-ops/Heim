import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function ArticleCTA() {
  return (
    <div className="not-prose rounded-[18px] px-6 py-6 my-8 text-center"
      style={{ background: "var(--accent-weak)", border: "1px solid var(--border)" }}>
      <p className="text-[16px] font-[700] mb-1" style={{ color: "var(--foreground)" }}>
        Prøv Heim gratis
      </p>
      <p className="text-[13.5px] mb-4" style={{ color: "var(--text-2)" }}>
        Delt kalender, handlelister og gjøremål i sanntid. Norsk, ingen betalingsmur, ingen annonser.
      </p>
      <Link href="/login?tab=signup"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-white text-[14px] font-[700] hover:opacity-90 transition-opacity"
        style={{ background: "var(--accent)" }}>
        Kom i gang gratis <ArrowRight size={15} />
      </Link>
    </div>
  );
}
