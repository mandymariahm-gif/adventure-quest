"use client";
import { useState } from "react";
import ThemeProvider, { type Theme } from "@/components/ThemeProvider";
import { channelsToHex, hexToChannels, contrastRatio } from "@/lib/theme-utils";

const DEFAULT_THEME: Required<Theme> = {
  pine: "20 41 31",
  moss: "35 64 47",
  fern: "111 163 107",
  amber: "232 163 61",
  lantern: "246 196 83",
  paper: "243 234 216",
  ink: "29 22 16",
};

const COLOR_FIELDS: { key: keyof Theme; label: string; hint: string }[] = [
  { key: "pine", label: "Pine", hint: "Main page background" },
  { key: "moss", label: "Moss", hint: "Secondary background tone" },
  { key: "fern", label: "Fern", hint: "Section headings & accents" },
  { key: "amber", label: "Amber", hint: "Primary buttons & highlights" },
  { key: "lantern", label: "Lantern", hint: "Legendary quest glow" },
  { key: "paper", label: "Paper", hint: "Light card backgrounds & header text" },
  { key: "ink", label: "Ink", hint: "Dark text on paper cards" },
];

const MIN_CONTRAST = 4.5; // WCAG AA minimum for normal text

export default function ThemePicker({
  packId,
  initialTheme,
}: {
  packId: string;
  initialTheme: Theme | null;
}) {
  const [theme, setTheme] = useState<Required<Theme>>({ ...DEFAULT_THEME, ...initialTheme });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const contrast = contrastRatio(theme.paper, theme.pine);
  const lowContrast = contrast < MIN_CONTRAST;

  function setColor(key: keyof Theme, hex: string) {
    setTheme((t) => ({ ...t, [key]: hexToChannels(hex) }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/quest-packs/${packId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme_json: theme }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save the theme.");
    setSaved(true);
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      <h2 className="font-display text-sm uppercase tracking-[0.25em] text-fern">Theme</h2>

      {/* Live preview — reuses the real ThemeProvider + real page styles, not a mockup */}
      <ThemeProvider theme={theme} className="rounded-xl bg-pine p-4">
        <h3 className="font-display text-lg text-paper">Header text</h3>
        <p className="mt-1 text-xs uppercase tracking-wide text-fern">Section label</p>
        <div className="ticket mt-3 p-4">
          <p className="font-display leading-tight">⭐ Sample quest title</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink/50">category · 10 pts</p>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-primary flex-1" disabled>Primary button</button>
          <button className="btn-paper flex-1" disabled>Paper button</button>
        </div>
      </ThemeProvider>

      {lowContrast ? (
        <p role="alert" className="text-sm text-lantern">
          ⚠️ Low contrast: "Paper" text on the "Pine" header only measures {contrast.toFixed(1)}:1
          — under {MIN_CONTRAST}:1, it may be hard to read. Try a lighter Paper or darker Pine.
        </p>
      ) : (
        <p className="text-sm text-fern">✓ Paper-on-Pine contrast: {contrast.toFixed(1)}:1 (readable)</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {COLOR_FIELDS.map(({ key, label, hint }) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="color"
              className="h-10 w-10 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
              value={channelsToHex(theme[key] ?? DEFAULT_THEME[key])}
              onChange={(e) => setColor(key, e.target.value)}
            />
            <span>
              <span className="block text-sm font-medium text-paper">{label}</span>
              <span className="block text-xs text-paper/50">{hint}</span>
            </span>
          </label>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-lantern">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={save} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save theme"}
        </button>
        <button
          className="btn-ghost !px-4"
          onClick={() => { setTheme(DEFAULT_THEME); setSaved(false); }}
          disabled={saving}
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}
