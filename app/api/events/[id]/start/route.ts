import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: event } = await admin.from("events").select("id, host_id, status").eq("id", params.id).single();
  if (!event || event.host_id !== user.id)
    return NextResponse.json({ error: "Only the host can start the event." }, { status: 403 });
  if (event.status !== "draft")
    return NextResponse.json({ error: "Event already started." }, { status: 400 });

  const { error } = await admin
    .from("events")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
