import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

/** Full pack content, used for offline pre-caching when a participant joins. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: pack } = await admin.from("quest_packs").select("*").eq("id", params.id).maybeSingle();
  if (!pack) return NextResponse.json({ error: "Pack not found." }, { status: 404 });
  const { data: quests } = await admin.from("quests").select("*").eq("quest_pack_id", params.id);
  return NextResponse.json({ pack, quests: quests ?? [] });
}

/** Updates any subset of a pack's own fields (not its quests — see the quests routes for that). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: pack } = await admin.from("quest_packs").select("owner_id").eq("id", params.id).maybeSingle();
  if (!pack) return NextResponse.json({ error: "Pack not found." }, { status: 404 });
  if (pack.owner_id !== user.id) {
    return NextResponse.json({ error: "You don't own this pack." }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Pack name is required." }, { status: 400 });
    updates.name = name;
  }
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.cover_art_url !== undefined) updates.cover_art_url = body.cover_art_url || null;
  if (body.theme_json !== undefined) updates.theme_json = body.theme_json;
  if (body.is_public !== undefined) updates.is_public = Boolean(body.is_public);

  const { data: updated, error } = await admin
    .from("quest_packs").update(updates).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pack: updated });
}
