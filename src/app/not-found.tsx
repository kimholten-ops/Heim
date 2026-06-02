import Link from "next/link";
import { Home, Compass } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5"
      style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm text-center">
        <p className="text-[72px] font-[800] tracking-tight leading-none mb-2"
          style={{ color: "var(--accent)" }}>
          404
        </p>
        <h1 className="text-[21px] font-[700] mb-2" style={{ color: "var(--foreground)" }}>
          Siden finnes ikke
        </h1>
        <p className="text-[14.5px] mb-8" style={{ color: "var(--text-2)" }}>
          La oss ta deg hjem til familien.
        </p>
        <Link href="/app"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-[13px] font-[600] text-[15px] hover:opacity-90 transition-opacity">
          <Home size={16} /> Gå hjem
        </Link>
        <p className="mt-4 text-[13px]" style={{ color: "var(--text-3)" }}>
          Eller{" "}
          <Link href="/login" className="underline hover:opacity-80" style={{ color: "var(--accent)" }}>
            logg inn
          </Link>
        </p>
      </div>
    </div>
  );
}
