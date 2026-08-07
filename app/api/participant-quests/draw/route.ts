import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  // Verify the user is a participant in this event
  const { data: membership } = await admin
    .from("event_participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  // Fetch all participants in the event with their profiles
  const { data: participants } = await admin
    .from("event_participants")
    .select("id, user_id, profiles ( display_name )")
    .eq("event_id", eventId);

  const participantMap = new Map(
    (participants ?? []).map((p: any) => [
      p.id,
      p.profiles?.display_name ?? "Someone",
    ])
  );

  const participantIds = (participants ?? []).map((p: any) => p.id);
  if (participantIds.length === 0) return NextResponse.json({ activity: [] });

  // Fetch participant quests for this event
  const { data: pquests } = await admin
    .from("participant_quests")
    .select("id, event_participant_id, quests ( title, points, is_legendary )")
    .in("event_participant_id", participantIds);

  const pquestMap = new Map(
    (pquests ?? []).map((pq: any) => [
      pq.id,
      {
        quest_title: pq.quests?.title ?? "Quest",
        points: pq.quests?.points ?? 0,
        is_legendary: pq.quests?.is_legendary ?? false,
        event_participant_id: pq.event_participant_id,
      },
    ])
  );

  const pquestIds = (pquests ?? []).map((pq: any) => pq.id);
  if (pquestIds.length === 0) return NextResponse.json({ activity: [] });

  // Fetch completions
  const { data: completions, error } = await admin
    .from("quest_completions")
    .select("id, completed_at, photo_url, text_note, participant_quest_id")
    .in("participant_quest_id", pquestIds)
    .order("completed_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten into activity items
  const activity = (completions ?? []).map((c: any) => {
    const pq = pquestMap.get(c.participant_quest_id);
    const displayName = pq ? participantMap.get(pq.event_participant_id) : "Someone";
    return {
      id: c.id,
      completed_at: c.completed_at,
      photo_url: c.photo_url,
      text_note: c.text_note,
      quest_title: pq?.quest_title ?? "Quest",
      display_name: displayName ?? "Someone",
      points: pq?.points ?? 0,
      is_legendary: pq?.is_legendary ?? false,
    };
  });

  return NextResponse.json({ activity });
}