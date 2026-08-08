// Shared types mirroring the Postgres schema (see supabase/migrations)

export type EventStatus = "draft" | "active" | "curation" | "locked" | "archived" | "ended";
export type ParticipantRole = "host" | "participant";
export type ParticipantQuestStatus =
  | "drawn"
  | "active"
  | "queued"
  | "completed"
  | "locked"; // used for the hidden Legendary Quest before its trigger fires

export interface AppUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface QuestPack {
  id: string;
  name: string;
  description: string | null;
  version: number;
  is_public: boolean;
}

export interface Quest {
  id: string;
  quest_pack_id: string;
  title: string;
  description: string | null;
  category: string;
  points: number;
  is_legendary: boolean;
  requires_photo: boolean;
  requires_verification: boolean;
  requires_voting: boolean;
}

export interface EventRow {
  id: string;
  host_id: string;
  quest_pack_id: string;
  name: string;
  location: string | null;
  event_date: string | null;
  description: string | null;
  cover_photo_url: string | null;
  participant_limit: number;
  invite_code: string;
  status: EventStatus;
  started_at: string | null;
  ended_at: string | null;
  curation_starts_at: string | null;
  curation_ends_at: string | null;
  game_mode: string;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  role: ParticipantRole;
  joined_at: string;
}

export interface ParticipantQuest {
  id: string;
  event_participant_id: string;
  quest_id: string;
  status: ParticipantQuestStatus;
  drawn_at: string;
  activated_at: string | null;
  quest?: Quest;
}

export interface QuestCompletion {
  id: string;
  participant_quest_id: string;
  photo_url: string | null;
  text_note: string | null;
  verified_by: string | null;
  completed_at: string;
  synced_at: string | null;
}

export interface ScrapbookStats {
  total_completions: number;
  total_photos: number;
  total_points: number;
  participant_count: number;
  leaderboard: { user_id: string; display_name: string; points: number }[];
  timeline: {
    completed_at: string;
    display_name: string;
    quest_title: string;
    photo_url: string | null;
    text_note: string | null;
    points: number;
    is_legendary: boolean;
  }[];
}

export interface TimeCapsuleInput {
  favorite_beer: string;
  favorite_brewery: string;
  funniest_moment: string;
  biggest_surprise: string;
  favorite_animal: string;
  prediction_next_year: string;
  personal_goal: string;
}

/** A queued offline mutation. `id` is generated client-side so retries are idempotent. */
export type SyncMutation =
  | {
      id: string; // uuid, becomes the quest_completions.id
      type: "completion";
      participant_quest_id: string;
      text_note: string | null;
      photo_base64: string | null; // compressed JPEG data URL payload (no prefix)
      completed_at: string;
    }
  | {
      id: string;
      type: "time_capsule";
      event_participant_id: string;
      payload: TimeCapsuleInput;
    };
