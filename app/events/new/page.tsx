"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

interface PackOption { id: string; name: string; description: string | null }

const GAME_MODES = [
  { value: "casual", label: "🍺 Casual", description: "No leaderboard emphasis — just fun" },
  { value: "competitive", label: "🏆 Competitive", description: "Full leaderboard, scores prominent" },
  { value: "memory_maker", label: "📸 Memory Maker", description: "No leaderboard — focus on photos and stories" },
];

export default function NewEvent() {
  const router = useRouter();
  const [packs, setPacks] = useState<PackOption[]>([]);
  const [form, setForm] = useState({
    name: "", location: "", event_date: "", description: "",
    participant_limit: 20, quest_pack_id: "", game_mode: "casual",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabaseBrowser()
      .from("quest_packs").select("id,name,description").eq("is_public", true)
      .then(({ data }) => {
        setPacks(data ?? []);
        if (data?.[0]) setForm((f) => ({ ...f, quest_pack_id: data[0].id }));
      });
  }, []);

  async function createEvent() {
    if (!form.name.trim()) return setError("Give your event a name.");
    if (!form.quest_pack_id) return setError("Choose a quest pack.");
    setSaving(true);
    setError("");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      return setError(data.error ?? "Couldn't create the event. Try again.");
    }
    router.push(`/events/${data.event.id}/manage`);
  }

  return (
    <main className="mx-auto max-w-md p-5 pb-24">
      <header className="flex items-center gap-3 py-3">
        <button onClick={() => router.back()} className="btn-ghost !min-h-[40px] !px-3 text-sm" aria-label="Back">←</button>
        <h1 className="text-2xl">New event</h1>
      </header>

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="name">Event name</label>
          <input id="name" className="field" placeholder="Brew at the Zoo 2026"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="location">Location</label>
          <input id="location" className="field" placeholder="Riverbanks Zoo"
            value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div>
          <label htmlFor="date">Date</label>
          <input id="date" type="date" className="field"
            value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
        </div>
        <div>
          <label htmlFor="desc">Description</label>
          <textarea id="desc" className="field" rows={3} placeholder="What's the plan?"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label htmlFor="limit">Participant limit</label>
          <div className="flex items-center gap-3">
            <button className="btn-ghost !min-h-[44px] !px-5" aria-label="Decrease limit"
              onClick={() => setForm((f) => ({ ...f, participant_limit: Math.max(2, f.participant_limit - 1) }))}>−</button>
            <span className="min-w-[3ch] text-center font-display text-xl">{form.participant_limit}</span>
            <button className="btn-ghost !min-h-[44px] !px-5" aria-label="Increase limit"
              onClick={() => setForm((f) => ({ ...f, participant_limit: Math.min(200, f.participant_limit + 1) }))}>+</button>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-paper/80">Game mode</legend>
          <div className="flex flex-col gap-2">
            {GAME_MODES.map((m) => (
              <label key={m.value} className={`ticket flex cursor-pointer items-center gap-3 p-4 ${form.game_mode === m.value ? "ring-4 ring-amber" : ""}`}>
                <input type="radio" name="game_mode" className="h-5 w-5 accent-[#E8A33D]"
                  checked={form.game_mode === m.value}
                  onChange={() => setForm({ ...form, game_mode: m.value })} />
                <span>
                  <span className="block font-display">{m.label}</span>
                  <span className="block text-sm text-ink/60">{m.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-paper/80">Quest pack</legend>
          <div className="flex flex-col gap-2">
            {packs.map((p) => (
              <label key={p.id} className={`ticket flex cursor-pointer items-center gap-3 p-4 ${form.quest_pack_id === p.id ? "ring-4 ring-amber" : ""}`}>
                <input type="radio" name="pack" className="h-5 w-5 accent-[#E8A33D]"
                  checked={form.quest_pack_id === p.id}
                  onChange={() => setForm({ ...form, quest_pack_id: p.id })} />
                <span>
                  <span className="block font-display">{p.name}</span>
                  {p.description && <span className="block text-sm text-ink/60">{p.description}</span>}
                </span>
              </label>
            ))}
            {packs.length === 0 && (
              <p className="text-sm text-paper/60">
                No quest packs found — run <code>npm run seed</code> to load Brew at the Zoo.
              </p>
            )}
          </div>
        </fieldset>

        {error && <p role="alert" className="text-sm text-lantern">{error}</p>}
        <button className="btn-primary" onClick={createEvent} disabled={saving}>
          {saving ? "Creating…" : "Create event"}
        </button>
      </div>
    </main>
  );
}
