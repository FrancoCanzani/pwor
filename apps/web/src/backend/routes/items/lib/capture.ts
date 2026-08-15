import normalizeUrlLib from "normalize-url";

const TRACKING_PARAMS = [
  /^utm_/,
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  /^mc_[ce]id$/,
  "igshid",
  "si",
  "ref",
  "ref_src",
  "ref_url",
  "_hsenc",
  "_hsmi",
  "spm",
];

const TWEET_RE =
  /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+/i;
const URL_RE = /^https?:\/\/\S+$/i;

export type ParsedCapture =
  | { type: "url"; url: string }
  | { type: "text"; content: string };

export function parseCaptureInput(input: string): ParsedCapture {
  const trimmed = input.trim();
  const url = extractUrl(trimmed);
  if (url) return { type: "url", url };
  return { type: "text", content: trimmed };
}

export function titleFromText(content: string): string {
  const line = content.trim().split(/\n/)[0] ?? content.trim();
  return line.length > 60 ? `${line.slice(0, 60).trim()}…` : line;
}

export function normalizeUrl(rawUrl: string): string | null {
  try {
    return normalizeUrlLib(rawUrl, {
      stripWWW: true,
      stripHash: true,
      removeTrailingSlash: true,
      sortQueryParameters: true,
      removeQueryParameters: TRACKING_PARAMS,
    });
  } catch {
    return null;
  }
}

export function extractUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!URL_RE.test(trimmed) && !TWEET_RE.test(trimmed)) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

export function normalizeSeedTags(tags: string[] | undefined): string[] | null {
  if (!tags?.length) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag.slice(0, 40));
    if (out.length >= 12) break;
  }
  return out.length ? out : null;
}
