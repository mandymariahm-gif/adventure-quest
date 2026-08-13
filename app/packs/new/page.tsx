"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPack() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "", cover_art_url: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  async function createPack() {
    if (!form.name.trim()) return setError("Give your pack a name.");
    setSaving(true);
    setError("");
    const res = await fetch("/api/quest-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      return setError(data.error ?? "Couldn't create the pack. Try again.");
    }
    setCreated(data.pack);
    setSaving(false);
  }

  if (created) {
    return (
      <main className="mx-auto max-w-md p-5 pb-24">
        <header className="flex items-center gap-3 py-3">
          <h1 className="text-2xl">Pack created</h1>
        </header>
        <div className="ticket p-4">
          <p className="font-display text-lg">{created.name}</p>
          <p className="mt-1 text-sm text-ink/60">
            Saved as a private draft — only you can see it so far.
          </p>
        </div>
        <button className="btn-primary mt-4 w-full" onClick={() => router.push(`/packs/${created.id}/edit`)}>
          Add quests →
        </button>
        <button className="btn-ghost mt-2 w-full" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-5 pb-24">
      <header className="flex items-center gap-3 py-3">
        <button onClick={() => router.back()} className="btn-ghost !min-h-[40px] !px-3 text-sm" aria-label="Back">←</button>
        <h1 className="text-2xl">New quest pack</h1>
      </header>

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="name">Pack name</label>
          <input id="name" className="field" placeholder="Bachelorette Bash"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="desc">Description</label>
          <textarea id="desc" className="field" rows={3} placeholder="What's this pack about?"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label htmlFor="cover">Cover art URL</label>
          <input id="cover" className="field" placeholder="https://..."
            value={form.cover_art_url} onChange={(e) => setForm({ ...form, cover_art_url: e.target.value })} />
          <p className="mt-1 text-xs text-paper/50">
            Paste a link to an image for now — uploading your own image comes later.
          </p>
        </div>

        {error && <p role="alert" className="text-sm text-lantern">{error}</p>}
        <button className="btn-primary" onClick={createPack} disabled={saving}>
          {saving ? "Creating…" : "Create pack"}
        </button>
      </div>
    </main>
  );
}
