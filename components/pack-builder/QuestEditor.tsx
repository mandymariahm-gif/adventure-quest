"use client";
import { useState } from "react";
import type { Quest } from "@/lib/types";

type QuestForm = {
  title: string;
  description: string;
  category: string;
  points: number;
  is_legendary: boolean;
  requires_photo: boolean;
  requires_verification: boolean;
  requires_voting: boolean;
};

const BLANK_FORM: QuestForm = {
  title: "",
  description: "",
  category: "general",
  points: 10,
  is_legendary: false,
  requires_photo: false,
  requires_verification: false,
  requires_voting: false,
};

function badges(q: Quest) {
  const out: string[] = [];
  if (q.is_legendary) out.push("⭐ Legendary");
  if (q.requires_photo) out.push("📷 Photo");
  if (q.requires_verification) out.push("✅ Verification");
  if (q.requires_voting) out.push("🗳️ Voting");
  return out;
}

export default function QuestEditor({
  packId,
  initialQuests,
}: {
  packId: string;
  initialQuests: Quest[];
}) {
  const [quests, setQuests] = useState<Quest[]>(initialQuests);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<QuestForm>(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<QuestForm>(BLANK_FORM);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function addQuest() {
    if (!addForm.title.trim()) return setError("Give the quest a title.");
    setBusy(true);
    setError("");
    const res = await fetch(`/api/quest-packs/${packId}/quests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't add the quest.");
    setQuests((qs) => [...qs, data.quest]);
    setAddForm(BLANK_FORM);
    setAdding(false);
  }

  function startEdit(q: Quest) {
    setEditingId(q.id);
    setEditForm({
      title: q.title,
      description: q.description ?? "",
      category: q.category,
      points: q.points,
      is_legendary: q.is_legendary,
      requires_photo: q.requires_photo,
      requires_verification: q.requires_verification,
      requires_voting: q.requires_voting,
    });
  }

  async function saveEdit(id: string) {
    if (!editForm.title.trim()) return setError("Give the quest a title.");
    setBusy(true);
    setError("");
    const res = await fetch(`/api/quest-packs/${packId}/quests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save the quest.");
    setQuests((qs) => qs.map((q) => (q.id === id ? data.quest : q)));
    setEditingId(null);
  }

  async function deleteQuest(id: string) {
    if (!window.confirm("Delete this quest? This can't be undone.")) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/quest-packs/${packId}/quests/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      return setError(data.error ?? "Couldn't delete the quest.");
    }
    setQuests((qs) => qs.filter((q) => q.id !== id));
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= quests.length) return;
    const reordered = [...quests];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setQuests(reordered); // update immediately so the UI feels responsive
    setBusy(true);
    setError("");
    const res = await fetch(`/api/quest-packs/${packId}/quests/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map((q) => q.id) }),
    });
    setBusy(false);
    if (!res.ok) {
      setQuests(quests); // reorder failed server-side — undo the local swap
      const data = await res.json();
      setError(data.error ?? "Couldn't reorder quests.");
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-fern">
          Quests ({quests.length})
        </h2>
        {!adding && (
          <button className="btn-paper !min-h-[36px] !px-4 text-sm" onClick={() => setAdding(true)}>
            + Add quest
          </button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-lantern">{error}</p>}

      {adding && (
        <QuestForm
          form={addForm}
          setForm={setAddForm}
          onSave={addQuest}
          onCancel={() => { setAdding(false); setAddForm(BLANK_FORM); setError(""); }}
          busy={busy}
          saveLabel="Add quest"
        />
      )}

      {quests.length === 0 && !adding && (
        <p className="text-sm text-paper/60">No quests yet — add your first one above.</p>
      )}

      <ul className="flex flex-col gap-3">
        {quests.map((q, i) => (
          <li key={q.id} className="ticket p-4">
            {editingId === q.id ? (
              <QuestForm
                form={editForm}
                setForm={setEditForm}
                onSave={() => saveEdit(q.id)}
                onCancel={() => { setEditingId(null); setError(""); }}
                busy={busy}
                saveLabel="Save"
                onPaper
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display leading-tight">{q.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-ink/50">
                    {q.category} · {q.points} pts
                  </p>
                  {badges(q).length > 0 && (
                    <p className="mt-1 text-xs text-ink/60">{badges(q).join(" · ")}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex gap-1">
                    <button
                      className="btn-paper !min-h-[32px] !px-2 text-xs"
                      aria-label="Move up"
                      disabled={i === 0 || busy}
                      onClick={() => move(i, -1)}
                    >↑</button>
                    <button
                      className="btn-paper !min-h-[32px] !px-2 text-xs"
                      aria-label="Move down"
                      disabled={i === quests.length - 1 || busy}
                      onClick={() => move(i, 1)}
                    >↓</button>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-paper !min-h-[32px] !px-3 text-xs" onClick={() => startEdit(q)}>Edit</button>
                    <button className="btn-paper !min-h-[32px] !px-3 text-xs text-lantern" onClick={() => deleteQuest(q.id)}>Delete</button>
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuestForm({
  form,
  setForm,
  onSave,
  onCancel,
  busy,
  saveLabel,
  onPaper = false,
}: {
  form: QuestForm;
  setForm: (f: QuestForm) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  saveLabel: string;
  /** True when rendered inside a .ticket card (light background) — the "Add quest"
   *  form sits directly on the dark page background instead, so it stays false. */
  onPaper?: boolean;
}) {
  const fieldClass = onPaper ? "field-paper" : "field";
  const labelClass = onPaper ? "!text-ink/70" : "";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="q-title" className={labelClass}>Title</label>
        <input id="q-title" className={fieldClass} placeholder="Find an underrated beer"
          value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <label htmlFor="q-desc" className={labelClass}>Description</label>
        <textarea id="q-desc" className={fieldClass} rows={2} placeholder="What does completing this involve?"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="q-category" className={labelClass}>Category</label>
          <input id="q-category" className={fieldClass} placeholder="e.g. photo, social, challenge"
            value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
        <div className="w-24">
          <label htmlFor="q-points" className={labelClass}>Points</label>
          <input id="q-points" type="number" min={1} className={fieldClass}
            value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
        </div>
      </div>
      <div className={`flex flex-col gap-2 text-sm ${labelClass}`}>
        <label className={`flex items-center gap-2 ${labelClass}`}>
          <input type="checkbox" className="h-4 w-4 accent-[#E8A33D]"
            checked={form.is_legendary} onChange={(e) => setForm({ ...form, is_legendary: e.target.checked })} />
          ⭐ Legendary quest
        </label>
        <label className={`flex items-center gap-2 ${labelClass}`}>
          <input type="checkbox" className="h-4 w-4 accent-[#E8A33D]"
            checked={form.requires_photo} onChange={(e) => setForm({ ...form, requires_photo: e.target.checked })} />
          📷 Requires a photo
        </label>
        <label className={`flex items-center gap-2 ${labelClass}`}>
          <input type="checkbox" className="h-4 w-4 accent-[#E8A33D]"
            checked={form.requires_verification} onChange={(e) => setForm({ ...form, requires_verification: e.target.checked })} />
          ✅ Requires verification
        </label>
        <label className={`flex items-center gap-2 ${labelClass}`}>
          <input type="checkbox" className="h-4 w-4 accent-[#E8A33D]"
            checked={form.requires_voting} onChange={(e) => setForm({ ...form, requires_voting: e.target.checked })} />
          🗳️ Requires group voting
        </label>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : saveLabel}
        </button>
        <button className={`${onPaper ? "btn-paper" : "btn-ghost"} !px-4`} onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
