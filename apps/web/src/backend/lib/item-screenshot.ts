import { eq } from "drizzle-orm";

import { createDb } from "../db";
import { item } from "../db/schema";
import { normalizeItemKind } from "./item-capture";
import { assertPublicHttpUrl } from "./safe-url";
import { putItemObject } from "./item-storage";

/** CSS that hides common cookie / consent banners before capture. */
const COOKIE_BANNER_CSS = `
[id*="cookie" i],
[class*="cookie" i],
[id*="consent" i],
[class*="consent" i],
[id*="gdpr" i],
[class*="gdpr" i],
[aria-label*="cookie" i],
[aria-label*="consent" i],
#onetrust-banner-sdk,
#onetrust-consent-sdk,
.onetrust-pc-dark-filter,
.ot-sdk-container,
#CybotCookiebotDialog,
#CookiebotWidget,
#sp_message_container,
.qc-cmp2-container,
.fc-consent-root,
#didomi-host,
.didomi-popup-container,
.osano-cm-window,
#osano-cm-dialog,
#user-consent,
.cc-window,
.cc-banner,
.cc-overlay,
.cky-consent-container,
.cky-overlay,
#usercentercmp,
.pm__overlay,
#iubenda-cs-banner,
.iubenda-cs-container,
#truste-consent-track,
.trustarc-banner-container,
div[class*="CookieConsent"],
#cookiebanner,
.cookie-banner,
.cookie-notice,
.cookie-modal,
.cookies-eu-banner,
#cookiescript_injected,
#termly-code-snippet-support,
[data-testid*="cookie" i]
{
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  visibility: hidden !important;
  height: 0 !important;
  max-height: 0 !important;
  overflow: hidden !important;
}
html, body {
  overflow: auto !important;
  position: static !important;
}
`;

/** Remove leftover overlays and unlock scroll after banners inject. */
const COOKIE_BANNER_JS = `
(() => {
  const selectors = [
    '[id*="cookie" i]',
    '[class*="cookie" i]',
    '[id*="consent" i]',
    '[class*="consent" i]',
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '#CybotCookiebotDialog',
    '#sp_message_container',
    '.qc-cmp2-container',
    '.fc-consent-root',
    '#didomi-host',
    '.osano-cm-window',
    '#usercentrics-root',
    '#iubenda-cs-banner',
  ];
  for (const sel of selectors) {
    try {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    } catch {}
  }
  document.documentElement.style.overflow = 'auto';
  document.body && (document.body.style.overflow = 'auto');
  document.body && (document.body.style.position = 'static');
})();
`;

export type SiteScreenshotResult = {
  bytes: ArrayBuffer;
  contentType: string;
};

/**
 * Full-page screenshot via Cloudflare Browser Run.
 * Hides cookie/consent banners; does not send visitor cookies.
 */
export async function captureSiteScreenshot(
  env: Env,
  url: string,
): Promise<SiteScreenshotResult | null> {
  if (!env.BROWSER) return null;

  try {
    assertPublicHttpUrl(url);
    const response = await env.BROWSER.quickAction("screenshot", {
      url,
      screenshotOptions: {
        fullPage: true,
        type: "jpeg",
        quality: 72,
      },
      viewport: {
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
      },
      gotoOptions: {
        waitUntil: "networkidle2",
        timeout: 45_000,
      },
      cookies: [],
      addStyleTag: [{ content: COOKIE_BANNER_CSS }],
      addScriptTag: [{ content: COOKIE_BANNER_JS }],
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      console.error("site screenshot failed", response.status, detail);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 100) return null;
    return { bytes, contentType };
  } catch (error) {
    console.error("site screenshot error", error);
    return null;
  }
}

export async function storeSiteScreenshot(
  env: Env,
  userId: string,
  itemId: string,
  url: string,
): Promise<string | null> {
  const shot = await captureSiteScreenshot(env, url);
  if (!shot) return null;

  const ext = shot.contentType.includes("png") ? "png" : "jpg";
  const key = `${userId}/${itemId}/preview.${ext}`;
  await putItemObject(env.ITEMS_BUCKET, key, shot.bytes, shot.contentType);
  return key;
}

const previewCaptures = new Set<string>();

/** Capture a missing link screenshot without re-running AI enrichment. */
export function scheduleMissingSitePreview(
  ctx: { waitUntil(promise: Promise<unknown>): void },
  env: Env,
  itemId: string,
): void {
  if (previewCaptures.has(itemId)) return;
  previewCaptures.add(itemId);
  ctx.waitUntil(
    (async () => {
      const db = createDb(env.DB);
      const [row] = await db
        .select({
          id: item.id,
          kind: item.kind,
          url: item.url,
          userId: item.userId,
          previewR2Key: item.previewR2Key,
        })
        .from(item)
        .where(eq(item.id, itemId))
        .limit(1);
      if (
        !row?.url ||
        normalizeItemKind(row.kind) !== "link" ||
        row.previewR2Key
      ) {
        return;
      }
      const key = await storeSiteScreenshot(env, row.userId, row.id, row.url);
      if (!key) return;
      await db
        .update(item)
        .set({ previewR2Key: key })
        .where(eq(item.id, itemId));
    })()
      .catch((error) => {
        console.error("site preview capture failed", itemId, error);
      })
      .finally(() => {
        previewCaptures.delete(itemId);
      }),
  );
}
