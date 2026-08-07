"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { localDB, type LocalQuestState } from "@/lib/offline/db";
import QuestDetailSheet from "@/components/quest/QuestDetailSheet";
import TimeCapsulePreview from "@/components/quest/TimeCapsulePreview";
import type { EventRow } from "@/lib/types";

const LEGENDARY_TRIGGER = 5;

export default function QuestBoard() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [quests, setQuests] = useState<LocalQuestState[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [selected, setSelected] = useState<LocalQuestState | null>(null);
  const [error, setError] = useState("");

  const refreshLocal = useCallback(async () => {
    const rows = await localDB.myQuests.where("event_id").equals(eventId).toArray();
    setQuests(rows);
  }, [eventId]);

  useEffect(() => {
    void refreshLocal();
    const supabase = supabaseBrowser();
    supabase.from("events").select("*").eq("id", eventId).single()
      .then(({ data }) => setEvent(data));

    (async () => {
      if (!navigator.onLine) return;
      try {
        const res = await fetch(`/api/participant-quests?eventId=${eventId}`);
        if (!res.ok) return;
        const { quests: serverQuests } = await res.json();
        if (Array.isArray(serverQuests) && serverQuests.length > 0) {
          await localDB.myQuests.where("event_id").equals(eventId).delete();
          await localDB.myQuests.bulkPut(serverQuests);
          await refreshLocal();
        }
      } catch { /* offline — local state stands */ }
    })();

    const onSync = () => void refreshLocal();
    window.addEventListener("aq:synced", onSync);
    return () => window.removeEventListener("aq:synced", onSync);
  }, [eventId, refreshLocal]);

  const completedCount = useMemo(() => quests.filter((q) => q.status === "completed").length, [quests]);
  const points = useMemo(
    () => quests.filter((q) => q.status === "completed").reduce((s, q) => s + q.points, 0),
    [quests]
  );
  const active = quests.filter((q) => q.status === "active" && !q.is_legendary);
  const legendary = quests.find((q) => q.is_legendary);
  const legendaryUnlocked = completedCount >= LEGENDARY_TRIGGER;
  const doneList = quests.filter((q) => q.status === "completed");

  async function drawQuests() {
    setDrawing(true);
    setError("");

    if (!navigator.onLine) {
      setError("You need a connection to draw your first quests — find some signal and try again!");
      setDrawing(false);
      return;
    }

    try {
      const res = await fetch("/api/participant-quests/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't draw quests.");
      await localDB.myQuests.bulkPut(data.quests);
      await refreshLocal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draw quests — check your connection and try again.");
    } finally {
      setDrawing(false);
    }
  }

  const onCompleted = useCallback(async (pqId: string) => {
    await localDB.myQuests.update(pqId, { status: "completed" });
    const all = await localDB.myQuests.where("event_id").equals(eventId).toArray();
    const done = all.filter((q) => q.status === "completed").length;
    const leg = all.find((q) => q.is_legendary && q.status === "locked");
    if (leg && done >= LEGENDARY_TRIGGER) {
      await localDB.myQuests.update(leg.id, { status: "active", activated_at: new Date().toISOString() });
    }
    setSelected(null);
    await refreshLocal();
  }, [eventId, refreshLocal]);

  if (event && event.status === "ended") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl">The night is a wrap</h1>
        <p className="text-paper/70">The scrapbook is ready — and your Time Capsule is waiting.</p>
        <Link href={`/scrapbook/${eventId}`} className="btn-primary">Open the scrapbook</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-5 pb-28">
      <header className="flex items-center justify-between py-3">
        <Link href="/dashboard" className="btn-ghost !min-h-[44px] !px-3 text-sm">← Back</Link>
        <div className="text-center">
          <h1 className="text-xl leading-tight">{event?.name ?? "Quest Board"}</h1>
          <p className="text-sm text-paper/60">{completedCount} done</p>
        </div>
        <div className="rounded-full bg-amber px-4 py-2 font-display text-lg text-ink" aria-label={`${points} points`}>
          {points} pts
        </div>
      </header>

      {quests.length === 0 ? (
        <section className="mt-10 text-center">
          <h2 className="text-2xl">Ready to play?</h2>
          <p className="mx-auto mt-2 max-w-xs text-paper/70">
            You&apos;ll draw 10 quests — all active from the start. Complete any of them in any order. One hidden Legendary Quest is riding along.
          </p>
          <button className="btn-primary mt-6 w-full" onClick={drawQuests} disabled={drawing || event?.status !== "active"}>
            {drawing ? "Shuffling the deck…" : event?.status === "active" ? "Draw my quests" : "Waiting for the host to start…"}
          </button>
          {error && <p role="alert" className="mt-3 text-sm text-lantern">{error}</p>}
        </section>
      ) : (
        <>
          <section aria-label="Active quests" className="mt-2">
            <h2 className="font-display text-sm uppercase tracking-[0.25em] text-fern">
              Active quests ({active.length})
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {active.map((q) => (
                <li key={q.id}>
                  <button className="ticket w-full p-4 text-left" onClick={() => setSelected(q)}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-display leading-tight">{q.title}</p>
                        <p className="mt-0.5 text-xs uppercase tracking-wide text-ink/50">
                          {q.category} · {q.points} pts{q.requires_photo ? " · 📷" : ""}
                        </p>
                      </div>
                      <span aria-hidden className="text-ink/40">›</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {legendary && (
            <section className="mt-6" aria-label="Legendary quest">
              {legendaryUnlocked || legendary.status !== "locked" ? (
                legendary.status === "completed" ? (
                  <div className="ticket ticket-legendary p-4">
                    <p className="font-display">⭐ {legendary.title}</p>
                    <p className="text-sm text-ink/70">Legendary — complete. Well played.</p>
                  </div>
                ) : (
                  <button className="ticket ticket-legendary w-full p-4 text-left" onClick={() => setSelected(legendary)}>
                    <p className="font-display">⭐ {legendary.title}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-ink/60">
                      Legendary · {legendary.points} pts — unlocked!
                    </p>
                  </button>
                )
              ) : (
                <div className="ticket p-4 opacity-80">
                  <p className="font-display">⭐ Legendary Quest — locked</p>
                  <p className="text-sm text-ink/60">
                    Complete {LEGENDARY_TRIGGER - completedCount} more quest
                    {LEGENDARY_TRIGGER - completedCount === 1 ? "" : "s"} to reveal it.
                  </p>
                </div>
              )}
            </section>
          )}

          {doneList.length > 0 && (
            <section className="mt-6" aria-label="Completed quests">
              <h2 className="font-display text-sm uppercase tracking-[0.25em] text-fern">Completed</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {doneList.map((q) => (
                  <li key={q.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span className="text-paper/80">✓ {q.title}</span>
                    <span className="text-paper/50">{q.points} pts</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Time capsule preview */}
          <TimeCapsulePreview />
        </>
      )}

      {/* ✅ Activity added to bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-pine/95 backdrop-blur" aria-label="Main">
        <div className="mx-auto flex max-w-md justify-around py-2">
          <span className="btn-ghost !min-h-[44px] !bg-white/15 text-sm">Quests</span>
          <Link className="btn-ghost !min-h-[44px] text-sm" href={`/activity/${eventId}`}>Activity</Link>
          <Link className="btn-ghost !min-h-[44px] text-sm" href={`/scrapbook/${eventId}`}>Scrapbook</Link>
          <Link className="btn-ghost !min-h-[44px] text-sm" href="/profile">Profile</Link>
        </div>
      </nav>

      {selected && (
        <QuestDetailSheet quest={selected} onClose={() => setSelected(null)} onCompleted={onCompleted} />
      )}
    </main>
  );
}
