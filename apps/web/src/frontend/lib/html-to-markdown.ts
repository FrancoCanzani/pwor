import MarkdownIt from "markdown-it";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

turndown.addRule("strike", {
  filter: (node) => ["DEL", "S", "STRIKE"].includes(node.nodeName),
  replacement: (content) => (content ? `~~${content}~~` : ""),
});

const markdown = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: true,
});

export function htmlToMarkdown(html: string): string {
  return turndown
    .turndown(html)
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function markdownToHtml(source: string): string {
  return markdown.render(source);
}
