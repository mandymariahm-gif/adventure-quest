import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  // Fetch completions joined with quest and participant info
  const { data: completions, error } = await admin
    .from("quest_completions")
    .select(`
      id,
      completed_at,
      photo_url,
      text_note,
      participant_quests!inner (
        points:quests!inner ( points ),
        is_legendary:quests!inner ( is_legendary ),
        quest_title:quests!inner ( title ),
        event_participants!inner (
          event_id,
          display_name:profiles ( display_name )
        )
      )
    `)
    .eq("participant_quests.event_participants.event_id", eventId)
    .order("completed_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten the nested structure
  const activity = (completions ?? []).map((c: any) => ({
    id: c.id,
    completed_at: c.completed_at,
    photo_url: c.photo_url,
    text_note: c.text_note,
    quest_title: c.participant_quests?.quest_title?.title ?? "Quest",
    display_name: c.participant_quests?.event_participants?.display_name?.display_name ?? "Someone",
    points: c.participant_quests?.points?.points ?? 0,
    is_legendary: c.participant_quests?.is_legendary?.is_legendary ?? false,
  }));

  return NextResponse.json({ activity });
}