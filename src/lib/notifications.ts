// Kalles klient-side når appen lastes: trigger server-sjekken som lager
// event-påminnelser og sender push. Selve varsel-genereringen skjer i
// /api/notifications/check siden push krever VAPID-privatnøkkelen (server-only).
export async function checkEventReminders(householdId: string): Promise<void> {
  try {
    await fetch("/api/notifications/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId }),
    });
  } catch {
    // Stille feil — dette er en best-effort bakgrunnssjekk, ikke kritisk for siden.
  }
}
