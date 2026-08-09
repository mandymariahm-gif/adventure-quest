import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEventPermissions } from "@/lib/event-permissions";

export const dynamic = "force-dynamic";

// Default awards for every event
const DEFAULT_AWARDS = [
  { award_code: "best_photo",      award_emoji: "📸", award_label: "Best Photo" },
  { award_code: "funniest",        award_emoji: "😂", award_label: "Funniest Moment" },
  { award_code: "most_wholesome",  award_emoji: "🥹", award_label: "Most Wholesome" },
  { award_code: "quest_master",    award_emoji: "🎯", award_label: "Quest Master" },
  { award_code: "main_character",  award_emoji: "🔥", award_label: "Main Character" },
  { award_code: "mvp",             award_emoji: "🏅", award_label: "MVP of the Event" },
  { award_code: "most_random",     award_emoji: "🐸", award_label: "Most Random Moment" },
  { award_code: "best_group",      award_emoji: "👯", award_label: "Best Group Photo" },
];

/** GET — fetch awards and nominations for an event */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const admin = supabaseAdmin();

  // Ensure default awards exist for this event
  const { data: existing } = await admin
    .from("community_awards")
    .select("award_code")
    .eq("event_id", eventId);

  const existingCodes = new Set((existing ?? []).map((a: any) => a.award_code));
  const missing = DEFAULT_AWARDS.filter((a) => !existingCodes.has(a.award_code));

  if (missing.length > 0) {
    await admin.from("community_awards").insert(
      missing.map((a) => ({ ...a, event_id: eventId }))
    );
  }

  const { data: awards } = await admin
    .from("community_awards")
    .select("id, award_code, award_emoji, award_label, winner_user_id, finalized_at")
    .eq("event_id", eventId)
    .order("created_at");

  const { data: nominations } = await admin
    .from("award_nominations")
    .select("id, award_code, nominated_user_id, nominated_by_user_id, photo_id, photo_type, users!award_nominations_nominated_user_id_fkey(display_name)")
    .eq("event_id", eventId);

  return NextResponse.json({ awards: awards ?? [], nominations: nominations ?? [] });
}

/** POST — nominate someone for an award */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (!user || authError) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { awardCode, nominatedUserId, photoId, photoType, eventId } = await request.json();

  if (!awardCode || !nominatedUserId || !eventId) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Can't nominate yourself
  if (nominatedUserId === user.id) {
    return NextResponse.json({ error: "You can't nominate yourself!" }, { status: 400 });
  }

  // Verify event is in curation
  const { data: event } = await admin
    .from("events").select("status, curation_ends_at").eq("id", eventId).single();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const perms = getEventPermissions(event.status, event.curation_ends_at, false);
  if (!perms.canVote) {
    return NextResponse.json({ error: "Awards are only open during Memory Week." }, { status: 403 });
  }

  // Upsert — one nomination per award per person (can change their vote)
  const { data, error } = await admin
    .from("award_nominations")
    .upsert({
      event_id: eventId,
      award_code: awardCode,
      nominated_user_id: nominatedUserId,
      nominated_by_user_id: user.id,
      photo_id: photoId ?? null,
      photo_type: photoType ?? null,
    }, { onConflict: "event_id,award_code,nominated_by_user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check achievements
  const { checkCurationAchievements } = await import("@/lib/check-achievements");
  await checkCurationAchievements(admin, user.id, eventId);
  
  return NextResponse.json({ nomination: data });
}