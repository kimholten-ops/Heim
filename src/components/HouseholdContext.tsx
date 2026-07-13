"use client";

import { createContext, useContext } from "react";

export type Member = {
  id: string; name: string; color: string; role: string; can_login: boolean;
};
export type HouseholdRef = { id: string; name: string };

export type HouseholdCtx = {
  meName: string;
  myMemberId: string | null;
  household: HouseholdRef;
  members: Member[];
  myHouseholds: HouseholdRef[];
};

const Ctx = createContext<HouseholdCtx | null>(null);

export function HouseholdProvider({
  value,
  children,
}: {
  value: HouseholdCtx;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHousehold() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHousehold må brukes innenfor HouseholdProvider");
  return v;
}
