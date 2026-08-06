"use client";
import Dexie, { type Table } from "dexie";
import type { ParticipantQuest, Quest, SyncMutation } from "@/lib/types";

/**
 * Local-first store. Everything the participant does during an event writes
 * here FIRST, then syncs to the server when connectivity allows.
 */
export interface CachedPack {
  quest_pack_id: string;
  quests: Quest[];
  cached_at: string;
}

export interface LocalQuestState extends ParticipantQuest {
  event_id: string;
  /** points shown optimistically before server confirms */
  points: number;
  title: string;
  description: string | null;
  category: string;
  is_legendary: boolean;
  requires_photo: boolean;
}

export interface PendingPhoto {
  mutation_id: string;
  blob: Blob;
}

class AdventureQuestDB extends Dexie {
  packs!: Table<CachedPack, string>;
  myQuests!: Table<LocalQuestState, string>;
  queue!: Table<SyncMutation, string>;
  photos!: Table<PendingPhoto, string>;

  constructor() {
    super("adventure-quest");
    this.version(1).stores({
      packs: "quest_pack_id",
      myQuests: "id, event_id, status",
      queue: "id",
      photos: "mutation_id",
    });
  }
}

export const localDB = new AdventureQuestDB();
