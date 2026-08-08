"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getEventPermissions, formatTimeRemaining } from "@/lib/event-permissions";
import type { EventRow } from "@/lib/types";

interface ParticipantView { id: string; role: string; users: { display_name: string | null } | null }

export default function ManageEvent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantView[]>([]);
  const [completions, setCompletions] = useState(0);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
    setEvent(ev);
    const { data: parts } = await supabase
      .from("event_participants")
      .select("id, role, users(display_name)")
      .eq("event_id", id);
    setParticipants((parts as unknown as ParticipantView[]) ?? []);
    if (parts?.length) {
      const { count } = await supabase
        .from("quest_completions")
        .select("id, participant_quests!inner(event_participant_id)", { count: "exact", head: true })
        .in("participant_quests.event_participant_id", parts.map((p) => p.id));
      setCompletions(count ?? 0);
    }
  }, [id]);

  useEffect(() => { void load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  // Curation countdown ticker
  useEffect(() => {
    if (!event?.curation_ends_at) return;
    const tick = () => {
      const perms = getEventPermissions(event.status, event.curation_ends_at, true);
      if (perms.msRemaining !== null && perms.msRemaining > 0) {
        setTimeRemaining(formatTimeRemaining(perms.msRemaining));
      } else {
        setTimeRemaining(null);
      }
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [event]);

  useEffect(() => {
    if (!event) return;
    const url = `${window.location.origin}/join/${event.invite_code}`;
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#1D1610", light: "#F3EAD8" } })
      .then(setQr).catch(() => {});
  }, [event]);

  async function transition(action: "start" | "end") {
    if (action === "end" && !confirm("End the event? This starts the 7-day Memory Week where participants can add photos and memories.")) return;
    setBusy(true);
    const res = await fetch(`/api/events/${id}/${action}`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      if (action === "end") void load();
      else void load();
    }
  }

  async function copyLink() {
    if (!event) return;
    await navigator.clipboard.writeText(`${window.location.origin}/join/${event.invite_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!event) return <main className="p-6 text-paper/60">Loading…</main>;

  const perms = getEventPermissions(event.status, event.curation_ends_at, true);

  const statusLabel = () => {
    switch (event.status) {
      case "draft":     return "Draft — share the invite, then start when everyone's here.";
      case "active":    return "● Live — quests are unlocked.";
      case "curation":  return timeRemaining
        ? `📸 Memory Week — ${timeRemaining}`
        : "📸 Memory Week is ending soon…";
      case "locked":    return "🔒 Adventure Complete — Memory Week has ended.";
      case "archived":  return "📚 Archived.";
      case "ended":     return "Ended.";
    }
  };

  return (
    <main className="mx-auto max-w-md p-5 pb-24">
      <header className="flex items-center gap-3 py-3">
        <button onClick={() => router.push("/dashboard")} className="btn-ghost !min-h-[40px] !px-3 text-sm" aria-label="Back">←</button>
        <div>
          <h1 className="text-2xl leading-tight">{event.name}</h1>
          <p className="text-sm text-paper/60">{statusLabel()}</p>
        </div>
      </header>

      {/* Curation week banner */}
      {event.status === "curation" && (
        <div className="mb-4 rounded-xl bg-fern/20 border border-fern/30 p-4 text-center">
          <p className="font-display text-sm uppercase tracking-[0.2em] text-fern">📸 Memory Week</p>
          <p className="mt-1 text-sm text-paper/70">
            Participants can add missing photos and side quest moments.
          </p>
          {timeRemaining && (
            <p className="mt-2 font-display text-lg text-amber">⏳ {timeRemaining}</p>
          )}
        </div>
      )}

      {/* Locked banner */}
      {event.status === "locked" && (
        <div className="mb-4 rounded-xl bg-white/10 border border-white/20 p-4 text-center">
          <p className="font-display text-sm uppercase tracking-[0.2em] text-paper/60">🔒 Adventure Complete</p>
          <p className="mt-1 text-sm text-paper/70">
            Memory Week has ended. The scrapbook is now final.
          </p>
        </div>
      )}

      <section className="ticket p-5 text-center">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-ink/60">Invite friends</h2>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code for invite link, code ${event.invite_code}`} className="mx-auto mt-3 w-48 rounded-lg" />
        )}
        <p className="mt-2 font-display text-xl tracking-widest">{event.invite_code}</p>
        <button className="btn-paper mt-3 w-full" onClick={copyLink}>
          {copied ? "Copied!" : "Copy invite link"}
        </button>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-white/10 p-4">
          <p className="font-display text-3xl">{participants.length}</p>
          <p className="text-xs uppercase tracking-wide text-paper/60">Joined</p>
        </div>
        <div className="rounded-xl bg-white/10 p-4">
          <p className="font-display text-3xl">{completions}</p>
          <p className="text-xs uppercase tracking-wide text-paper/60">Quests done</p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-fern">Participants</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span>{p.users?.display_name ?? "Friend"}</span>
              {p.role === "host" && <span className="text-xs uppercase text-amber">Host</span>}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-col gap-3">
        {event.status === "draft" && (
          <button className="btn-primary" onClick={() => transition("start")} disabled={busy}>
            Start event
          </button>
        )}
        {event.status === "active" && (
          <>
            <a href={`/quests/${event.id}`} className="btn-primary">Open my quest board</a>
            <button className="btn-ghost" onClick={() => transition("end")} disabled={busy}>
              End event &amp; start Memory Week
            </button>
          </>
        )}
        {event.status === "curation" && (
          <>
            <a href={`/scrapbook/${event.id}`} className="btn-primary">View scrapbook</a>
            <p className="text-center text-xs text-paper/40">
              Memory Week ends automatically when the timer runs out.
            </p>
          </>
        )}
        {(event.status === "locked" || event.status === "ended") && (
          <a href={`/scrapbook/${event.id}`} className="btn-primary">View scrapbook</a>
        )}
      </div>
    </main>
  );
}
