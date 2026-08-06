import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

function inviteCode(): string {
  // short, unambiguous, easy to read aloud at a party
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function POST(request: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Event name is required." }, { status: 400 });
  const limit = Math.min(200, Math.max(2, Number(body.participant_limit) || 20));

  const admin = supabaseAdmin();
  const { data: pack } = await admin
    .from("quest_packs").select("id").eq("id", body.quest_pack_id).maybeSingle();
  if (!pack) return NextResponse.json({ error: "Choose a valid quest pack." }, { status: 400 });

  const { data: event, error } = await admin
    .from("events")
    .insert({
      host_id: user.id,
      quest_pack_id: pack.id,
      name,
      location: body.location || null,
      event_date: body.event_date || null,
      description: body.description || null,
      participant_limit: limit,
      invite_code: inviteCode(),
      status: "draft",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("event_participants").insert({ event_id: event.id, user_id: user.id, role: "host" });
  return NextResponse.json({ event });
}
