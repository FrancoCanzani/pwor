import { createNote } from "@features/notes/api";
import {
  createVaultSnippet,
  uploadVaultItem,
} from "@features/vault/api";
import { classifyIngestFile } from "@shared/ingest-file";
import {
  inferTitleFromRaw,
  prependFrontmatter,
} from "@shared/note-frontmatter";
import { languageFromFilename } from "@shared/snippet-language";

export type IngestFileResult =
  | { kind: "note"; id: string }
  | { kind: "snippet"; id: string }
  | { kind: "file"; id: string };

/**
 * Canonical client ingest: one policy, all entry points.
 * Markdown → note, code → snippet, else → vault file upload.
 */
export async function ingestFile(
  file: File,
  {
    workspaceId,
    categoryId,
  }: {
    workspaceId?: string | null;
    categoryId?: string | null;
  } = {},
): Promise<IngestFileResult> {
  const kind = classifyIngestFile(file.name, file.type);

  switch (kind) {
    case "note": {
      const raw = await file.text();
      const inferred = inferTitleFromRaw(raw).title;
      const fallbackTitle = file.name.replace(/\.md$/i, "");
      const title = inferred || fallbackTitle;
      const body = inferred
        ? raw
        : prependFrontmatter(raw, { title: fallbackTitle, tags: [] });
      const note = await createNote(body, title, workspaceId);
      return { kind: "note", id: note.id };
    }
    case "snippet": {
      const content = await file.text();
      const item = await createVaultSnippet(content, {
        title: file.name,
        language: languageFromFilename(file.name),
        workspaceId,
        categoryId,
      });
      return { kind: "snippet", id: item.id };
    }
    case "file": {
      const item = await uploadVaultItem(file, workspaceId, categoryId);
      return { kind: "file", id: item.id };
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export async function ingestFiles(
  files: Iterable<File>,
  options: {
    workspaceId?: string | null;
    categoryId?: string | null;
  } = {},
): Promise<{
  results: IngestFileResult[];
  notesChanged: boolean;
  vaultChanged: boolean;
}> {
  const results: IngestFileResult[] = [];
  let notesChanged = false;
  let vaultChanged = false;

  for (const file of files) {
    const result = await ingestFile(file, options);
    results.push(result);
    if (result.kind === "note") notesChanged = true;
    else vaultChanged = true;
  }

  return { results, notesChanged, vaultChanged };
}
