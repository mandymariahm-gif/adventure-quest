import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET — fetch existing participant quests for hydrating local DB */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (!user || authError) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId." }, { status: 400 });

  const { data: participant } = await admin
    .from("event_participants").select("id")
    .eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
  if (!participant) return NextResponse.json({ quests: [] });

  const { data: existing } = await admin
    .from("participant_quests")
    .select("id, quest_id, status, drawn_at, activated_at, quests(*)")
    .eq("event_participant_id", participant.id);

  return NextResponse.json({ quests: toLocal(existing ?? [], eventId) });
}

/** POST — backward compat */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (!user || authError) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { eventId } = await request.json();

  const { data: participant } = await admin
    .from("event_participants").select("id")
    .eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
  if (!participant) return NextResponse.json({ error: "Join the event first." }, { status: 403 });

  const { data: existing } = await admin
    .from("participant_quests")
    .select("id, quest_id, status, drawn_at, activated_at, quests(*)")
    .eq("event_participant_id", participant.id);

  return NextResponse.json({ quests: toLocal(existing ?? [], eventId) });
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