import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import type { ScrapbookStats } from "@/lib/types";

/** Ending an event: locks new completions, builds the scrapbook
 *  (timeline + stats + champion), and awards achievements. */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: event } = await admin
    .from("events").select("id, host_id, status, event_date").eq("id", params.id).single();
  if (!event || event.host_id !== user.id)
    return NextResponse.json({ error: "Only the host can end the event." }, { status: 403 });
  if (event.status !== "active")
    return NextResponse.json({ error: "Event is not active." }, { status: 400 });

  await admin.from("events")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", params.id);

  // gather everything for the scrapbook
  const { data: participants } = await admin
    .from("event_participants")
    .select("id, user_id, users(display_name)")
    .eq("event_id", params.id);
  const partById = new Map((participants ?? []).map((p) => [p.id, p]));

  const { data: completions } = await admin
    .from("quest_completions")
    .select("id, photo_url, text_note, completed_at, participant_quests!inner(event_participant_id, quests(title, points, is_legendary))")
    .in("participant_quest_id",
      (await admin.from("participant_quests").select("id")
        .in("event_participant_id", (participants ?? []).map((p) => p.id))
      ).data?.map((r) => r.id) ?? []
    )
    .order("completed_at", { ascending: true });

  type CompletionRow = {
    id: string; photo_url: string | null; text_note: string | null; completed_at: string;
    participant_quests: {
      event_participant_id: string;
      quests: { title: string; points: number; is_legendary: boolean } | null;
    } | null;
  };
  const rows = (completions ?? []) as unknown as CompletionRow[];

  const pointsByUser = new Map<string, number>();
  const timeline: ScrapbookStats["timeline"] = [];
  let totalPhotos = 0;
  let totalPoints = 0;

  for (const c of rows) {
    const pq = c.participant_quests;
    if (!pq?.quests) continue;
    const part = partById.get(pq.event_participant_id);
    if (!part) continue;
    const displayName =
      (part as unknown as { users: { display_name: string | null } | null }).users?.display_name ?? "Friend";
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

  const leaderboard = [...pointsByUser.entries()]
    .map(([user_id, points]) => ({
      user_id,
      points,
      display_name:
        (participants ?? [])
          .map((p) => p as unknown as { user_id: string; users: { display_name: string | null } | null })
          .find((p) => p.user_id === user_id)?.users?.display_name ?? "Friend",
    }))
    .sort((a, b) => b.points - a.points);

  const stats: ScrapbookStats = {
    total_completions: rows.length,
    total_photos: totalPhotos,
    total_points: totalPoints,
    participant_count: participants?.length ?? 0,
    leaderboard,
    timeline,
  };

  const champion = leaderboard[0]?.user_id ?? null;

  await admin.from("scrapbooks").upsert(
    {
      event_id: params.id,
      stats_json: stats as unknown as Record<string, unknown>,
      champion_user_id: champion,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" }
  );

  // achievements: champion + season regular
  const { data: achievements } = await admin.from("achievements").select("id, code");
  const achId = (code: string) => achievements?.find((a) => a.code === code)?.id;

  if (champion && achId("champion")) {
    await admin.from("user_achievements")
      .upsert({ user_id: champion, achievement_id: achId("champion")! }, { onConflict: "user_id,achievement_id", ignoreDuplicates: true });
  }
  for (const p of participants ?? []) {
    const { count } = await admin
      .from("event_participants").select("id", { count: "exact", head: true })
      .eq("user_id", p.user_id);
    if ((count ?? 0) >= 3 && achId("regular")) {
      await admin.from("user_achievements")
        .upsert({ user_id: p.user_id, achievement_id: achId("regular")! }, { onConflict: "user_id,achievement_id", ignoreDuplicates: true });
    }
  }

  return NextResponse.json({ ok: true });
}
