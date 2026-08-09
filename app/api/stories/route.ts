import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEventPermissions } from "@/lib/event-permissions";

export const dynamic = "force-dynamic";

/** GET — fetch all stories for an event */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: stories } = await admin
    .from("photo_stories")
    .select("id, photo_id, photo_type, user_id, story_text, created_at, users(display_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ stories: stories ?? [] });
}

/** POST — add or update a story */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (!user || authError) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { photoId, photoType, storyText, eventId } = await request.json();

  if (!photoId || !photoType || !storyText?.trim() || !eventId) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Verify event is in curation and curation is still open
  const { data: event } = await admin
    .from("events")
    .select("status, curation_ends_at")
    .eq("id", eventId)
    .single();

  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const perms = getEventPermissions(event.status, event.curation_ends_at, false);
  if (!perms.canAddStory) {
    return NextResponse.json({ error: "Stories can only be added during Memory Week." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("photo_stories")
    .upsert({
      photo_id: photoId,
      photo_type: photoType,
      user_id: user.id,
      event_id: eventId,
      story_text: storyText.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "photo_id,photo_type,user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ story: data });
}