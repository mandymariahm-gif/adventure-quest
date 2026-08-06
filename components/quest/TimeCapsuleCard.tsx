"use client";
import { useState } from "react";

const PREVIEW_FIELDS = [
  "Favorite beer tonight",
  "Favorite brewery",
  "Funniest moment",
  "Biggest surprise",
  "Favorite animal",
  "Prediction for next year",
  "One goal before we're back",
];

export default function TimeCapsulePreview() {
  const [open, setOpen] = useState(false);

  return (
    <div className="ticket p-4 mt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display leading-tight">⏳ Time Capsule</h2>
          <p className="mt-0.5 text-xs uppercase tracking-wide text-ink/50">
            Sealed at the end of the night
          </p>
        </div>
        <button
          className="btn-paper !min-h-[40px] !px-3 text-sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Hide" : "Preview"}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="text-xs text-ink/60 mb-3">
            Seven questions waiting for you at the end of the night — start thinking now! 🧠
          </p>
          <ol className="flex flex-col gap-2">
            {PREVIEW_FIELDS.map((label, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="font-display text-amber mt-0.5">{i + 1}.</span>
                <span className="text-ink/80">{label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-ink/40 text-center italic">
            Your answers lock until next year. Be honest — future you is watching.
          </p>
        </div>
      )}
    </div>
  );
}
