"use client";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/offline/sync";

interface Props {
  eventId: string;
  onClose: () => void;
  onAdded: () => void;
}

export default function SideQuestSheet({ eventId, onClose, onAdded }: Props) {
  const [title, setTitle] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    const compressed = await compressImage(file);
    setPhoto(compressed);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(compressed);
    });
  }

  async function submit() {
    if (!title.trim()) {
      setError("Give your moment a name!");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) {
        setError("You need to be signed in.");
        return;
      }

      const formData = new FormData();
      formData.append("eventId", eventId);
      formData.append("title", title.trim());
      if (photo) {
        formData.append("photo", new File([photo], "moment.jpg", { type: "image/jpeg" }));
      }

      const res = await fetch("/api/side-quests", {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Couldn't save your moment.");
      }

      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a moment"
        className="w-full max-w-md rounded-t-2xl bg-paper p-5 pb-8 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">📸 Add a moment</h2>
          <button className="btn-paper !min-h-[40px] !px-3 text-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="mt-1 text-sm text-ink/60">Your own side quest — no rules, just vibes.</p>

        <div className="mt-4 flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          <button className="btn-primary w-full" onClick={() => fileRef.current?.click()}>
            {photo ? "📷 Retake photo" : "📷 Add photo"}
          </button>

          {preview && (
            <div className="polaroid relative mx-auto w-48" style={{ ["--tilt" as never]: "1.5deg" }}>
              <span className="tape" aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Your moment" />
            </div>
          )}

          <div>
            <label htmlFor="moment-title" className="!text-ink/70">What happened?</label>
            <input
              id="moment-title"
              className="field-paper"
              placeholder="Name this moment…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          {error && <p role="alert" className="text-sm text-[#B4482B]">{error}</p>}

          <button className="btn-paper w-full mt-1" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save this moment"}
          </button>
        </div>
      </div>
    </div>
  );
}
