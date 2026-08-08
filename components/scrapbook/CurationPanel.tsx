"use client";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage, enqueue, uuid } from "@/lib/offline/sync";

interface MissingPhotoQuest {
  completionId: string;
  questTitle: string;
}

interface ActiveQuest {
  pquestId: string;
  questTitle: string;
  requiresPhoto: boolean;
}

interface Props {
  eventId: string;
  missingPhotoQuests: MissingPhotoQuest[];
  activeQuests: ActiveQuest[];
  canAddSideQuest: boolean;
}

export default function CurationPanel({ eventId, missingPhotoQuests, activeQuests, canAddSideQuest }: Props) {
  // Missing photo uploads
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const cameraRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const galleryRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Curation completions
  const [completing, setCompleting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [completionErrors, setCompletionErrors] = useState<Record<string, string>>({});
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [completionPhotos, setCompletionPhotos] = useState<Record<string, Blob>>({});
  const [completionPreviews, setCompletionPreviews] = useState<Record<string, string>>({});
  const compCameraRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const compGalleryRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Side quest
  const [showSideQuest, setShowSideQuest] = useState(false);
  const [sqTitle, setSqTitle] = useState("");
  const [sqPhoto, setSqPhoto] = useState<Blob | null>(null);
  const [sqPreview, setSqPreview] = useState<string | null>(null);
  const [sqSaving, setSqSaving] = useState(false);
  const [sqDone, setSqDone] = useState(false);
  const [sqError, setSqError] = useState("");
  const sqCameraRef = useRef<HTMLInputElement>(null);
  const sqGalleryRef = useRef<HTMLInputElement>(null);

  async function uploadMissingPhoto(completionId: string, file: File) {
    setUploading(completionId);
    setUploadErrors((e) => ({ ...e, [completionId]: "" }));
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("completionId", completionId);
      formData.append("eventId", eventId);
      formData.append("photo", new File([compressed], "photo.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/curation/photo", {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Upload failed."); }
      setUploaded((u) => new Set([...u, completionId]));
    } catch (e) {
      setUploadErrors((err) => ({ ...err, [completionId]: e instanceof Error ? e.message : "Upload failed." }));
    } finally {
      setUploading(null);
    }
  }

  async function pickCompletionPhoto(pquestId: string, file: File | undefined) {
    if (!file) return;
    const compressed = await compressImage(file);
    setCompletionPhotos((p) => ({ ...p, [pquestId]: compressed }));
    setCompletionPreviews((p) => {
      if (p[pquestId]) URL.revokeObjectURL(p[pquestId]);
      return { ...p, [pquestId]: URL.createObjectURL(compressed) };
    });
  }

  async function submitCurationCompletion(quest: ActiveQuest) {
    if (quest.requiresPhoto && !completionPhotos[quest.pquestId]) {
      setCompletionErrors((e) => ({ ...e, [quest.pquestId]: "This quest needs a photo!" }));
      return;
    }
    setCompleting(quest.pquestId);
    setCompletionErrors((e) => ({ ...e, [quest.pquestId]: "" }));
    try {
      const mutationId = uuid();
      await enqueue(
        {
          id: mutationId,
          type: "completion",
          participant_quest_id: quest.pquestId,
          text_note: completionNotes[quest.pquestId]?.trim() || null,
          photo_base64: null,
          completed_at: new Date().toISOString(),
        },
        completionPhotos[quest.pquestId] ?? undefined
      );
      window.dispatchEvent(new CustomEvent("aq:queued"));
      setCompleted((c) => new Set([...c, quest.pquestId]));
    } catch (e) {
      setCompletionErrors((err) => ({ ...err, [quest.pquestId]: "Something went wrong — try again." }));
    } finally {
      setCompleting(null);
    }
  }

  async function pickSqPhoto(file: File | undefined) {
    if (!file) return;
    const compressed = await compressImage(file);
    setSqPhoto(compressed);
    setSqPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(compressed); });
  }

  async function submitSideQuest() {
    if (!sqTitle.trim()) { setSqError("Give your moment a name!"); return; }
    setSqSaving(true); setSqError("");
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const formData = new FormData();
      formData.append("eventId", eventId);
      formData.append("title", sqTitle.trim());
      if (sqPhoto) formData.append("photo", new File([sqPhoto], "moment.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/side-quests", {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Couldn't save."); }
      setSqDone(true); setShowSideQuest(false); setSqTitle(""); setSqPhoto(null); setSqPreview(null);
    } catch (e) {
      setSqError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSqSaving(false);
    }
  }

  const remainingMissing = missingPhotoQuests.filter((q) => !uploaded.has(q.completionId));
  const remainingActive = activeQuests.filter((q) => !completed.has(q.pquestId));

  if (remainingMissing.length === 0 && remainingActive.length === 0 && !canAddSideQuest) return null;

  return (
    <div className="mx-5 mt-6 flex flex-col gap-4">

      {/* Missing photos on completed quests */}
      {remainingMissing.length > 0 && (
        <div className="rounded-xl border border-fern/30 bg-fern/10 p-4">
          <h3 className="font-display text-sm uppercase tracking-[0.2em] text-fern">📷 Add missing photos</h3>
          <p className="mt-1 text-xs text-ink/60">These quests you completed don't have a photo yet.</p>
          <ul className="mt-3 flex flex-col gap-3">
            {remainingMissing.map((q) => (
              <li key={q.completionId}>
                <p className="text-sm font-medium text-ink/80">{q.questTitle}</p>
                {uploadErrors[q.completionId] && <p className="text-xs text-red-500 mt-0.5">{uploadErrors[q.completionId]}</p>}
                <div className="mt-1.5 flex gap-2">
                  <input ref={(el) => { cameraRefs.current[q.completionId] = el; }} type="file" accept="image/*" capture="environment" className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMissingPhoto(q.completionId, f); }} />
                  <input ref={(el) => { galleryRefs.current[q.completionId] = el; }} type="file" accept="image/*" className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMissingPhoto(q.completionId, f); }} />
                  <button className="btn-primary !min-h-[36px] flex-1 text-xs" disabled={uploading === q.completionId}
                    onClick={() => cameraRefs.current[q.completionId]?.click()}>
                    {uploading === q.completionId ? "Uploading…" : "📷 Camera"}
                  </button>
                  <button className="btn-paper !min-h-[36px] flex-1 text-xs" disabled={uploading === q.completionId}
                    onClick={() => galleryRefs.current[q.completionId]?.click()}>
                    🖼️ Gallery
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active quests — complete during curation */}
      {remainingActive.length > 0 && (
        <div className="rounded-xl border border-amber/30 bg-amber/10 p-4">
          <h3 className="font-display text-sm uppercase tracking-[0.2em] text-amber">✅ Complete unfinished quests</h3>
          <p className="mt-1 text-xs text-ink/60">Did you do these but forget to submit? Add them now!</p>
          <ul className="mt-3 flex flex-col gap-4">
            {remainingActive.map((quest) => (
              <li key={quest.pquestId} className="border-t border-amber/20 pt-3 first:border-0 first:pt-0">
                <p className="text-sm font-medium text-ink/80">{quest.questTitle}</p>
                {quest.requiresPhoto && (
                  <p className="text-xs text-ink/50 mt-0.5">📷 Photo required</p>
                )}
                {completionErrors[quest.pquestId] && (
                  <p className="text-xs text-red-500 mt-0.5">{completionErrors[quest.pquestId]}</p>
                )}

                {/* Photo picker */}
                <input ref={(el) => { compCameraRefs.current[quest.pquestId] = el; }} type="file" accept="image/*" capture="environment" className="sr-only"
                  onChange={(e) => pickCompletionPhoto(quest.pquestId, e.target.files?.[0])} />
                <input ref={(el) => { compGalleryRefs.current[quest.pquestId] = el; }} type="file" accept="image/*" className="sr-only"
                  onChange={(e) => pickCompletionPhoto(quest.pquestId, e.target.files?.[0])} />

                <div className="mt-2 flex gap-2">
                  <button className="btn-primary !min-h-[36px] flex-1 text-xs"
                    onClick={() => compCameraRefs.current[quest.pquestId]?.click()}>
                    {completionPhotos[quest.pquestId] ? "📷 Retake" : "📷 Camera"}
                  </button>
                  <button className="btn-paper !min-h-[36px] flex-1 text-xs"
                    onClick={() => compGalleryRefs.current[quest.pquestId]?.click()}>
                    {completionPhotos[quest.pquestId] ? "🖼️ Change" : "🖼️ Gallery"}
                  </button>
                </div>

                {completionPreviews[quest.pquestId] && (
                  <div className="polaroid relative mx-auto mt-2 w-32" style={{ ["--tilt" as never]: "-1deg" }}>
                    <span className="tape" aria-hidden />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={completionPreviews[quest.pquestId]} alt="Preview" />
                  </div>
                )}

                <textarea
                  className="field-paper mt-2 text-sm"
                  rows={2}
                  placeholder="What happened? (optional)"
                  value={completionNotes[quest.pquestId] ?? ""}
                  onChange={(e) => setCompletionNotes((n) => ({ ...n, [quest.pquestId]: e.target.value }))}
                />

                <button
                  className="btn-paper mt-2 w-full text-sm"
                  disabled={completing === quest.pquestId}
                  onClick={() => submitCurationCompletion(quest)}
                >
                  {completing === quest.pquestId ? "Saving…" : "✅ Mark as completed"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add a side quest moment */}
      {canAddSideQuest && !sqDone && (
        <div className="rounded-xl border border-fern/20 bg-fern/5 p-4">
          <h3 className="font-display text-sm uppercase tracking-[0.2em] text-fern">📸 Add a moment</h3>
          <p className="mt-1 text-xs text-ink/60">A photo from the night that deserves to be remembered.</p>
          {!showSideQuest ? (
            <button className="btn-paper mt-3 w-full text-sm" onClick={() => setShowSideQuest(true)}>
              + Add your own moment
            </button>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <input ref={sqCameraRef} type="file" accept="image/*" capture="environment" className="sr-only"
                onChange={(e) => pickSqPhoto(e.target.files?.[0])} />
              <input ref={sqGalleryRef} type="file" accept="image/*" className="sr-only"
                onChange={(e) => pickSqPhoto(e.target.files?.[0])} />
              <div className="flex gap-2">
                <button className="btn-primary flex-1 text-xs !min-h-[36px]" onClick={() => sqCameraRef.current?.click()}>📷 Camera</button>
                <button className="btn-paper flex-1 text-xs !min-h-[36px]" onClick={() => sqGalleryRef.current?.click()}>🖼️ Gallery</button>
              </div>
              {sqPreview && (
                <div className="polaroid relative mx-auto w-32" style={{ ["--tilt" as never]: "1deg" }}>
                  <span className="tape" aria-hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sqPreview} alt="Preview" />
                </div>
              )}
              <input className="field-paper text-sm" placeholder="What happened?"
                value={sqTitle} onChange={(e) => setSqTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitSideQuest()} />
              {sqError && <p className="text-xs text-red-500">{sqError}</p>}
              <div className="flex gap-2">
                <button className="btn-paper flex-1 text-sm" onClick={submitSideQuest} disabled={sqSaving}>
                  {sqSaving ? "Saving…" : "Save moment"}
                </button>
                <button className="btn-ghost flex-1 text-sm" onClick={() => setShowSideQuest(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {sqDone && (
        <div className="rounded-xl bg-fern/10 p-3 text-center text-sm text-fern">
          ✅ Moment added to the scrapbook!
        </div>
      )}
    </div>
  );
}
