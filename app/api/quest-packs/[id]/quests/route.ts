import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

/** Verifies the signed-in user owns this pack. Returns the user id, or a response to return early. */
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

/** Adds a new quest to the pack, placed at the end of the current order. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOwner(params.id);
  if (auth.error) return auth.error;
  const { admin } = auth;

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Quest title is required." }, { status: 400 });

  const { data: existing } = await admin
    .from("quests").select("position").eq("quest_pack_id", params.id)
    .order("position", { ascending: false }).limit(1);
  const nextPosition = existing?.[0] ? existing[0].position + 1 : 0;

  const { data: quest, error } = await admin
    .from("quests")
    .insert({
      quest_pack_id: params.id,
      title,
      description: body.description || null,
      category: String(body.category ?? "").trim() || "general",
      points: Math.max(1, Number(body.points) || 10),
      is_legendary: Boolean(body.is_legendary),
      requires_photo: Boolean(body.requires_photo),
      requires_verification: Boolean(body.requires_verification),
      requires_voting: Boolean(body.requires_voting),
      position: nextPosition,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quest });
}
