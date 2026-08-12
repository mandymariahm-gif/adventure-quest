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
    .from("events").select("id, host_id, status").eq("id", params.id).single();

  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.host_id !== user.id) return NextResponse.json({ error: "Hosts only." }, { status: 403 });
  if (event.status !== "locked" && event.status !== "curation") {
    return NextResponse.json({ error: "Event must be in curation or locked." }, { status: 400 });
  }

  await generateScrapbook(admin, params.id);

  return NextResponse.json({ ok: true });
}