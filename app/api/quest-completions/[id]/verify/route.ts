import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

/** Friend verification: any other participant of the same event can vouch. */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: completion } = await admin
    .from("quest_completions")
    .select("id, verified_by, participant_quests!inner(event_participants!inner(user_id, event_id))")
    .eq("id", params.id)
    .maybeSingle();
  if (!completion) return NextResponse.json({ error: "Completion not found." }, { status: 404 });

  const owner = (completion.participant_quests as unknown as {
    event_participants: { user_id: string; event_id: string };
  }).event_participants;

  if (owner.user_id === user.id)
    return NextResponse.json({ error: "You can't verify your own quest — grab a friend." }, { status: 400 });

  const { data: membership } = await admin
    .from("event_participants").select("id")
    .eq("event_id", owner.event_id).eq("user_id", user.id).maybeSingle();
  if (!membership)
    return NextResponse.json({ error: "Only event participants can verify." }, { status: 403 });

  await admin.from("quest_completions").update({ verified_by: user.id }).eq("id", params.id);
  return NextResponse.json({ ok: true });
}
