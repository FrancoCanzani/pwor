import {
  documentFromHTML,
  emptyDocument,
  type DocumentJSON,
} from "@pwor/editor";
import {
  parseFrontmatter,
  readStoredNote,
} from "@shared/note-frontmatter";
import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false });

export function bodyToDocument(raw: string): DocumentJSON {
  const stored = readStoredNote(raw);
  if (stored.kind === "tiptap") return stored.doc;
  const { body } = parseFrontmatter(stored.raw);
  if (body.trim().length === 0) return emptyDocument();
  return documentFromHTML(markdown.render(body));
}
