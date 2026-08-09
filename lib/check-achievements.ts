import { SupabaseClient } from "@supabase/supabase-js";

/** Grant an achievement to a user — idempotent, safe to call multiple times */
async function grantAchievement(
  admin: SupabaseClient,
  userId: string,
  code: string
): Promise<void> {
  const { data: achievement } = await admin
    .from("achievements").select("id").eq("code", code).maybeSingle();
  if (!achievement) return;

  await admin.from("user_achievements").upsert(
    { user_id: userId, achievement_id: achievement.id },
    { onConflict: "user_id,achievement_id", ignoreDuplicates: true }
  );
}

/** Check and award all curation-phase achievements for a user in an event */
export async function checkCurationAchievements(
  admin: SupabaseClient,
  userId: string,
  eventId: string
): Promise<void> {
  // Get participant record
  const { data: ep } = await admin
    .from("event_participants").select("id")
    .eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  if (!ep) return;

  // Side quester — submitted a side quest
  const { count: sqCount } = await admin
    .from("side_quests").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("user_id", userId);
  if ((sqCount ?? 0) >= 1) await grantAchievement(admin, userId, "side_quester");

  // Memory keeper — added a story
  const { count: storyCount } = await admin
    .from("photo_stories").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("user_id", userId);
  if ((storyCount ?? 0) >= 1) await grantAchievement(admin, userId, "memory_keeper");

  // Storyteller — added stories to 3+ photos
  if ((storyCount ?? 0) >= 3) await grantAchievement(admin, userId, "storyteller");

  // Social butterfly — reacted to 10+ photos
  const { count: reactionCount } = await admin
    .from("photo_reactions").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("user_id", userId);
  if ((reactionCount ?? 0) >= 10) await grantAchievement(admin, userId, "social_butterfly");

  // Crowd favorite — won a community award
  const { count: awardCount } = await admin
    .from("community_awards").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("winner_user_id", userId);
  if ((awardCount ?? 0) >= 1) await grantAchievement(admin, userId, "crowd_favorite");

  // Paparazzi — added 5+ photos during Memory Week
  const { count: curationPhotoCount } = await admin
    .from("quest_completions").select("id", { count: "exact", head: true })
    .eq("curation_completed", true);
  const { count: sideQuestPhotoCount } = await admin
    .from("side_quests").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("user_id", userId).not("photo_url", "is", null);
  if (((curationPhotoCount ?? 0) + (sideQuestPhotoCount ?? 0)) >= 5) {
    await grantAchievement(admin, userId, "paparazzi");
  }

  // Memory maker — completed all Memory Week activities
  const hasSideQuest = (sqCount ?? 0) >= 1;
  const hasStory = (storyCount ?? 0) >= 1;
  const hasReaction = (reactionCount ?? 0) >= 1;
  if (hasSideQuest && hasStory && hasReaction) {
    await grantAchievement(admin, userId, "memory_maker");
  }
}

/** Check and award event-phase achievements */
export async function checkEventAchievements(
  admin: SupabaseClient,
  userId: string,
  eventId: string
): Promise<void> {
  const { data: ep } = await admin
    .from("event_participants").select("id")
    .eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  if (!ep) return;

  const { count: completionCount } = await admin
    .from("participant_quests").select("id", { count: "exact", head: true })
    .eq("event_participant_id", ep.id).eq("status", "completed");

  // Quest goblin — 5+ quests
  if ((completionCount ?? 0) >= 5) await grantAchievement(admin, userId, "quest_goblin");

  // First quest
  if ((completionCount ?? 0) >= 1) await grantAchievement(admin, userId, "first_quest");

  // Ten quests
  if ((completionCount ?? 0) >= 10) await grantAchievement(admin, userId, "ten_quests");
}