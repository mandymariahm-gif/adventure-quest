"use client";
import { useEffect, useState } from "react";
import { flushQueue, pendingCount, registerSyncTriggers } from "@/lib/offline/sync";

/** Registers the service worker + sync triggers and shows a subtle
 *  "offline — will sync" chip whenever mutations are queued. */
export default function PWASetup() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Only register in production — during `npm run dev` the service worker's
    // cache-first strategy for JS files serves stale code after every edit,
    // fighting Next.js's hot reload. Real (deployed) usage is unaffected.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    registerSyncTriggers();
    void flushQueue();

    const update = async () => setPending(await pendingCount());
    const onOnline = () => { setOnline(true); void update(); };
    const onOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    void update();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("aq:queued", update as EventListener);
    window.addEventListener("aq:synced", update as EventListener);
    const t = setInterval(update, 10_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("aq:queued", update as EventListener);
      window.removeEventListener("aq:synced", update as EventListener);
      clearInterval(t);
    };
  }, []);

  if (online && pending === 0) return null;
  return (
    <div className="sync-chip" role="status" aria-live="polite">
      {online
        ? `Syncing ${pending} item${pending === 1 ? "" : "s"}…`
        : `Offline — ${pending > 0 ? `${pending} saved, ` : ""}will sync when you're back`}
    </div>
  );
}
