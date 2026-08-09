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
  const completionId = formData.get("completionId") as string;
  const eventId = formData.get("eventId") as string;
  const photo = formData.get("photo") as File | null;

  if (!completionId || !eventId || !photo) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const { data: event } = await admin
    .from("events").select("status, curation_ends_at").eq("id", eventId).single();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const perms = getEventPermissions(event.status, event.curation_ends_at, false);
  if (!perms.canUploadQuestPhoto) {
    return NextResponse.json({ error: "Photo uploads are not allowed at this time." }, { status: 403 });
  }

  const { data: completion } = await admin
    .from("quest_completions")
    .select("id, photo_url, participant_quests!inner(event_participant_id, event_participants!inner(user_id, event_id))")
    .eq("id", completionId).maybeSingle();

  if (!completion) return NextResponse.json({ error: "Completion not found." }, { status: 404 });

  const ep = (completion as any).participant_quests?.event_participants;
  if (ep?.user_id !== user.id) return NextResponse.json({ error: "You can only add photos to your own completions." }, { status: 403 });
  if (ep?.event_id !== eventId) return NextResponse.json({ error: "Completion does not belong to this event." }, { status: 403 });
  if ((completion as any).photo_url) return NextResponse.json({ error: "This completion already has a photo." }, { status: 400 });

  const bytes = await photo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const path = `${eventId}/curation-${completionId}.jpg`;

  const { error: upErr } = await admin.storage
    .from("photos").upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const photoUrl = admin.storage.from("photos").getPublicUrl(path).data.publicUrl;

  const { error: updateErr } = await admin
    .from("quest_completions").update({ photo_url: photoUrl }).eq("id", completionId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // ✅ Award curation points for adding a missing photo
  await awardCurationPoints(admin, eventId, user.id, CURATION_POINT_VALUES.ADD_MISSING_PHOTO, "add_missing_photo");

  return NextResponse.json({ photoUrl });
}