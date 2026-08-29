import { tweetIdFromUrl } from "./tweet";

export function shouldCaptureScreenshot(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return !tweetIdFromUrl(url);
  } catch {
    return false;
  }
}
