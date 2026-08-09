import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import FinalReveal from "@/components/scrapbook/FinalReveal";
import type { ScrapbookStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RevealPage({ params }: { params: { eventId: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = supabaseAdmin();
  const { data: membership } = await admin
    .from("event_participants").select("id, curation_points")
    .eq("event_id", params.eventId).eq("user_id", user.id).maybeSingle();
  if (!membership) redirect("/dashboard");

  const { data: event } = await admin
    .from("events").select("name, status")
    .eq("id", params.eventId).single();
  if (!event || event.status !== "locked") redirect(`/scrapbook/${params.eventId}`);

  const { data: scrapbook } = await admin
    .from("scrapbooks").select("stats_json")
    .eq("event_id", params.eventId).maybeSingle();

  const stats = (scrapbook?.stats_json ?? null) as ScrapbookStats | null;

  // Fetch all participants with curation points
  const { data: participantsRaw } = await admin
    .from("event_participants")
    .select("user_id, curation_points, users(display_name)")
    .eq("event_id", params.eventId);

  const cpMap = new Map(
    (participantsRaw ?? []).map((p: any) => [p.user_id, p.curation_points ?? 0])
  );

  // Build adventure score leaderboard
  const leaderboard = (stats?.leaderboard ?? []).map((l) => ({
    display_name: l.display_name,
    quest_points: l.points,
    curation_points: cpMap.get(l.user_id) ?? 0,
    total: l.points + (cpMap.get(l.user_id) ?? 0),
  })).sort((a, b) => b.total - a.total);

  const champion = leaderboard[0] ?? null;

  // Fetch finalized awards with winner names
  const { data: awardsRaw } = await admin
    .from("community_awards")
    .select("award_emoji, award_label, winner_user_id, users(display_name)")
    .eq("event_id", params.eventId)
    .not("winner_user_id", "is", null);

  const awards = (awardsRaw ?? []).map((a: any) => ({
    award_emoji: a.award_emoji,
    award_label: a.award_label,
    winner_display_name: a.users?.display_name ?? null,
  }));

  return (
    <FinalReveal
      eventName={event.name}
      eventId={params.eventId}
      totalQuests={stats?.total_completions ?? 0}
      totalPhotos={stats?.total_photos ?? 0}
      totalParticipants={stats?.participant_count ?? 0}
      leaderboard={leaderboard}
      awards={awards}
      champion={champion}
    />
  );
}
