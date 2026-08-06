import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

const CATEGORY_QUOTAS: Record<string, number> = {
  beer:         3,
  zoo:          2,
  creative:     2,
  adventure:    1,
  friendship:   1,
  photography:  1,
};
const TOTAL_DRAW = 10;

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
    return NextResponse.json({ error: "No quests found. Run the seed script." }, { status: 500 });

  const regular = pool.filter((q) => !q.is_legendary);
  const legendary = shuffle(pool.filter((q) => q.is_legendary))[0] ?? null;

  const selected: typeof regular = [];
  const overflow: typeof regular = [];

  const byCategory: Record<string, typeof regular> = {};
  for (const q of regular) {
    const cat = q.category ?? "other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(q);
  }

  for (const [cat, quota] of Object.entries(CATEGORY_QUOTAS)) {
    const bucket = shuffle(byCategory[cat] ?? []);
    selected.push(...bucket.slice(0, quota));
    overflow.push(...bucket.slice(quota));
  }

  for (const [cat, bucket] of Object.entries(byCategory)) {
    if (!(cat in CATEGORY_QUOTAS)) overflow.push(...bucket);
  }

  const remaining = TOTAL_DRAW - selected.length;
  if (remaining > 0) selected.push(...shuffle(overflow).slice(0, remaining));

  const now = new Date().toISOString();
  const rows: { event_participant_id: string; quest_id: string; status: string; activated_at: string | null }[] =
    selected.slice(0, TOTAL_DRAW).map((q) => ({
      event_participant_id: participant.id,
      quest_id: q.id,
      status: "active",
      activated_at: now,
    }));

  if (legendary) {
    rows.push({
      event_participant_id: participant.id,
      quest_id: legendary.id,
      status: "locked",
      activated_at: null,
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