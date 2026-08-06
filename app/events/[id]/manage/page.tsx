"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabaseBrowser } from "@/lib/supabase/client";
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

  useEffect(() => {
    if (!event) return;
    const url = `${window.location.origin}/join/${event.invite_code}`;
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#1D1610", light: "#F3EAD8" } })
      .then(setQr).catch(() => {});
  }, [event]);

  async function transition(action: "start" | "end") {
    if (action === "end" && !confirm("End the event? This locks new quest completions and builds the scrapbook.")) return;
    setBusy(true);
    const res = await fetch(`/api/events/${id}/${action}`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      if (action === "end") router.push(`/scrapbook/${id}`);
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

  return (
    <main className="mx-auto max-w-md p-5 pb-24">
      <header className="flex items-center gap-3 py-3">
        <button onClick={() => router.push("/dashboard")} className="btn-ghost !min-h-[40px] !px-3 text-sm" aria-label="Back">←</button>
        <div>
          <h1 className="text-2xl leading-tight">{event.name}</h1>
          <p className="text-sm text-paper/60">
            {event.status === "draft" && "Draft — share the invite, then start when everyone's here."}
            {event.status === "active" && "● Live — quests are unlocked."}
            {event.status === "ended" && "Ended."}
          </p>
        </div>
      </header>

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
              End event &amp; build scrapbook
            </button>
          </>
        )}
        {event.status === "ended" && (
          <a href={`/scrapbook/${event.id}`} className="btn-primary">View scrapbook</a>
        )}
      </div>
    </main>
  );
}
