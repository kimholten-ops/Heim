"use client";

import Link from "next/link";
import { ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Avatar ──────────────────────────────────────────────────────────
 * Coloured circle with white initial. Sizes: 22 | 28 | 34
 */
const AVA_SIZE = { 22: "w-[22px] h-[22px] text-[11px]", 28: "w-7 h-7 text-xs", 34: "w-[34px] h-[34px] text-[13px]" };

export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: 22 | 28 | 34 }) {
  return (
    <span
      className={cn("rounded-avatar inline-flex items-center justify-center font-bold text-white flex-shrink-0", AVA_SIZE[size])}
      style={{ background: color }}
      aria-label={name}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────
 * Member filter pill. active = dark bg + white text.
 */
export function Chip({
  name, color, active = false, onClick,
}: { name: string; color?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingTop:"clamp(5px,1vh,7px)", paddingBottom:"clamp(5px,1vh,7px)" }}
      className={cn(
        "inline-flex items-center gap-[6px] px-3 rounded-chip border text-[12px] font-[550] transition-colors",
        "shadow-card",
        active
          ? "bg-fg text-white border-fg"
          : "bg-surface text-fg border-border hover:bg-surface-2"
      )}
    >
      {color ? (
        <Avatar name={name} color={active ? "rgba(255,255,255,.25)" : color} size={22} />
      ) : null}
      {name}
    </button>
  );
}

/* ── SectionLabel ────────────────────────────────────────────────────
 * Uppercase 12/600 text-3 header, optional right link.
 */
export function SectionLabel({
  title, href, linkText,
}: { title: string; href?: string; linkText?: string }) {
  return (
    <div className="flex items-center justify-between px-1" style={{ paddingBottom:"clamp(6px,1.2vh,10px)", paddingTop:"clamp(4px,0.8vh,6px)" }}>
      <h2 className="text-[12px] font-[600] uppercase tracking-wide12 text-text-3">{title}</h2>
      {href && linkText && (
        <Link href={href} className="text-[13px] font-[600] text-accent flex items-center gap-[3px] hover:opacity-80 transition-opacity">
          {linkText}
          <ArrowRight size={14} strokeWidth={2.2} />
        </Link>
      )}
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────
 * White card: 1px border, radius 18, light shadow.
 */
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-surface border border-border rounded-card shadow-card", className)}>
      {children}
    </div>
  );
}

/* ── EmptyState ──────────────────────────────────────────────────────
 * Icon + text inside a card.
 */
export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-text-2 text-[14.5px] px-4 py-3.5">
      <span className="w-[34px] h-[34px] rounded-[10px] bg-surface-2 text-text-3 flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      {text}
    </div>
  );
}

/* ── TodoRow ─────────────────────────────────────────────────────────
 * Checkbox (22px, radius 7) + left colour bar + title + sub.
 * checked = accent-filled checkbox
 */
export function TodoRow({
  title, sub, barColor = "var(--m-amber)",
  checked = false, onToggle,
}: {
  title: string; sub?: string; barColor?: string;
  checked?: boolean; onToggle?: () => void;
}) {
  return (
    <div className="flex items-center gap-[13px] px-4 py-[13px]">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-[22px] h-[22px] rounded-check border-2 flex-shrink-0 flex items-center justify-center transition-colors",
          checked ? "border-accent bg-accent" : "border-[#d6dae1] bg-transparent"
        )}
        aria-checked={checked}
      >
        {checked && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4.5l3 3L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0" style={{ borderLeft: `3px solid ${barColor}`, borderRadius: "3px", paddingLeft: "12px" }}>
        <p className={cn("text-[15px] font-[550]", checked ? "line-through text-text-3" : "text-fg")}>{title}</p>
        {sub && <p className="text-[12.5px] text-text-3 mt-[1px]">{sub}</p>}
      </div>
    </div>
  );
}

/* ── EventRow ────────────────────────────────────────────────────────
 * DateTile + title + sub + trailing member dot.
 */
export function EventRow({
  day, weekday, title, sub, dotColor, divider = false,
}: {
  day: number; weekday: string; title: string; sub?: string;
  dotColor?: string; divider?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-[14px] px-4 py-3", divider && "border-t border-border")}>
      <div className="w-[46px] h-[46px] rounded-date bg-surface-2 flex-shrink-0 flex flex-col items-center justify-center">
        <span className="text-[17px] font-[700] text-fg leading-none tracking-[-0.02em]">{day}</span>
        <span className="text-[10px] font-[600] text-text-3 uppercase tracking-[0.04em] mt-[2px]">{weekday}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-[600] text-fg">{title}</p>
        {sub && <p className="text-[12.5px] text-text-2 mt-[2px]">{sub}</p>}
      </div>
      {dotColor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />}
    </div>
  );
}

