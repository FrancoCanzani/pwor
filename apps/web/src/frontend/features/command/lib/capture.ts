import { tweetIdFromUrl } from "@shared/tweet";

const URL_RE = /^https?:\/\/\S+$/i;

export type CaptureDestination =
  | { kind: "inbox" }
  | { kind: "auto" }
  | { kind: "space"; id: string };

export function isCaptureUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (tweetIdFromUrl(trimmed)) return true;
  return URL_RE.test(trimmed);
}

export function captureHost(input: string): string | null {
  const trimmed = input.trim();
  if (!isCaptureUrl(trimmed)) return null;
  try {
    return new URL(trimmed).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function destinationKey(dest: CaptureDestination): string {
  switch (dest.kind) {
    case "inbox":
      return "inbox";
    case "auto":
      return "auto";
    case "space":
      return dest.id;
    default: {
      const _exhaustive: never = dest;
      return _exhaustive;
    }
  }
}

export function destinationFromKey(key: string): CaptureDestination {
  if (key === "inbox") return { kind: "inbox" };
  if (key === "auto") return { kind: "auto" };
  return { kind: "space", id: key };
}

export function cycleDestination(
  dest: CaptureDestination,
  spaceIds: string[],
  direction: 1 | -1,
): CaptureDestination {
  const keys = [
    "inbox",
    ...(spaceIds.length > 0 ? ["auto"] : []),
    ...spaceIds,
  ];
  const current = destinationKey(dest);
  const index = keys.indexOf(current);
  const from = index === -1 ? 0 : index;
  const next = keys[(from + direction + keys.length) % keys.length];
  if (!next) return dest;
  return destinationFromKey(next);
}

export function destinationLabel(
  dest: CaptureDestination,
  spaces: { id: string; name: string }[],
): string {
  switch (dest.kind) {
    case "inbox":
      return "Inbox";
    case "auto":
      return "File for me";
    case "space": {
      const name = spaces.find((space) => space.id === dest.id)?.name.trim();
      return name || "Untitled";
    }
    default: {
      const _exhaustive: never = dest;
      return _exhaustive;
    }
  }
}

export function captureRequest(dest: CaptureDestination): {
  workspaceId: string | null;
  autoSpace: boolean;
} {
  switch (dest.kind) {
    case "inbox":
      return { workspaceId: null, autoSpace: false };
    case "auto":
      return { workspaceId: null, autoSpace: true };
    case "space":
      return { workspaceId: dest.id, autoSpace: false };
    default: {
      const _exhaustive: never = dest;
      return _exhaustive;
    }
  }
}
