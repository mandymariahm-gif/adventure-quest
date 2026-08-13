import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

/** Creates a new quest pack as a private draft. Admin-only — see is_admin on public.users. */
export async function POST(request: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("users").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Only admins can create quest packs." }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Pack name is required." }, { status: 400 });

  const { data: pack, error } = await admin
    .from("quest_packs")
    .insert({
      name,
      description: body.description || null,
      cover_art_url: body.cover_art_url || null,
      owner_id: user.id,
      is_public: false, // starts as a private draft; publish happens later in the builder
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pack });
}
