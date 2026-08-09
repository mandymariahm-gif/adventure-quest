"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const REACTIONS = [
  { type: "love",        emoji: "❤️",  label: "Love" },
  { type: "laugh",       emoji: "😂",  label: "Funny" },
  { type: "core_memory", emoji: "🥹",  label: "Core Memory" },
  { type: "epic",        emoji: "🔥",  label: "Epic" },
  { type: "remember",    emoji: "👀",  label: "I Remember This" },
];

interface Reaction {
  id: string;
  photo_id: string;
  photo_type: string;
  user_id: string;
  reaction_type: string;
}

interface Props {
  photoId: string;
  photoType: "completion" | "side_quest";
  eventId: string;
  currentUserId: string;
  allReactions: Reaction[];
  canReact: boolean;
}

export default function PhotoReactions({
  photoId, photoType, eventId, currentUserId, allReactions, canReact
}: Props) {
  const [reactions, setReactions] = useState<Reaction[]>(
    allReactions.filter((r) => r.photo_id === photoId && r.photo_type === photoType)
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const countFor = (type: string) => reactions.filter((r) => r.reaction_type === type).length;
  const hasReacted = (type: string) => reactions.some((r) => r.reaction_type === type && r.user_id === currentUserId);

  async function toggle(reactionType: string) {
    if (!canReact) return;
    setLoading(reactionType);
    setError("");
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");

      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ photoId, photoType, reactionType, eventId }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) setError(data.error);
        return;
      }

      if (data.action === "added") {
        setReactions((r) => [...r, {
          id: crypto.randomUUID(),
          photo_id: photoId,
          photo_type: photoType,
          user_id: currentUserId,
          reaction_type: reactionType,
        }]);
      } else {
        setReactions((r) => r.filter(
          (rx) => !(rx.reaction_type === reactionType && rx.user_id === currentUserId)
        ));
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  // Only show reactions that have at least 1, or all if canReact
  const visibleReactions = canReact
    ? REACTIONS
    : REACTIONS.filter((r) => countFor(r.type) > 0);

  if (visibleReactions.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5 justify-center">
        {visibleReactions.map((r) => {
          const count = countFor(r.type);
          const active = hasReacted(r.type);
          return (
            <button
              key={r.type}
              onClick={() => toggle(r.type)}
              disabled={!canReact || loading === r.type}
              aria-label={`${r.label}: ${count}`}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all
                ${active
                  ? "bg-amber/30 border border-amber/50 text-ink"
                  : "bg-white/10 border border-white/20 text-ink/60"}
                ${canReact ? "hover:bg-amber/20 cursor-pointer" : "cursor-default"}
                ${loading === r.type ? "opacity-50" : ""}
              `}
            >
              <span>{r.emoji}</span>
              {count > 0 && <span className="font-display">{count}</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1 text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
