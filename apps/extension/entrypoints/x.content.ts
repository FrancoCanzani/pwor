import { STORAGE_KEYS } from "../lib/config";

const TOAST_ID = "pwor-clipper-toast";
const BTN_ATTR = "data-pwor-save";

function isTweetUrl(url: string): boolean {
  return /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/i.test(
    url,
  );
}

function tweetUrlFromArticle(article: Element): string | null {
  const link = article.querySelector(
    'a[href*="/status/"]',
  ) as HTMLAnchorElement | null;
  if (!link?.href) return null;
  try {
    const url = new URL(link.href);
    const match = url.pathname.match(/\/([^/]+)\/status\/(\d+)/);
    if (!match) return null;
    return `https://x.com/${match[1]}/status/${match[2]}`;
  } catch {
    return null;
  }
}

function tweetHint(article: Element): string {
  const text =
    article.querySelector('[data-testid="tweetText"]')?.textContent?.trim() ??
    "";
  const user =
    article.querySelector('[data-testid="User-Name"]')?.textContent?.trim() ??
    "";
  return [user, text].filter(Boolean).join("\n").slice(0, 2000);
}

function showToast(message: string) {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOAST_ID;
    el.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:2147483647",
      "background:#111",
      "color:#fff",
      "font:400 12px/1.4 Geist,ui-sans-serif,system-ui,sans-serif",
      "padding:8px 12px",
      "border-radius:8px",
      "opacity:0",
      "transform:translateY(6px)",
      "transition:opacity .18s ease, transform .18s ease",
      "pointer-events:none",
      "max-width:260px",
    ].join(";");
    document.documentElement.appendChild(el);
  }
  el.textContent = message;
  requestAnimationFrame(() => {
    el!.style.opacity = "1";
    el!.style.transform = "translateY(0)";
  });
  window.setTimeout(() => {
    el!.style.opacity = "0";
    el!.style.transform = "translateY(6px)";
  }, 1800);
}

async function saveTweet(
  url: string,
  hint: string,
  via: "button" | "bookmark",
) {
  const response = (await browser.runtime.sendMessage({
    type: "pwor:capture-tweet",
    url,
    hint,
    via,
  })) as
    | { ok: true; spaceName: string }
    | { ok: false; error: string }
    | undefined;

  if (!response) {
    showToast("Could not reach Pwor");
    return;
  }
  if (!response.ok) {
    if (response.error === "disabled") return;
    if (response.error === "Not signed in") {
      showToast("Sign in to Pwor first");
      return;
    }
    showToast(response.error);
    return;
  }
  showToast(`Saved to Pwor · ${response.spaceName}`);
}

function createSaveButton(article: Element) {
  if (article.querySelector(`[${BTN_ATTR}]`)) return;

  const group =
    article.querySelector('[role="group"]') ||
    article.querySelector('[data-testid="tweet"] [role="group"]');
  if (!group) return;

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute(BTN_ATTR, "1");
  button.setAttribute("aria-label", "Save to Pwor");
  button.title = "Save to Pwor";
  button.textContent = "P";
  button.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "width:34px",
    "height:34px",
    "margin-left:2px",
    "border:0",
    "border-radius:999px",
    "background:transparent",
    "color:#111",
    "font:700 12px/1 Geist,ui-sans-serif,system-ui,sans-serif",
    "cursor:pointer",
  ].join(";");

  button.addEventListener("mouseenter", () => {
    button.style.background = "rgba(0,0,0,0.06)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.background = "transparent";
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const url = tweetUrlFromArticle(article);
    if (!url) {
      showToast("Could not find tweet URL");
      return;
    }
    void saveTweet(url, tweetHint(article), "button");
  });

  group.appendChild(button);
}

function enhanceTweets(showInline: boolean) {
  if (!showInline) return;
  const articles = document.querySelectorAll(
    'article[data-testid="tweet"], article[role="article"]',
  );
  articles.forEach((article) => createSaveButton(article));
}

function findArticleFromEventTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest('article[data-testid="tweet"], article[role="article"]');
}

function looksLikeBookmarkControl(target: Element): boolean {
  const testId = target
    .closest("[data-testid]")
    ?.getAttribute("data-testid");
  if (testId === "bookmark" || testId === "removeBookmark") return true;
  const label = (
    target.getAttribute("aria-label") ||
    target.closest("[aria-label]")?.getAttribute("aria-label") ||
    ""
  ).toLowerCase();
  return label.includes("bookmark");
}

export default defineContentScript({
  matches: ["https://x.com/*", "https://twitter.com/*"],
  runAt: "document_idle",
  main() {
    let showInline = true;
    let saveOnBookmark = true;

    void browser.storage.local
      .get([STORAGE_KEYS.showInlineButton, STORAGE_KEYS.saveOnBookmark])
      .then((stored) => {
        showInline = stored[STORAGE_KEYS.showInlineButton] !== false;
        saveOnBookmark = stored[STORAGE_KEYS.saveOnBookmark] !== false;
        enhanceTweets(showInline);
      });

    const observer = new MutationObserver(() => {
      enhanceTweets(showInline);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    document.addEventListener(
      "click",
      (event) => {
        if (!saveOnBookmark) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!looksLikeBookmarkControl(target)) return;

        const article = findArticleFromEventTarget(target);
        if (!article) return;
        const url = tweetUrlFromArticle(article);
        if (!url || !isTweetUrl(url)) return;

        const label = (
          target.getAttribute("aria-label") ||
          target.closest("[aria-label]")?.getAttribute("aria-label") ||
          ""
        ).toLowerCase();
        // Unbookmark must not delete from Pwor (capture is additive).
        if (label.includes("remove") || label.includes("unbookmark")) return;

        window.setTimeout(() => {
          void saveTweet(url, tweetHint(article), "bookmark");
        }, 120);
      },
      true,
    );

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (STORAGE_KEYS.showInlineButton in changes) {
        showInline = changes[STORAGE_KEYS.showInlineButton]?.newValue !== false;
        if (!showInline) {
          document
            .querySelectorAll(`[${BTN_ATTR}]`)
            .forEach((node) => node.remove());
        } else {
          enhanceTweets(true);
        }
      }
      if (STORAGE_KEYS.saveOnBookmark in changes) {
        saveOnBookmark =
          changes[STORAGE_KEYS.saveOnBookmark]?.newValue !== false;
      }
    });
  },
});
