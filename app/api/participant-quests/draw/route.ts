import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

const DRAW = 10;
const ACTIVE = 5;

/** Draw quests for the signed-in participant:
 *  10 random regular quests (5 active, 5 queued) + 1 hidden Legendary.
 *  Idempotent — drawing twice returns the existing hand. */
export async function POST(request: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { eventId } = await request.json();
  const admin = supabaseAdmin();

  const { data: event } = await admin
    .from("events").select("id, status, quest_pack_id").eq("id", eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.status !== "active")
    return NextResponse.json({ error: "The host hasn't started the event yet." }, { status: 400 });

  const { data: participant } = await admin
    .from("event_participants").select("id")
    .eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
  if (!participant)
    return NextResponse.json({ error: "Join the event first." }, { status: 403 });

  // already drawn? return the existing hand (idempotent)
  const { data: existing } = await admin
    .from("participant_quests")
    .select("id, quest_id, status, drawn_at, activated_at, quests(*)")
    .eq("event_participant_id", participant.id);
  if (existing && existing.length > 0) {
    return NextResponse.json({ quests: toLocal(existing, eventId) });
  }

  const { data: pool } = await admin
    .from("quests").select("*").eq("quest_pack_id", event.quest_pack_id);
  if (!pool || pool.length === 0)
    return NextResponse.json({ error: "This quest pack has no quests. Run the seed script." }, { status: 500 });

  const regular = shuffle(pool.filter((q) => !q.is_legendary)).slice(0, DRAW);
  const legendary = shuffle(pool.filter((q) => q.is_legendary))[0] ?? null;

  const now = new Date().toISOString();
  const rows = regular.map((q, i) => ({
    event_participant_id: participant.id,
    quest_id: q.id,
    status: i < ACTIVE ? "active" : "queued",
    activated_at: i < ACTIVE ? now : null,
  }));
  if (legendary) {
    rows.push({
      event_participant_id: participant.id,
      quest_id: legendary.id,
      status: "locked",
      activated_at: null as unknown as string,
    });
  }

  const { data: inserted, error } = await admin
    .from("participant_quests")
    .insert(rows)
    .select("id, quest_id, status, drawn_at, activated_at, quests(*)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quests: toLocal(inserted ?? [], eventId) });
}

type PQRow = {
  id: string; quest_id: string; status: string;
  drawn_at: string; activated_at: string | null;
  quests: {
    points: number; title: string; description: string | null; category: string;
    is_legendary: boolean; requires_photo: boolean;
  } | null;
};

function toLocal(rows: unknown[], eventId: string) {
  return (rows as PQRow[]).map((r) => ({
    id: r.id,
    event_participant_id: "",
    quest_id: r.quest_id,
    status: r.status,
    drawn_at: r.drawn_at,
    activated_at: r.activated_at,
    event_id: eventId,
    points: r.quests?.points ?? 0,
    title: r.quests?.title ?? "",
    description: r.quests?.description ?? null,
    category: r.quests?.category ?? "general",
    is_legendary: r.quests?.is_legendary ?? false,
    requires_photo: r.quests?.requires_photo ?? false,
  }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
