import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

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

  // Run the finalize function
  const { error } = await admin.rpc("finalize_awards", { p_event_id: params.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}