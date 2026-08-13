/**
 * Color helpers for the theme picker.
 *
 * Your CSS variables store colors as space-separated channel numbers
 * (e.g. "20 41 31") so Tailwind can apply opacity to them. A browser's
 * native color picker (<input type="color">) speaks hex (e.g. "#14291f")
 * instead — these functions convert between the two, plus calculate
 * contrast ratio (the standard accessibility measure of "can you actually
 * read this text against this background").
 */

export function hexToChannels(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function channelsToHex(channels: string): string {
  const [r, g, b] = channels.trim().split(/\s+/).map(Number);
  const toHex = (n: number) => Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** WCAG relative luminance — how bright a color perceptually is, 0 (black) to 1 (white). */
function relativeLuminance(channels: string): number {
  const [r, g, b] = channels.trim().split(/\s+/).map(Number).map((c) => c / 255);
  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [R, G, B] = [linearize(r), linearize(g), linearize(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * WCAG contrast ratio between two colors, from 1 (identical — unreadable)
 * to 21 (black on white — maximum readable). 4.5 is the standard minimum
 * for body text; this app uses it for paper-on-pine header text.
 */
export function contrastRatio(channelsA: string, channelsB: string): number {
  const L1 = relativeLuminance(channelsA);
  const L2 = relativeLuminance(channelsB);
  const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
}
