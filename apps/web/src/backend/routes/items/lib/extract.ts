import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "code",
  "pre",
  "blockquote",
  "cite",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "video",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "sup",
]);

const ALLOWED_ATTR = new Set([
  "href",
  "src",
  "srcset",
  "alt",
  "title",
  "poster",
  "controls",
  "playsinline",
  "preload",
  "width",
  "height",
]);

const STRIPPED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "form",
  "input",
  "button",
  "svg",
  "math",
  "noscript",
  "template",
  "audio",
  "source",
  "track",
  "canvas",
]);

const SAFE_URL_RE = /^(https?:|mailto:|tel:|#|\/)/i;

const LAZY_SRC_ATTRS = [
  "src",
  "data-src",
  "data-lazy-src",
  "data-original",
  "data-orig-src",
];

const LAZY_SRCSET_ATTRS = ["srcset", "data-srcset", "data-lazy-srcset"];
const PHRASING_PARENTS = new Set(["P", "SPAN", "A", "STRONG", "EM"]);

export type ExtractedArticle = {
  title: string | null;
  excerpt: string | null;
  html: string;
};

interface DomNode {
  nodeType: number;
  textContent: string | null;
  nextSibling: DomNode | null;
}

interface DomElement extends DomNode {
  tagName: string;
  innerHTML: string;
  childNodes: DomNode[];
  parentElement: DomElement | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttributeNames(): string[];
  remove(): void;
  replaceWith(...nodes: DomNode[]): void;
  insertBefore(node: DomNode, ref: DomNode | null): void;
  querySelector(selector: string): DomElement | null;
  querySelectorAll(selector: string): DomElement[];
  prepend(node: DomElement): void;
}

interface DomDocument {
  head: DomElement | null;
  body: DomElement;
  querySelector(selector: string): DomElement | null;
  createElement(tag: string): DomElement;
  createTextNode(data: string): DomNode;
}

function parseDocument(html: string): DomDocument {
  return parseHTML(html).document;
}

function ensureBase(document: DomDocument, url: string): void {
  let base = document.querySelector("base");
  if (!base) {
    base = document.createElement("base");
    document.head?.prepend(base);
  }
  base.setAttribute("href", url);
}

function firstSrcsetUrl(srcset: string): string | null {
  if (!srcset || srcset.startsWith("data:")) return null;
  const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
  return first && !first.startsWith("data:") ? first : null;
}

function attrValue(el: DomElement, names: string[]): string | null {
  for (const name of names) {
    const value = el.getAttribute(name)?.trim() ?? "";
    if (value && !value.startsWith("data:")) return value;
  }
  return null;
}

function promoteMediaSources(root: DomElement): void {
  for (const video of root.querySelectorAll("video")) {
    if (attrValue(video, LAZY_SRC_ATTRS)) continue;
    const source = video.querySelector("source");
    const src = source ? attrValue(source, LAZY_SRC_ATTRS) : null;
    if (src) video.setAttribute("src", src);
  }
}

function wrapBareVideos(root: DomElement, document: DomDocument): void {
  // Readability drops loose <video>; wrap so parse keeps them, unwrap after.
  const alreadyWrapped = new Set(root.querySelectorAll("figure video"));
  for (const video of [...root.querySelectorAll("video")]) {
    if (alreadyWrapped.has(video)) continue;
    if (!attrValue(video, LAZY_SRC_ATTRS) && !video.getAttribute("src")) continue;
    const figure = document.createElement("figure");
    video.replaceWith(figure);
    figure.prepend(video);
  }
}

function liftMediaFromFigures(root: DomElement): void {
  for (const figure of [...root.querySelectorAll("figure")]) {
    const media = figure.querySelector("video") ?? figure.querySelector("img");
    if (media) figure.replaceWith(media);
  }
}

function hoistBlockMedia(root: DomElement): void {
  for (const media of [...root.querySelectorAll("video, img, table")]) {
    let parent = media.parentElement;
    while (parent && parent !== root && PHRASING_PARENTS.has(parent.tagName)) {
      const grand = parent.parentElement;
      if (!grand) break;
      grand.insertBefore(media, parent);
      if (!parent.textContent?.trim() && parent.childNodes.length === 0) {
        parent.remove();
      }
      parent = media.parentElement;
    }
  }
}

function rewriteLazyImages(root: DomElement): void {
  for (const picture of root.querySelectorAll("picture")) {
    const img = picture.querySelector("img");
    if (!img) continue;
    if (!attrValue(img, LAZY_SRC_ATTRS) && !attrValue(img, LAZY_SRCSET_ATTRS)) {
      const source = picture.querySelector("source");
      if (source) {
        const srcset = attrValue(source, LAZY_SRCSET_ATTRS);
        if (srcset) img.setAttribute("srcset", srcset);
      }
    }
  }

  for (const media of root.querySelectorAll("img, video")) {
    const srcset = attrValue(media, LAZY_SRCSET_ATTRS);
    const src =
      attrValue(media, LAZY_SRC_ATTRS) ??
      (srcset ? firstSrcsetUrl(srcset) : null);
    if (src) media.setAttribute("src", src);
    else media.removeAttribute("src");
    if (media.tagName === "IMG") {
      if (srcset) media.setAttribute("srcset", srcset);
      else media.removeAttribute("srcset");
    }
  }
}

function stripLinkOnlyAnchors(root: DomElement): void {
  for (const anchor of root.querySelectorAll("a")) {
    if (anchor.querySelector("img")) continue;
    const text = (anchor.textContent ?? "").trim();
    if (/^link$/i.test(text)) anchor.remove();
  }
}

function dedupeAdjacentImages(root: DomElement): void {
  for (const img of root.querySelectorAll("img")) {
    let sibling = img.nextSibling;
    while (sibling && sibling.nodeType === 3 && !sibling.textContent?.trim()) {
      sibling = sibling.nextSibling;
    }
    const src = img.getAttribute("src");
    if (
      src &&
      sibling &&
      sibling.nodeType === 1 &&
      (sibling as DomElement).tagName === "IMG" &&
      (sibling as DomElement).getAttribute("src") === src
    ) {
      (sibling as DomElement).remove();
    }
  }
}

function resolveUrl(value: string, base: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }
  try {
    return new URL(trimmed, base).href;
  } catch {
    return null;
  }
}

