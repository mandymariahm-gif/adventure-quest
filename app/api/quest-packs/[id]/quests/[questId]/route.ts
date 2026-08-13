import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

async function requireOwner(packId: string) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };

  const admin = supabaseAdmin();
  const { data: pack } = await admin.from("quest_packs").select("owner_id").eq("id", packId).maybeSingle();
  if (!pack) return { error: NextResponse.json({ error: "Pack not found." }, { status: 404 }) };
  if (pack.owner_id !== user.id) {
    return { error: NextResponse.json({ error: "You don't own this pack." }, { status: 403 }) };
  }
  return { userId: user.id, admin };
}

/** Updates any subset of a quest's fields (not position — see the reorder route for that). */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; questId: string } }
) {
  const auth = await requireOwner(params.id);
  if (auth.error) return auth.error;
  const { admin } = auth;

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "Quest title is required." }, { status: 400 });
    updates.title = title;
  }
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.category !== undefined) updates.category = String(body.category).trim() || "general";
  if (body.points !== undefined) updates.points = Math.max(1, Number(body.points) || 10);
  if (body.is_legendary !== undefined) updates.is_legendary = Boolean(body.is_legendary);
  if (body.requires_photo !== undefined) updates.requires_photo = Boolean(body.requires_photo);
  if (body.requires_verification !== undefined) updates.requires_verification = Boolean(body.requires_verification);
  if (body.requires_voting !== undefined) updates.requires_voting = Boolean(body.requires_voting);

  const { data: quest, error } = await admin
    .from("quests")
    .update(updates)
    .eq("id", params.questId)
    .eq("quest_pack_id", params.id) // belt-and-suspenders: can't touch a quest from another pack
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quest });
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string; questId: string } }
) {
  const auth = await requireOwner(params.id);
  if (auth.error) return auth.error;
  const { admin } = auth;

  const { error } = await admin
    .from("quests")
    .delete()
    .eq("id", params.questId)
    .eq("quest_pack_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
