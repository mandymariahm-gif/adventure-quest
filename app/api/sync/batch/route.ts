import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { SyncMutation } from "@/lib/types";

const LEGENDARY_TRIGGER = 5;

/** Applies a batch of queued offline mutations.
 *  - Mutation ids are client-generated UUIDs → retries are idempotent and
 *    can never double-award points (completion id is the mutation id).
 *  - Photos ride along as compressed base64 and land in Supabase Storage.
 *  - Server re-runs the pool rules: refill to 5 active, unlock the
 *    Legendary at the trigger point.
 *  Returns { applied: [...ids] } so the client can clear its queue. */
export async function POST(request: Request) {
  // ✅ FIX — verify the Bearer token directly instead of relying on cookies
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (!user || authError) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { mutations } = (await request.json()) as { mutations: SyncMutation[] };
  if (!Array.isArray(mutations))
    return NextResponse.json({ error: "mutations array required" }, { status: 400 });

  const applied: string[] = [];

  for (const m of mutations.slice(0, 50)) {
    try {
      if (m.type === "completion") {
        const ok = await applyCompletion(admin, user.id, m);
        if (ok) applied.push(m.id);
      } else if (m.type === "time_capsule") {
        const ok = await applyTimeCapsule(admin, user.id, m);
        if (ok) applied.push(m.id);
      }
    } catch {
      // leave it in the client queue; a later flush retries
    }
  }

  return NextResponse.json({ applied });
}

type Admin = ReturnType<typeof supabaseAdmin>;

async function applyCompletion(
  admin: Admin,
  userId: string,
  m: Extract<SyncMutation, { type: "completion" }>
): Promise<boolean> {
  const { data: existing } = await admin
    .from("quest_completions").select("id").eq("id", m.id).maybeSingle();
  if (existing) return true;

  const { data: pq } = await admin
    .from("participant_quests")
    .select("id, status, event_participant_id, event_participants!inner(user_id, event_id, events!inner(status, ended_at, curation_ends_at))")
    .eq("id", m.participant_quest_id)
    .maybeSingle();
  if (!pq) return true;

  const ep = pq.event_participants as unknown as {
    user_id: string; event_id: string; events: { status: string; ended_at: string | null };
  };
  if (ep.user_id !== userId) return false;

  // Allow completions during active OR curation (curation completions are flagged)
  const isCurationCompletion = ep.events.status === "curation";
  if (ep.events.status !== "active" && !isCurationCompletion) return true;

  // During curation, check the window is still open
  if (isCurationCompletion) {
    const curationEndsAt = (ep.events as any).curation_ends_at;
    if (!curationEndsAt || new Date(curationEndsAt) < new Date()) return true;
  }
  if (pq.status === "completed") return true;

  let photoUrl: string | null = null;
  if (m.photo_base64) {
    const bytes = Buffer.from(m.photo_base64, "base64");
    if (bytes.length > 8 * 1024 * 1024) return true;
    const path = `${ep.event_id}/${m.id}.jpg`;
    const { error: upErr } = await admin.storage
      .from("photos")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (!upErr) {
      photoUrl = admin.storage.from("photos").getPublicUrl(path).data.publicUrl;
    }
  }

  const { error: insErr } = await admin.from("quest_completions").insert({
    id: m.id,
    participant_quest_id: m.participant_quest_id,
    photo_url: photoUrl,
    text_note: m.text_note,
    completed_at: m.completed_at,
    synced_at: new Date().toISOString(),
    curation_completed: isCurationCompletion,
  });
  if (insErr && !insErr.message.includes("duplicate")) return false;

  await admin.from("participant_quests").update({ status: "completed" }).eq("id", pq.id);

  const { data: hand } = await admin
    .from("participant_quests")
    .select("id, status, quests(is_legendary)")
    .eq("event_participant_id", pq.event_participant_id);

  type HandRow = { id: string; status: string; quests: { is_legendary: boolean } | null };
  const rows = (hand ?? []) as unknown as HandRow[];
  const activeCount = rows.filter((r) => r.status === "active" && !r.quests?.is_legendary).length;
  const doneCount = rows.filter((r) => r.status === "completed").length;

  if (activeCount < 5) {
    const nextQueued = rows.find((r) => r.status === "queued");
    if (nextQueued) {
      await admin.from("participant_quests")
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("id", nextQueued.id);
    }
  }
  if (doneCount >= LEGENDARY_TRIGGER) {
    const locked = rows.find((r) => r.status === "locked");
    if (locked) {
      await admin.from("participant_quests")
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("id", locked.id);
    }
  }

  const { data: achievements } = await admin.from("achievements").select("id, code");
  const achId = (code: string) => achievements?.find((a) => a.code === code)?.id;
  const grant = async (code: string) => {
    const id = achId(code);
    if (!id) return;
    await admin.from("user_achievements")
      .upsert({ user_id: userId, achievement_id: id }, { onConflict: "user_id,achievement_id", ignoreDuplicates: true });
  };

  await grant("first_quest");
  const { data: completedPq } = await admin
    .from("participant_quests").select("id, event_participants!inner(user_id)")
    .eq("status", "completed").eq("event_participants.user_id", userId);
  if ((completedPq?.length ?? 0) >= 10) await grant("ten_quests");

  const { data: thisQuest } = await admin
    .from("participant_quests").select("quests(is_legendary)").eq("id", pq.id).single();
  if ((thisQuest?.quests as unknown as { is_legendary: boolean } | null)?.is_legendary) {
    await grant("legendary");
  }

  return true;
}

async function applyTimeCapsule(
  admin: Admin,
  userId: string,
  m: Extract<SyncMutation, { type: "time_capsule" }>
): Promise<boolean> {
  const { data: ep } = await admin
    .from("event_participants")
    .select("id, user_id, events!inner(event_date, ended_at)")
    .eq("id", m.event_participant_id)
    .maybeSingle();
  if (!ep) return true;
  if (ep.user_id !== userId) return false;

  const ev = ep.events as unknown as { event_date: string | null; ended_at: string | null };
  const base = ev.event_date ? new Date(ev.event_date) : new Date(ev.ended_at ?? Date.now());
  const unlock = new Date(base);
  unlock.setFullYear(unlock.getFullYear() + 1);
  unlock.setDate(unlock.getDate() - 7);

  const { error } = await admin.from("time_capsules").upsert(
    {
      event_participant_id: m.event_participant_id,
      ...m.payload,
      unlock_at: unlock.toISOString(),
    },
    { onConflict: "event_participant_id" }
  );
  if (error) return false;

  const { data: achievements } = await admin.from("achievements").select("id, code");
  const time = achievements?.find((a) => a.code === "time_traveler")?.id;
  if (time) {
    await admin.from("user_achievements")
      .upsert({ user_id: userId, achievement_id: time }, { onConflict: "user_id,achievement_id", ignoreDuplicates: true });
  }
  return true;
}