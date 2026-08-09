import { SupabaseClient } from "@supabase/supabase-js";

/** Award curation points to a participant — server-side only, never client-set */
export async function awardCurationPoints(
  admin: SupabaseClient,
  eventId: string,
  userId: string,
  points: number,
  reason: string
): Promise<void> {
  // Find the participant record
  const { data: ep } = await admin
    .from("event_participants")
    .select("id, curation_points")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!ep) return;

  await admin
    .from("event_participants")
    .update({ curation_points: (ep.curation_points ?? 0) + points })
    .eq("id", ep.id);
}

export const CURATION_POINT_VALUES = {
  ADD_MISSING_PHOTO:    2,
  COMPLETE_LATE_QUEST:  2,  // bonus on top of quest points
  ADD_SIDE_QUEST:       3,
  ADD_STORY:            2,
  REACT_TO_PHOTO:       1,  // max 10/day enforced elsewhere
  WIN_AWARD:            10,
};