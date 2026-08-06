"use client";
import { useEffect, useRef, useState } from "react";
import type { LocalQuestState } from "@/lib/offline/db";
import { compressImage, enqueue, uuid } from "@/lib/offline/sync";

interface Props {
  quest: LocalQuestState;
  onClose: () => void;
  onCompleted: (participantQuestId: string) => void;
}

/** Bottom sheet for completing a quest. Works fully offline:
 *  the completion (and compressed photo) is written to the local queue and
 *  syncs whenever connectivity returns. */
export default function QuestDetailSheet({ quest, onClose, onCompleted }: Props) {
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError("");
    const compressed = await compressImage(file);
    setPhoto(compressed);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(compressed);
    });
  }

  async function complete() {
    if (quest.requires_photo && !photo) {
      setError("This quest needs a photo — that's the scrapbook material!");
      return;
    }
    setSaving(true);
    const mutationId = uuid();
    await enqueue(
      {
        id: mutationId,
        type: "completion",
        participant_quest_id: quest.id,
        text_note: note.trim() || null,
        photo_base64: null, // filled in from the photos table at flush time
        completed_at: new Date().toISOString(),
      },
      photo ?? undefined
    );
    window.dispatchEvent(new CustomEvent("aq:queued"));
    onCompleted(quest.id);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Quest: ${quest.title}`}
        tabIndex={-1}
        className="w-full max-w-md rounded-t-2xl bg-paper p-5 pb-8 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl leading-tight">
              {quest.is_legendary ? "⭐ " : ""}{quest.title}
            </h2>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-ink/50">
              {quest.category} · {quest.points} pts
            </p>
          </div>
          <button className="btn-paper !min-h-[40px] !px-3 text-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {quest.description && <p className="mt-3 text-sm text-ink/80">{quest.description}</p>}

        <div className="ticket-tear mt-4 pt-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          <button className="btn-primary w-full" onClick={() => fileRef.current?.click()}>
            📷 {photo ? "Retake photo" : "Add photo"}
          </button>
          {preview && (
            <div className="polaroid relative mx-auto mt-4 w-48" style={{ ["--tilt" as never]: "-2deg" }}>
              <span className="tape" aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Your quest photo" />
              <p className="polaroid-caption">tonight</p>
            </div>
          )}

          <label htmlFor="note" className="mt-4 !text-ink/70">Note for the scrapbook</label>
          <textarea
            id="note"
            className="field-paper"
            rows={2}
            placeholder="What happened?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {error && <p role="alert" className="mt-2 text-sm text-[#B4482B]">{error}</p>}

          <button className="btn-paper mt-4 w-full" onClick={complete} disabled={saving}>
            {saving ? "Saving…" : "Mark complete"}
          </button>
          <p className="mt-2 text-center text-xs text-ink/50">
            No signal? No problem — this saves on your phone and syncs later.
          </p>
        </div>
      </div>
    </div>
  );
}
