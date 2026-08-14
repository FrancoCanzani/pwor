/** Format item storage as GB in 0.1 steps. Non-empty items never show 0.0. */
export function formatGb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0.0 GB";

  const gb = bytes / 1024 ** 3;
  // Round up to the next tenth so any files read as at least 0.1 GB.
  const tenths = Math.max(0.1, Math.ceil(gb * 10) / 10);
  return `${tenths.toFixed(1)} GB`;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number | null | undefined): string {
  if (!Number.isFinite(bytes) || !bytes || bytes <= 0) return "—";

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${BYTE_UNITS[unitIndex]}`;
}
