/** Format vault storage as GB in 0.1 steps. Non-empty vaults never show 0.0. */
export function formatGb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0.0 GB";

  const gb = bytes / 1024 ** 3;
  // Round up to the next tenth so any files read as at least 0.1 GB.
  const tenths = Math.max(0.1, Math.ceil(gb * 10) / 10);
  return `${tenths.toFixed(1)} GB`;
}
