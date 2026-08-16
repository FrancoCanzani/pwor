export function isRaindropUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return (
      host === "raindrop.io" ||
      host === "app.raindrop.io" ||
      host.endsWith(".raindrop.io") ||
      host.endsWith(".raindrop.page")
    );
  } catch {
    return false;
  }
}

export function scrapeRaindropOriginalUrl(): string | null {
  const raindropHost = (hostname: string) => {
    const host = hostname.replace(/^www\./, "").toLowerCase();
    return (
      host === "raindrop.io" ||
      host === "app.raindrop.io" ||
      host.endsWith(".raindrop.io") ||
      host.endsWith(".raindrop.page")
    );
  };

  const original = (href: string | null | undefined) => {
    if (!href) return null;
    try {
      const parsed = new URL(href, location.href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      if (raindropHost(parsed.hostname)) return null;
      return parsed.href;
    } catch {
      return null;
    }
  };

  const fromButtons = original(
    document.querySelector<HTMLAnchorElement>(
      '[data-button="new_tab"], [data-button="current_tab"]',
    )?.href,
  );
  if (fromButtons) return fromButtons;

  const externals = [
    ...document.querySelectorAll<HTMLAnchorElement>('a[href][target="_blank"]'),
  ]
    .map((anchor) => original(anchor.href))
    .filter((href): href is string => Boolean(href));

  if (/\/item\/\d+/.test(location.pathname)) {
    const unique = [...new Set(externals)];
    if (unique[0]) return unique[0];
  }

  const selected = [
    ...document.querySelectorAll<HTMLAnchorElement>(
      '[aria-current="true"] a[href], [aria-selected="true"] a[href]',
    ),
  ]
    .map((anchor) => original(anchor.href))
    .filter((href): href is string => Boolean(href));
  return selected[0] ?? null;
}

export async function resolveCaptureUrl(
  tab: { id?: number; url?: string },
  rawUrl?: string | null,
): Promise<string | null> {
  const url = rawUrl || tab.url || null;
  if (!url) return null;
  if (!isRaindropUrl(url) || tab.id == null) return url;
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeRaindropOriginalUrl,
    });
    const found = results?.[0]?.result;
    if (typeof found === "string" && found) return found;
  } catch {
    return url;
  }
  return url;
}
