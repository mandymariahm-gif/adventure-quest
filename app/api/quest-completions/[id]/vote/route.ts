import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

/** One vote per person per completion (upsert). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const value = Number(body.value) === -1 ? -1 : 1;

  const admin = supabaseAdmin();
  const { error } = await admin.from("votes").upsert(
    { quest_completion_id: params.id, voter_id: user.id, value },
    { onConflict: "quest_completion_id,voter_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
