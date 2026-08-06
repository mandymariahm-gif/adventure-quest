import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

/** GET /api/participant-quests?eventId=… — hydrate the local board from the server. */
export async function GET(request: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: participant } = await admin
    .from("event_participants").select("id")
    .eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
  if (!participant) return NextResponse.json({ quests: [] });

  const { data: rows } = await admin
    .from("participant_quests")
    .select("id, quest_id, status, drawn_at, activated_at, quests(*)")
    .eq("event_participant_id", participant.id);

  type PQRow = {
    id: string; quest_id: string; status: string; drawn_at: string; activated_at: string | null;
    quests: {
      points: number; title: string; description: string | null; category: string;
      is_legendary: boolean; requires_photo: boolean;
    } | null;
  };

  const quests = ((rows ?? []) as unknown as PQRow[]).map((r) => ({
    id: r.id,
    event_participant_id: participant.id,
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

  return NextResponse.json({ quests });
}
