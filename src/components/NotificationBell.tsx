"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/HouseholdContext";
import { IconButton } from "@/components/ui";
import { Bell, X, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { pushSupported, getPushSubscriptionState, subscribeToPush } from "@/lib/push-client";

type Notification = {
  id: string; title: string; body: string | null; url: string | null;
  type: string; read_at: string | null; created_at: string;
};

export default function NotificationBell() {
  const [supabase] = useState(() => createClient());
  const { myMemberId } = useHousehold();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [pushState, setPushState] = useState<"subscribed" | "unsubscribed" | "unsupported">("unsupported");
  const [subscribing, setSubscribing] = useState(false);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const fetchNotifications = useCallback(async () => {
    if (!myMemberId) return;
    const { data } = await supabase.from("notifications").select("*")
      .eq("member_id", myMemberId).order("created_at", { ascending: false }).limit(30);
    setItems((data ?? []) as Notification[]);
  }, [myMemberId, supabase]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { if (pushSupported()) getPushSubscriptionState().then(setPushState); }, []);

  async function handleOpen() {
    setOpen(true);
    const unread = items.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).in("id", unread.map((n) => n.id));
  }

  async function handleSubscribe() {
    setSubscribing(true);
    const ok = await subscribeToPush();
    setPushState(ok ? "subscribed" : "unsubscribed");
    setSubscribing(false);
  }

  return (
    <>
      <IconButton onClick={handleOpen} badgeDot={unreadCount > 0}>
        <Bell size={18} strokeWidth={1.7} />
      </IconButton>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-t-[24px] p-5 pb-8 shadow-2xl max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4 flex-shrink-0" />
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="text-[19px] font-[700] text-fg">Varsler</h2>
              <button onClick={() => setOpen(false)} className="text-text-3 p-1"><X size={18} /></button>
            </div>

            {pushSupported() && pushState !== "subscribed" && (
              <button onClick={handleSubscribe} disabled={subscribing}
                className="flex items-center gap-2 text-[13px] font-[600] text-accent bg-accent-weak rounded-[13px] px-4 py-3 mb-3 flex-shrink-0 disabled:opacity-50">
                <BellRing size={15} /> {subscribing ? "Skrur på…" : "Få varsler på denne enheten"}
              </button>
            )}

            <div className="overflow-y-auto -mx-1 px-1">
              {items.length === 0 ? (
                <p className="text-[14px] text-text-3 text-center py-8">Ingen varsler ennå.</p>
              ) : (
                items.map((n, i) => (
                  <div key={n.id} className={cn("py-3", i > 0 && "border-t border-border")}>
                    <p className="text-[14.5px] font-[600] text-fg">{n.title}</p>
                    {n.body && <p className="text-[13px] text-text-3 mt-[2px]">{n.body}</p>}
                    <p className="text-[11.5px] text-text-3 mt-[3px]">
                      {new Date(n.created_at).toLocaleString("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
