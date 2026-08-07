"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface ActivityItem {
  id: string;
  completed_at: string;
  photo_url: string | null;
  text_note: string | null;
  quest_title: string;
  display_name: string;
  points: number;
  is_legendary: boolean;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function ActivityFeed({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    // Initial load
    async function load() {
      const res = await fetch(`/api/activity?eventId=${eventId}`);
      if (res.ok) {
        const { activity } = await res.json();
        setItems(activity ?? []);
      }
      setLoading(false);
    }
    void load();

    // Real-time subscription on quest_completions
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`activity-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quest_completions",
        },
        async () => {
          // Re-fetch the full enriched list when a new completion arrives
          const res = await fetch(`/api/activity?eventId=${eventId}`);
          if (res.ok) {
            const { activity } = await res.json();
            setItems(activity ?? []);
          }
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [eventId]);

  if (loading) {
    return (
      <div className="mt-10 text-center text-sm text-paper/50">
        Loading activity…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-10 text-center">
        <p className="text-2xl">🌙</p>
        <p className="mt-2 text-sm text-paper/60">
          No quests completed yet — be the first!
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="ticket p-3">
          <button
            className="w-full text-left"
            onClick={() => setExpanded(expanded === item.id ? null : item.id)}
          >
            <div className="flex items-start gap-3">
              {/* Photo thumbnail */}
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
                {item.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.photo_url}
                    alt={`${item.display_name}'s quest photo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl">
                    {item.is_legendary ? "⭐" : "✓"}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm leading-tight">
                  {item.is_legendary ? "⭐ " : ""}{item.quest_title}
                </p>
                <p className="mt-0.5 text-xs text-paper/60">
                  <span className="text-amber font-medium">{item.display_name}</span>
                  {" · "}+{item.points} pts
                  {" · "}{timeAgo(item.completed_at)}
                </p>
                {item.text_note && (
                  <p className="mt-1 truncate text-xs italic text-paper/50">
                    "{item.text_note}"
                  </p>
                )}
              </div>

              <span className="text-ink/30 text-sm mt-1">
                {expanded === item.id ? "▲" : "▼"}
              </span>
            </div>
          </button>

          {/* Expanded polaroid view */}
          {expanded === item.id && item.photo_url && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="polaroid relative mx-auto w-48"
                style={{ ["--tilt" as never]: "-1.5deg" }}>
                <span className="tape" aria-hidden />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.photo_url}
                  alt={item.quest_title}
                  className="w-full"
                />
                <p className="polaroid-caption">{item.quest_title}</p>
              </div>
              {item.text_note && (
                <p className="mt-3 text-center text-sm italic text-paper/60">
                  "{item.text_note}"
                </p>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
