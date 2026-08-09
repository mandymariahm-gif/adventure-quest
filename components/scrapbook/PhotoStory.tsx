"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Story {
  id: string;
  photo_id: string;
  photo_type: string;
  user_id: string;
  story_text: string;
  users?: { display_name: string | null } | null;
}

interface Props {
  photoId: string;
  photoType: "completion" | "side_quest";
  eventId: string;
  currentUserId: string;
  allStories: Story[];
  canAddStory: boolean;
}

export default function PhotoStory({
  photoId, photoType, eventId, currentUserId, allStories, canAddStory
}: Props) {
  const photoStories = allStories.filter(
    (s) => s.photo_id === photoId && s.photo_type === photoType
  );
  const myStory = photoStories.find((s) => s.user_id === currentUserId);
  const otherStories = photoStories.filter((s) => s.user_id !== currentUserId);

  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(myStory?.story_text ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");

      const res = await fetch("/api/stories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ photoId, photoType, storyText: text, eventId }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Couldn't save.");
      }
      setSaved(true);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const hasAnyStory = photoStories.length > 0;
  if (!hasAnyStory && !canAddStory) return null;

  return (
    <div className="mt-1 px-1">
      {/* Other people's stories */}
      {otherStories.map((s) => (
        <p key={s.id} className="mt-1 text-center text-xs italic text-ink/60">
          💬 &ldquo;{s.story_text}&rdquo;
          <span className="not-italic text-ink/40"> — {s.users?.display_name ?? "Someone"}</span>
        </p>
      ))}

      {/* My story */}
      {myStory && !editing && (
        <div className="mt-1 text-center">
          <p className="text-xs italic text-ink/60">
            💬 &ldquo;{saved ? text : myStory.story_text}&rdquo;
          </p>
          {canAddStory && (
            <button
              className="mt-0.5 text-[10px] text-ink/30 underline"
              onClick={() => { setText(myStory.story_text); setEditing(true); setSaved(false); }}
            >
              edit
            </button>
          )}
        </div>
      )}

      {/* Add/edit story input */}
      {canAddStory && !myStory && !editing && (
        <button
          className="mt-1 w-full text-center text-[10px] text-ink/30 underline"
          onClick={() => setEditing(true)}
        >
          + Add the story
        </button>
      )}

      {editing && (
        <div className="mt-2 flex flex-col gap-1">
          <textarea
            className="field-paper text-xs"
            rows={2}
            placeholder="What's the story behind this photo?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <div className="flex gap-1">
            <button
              className="btn-paper !min-h-[28px] flex-1 text-xs"
              onClick={save}
              disabled={saving || !text.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className="btn-ghost !min-h-[28px] flex-1 text-xs"
              onClick={() => { setEditing(false); setText(myStory?.story_text ?? ""); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