/* ── ShortcutTile ────────────────────────────────────────────────────
 * Card radius-16, icon 38px tinted + label 12.5/550.
 */
export function ShortcutTile({
  icon, label, href, iconBg, iconColor,
}: {
  icon: React.ReactNode; label: string; href: string;
  iconBg: string; iconColor: string;
}) {
  return (
    <Link
      href={href}
      className="bg-surface border border-border rounded-tile shadow-card flex flex-col items-center px-2 hover:bg-surface-2 active:scale-95 transition-all"
      style={{ gap:"clamp(6px,1.2vh,9px)", paddingTop:"clamp(10px,2vh,16px)", paddingBottom:"clamp(10px,2vh,16px)" }}
    >
      <span
        className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </span>
      <span className="text-[12.5px] font-[550] text-fg text-center leading-tight">{label}</span>
    </Link>
  );
}

/* ── NotificationRow ─────────────────────────────────────────────────
 * Green icon + title/sub + chevron.
 */
export function NotificationRow({
  icon, title, sub, href,
}: { icon: React.ReactNode; title: string; sub: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-[13px] px-4 py-[14px] bg-surface border border-border rounded-card shadow-card hover:bg-surface-2 transition-colors">
      <span className="w-[38px] h-[38px] rounded-[11px] bg-accent-weak text-accent flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-[600] text-fg">{title}</p>
        <p className="text-[12.5px] text-text-2 mt-[1px]">{sub}</p>
      </div>
      <ChevronRight size={18} className="text-text-3 flex-shrink-0" />
    </Link>
  );
}

/* ── Header (backward-compat) ────────────────────────────────────────
 * Simple page header for inner screens (kicker + title + optional right).
 */
export function Header({
  kicker, title, right,
}: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between px-[18px] pt-6 pb-3">
      <div>
        <p className="text-[12.5px] font-[600] text-text-3 uppercase tracking-wide12">{kicker}</p>
        <h1 className="text-[27px] font-[700] tracking-tight27 text-fg mt-[3px] leading-[1.05]">{title}</h1>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

/* ── Placeholder ─────────────────────────────────────────────────────
 * Used by stub pages (kalender, gjøremål).
 */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <div className="px-[18px] pt-6 pb-3">
        <p className="text-[12.5px] font-[600] text-text-3 uppercase tracking-wide12">Kommer snart</p>
        <h1 className="text-[27px] font-[700] tracking-tight27 text-fg mt-1">{title}</h1>
      </div>
      <div className="px-[18px]">
        <Card className="p-4">
          <p className="text-text-2 text-[15px]">{note}</p>
        </Card>
      </div>
    </div>
  );
}

/* ── AppHeader ────────────────────────────────────────────────────────
 * Left: kicker + name + date. Right: slot for icon buttons.
 */
export function AppHeader({
  kicker, name, date, right,
}: { kicker: string; name: string; date: string; right?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start px-2"
      style={{ paddingTop:"var(--header-pt)", paddingBottom:"var(--header-pt)" }}>
      <div>
        <p className="text-[12px] font-[600] text-text-3 tracking-[0.02em]">{kicker}</p>
        <h1 className="font-[700] tracking-tight27 text-fg mt-[2px] leading-[1.05]"
          style={{ fontSize:"var(--heading-size)" }}>{name}</h1>
        <p className="font-[450] text-text-2 mt-[3px]"
          style={{ fontSize:"clamp(11px,3vw,13px)" }}>{date}</p>
      </div>
      {right && <div className="flex gap-1.5 mt-1">{right}</div>}
    </div>
  );
}

/* ── IconButton ──────────────────────────────────────────────────────
 * 38×38 surface button w/ border & shadow.
 */
export function IconButton({
  children, onClick, badgeDot = false,
}: { children: React.ReactNode; onClick?: () => void; badgeDot?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-[38px] h-[38px] rounded-icon bg-surface border border-border shadow-card flex items-center justify-center text-fg hover:bg-surface-2 active:scale-95 transition-all"
    >
      {children}
      {badgeDot && (
        <span className="absolute top-[9px] right-[9px] w-[7px] h-[7px] rounded-full bg-m-coral border-[1.5px] border-surface" />
      )}
    </button>
  );
}
