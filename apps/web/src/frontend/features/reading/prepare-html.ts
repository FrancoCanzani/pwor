import DOMPurify from "dompurify";

const PHRASING_PARENTS = new Set(["P", "SPAN", "A", "STRONG", "EM", "B", "I"]);

export function prepareReaderHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["form", "input", "button"],
    ADD_TAGS: ["video", "source"],
    ADD_ATTR: [
      "controls",
      "playsinline",
      "preload",
      "poster",
      "width",
      "height",
    ],
  });
  const doc = new DOMParser().parseFromString(
    `<div id="reader-root">${clean}</div>`,
    "text/html",
  );
  const root = doc.getElementById("reader-root");
  if (!root) return clean;

  for (const figure of [...root.querySelectorAll("figure")]) {
    const media = figure.querySelector("video[src], img[src]");
    if (!media) continue;
    prepareVideo(media);
    figure.replaceWith(media);
  }

  for (const video of [...root.querySelectorAll("video")]) {
    prepareVideo(video);
    hoistOutOfPhrasing(video, root);
  }

  for (const anchor of [...root.querySelectorAll("a")]) {
    wrapFootnoteRef(anchor, doc);
  }

  return root.innerHTML;
}

function prepareVideo(el: Element) {
  if (el.tagName !== "VIDEO") return;
  const src =
    el.getAttribute("src") || el.querySelector("source")?.getAttribute("src");
  if (src && !el.getAttribute("src")) el.setAttribute("src", src);
  el.setAttribute("controls", "");
  el.setAttribute("playsinline", "");
  el.setAttribute("preload", "metadata");
}

function wrapFootnoteRef(anchor: Element, doc: Document) {
  if (anchor.parentElement?.closest("sup")) return;
  if (anchor.querySelector("img")) return;
  const text = (anchor.textContent ?? "").trim();
  if (!/^\d{1,2}$/.test(text)) return;
  const sup = doc.createElement("sup");
  anchor.replaceWith(sup);
  sup.appendChild(anchor);
}

function hoistOutOfPhrasing(el: Element, root: Element) {
  let parent = el.parentElement;
  while (
    parent &&
    parent !== root &&
    PHRASING_PARENTS.has(parent.tagName) &&
    parent.parentElement
  ) {
    const grand = parent.parentElement;
    grand.insertBefore(el, parent);
    if (!parent.textContent?.trim() && parent.childElementCount === 0) {
      parent.remove();
    }
    parent = el.parentElement;
  }
}
