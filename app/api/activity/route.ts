import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  // Use cookies() to properly read the session in an API route
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    }
  );

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

  // Fetch participant quests for this event
  const participantIds = (participants ?? []).map((p: any) => p.id);
  if (participantIds.length === 0) return NextResponse.json({ activity: [] });

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

  // Fetch completions for those participant quests
  const pquestIds = (pquests ?? []).map((pq: any) => pq.id);
  if (pquestIds.length === 0) return NextResponse.json({ activity: [] });

  const { data: completions, error } = await admin
    .from("quest_completions")
    .select("id, completed_at, photo_url, text_note, participant_quest_id")
    .in("participant_quest_id", pquestIds)
    .order("completed_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten everything together
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