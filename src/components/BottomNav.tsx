"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, SquareCheck, Calendar, Users } from "lucide-react";
import { useHousehold } from "@/components/HouseholdContext";
import { GUEST_HIDDEN_HREFS } from "@/lib/guest-access";
import { cn } from "@/lib/utils";

const ALL_TABS = [
  { href: "/app",          label: "Hjem",     Icon: Home,         module: null },
  { href: "/app/lister",   label: "Lister",   Icon: ShoppingCart, module: null },
  { href: "/app/gjoremal", label: "Gjøremål", Icon: SquareCheck,  module: null },
  { href: "/app/kalender", label: "Kalender", Icon: Calendar,     module: null },
  { href: "/app/familie",  label: "Familie",  Icon: Users,        module: null },
] as const;

export default function BottomNav() {
  const path = usePathname();
  const { myHouseholdRole } = useHousehold();

  const tabs = ALL_TABS.filter(t => {
    if (myHouseholdRole === "gjest" && GUEST_HIDDEN_HREFS.has(t.href)) return false;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30"
      style={{ height:"clamp(60px,10vh,82px)" }}>
      <div
        className="max-w-[420px] mx-auto h-full flex px-[6px]"
        style={{
          paddingTop: "clamp(8px,1.5vh,10px)",
          paddingBottom: "max(env(safe-area-inset-bottom,0px),clamp(8px,2.5vh,22px))",
          background: "rgba(255,255,255,.86)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {tabs.map(({ href, label, Icon }) => {
          const active = path === href || (href !== "/app" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-1"
              style={{ color: active ? "var(--accent)" : "var(--text-3)" }}
            >
              <Icon size={22} strokeWidth={1.8} />
              <span className="text-[10.5px] font-[600]">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
