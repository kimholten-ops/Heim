"use client";

import { useState, useEffect, useCallback } from "react";

export type ModuleSettings = {
  maaltider: boolean;
};

const DEFAULTS: ModuleSettings = { maaltider: true };

function key(hid: string) { return `heim-modules-${hid}`; }

export function useModuleSettings(householdId: string | null) {
  const [settings, setSettings] = useState<ModuleSettings>(DEFAULTS);

  useEffect(() => {
    if (!householdId) return;
    try {
      const raw = localStorage.getItem(key(householdId));
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, [householdId]);

  const update = useCallback((patch: Partial<ModuleSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      if (householdId) {
        try { localStorage.setItem(key(householdId), JSON.stringify(next)); } catch {}
      }
      return next;
    });
  }, [householdId]);

  return { settings, update };
}

/** Read module settings synchronously (for SSR-safe server-only contexts, returns defaults) */
export function readModuleSettings(householdId: string): ModuleSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(key(householdId));
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
}
