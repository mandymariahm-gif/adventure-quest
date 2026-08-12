import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { generateScrapbook } from "@/lib/generate-scrapbook";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: event } = await admin
    .from("events").select("id, host_id, status, curation_ends_at").eq("id", params.id).single();

  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.host_id !== user.id) return NextResponse.json({ error: "Only the host can lock the event." }, { status: 403 });
  if (event.status !== "curation") return NextResponse.json({ error: "Event is not in curation." }, { status: 400 });

  // Finalize awards
  const { error } = await admin.rpc("finalize_awards", { p_event_id: params.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lock the event
  await admin.from("events")
    .update({ status: "locked" })
    .eq("id", params.id);

  // Regenerate scrapbook with reactions, stories, awards, achievements
  await generateScrapbook(admin, params.id);

  // Award achievements for all participants
  const { checkCurationAchievements } = await import("@/lib/check-achievements");
  const { data: participants } = await admin
    .from("event_participants").select("user_id").eq("event_id", params.id);
  for (const p of participants ?? []) {
    await checkCurationAchievements(admin, p.user_id, params.id);
  }

  return NextResponse.json({ ok: true });
}