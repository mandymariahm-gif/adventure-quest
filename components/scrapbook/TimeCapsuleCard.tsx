"use client";
import { useState } from "react";
import { enqueue, uuid } from "@/lib/offline/sync";
import type { TimeCapsuleInput } from "@/lib/types";

interface ExistingCapsule extends Partial<TimeCapsuleInput> {
  id: string;
  unlock_at: string;
}

const FIELDS: { key: keyof TimeCapsuleInput; label: string; placeholder: string }[] = [
  { key: "favorite_beer", label: "Favorite beer tonight", placeholder: "The hazy one with the otter on the can" },
  { key: "favorite_brewery", label: "Favorite brewery", placeholder: "" },
  { key: "funniest_moment", label: "Funniest moment", placeholder: "WhenΓÇª" },
  { key: "biggest_surprise", label: "Biggest surprise", placeholder: "" },
  { key: "favorite_animal", label: "Favorite animal", placeholder: "" },
  { key: "prediction_next_year", label: "Prediction for next year", placeholder: "Sealed until then ΓÇö be bold" },
  { key: "personal_goal", label: "One goal before we're back", placeholder: "" },
];

export default function TimeCapsuleCard({
  eventParticipantId,
  existing,
}: {
  eventParticipantId: string;
  existing: ExistingCapsule | null;
}) {
  const [open, setOpen] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [form, setForm] = useState<TimeCapsuleInput>({
    favorite_beer: "", favorite_brewery: "", funniest_moment: "",
    biggest_surprise: "", favorite_animal: "", prediction_next_year: "", personal_goal: "",
  });

  // capsule already exists and is unlocked ΓåÆ show it
  if (existing && new Date(existing.unlock_at) <= new Date()) {
    return (
      <div className="ticket p-5">
        <h2 className="font-display text-lg">ΓÅ│ Your Time Capsule ΓÇö unlocked</h2>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          {FIELDS.map(({ key, label }) =>
            existing[key] ? (
              <div key={key}>
                <dt className="text-ink/50">{label}</dt>
                <dd className="italic">ΓÇ£{existing[key]}ΓÇ¥</dd>
              </div>
            ) : null
          )}
        </dl>
      </div>
    );
  }

  if ((existing && new Date(existing.unlock_at) > new Date()) || sealed) {
    const unlockDate = existing ? new Date(existing.unlock_at).toLocaleDateString() : "next year";
    return (
      <div className="ticket p-5 text-center">
        <h2 className="font-display text-lg">ΓÅ│ Time Capsule sealed</h2>
        <p className="mt-1 text-sm text-ink/60">
          Your answers are locked away until {unlockDate}. Future you says thanks.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="ticket p-5 text-center">
        <h2 className="font-display text-lg">ΓÅ│ Seal your Time Capsule</h2>
        <p className="mt-1 text-sm text-ink/60">
          Seven quick answers about tonight, locked until next year&apos;s event.
          The best page of the scrapbook is the one you can&apos;t read yet.
        </p>
        <button className="btn-paper mt-4 w-full" onClick={() => setOpen(true)}>
          Fill it out
        </button>
      </div>
    );
  }

  async function seal() {
    await enqueue({
      id: uuid(),
      type: "time_capsule",
      event_participant_id: eventParticipantId,
      payload: form,
    });
    window.dispatchEvent(new CustomEvent("aq:queued"));
    setSealed(true);
  }

  return (
    <div className="ticket flex flex-col gap-3 p-5">
      <h2 className="font-display text-lg">ΓÅ│ Time Capsule</h2>
      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label htmlFor={key} className="!text-ink/70">{label}</label>
          <input
            id={key}
            className="field-paper"
            placeholder={placeholder}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        </div>
      ))}
      <button className="btn-paper mt-1" onClick={seal}>Seal until next year</button>
    </div>
  );
}