function setAbsUrl(el: DomElement, attr: string, base: string): void {
  const value = el.getAttribute(attr);
  if (!value) return;
  const resolved = resolveUrl(value, base);
  if (resolved && SAFE_URL_RE.test(resolved)) el.setAttribute(attr, resolved);
  else el.removeAttribute(attr);
}

function absolutizeUrls(root: DomElement, base: string): void {
  for (const el of root.querySelectorAll("a, img, video")) {
    setAbsUrl(el, "href", base);
    setAbsUrl(el, "src", base);
    setAbsUrl(el, "poster", base);
    const srcset = el.getAttribute("srcset");
    if (!srcset) continue;
    const parts = srcset.split(",").flatMap((entry) => {
      const [url, descriptor] = entry.trim().split(/\s+/, 2);
      if (!url) return [];
      const resolved = resolveUrl(url, base);
      if (!resolved || !SAFE_URL_RE.test(resolved)) return [];
      return [descriptor ? `${resolved} ${descriptor}` : resolved];
    });
    if (parts.length > 0) el.setAttribute("srcset", parts.join(", "));
    else el.removeAttribute("srcset");
  }
}

function unwrap(el: DomElement, document: DomDocument): void {
  const children = [...el.childNodes];
  const nodes: DomNode[] = [];
  for (const child of children) {
    const last = nodes[nodes.length - 1];
    if (last && last.nodeType === 1 && child.nodeType === 1) {
      nodes.push(document.createTextNode(" "));
    }
    nodes.push(child);
  }
  if (nodes.length === 0) el.remove();
  else el.replaceWith(...nodes);
}

// DOMPurify never marks linkedom as a supported DOM (isSupported stays
// false) and silently returns input unchanged, so sanitize by hand.
function sanitize(root: DomElement, document: DomDocument): void {
  for (const el of root.querySelectorAll("*")) {
    const tag = el.tagName.toLowerCase();
    if (STRIPPED_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    for (const name of el.getAttributeNames()) {
      const lower = name.toLowerCase();
      const value = el.getAttribute(name) ?? "";
      const unsafeUrl =
        (lower === "href" || lower === "src" || lower === "poster") &&
        !SAFE_URL_RE.test(value);
      if (lower.startsWith("on") || !ALLOWED_ATTR.has(lower) || unsafeUrl) {
        el.removeAttribute(name);
      }
    }

    if (tag === "video" && el.getAttribute("src")) {
      el.setAttribute("controls", "");
      el.setAttribute("playsinline", "");
      el.setAttribute("preload", "metadata");
    }

    if (!ALLOWED_TAGS.has(tag)) unwrap(el, document);
  }
}

export function extractArticleHtml(
  rawHtml: string,
  url: string,
): ExtractedArticle | null {
  const document = parseDocument(rawHtml);
  ensureBase(document, url);
  promoteMediaSources(document.body);
  rewriteLazyImages(document.body);
  wrapBareVideos(document.body, document);

  let article;
  try {
    article = new Readability(document, { keepClasses: false }).parse();
  } catch {
    return null;
  }
  if (!article?.content) return null;

  const parsed = parseDocument(
    `<html><body><div>${article.content}</div></body></html>`,
  );
  const root = parsed.body.querySelector("div");
  if (!root) return null;

  promoteMediaSources(root);
  rewriteLazyImages(root);
  liftMediaFromFigures(root);
  hoistBlockMedia(root);
  stripLinkOnlyAnchors(root);
  dedupeAdjacentImages(root);
  sanitize(root, parsed);
  absolutizeUrls(root, url);
  const html = root.innerHTML.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!html) return null;

  return {
    title: article.title?.trim() || null,
    excerpt: article.excerpt?.trim() || null,
    html,
  };
}
