// Server-only: sender web push-varsler via VAPID. Krever
// VAPID_PRIVATE_KEY og NEXT_PUBLIC_VAPID_PUBLIC_KEY som miljøvariabler.
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type PushPayload = { title: string; body?: string; url?: string };

let configured = false;
function ensureConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails("mailto:support@heim.app", pub, priv);
    configured = true;
  }
  return true;
}

// Sender push til alle enheter en gitt bruker (auth_user_id) har abonnert med.
// Bruker service-role-klienten siden mottakerens abonnement kun er lesbart
// av dem selv via RLS — avsender (en annen husstands-medlem) har ikke tilgang.
export async function sendPushToUser(
  serviceClient: SupabaseClient<Database>,
  authUserId: string,
  payload: PushPayload
): Promise<void> {
  if (!ensureConfigured()) return;

  const { data: subs } = await serviceClient
    .from("push_subscriptions")
    .select("*")
    .eq("auth_user_id", authUserId);
  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        // 404/410 = abonnementet er utløpt eller nettleseren avregistrerte det.
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await serviceClient.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}
