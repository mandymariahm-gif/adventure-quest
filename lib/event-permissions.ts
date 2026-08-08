/** Central permission helper — every feature checks this, never scattered if-statements. */

export type EventState = "draft" | "active" | "curation" | "locked" | "archived" | "ended";

export interface EventPermissions {
  canCompleteQuests: boolean;
  canUploadQuestPhoto: boolean;
  canAddSideQuest: boolean;
  canVote: boolean;
  canAddStory: boolean;
  canEarnQuestPoints: boolean;
  canEarnCurationPoints: boolean;
  canViewScrapbook: boolean;
  canViewFinalScrapbook: boolean;
  isCurationOpen: boolean;
  curationEndsAt: Date | null;
  msRemaining: number | null;
  isHost: boolean;
}

export function getEventPermissions(
  status: EventState,
  curationEndsAt: string | null,
  isHost: boolean
): EventPermissions {
  const now = Date.now();
  const endsAt = curationEndsAt ? new Date(curationEndsAt) : null;
  const msRemaining = endsAt ? Math.max(0, endsAt.getTime() - now) : null;
  const curationStillOpen = msRemaining !== null && msRemaining > 0;

  return {
    canCompleteQuests:      status === "active",
    canUploadQuestPhoto:    status === "active" || (status === "curation" && curationStillOpen),
    canAddSideQuest:        status === "curation" && curationStillOpen,
    canVote:                status === "curation" && curationStillOpen,
    canAddStory:            status === "curation" && curationStillOpen,
    canEarnQuestPoints:     status === "active",
    canEarnCurationPoints:  status === "curation" && curationStillOpen,
    canViewScrapbook:       status !== "draft",
    canViewFinalScrapbook:  status === "locked" || status === "archived",
    isCurationOpen:         curationStillOpen,
    curationEndsAt:         endsAt,
    msRemaining,
    isHost,
  };
}

/** Format remaining curation time for display */
export function formatTimeRemaining(msRemaining: number): string {
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}