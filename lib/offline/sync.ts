"use client";
import { localDB } from "./db";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { SyncMutation } from "@/lib/types";

/**
 * Sync strategy (see architecture doc §5.3):
 *  - every action writes to IndexedDB first (optimistic UI)
 *  - a persistent queue holds unsynced mutations in order
 *  - metadata syncs first; photo bytes ride along per-mutation but are
 *    compressed hard client-side so a flaky zoo connection can cope
 *  - mutation ids are client-generated UUIDs, so retries are idempotent —
 *    the server upserts by id and can never double-award points
 */

let flushing = false;

export async function enqueue(mutation: SyncMutation, photoBlob?: Blob) {
  await localDB.queue.put(mutation);
  if (photoBlob) {
    await localDB.photos.put({ mutation_id: mutation.id, blob: photoBlob });
  }
  void flushQueue();
}

export async function pendingCount(): Promise<number> {
  return localDB.queue.count();
}

export async function flushQueue(): Promise<void> {
  if (flushing || typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    const items = await localDB.queue.toArray();
    if (items.length === 0) return;

    // ✅ FIX — get the session token and send it as Bearer so the
    // server can verify the user without relying on cookies
    const supabase = supabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return; // not signed in, keep queue

    const batch: SyncMutation[] = [];
    for (const item of items) {
      if (item.type === "completion") {
        const photo = await localDB.photos.get(item.id);
        if (photo) {
          item.photo_base64 = await blobToBase64(photo.blob);
        }
      }
      batch.push(item);
    }

    const res = await fetch("/api/sync/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ mutations: batch }),
    });
    if (!res.ok) return; // keep the queue; we'll retry on the next trigger

    const { applied } = (await res.json()) as { applied: string[] };
    await localDB.queue.bulkDelete(applied);
    await localDB.photos.bulkDelete(applied);
    window.dispatchEvent(new CustomEvent("aq:synced"));
  } catch {
    // offline or server hiccup — the queue persists, we retry later
  } finally {
    flushing = false;
  }
}

export function registerSyncTriggers() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => void flushQueue());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushQueue();
  });
  // periodic safety net
  setInterval(() => void flushQueue(), 30_000);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.substring(url.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Downscale + JPEG-compress a photo so offline storage and upload stay small. */
export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality)
  );
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}