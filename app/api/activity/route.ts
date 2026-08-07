import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const admin = supabaseAdmin();

  // Fetch all participants with display names
  const { data: participants } = await admin
    .from("event_participants")
    .select("id, user_id, users ( display_name )")
    .eq("event_id", eventId);

  const participantMap = new Map(
    (participants ?? []).map((p: any) => [p.id, p.users?.display_name ?? "Someone"])
  );
  const userMap = new Map(
    (participants ?? []).map((p: any) => [p.user_id, p.users?.display_name ?? "Someone"])
  );

  const participantIds = (participants ?? []).map((p: any) => p.id);

  // Fetch quest completions
  let completionItems: any[] = [];
  if (participantIds.length > 0) {
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

    if (pquestIds.length > 0) {
      const { data: completions } = await admin
        .from("quest_completions")
        .select("id, completed_at, photo_url, text_note, participant_quest_id")
        .in("participant_quest_id", pquestIds)
        .order("completed_at", { ascending: false })
        .limit(50);

      completionItems = (completions ?? []).map((c: any) => {
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
          is_side_quest: false,
        };
      });
    }
  }

  // Fetch side quests
  const { data: sideQuests } = await admin
    .from("side_quests")
    .select("id, created_at, photo_url, title, user_id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(50);

  const sideQuestItems = (sideQuests ?? []).map((s: any) => ({
    id: s.id,
    completed_at: s.created_at,
    photo_url: s.photo_url,
    text_note: null,
    quest_title: s.title,
    display_name: userMap.get(s.user_id) ?? "Someone",
    points: 0,
    is_legendary: false,
    is_side_quest: true,
  }));

  // Merge and sort by time descending
  const activity = [...completionItems, ...sideQuestItems].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  ).slice(0, 80);

  return NextResponse.json({ activity });
}