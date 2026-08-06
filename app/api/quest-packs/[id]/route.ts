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
