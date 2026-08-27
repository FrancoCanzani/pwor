import { McpServer } from "@modelcontextprotocol/server";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { McpContext } from "./tools";
import {
  capture,
  captureInput,
  createNoteInput,
  createUserNote,
  getFeedItem,
  getItem,
  getNote,
  idInput,
  listSpaces,
  search,
  searchInput,
} from "./tools";

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

async function runTool(work: () => Promise<unknown>) {
  try {
    return jsonResult(await work());
  } catch (err) {
    if (err instanceof HTTPException) return errorResult(err.message);
    if (err instanceof z.ZodError) {
      return errorResult(err.issues.map((issue) => issue.message).join("; "));
    }
    console.error(err);
    return errorResult("Something went wrong");
  }
}

export function createPworMcpServer(ctx: McpContext) {
  const server = new McpServer({
    name: "pwor",
    version: "1.0.0",
    title: "Pwor",
  });

  server.registerTool(
    "search",
    {
      title: "Search",
      description:
        "Search the user's pile: saved pages, files, notes, and feed posts. Start here. Hits have kind item, note, or feed — open them with get_item, get_note, or get_feed_item.",
      inputSchema: searchInput,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => runTool(() => search(ctx, args)),
  );

  server.registerTool(
    "get_item",
    {
      title: "Open a save",
      description:
        "Open a saved page, file, or pasted text by id from search. Returns title, summary, url, and extracted text. Files have no binary payload.",
      inputSchema: idInput,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => runTool(() => getItem(ctx, args)),
  );

  server.registerTool(
    "get_note",
    {
      title: "Open a note",
      description: "Open a note the user wrote, by id from search.",
      inputSchema: idInput,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => runTool(() => getNote(ctx, args)),
  );

  server.registerTool(
    "get_feed_item",
    {
      title: "Open a feed post",
      description: "Open an RSS or YouTube feed post by id from search.",
      inputSchema: idInput,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => runTool(() => getFeedItem(ctx, args)),
  );

  server.registerTool(
    "list_spaces",
    {
      title: "List folders",
      description:
        "List the user's folders (spaces). Inbox is unfiled — not a folder. Use space ids with capture or create_note.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => runTool(() => listSpaces(ctx)),
  );

  server.registerTool(
    "capture",
    {
      title: "Save",
      description:
        "Save a URL or some text into the user's pile. Lands in inbox unless spaceId or autoSpace is set. Enrichment (title, summary, tags) runs in the background.",
      inputSchema: captureInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => runTool(() => capture(ctx, args)),
  );

  server.registerTool(
    "create_note",
    {
      title: "Write a note",
      description: "Create a note. body is plain text or markdown.",
      inputSchema: createNoteInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => runTool(() => createUserNote(ctx, args)),
  );

  return server;
}
