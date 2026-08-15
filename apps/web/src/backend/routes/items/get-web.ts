import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

import { createDb } from "../../db";
import { ownedBy } from "../../db/helpers";
import { item } from "../../db/schema";
import { assertPublicHttpUrl } from "../../lib/safe-url";
import type { AppEnv } from "../../types";

const MAX_HTML_BYTES = 2_000_000;

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function failPage(message: string, href?: string) {
  const link = href
    ? ` <a href="${escapeAttr(href)}" target="_blank" rel="noreferrer">Open original</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:1.5rem;font:14px/1.5 system-ui,sans-serif;color:#737373">${message}${link}</body></html>`;
}

function stripScripts(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, "")
    .replace(/<link\b[^>]*rel=["']preload["'][^>]*as=["']script["'][^>]*>/gi, "")
    .replace(/<link\b[^>]*as=["']script["'][^>]*rel=["']preload["'][^>]*>/gi, "");
}

function openLinksInNewTab(html: string) {
  return html.replace(/<a\b([^>]*)>/gi, (open, attrs: string) => {
    const href = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const value = href?.[1] ?? href?.[2] ?? href?.[3] ?? "";
    if (!value || value.startsWith("#") || value.toLowerCase().startsWith("javascript:")) {
      return open;
    }
    let next = attrs.replace(/\s*\btarget\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    next = next.replace(/\s*\brel\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    return `<a${next} target="_blank" rel="noopener noreferrer">`;
  });
}

function htmlResponse(html: string) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}

export function registerGetItemWeb(app: Hono<AppEnv>) {
  return app.get("/:id/web", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [row] = await db
      .select({
        id: item.id,
        kind: item.kind,
        url: item.url,
      })
      .from(item)
      .where(ownedBy(item.id, id, item.userId, user.id))
      .limit(1);

    if (!row || row.kind !== "link" || !row.url) {
      throw new HTTPException(404, { message: "Not found" });
    }

    let pageUrl: URL;
    try {
      pageUrl = assertPublicHttpUrl(row.url);
    } catch {
      return htmlResponse(failPage("This URL can’t be opened here.", row.url));
    }

    let upstream: Response;
    try {
      upstream = await fetch(pageUrl.href, {
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch {
      return htmlResponse(failPage("Couldn't load this page.", row.url));
    }

    try {
      assertPublicHttpUrl(upstream.url);
    } catch {
      return htmlResponse(failPage("This URL can’t be opened here.", row.url));
    }

    if (!upstream.ok) {
      return htmlResponse(failPage("Couldn't load this page.", row.url));
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return htmlResponse(
        failPage("This page can’t be shown in the aside.", row.url),
      );
    }

    const html = stripScripts((await upstream.text()).slice(0, MAX_HTML_BYTES));
    const base = `<base href="${escapeAttr(upstream.url)}">`;
    const withBase = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (open) => `${open}${base}`)
      : `<head>${base}</head>${html}`;
    const framed = openLinksInNewTab(withBase)
      .replace(/<meta[^>]+http-equiv=["']?x-frame-options["']?[^>]*>/gi, "")
      .replace(
        /<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi,
        "",
      );

    return htmlResponse(framed);
  });
}
