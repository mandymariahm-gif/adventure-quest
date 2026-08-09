import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEventPermissions } from "@/lib/event-permissions";
import { awardCurationPoints, CURATION_POINT_VALUES } from "@/lib/curation-points";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: reactions } = await admin
    .from("photo_reactions")
    .select("id, photo_id, photo_type, user_id, reaction_type")
    .eq("event_id", eventId);

  return NextResponse.json({ reactions: reactions ?? [] });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (!user || authError) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { photoId, photoType, reactionType, eventId } = await request.json();

  if (!photoId || !photoType || !reactionType || !eventId) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const { data: event } = await admin
    .from("events").select("status, curation_ends_at").eq("id", eventId).single();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const perms = getEventPermissions(event.status, event.curation_ends_at, false);
  if (!perms.canVote) {
    return NextResponse.json({ error: "Reactions are not allowed at this time." }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("photo_reactions").select("id")
    .eq("photo_id", photoId).eq("photo_type", photoType)
    .eq("user_id", user.id).eq("reaction_type", reactionType).maybeSingle();

  if (existing) {
    await admin.from("photo_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ action: "removed" });
  } else {
    // Anti-abuse: max 20 reactions per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await admin
      .from("photo_reactions").select("id", { count: "exact", head: true })
      .eq("event_id", eventId).eq("user_id", user.id).gte("created_at", today.toISOString());

    if ((count ?? 0) >= 20) {
      return NextResponse.json({ error: "You've reacted a lot today — come back tomorrow!" }, { status: 429 });
    }

    await admin.from("photo_reactions").insert({
      photo_id: photoId, photo_type: photoType,
      user_id: user.id, reaction_type: reactionType, event_id: eventId,
    });

    // ✅ Award curation points for reacting (max 10/day tracked via reaction count)
    const { count: todayCount } = await admin
      .from("photo_reactions").select("id", { count: "exact", head: true })
      .eq("event_id", eventId).eq("user_id", user.id).gte("created_at", today.toISOString());

    if ((todayCount ?? 0) <= 10) {
      await awardCurationPoints(admin, eventId, user.id, CURATION_POINT_VALUES.REACT_TO_PHOTO, "react_to_photo");
    }

// Check achievements
  const { checkCurationAchievements } = await import("@/lib/check-achievements");
  await checkCurationAchievements(admin, user.id, eventId);
  
    return NextResponse.json({ action: "added" });
  }
}