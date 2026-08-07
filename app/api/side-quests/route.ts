import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

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

  // Verify user is a participant
  const { data: membership } = await admin
    .from("event_participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a participant." }, { status: 403 });

  // Upload photo if provided
  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const bytes = await photo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const path = `side-quests/${eventId}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await admin.storage
      .from("photos")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (!upErr) {
      photoUrl = admin.storage.from("photos").getPublicUrl(path).data.publicUrl;
    }
  }

  const { data, error } = await admin
    .from("side_quests")
    .insert({ event_id: eventId, user_id: user.id, title, photo_url: photoUrl })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sideQuest: data });
}