import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Renumbers every quest in the pack to match the order sent from the client
 * (0, 1, 2, …). This rewrites all positions on every call rather than
 * swapping two values — that also fixes packs whose quests all share the
 * same position (e.g. the migration backfill defaulted everything to 0).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
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
  const order: string[] = Array.isArray(body.order) ? body.order : [];
  if (order.length === 0) return NextResponse.json({ error: "No order given." }, { status: 400 });

  for (let i = 0; i < order.length; i++) {
    const { error } = await admin
      .from("quests")
      .update({ position: i })
      .eq("id", order[i])
      .eq("quest_pack_id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
