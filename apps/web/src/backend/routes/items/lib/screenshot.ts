import { tweetIdFromUrl } from "@shared/tweet";

import { assertPublicHttpUrl } from "../../../lib/safe-url";
import { putItemObject } from "./storage";

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

export type SiteScreenshotResult = {
  bytes: ArrayBuffer;
  contentType: string;
};

export function shouldCaptureScreenshot(url: string): boolean {
  if (tweetIdFromUrl(url)) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "raindrop.io" || host === "app.raindrop.io") return false;
    if (host.endsWith(".raindrop.io") || host.endsWith(".raindrop.page")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function captureSiteScreenshot(
  env: Env,
  url: string,
): Promise<SiteScreenshotResult | null> {
  if (!env.BROWSER) return null;
  if (!shouldCaptureScreenshot(url)) return null;

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
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      },
      cookies: [],
      addStyleTag: [{ content: COOKIE_BANNER_CSS }],
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
