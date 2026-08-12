import { SupabaseClient } from "@supabase/supabase-js";
import type { ScrapbookStats } from "@/lib/types";

export async function generateScrapbook(
  admin: SupabaseClient,
  eventId: string
): Promise<void> {
  // Participants
  const { data: participants } = await admin
    .from("event_participants")
    .select("id, user_id, curation_points, users(display_name)")
    .eq("event_id", eventId);

  const partById = new Map((participants ?? []).map((p) => [p.id, p]));

  // Completions
  const { data: pqIds } = await admin
    .from("participant_quests").select("id")
    .in("event_participant_id", (participants ?? []).map((p) => p.id));

  const { data: completions } = await admin
    .from("quest_completions")
    .select("id, photo_url, text_note, completed_at, participant_quests!inner(event_participant_id, quests(title, points, is_legendary))")
    .in("participant_quest_id", (pqIds ?? []).map((r) => r.id))
    .order("completed_at", { ascending: true });

  type CompletionRow = {
    id: string; photo_url: string | null; text_note: string | null; completed_at: string;
    participant_quests: {
      event_participant_id: string;
      quests: { title: string; points: number; is_legendary: boolean } | null;
    } | null;
  };
  const rows = (completions ?? []) as unknown as CompletionRow[];

  // Reactions — for sorting community favorites
  const { data: allReactions } = await admin
    .from("photo_reactions")
    .select("photo_id, reaction_type")
    .eq("event_id", eventId);

  const reactionCountMap = new Map<string, number>();
  for (const r of allReactions ?? []) {
    reactionCountMap.set(r.photo_id, (reactionCountMap.get(r.photo_id) ?? 0) + 1);
  }

  // Awards — finalized winners
  const { data: awards } = await admin
    .from("community_awards")
    .select("award_code, award_emoji, award_label, winner_user_id, users(display_name)")
    .eq("event_id", eventId)
    .not("winner_user_id", "is", null);

  const finalizedAwards = (awards ?? []).map((a: any) => ({
    award_code: a.award_code,
    award_emoji: a.award_emoji,
    award_label: a.award_label,
    winner_user_id: a.winner_user_id,
    winner_display_name: a.users?.display_name ?? "Someone",
  }));

  // Build timeline + points
  const pointsByUser = new Map<string, number>();
  const timeline: ScrapbookStats["timeline"] = [];
  let totalPhotos = 0;
  let totalPoints = 0;

  for (const c of rows) {
    const pq = c.participant_quests;
    if (!pq?.quests) continue;
    const part = partById.get(pq.event_participant_id) as any;
    if (!part) continue;
    const displayName = part.users?.display_name ?? "Friend";
    const pts = pq.quests.points;
    totalPoints += pts;
    if (c.photo_url) totalPhotos += 1;
    pointsByUser.set(part.user_id, (pointsByUser.get(part.user_id) ?? 0) + pts);
    timeline.push({
      completed_at: c.completed_at,
      display_name: displayName,
      quest_title: pq.quests.title,
      photo_url: c.photo_url,
      text_note: c.text_note,
      points: pts,
      is_legendary: pq.quests.is_legendary,
    });
  }

  // Community favorite photos — sorted by reaction count
  const communityPhotos = timeline
    .filter((t) => t.photo_url)
    .map((t) => ({
      ...t,
      reaction_count: reactionCountMap.get(t.photo_url!) ?? 0,
    }))
    .sort((a, b) => b.reaction_count - a.reaction_count)
    .slice(0, 12);

  // Leaderboard with curation points
  const leaderboard = [...pointsByUser.entries()]
    .map(([user_id, points]) => {
      const p = (participants ?? []).find((p: any) => p.user_id === user_id) as any;
      return {
        user_id,
        points,
        display_name: p?.users?.display_name ?? "Friend",
      };
    })
    .sort((a, b) => b.points - a.points);

  // Per-participant adventure summaries
  const myAdventures: ScrapbookStats["my_adventures"] = (participants ?? []).map((p: any) => {
    const myCompletions = rows.filter((c) => {
      const pq = c.participant_quests as any;
      return pq?.event_participant_id === p.id;
    });
    const myPoints = pointsByUser.get(p.user_id) ?? 0;
    const myCurationPts = p.curation_points ?? 0;
    const myPhotos = myCompletions.filter((c) => c.photo_url);
    const myBestPhoto = myPhotos
      .map((c) => ({ photo_url: c.photo_url!, reaction_count: reactionCountMap.get(c.photo_url!) ?? 0 }))
      .sort((a, b) => b.reaction_count - a.reaction_count)[0] ?? null;
    const myAwards = finalizedAwards.filter((a) => a.winner_user_id === p.user_id);

    return {
      user_id: p.user_id,
      display_name: p.users?.display_name ?? "Friend",
      quest_points: myPoints,
      curation_points: myCurationPts,
      total_points: myPoints + myCurationPts,
      quests_completed: myCompletions.length,
      photos_taken: myPhotos.length,
      best_photo_url: myBestPhoto?.photo_url ?? null,
      best_photo_reactions: myBestPhoto?.reaction_count ?? 0,
      awards_won: myAwards.map((a) => ({ label: a.award_label, emoji: a.award_emoji })),
    };
  });

  const stats: ScrapbookStats = {
    total_completions: rows.length,
    total_photos: totalPhotos,
    total_points: totalPoints,
    participant_count: participants?.length ?? 0,
    leaderboard,
    timeline,
    community_photos: communityPhotos,
    finalized_awards: finalizedAwards,
    my_adventures: myAdventures,
  };

  const champion = leaderboard[0]?.user_id ?? null;

  await admin.from("scrapbooks").upsert(
    {
      event_id: eventId,
      stats_json: stats as unknown as Record<string, unknown>,
      champion_user_id: champion,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" }
  );
}