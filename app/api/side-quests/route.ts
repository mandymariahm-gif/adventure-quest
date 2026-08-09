import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEventPermissions } from "@/lib/event-permissions";
import { awardCurationPoints, CURATION_POINT_VALUES } from "@/lib/curation-points";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (!user || authError) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const formData = await request.formData();
  const eventId = formData.get("eventId") as string;
  const title = formData.get("title") as string;
  const photo = formData.get("photo") as File | null;

  if (!eventId || !title) {
    return NextResponse.json({ error: "Missing eventId or title." }, { status: 400 });
  }

  const admin2 = supabaseAdmin();
  const { data: membership } = await admin2
    .from("event_participants").select("id")
    .eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a participant." }, { status: 403 });

  // Check if event allows side quests (active or curation)
  const { data: event } = await admin2
    .from("events").select("status, curation_ends_at").eq("id", eventId).single();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const bytes = await photo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const path = `side-quests/${eventId}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await admin2.storage
      .from("photos").upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (!upErr) {
      photoUrl = admin2.storage.from("photos").getPublicUrl(path).data.publicUrl;
    }
  }

  const { data, error } = await admin2
    .from("side_quests")
    .insert({ event_id: eventId, user_id: user.id, title, photo_url: photoUrl })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ✅ Award curation points for adding a side quest during curation
  const perms = getEventPermissions(event.status, event.curation_ends_at, false);
  if (perms.canEarnCurationPoints) {
    await awardCurationPoints(admin2, eventId, user.id, CURATION_POINT_VALUES.ADD_SIDE_QUEST, "add_side_quest");
  }

  return NextResponse.json({ sideQuest: data });
}