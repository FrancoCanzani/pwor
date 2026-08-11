/** Cosmic palettes for space pics — dark nebula-ish sets. */
const PALETTES: string[][] = [
  ["#0b1026", "#1a237e", "#4a148c", "#7c4dff", "#00bcd4"],
  ["#050814", "#0d1b2a", "#1b3a4b", "#415a77", "#778da9"],
  ["#120024", "#2d0060", "#6a00f4", "#b5179e", "#f72585"],
  ["#001219", "#005f73", "#0a9396", "#94d2bd", "#e9d8a6"],
  ["#10002b", "#240046", "#3c096c", "#5a189a", "#9d4edd"],
  ["#03071e", "#370617", "#6a040f", "#9d0208", "#dc2f02"],
  ["#012a4a", "#013a63", "#01497c", "#014f86", "#2a6f97"],
  ["#0f0e17", "#1f1635", "#3b1c5a", "#7b2cbf", "#c77dff"],
];

/** Stable 32-bit hash from a string (space id). */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function spacePicColors(spaceId: string): string[] {
  const h = hashString(spaceId);
  return PALETTES[h % PALETTES.length]!;
}

/** Paper StaticMeshGradient `positions` seed in 0–100. */
export function spacePicPositions(spaceId: string): number {
  return hashString(`pos:${spaceId}`) % 101;
}

export function spacePicRotation(spaceId: string): number {
  return hashString(`rot:${spaceId}`) % 360;
}
