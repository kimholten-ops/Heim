"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, ShoppingCart, SquareCheck, Calendar, Utensils, Wallet, Users } from "lucide-react";
import {
  AppHeader, IconButton, Chip, SectionLabel, Card,
  EmptyState, ShortcutTile, NotificationRow,
  TodoRow, EventRow,
} from "@/components/ui";
import { useHousehold } from "@/components/HouseholdContext";
import { useModuleSettings } from "@/lib/modules";

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "God morgen" : h < 17 ? "God dag" : "God kveld";
}

function todayLabel() {
  return new Date().toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
}

const ALL_SHORTCUTS = [
  { href: "/app/lister",   label: "Lister",    Icon: ShoppingCart, iconBg: "var(--accent-weak)", iconColor: "var(--accent)",   module: null },
  { href: "/app/gjoremal", label: "Gjøremål",  Icon: SquareCheck,  iconBg: "#e7f4ee",            iconColor: "var(--accent)",   module: null },
  { href: "/app/kalender", label: "Kalender",  Icon: Calendar,     iconBg: "#eef0f7",            iconColor: "#5b6bd6",         module: null },
  { href: "/app/maaltider",label: "Måltider",  Icon: Utensils,     iconBg: "#fdeee2",            iconColor: "var(--m-coral)",  module: "maaltider" },
  { href: "/app/familie",  label: "Ukepenger", Icon: Wallet,       iconBg: "#fef3e0",            iconColor: "#d9920a",         module: "ukepenger" },
  { href: "/app/familie",  label: "Familie",   Icon: Users,        iconBg: "#f1edff",            iconColor: "var(--m-violet)", module: null },
] as const;

export default function HomePage() {
  const { meName, household, members } = useHousehold();
  const router = useRouter();
  const [activeChip, setActiveChip] = useState<string | null>(null); // null = Alle

  // Derive member color (use spec colours by index, fallback to member.color)
  const { settings: moduleSettings } = useModuleSettings(household?.id ?? null);
  const SPEC_COLORS = ["var(--m-teal)", "var(--m-amber)", "var(--m-violet)", "var(--m-coral)"];
  const memberWithColor = members.map((m, i) => ({
    ...m,
    specColor: SPEC_COLORS[i % SPEC_COLORS.length],
  }));

  return (
    <div className="max-w-[420px] mx-auto">
      {/* ── Scroll area ── */}
      <div className="px-[18px] pb-28">

        {/* Header */}
        <AppHeader
          kicker={getGreeting()}
          name={household.name}
          date={todayLabel().replace(/^\w/, (c) => c.toUpperCase())}
          right={
            <>
              <IconButton badgeDot>
                <Bell size={19} strokeWidth={1.7} />
              </IconButton>
              <IconButton onClick={() => router.push("/login")}>
                <LogOut size={18} strokeWidth={1.7} />
              </IconButton>
            </>
          }
        />

        {/* Member filter chips */}
        {members.length > 0 && (
          <div className="flex gap-2 pb-[18px] flex-wrap">
            <Chip
              name="Alle"
              active={activeChip === null}
              onClick={() => setActiveChip(null)}
            />
            {memberWithColor.map((m) => (
              <Chip
                key={m.id}
                name={m.name}
                color={m.specColor}
                active={activeChip === m.id}
                onClick={() => setActiveChip(activeChip === m.id ? null : m.id)}
              />
            ))}
          </div>
        )}

        {/* ── I dag ── */}
        <div className="mb-[22px]">
          <SectionLabel title="I dag" href="/app/kalender" linkText="Kalender" />
          <Card>
            <EmptyState
              icon={<Calendar size={18} strokeWidth={1.7} />}
              text="Ingen hendelser i dag"
            />
          </Card>
        </div>

        {/* ── Gjøremål ── */}
        <div className="mb-[22px]">
          <SectionLabel title="Gjøremål" href="/app/gjoremal" linkText="Se alle" />
          <Card>
            <EmptyState
              icon={<SquareCheck size={18} strokeWidth={1.7} />}
              text="Ingen aktive gjøremål"
            />
          </Card>
        </div>

        {/* ── Resten av uken ── */}
        <div className="mb-[22px]">
          <SectionLabel title="Resten av uken" />
          <Card>
            <EmptyState
              icon={<Calendar size={18} strokeWidth={1.7} />}
              text="Ingen hendelser denne uken"
            />
          </Card>
        </div>

        {/* ── Snarveier ── */}
        <div className="mb-[22px]">
          <SectionLabel title="Snarveier" />
          <div className="grid grid-cols-3 gap-[10px]">
            {ALL_SHORTCUTS.filter(s => !s.module || moduleSettings[s.module as keyof typeof moduleSettings]).map(({ href, label, Icon, iconBg, iconColor }) => (
              <ShortcutTile
                key={label}
                href={href}
                label={label}
                icon={<Icon size={19} strokeWidth={1.7} />}
                iconBg={iconBg}
                iconColor={iconColor}
              />
            ))}
          </div>
        </div>

        {/* ── Varsler ── */}
        <NotificationRow
          href="/app/familie"
          icon={<Bell size={18} strokeWidth={1.7} />}
          title="Varsler"
          sub="Tildelinger, godkjenninger og hendelser"
        />
      </div>
    </div>
  );
}
