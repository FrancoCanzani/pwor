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
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

const ALLOWED_ATTR = new Set(["href", "src", "srcset", "alt", "title"]);

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
]);

const SAFE_URL_RE = /^(https?:|mailto:|tel:|#|\/)/i;

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
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttributeNames(): string[];
  remove(): void;
  replaceWith(...nodes: DomNode[]): void;
  querySelector(selector: string): DomElement | null;
  querySelectorAll(selector: string): DomElement[];
  prepend(node: DomElement): void;
}

interface DomDocument {
  head: DomElement | null;
  body: DomElement;
  querySelector(selector: string): DomElement | null;
  createElement(tag: string): DomElement;
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

// DOMPurify never marks linkedom as a supported DOM (isSupported stays
// false) and silently returns input unchanged, so sanitize by hand.
function sanitize(root: DomElement): void {
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
        (lower === "href" || lower === "src") && !SAFE_URL_RE.test(value);
      if (lower.startsWith("on") || !ALLOWED_ATTR.has(lower) || unsafeUrl) {
        el.removeAttribute(name);
      }
    }

    if (!ALLOWED_TAGS.has(tag)) el.replaceWith(...el.childNodes);
  }
}

export function extractArticleHtml(
  rawHtml: string,
  url: string,
): ExtractedArticle | null {
  const document = parseDocument(rawHtml);
  ensureBase(document, url);

  let article;
  try {
    article = new Readability(document, { keepClasses: false }).parse();
  } catch {
    return null;
  }
  if (!article?.content) return null;

  const root = parseDocument(
    `<html><body><div>${article.content}</div></body></html>`,
  ).body.querySelector("div");
  if (!root) return null;

  dedupeAdjacentImages(root);
  sanitize(root);
  const html = root.innerHTML.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!html) return null;

  return {
    title: article.title?.trim() || null,
    excerpt: article.excerpt?.trim() || null,
    html,
  };
}
