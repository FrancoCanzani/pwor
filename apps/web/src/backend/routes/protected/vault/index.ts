import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createDb } from "../../../db";
import { ownedBy } from "../../../db/helpers";
import { note, vaultItem } from "../../../db/schema";
import { classifyIngestFile } from "@shared/ingest-file";
import {
  inferTitleFromRaw,
  prependFrontmatter,
} from "@shared/note-frontmatter";
import {
  languageFromFilename,
  languageFromMime,
} from "@shared/snippet-language";
import {
  parseCaptureInput,
  titleFromText,
} from "../../../lib/vault-capture";
import { scheduleVaultEnrichment } from "../../../lib/vault-enrichment";
import {
  putVaultObject,
  vaultObjectByteSize,
} from "../../../lib/vault-storage";
import type { AppEnv } from "../../../types";
import categoriesRoutes from "./categories";
import { assertCategoryForWorkspace, serializeVaultItem } from "./helpers";

const listQuerySchema = z.object({
  workspaceId: z.string().optional(),
});

const updateVaultItemSchema = z
  .object({
    workspaceId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
  })
  .refine(
    (value) => value.workspaceId !== undefined || value.categoryId !== undefined,
    { message: "workspaceId or categoryId is required" },
  );

const captureSchema = z.object({
  input: z.string().trim().min(1),
  workspaceId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

const createSnippetSchema = z.object({
  content: z.string().min(1),
  title: z.string().trim().min(1).max(200).nullable().optional(),
  language: z.string().trim().min(1).max(40).nullable().optional(),
  workspaceId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

const listColumns = {
  id: vaultItem.id,
  kind: vaultItem.kind,
  title: vaultItem.title,
  summary: vaultItem.summary,
  tags: vaultItem.tags,
  language: vaultItem.language,
  mimeType: vaultItem.mimeType,
  url: vaultItem.url,
  siteName: vaultItem.siteName,
  categoryId: vaultItem.categoryId,
  workspaceId: vaultItem.workspaceId,
  parseStatus: vaultItem.parseStatus,
  createdAt: vaultItem.createdAt,
  r2Key: vaultItem.r2Key,
  content: vaultItem.content,
};

const app = new Hono<AppEnv>()
  .route("/categories", categoriesRoutes)

  .post("/", async (c) => {
    const user = c.get("user")!;
    const body = await c.req.parseBody();
    const file = body.file;
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : null;
    const categoryId =
      typeof body.categoryId === "string" && body.categoryId.length > 0
        ? body.categoryId
        : null;

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file is required" });
    }

    const db = createDb(c.env.DB);
    if (categoryId) {
      await assertCategoryForWorkspace(db, categoryId, user.id, workspaceId);
    }

    const contentType = file.type || "application/octet-stream";
    const ingestKind = classifyIngestFile(file.name, contentType);

    if (ingestKind === "note") {
      const raw = await file.text();
      const inferred = inferTitleFromRaw(raw).title;
      const fallbackTitle = file.name.replace(/\.md$/i, "");
      const title = inferred || fallbackTitle;
      const noteBody = inferred
        ? raw
        : prependFrontmatter(raw, { title: fallbackTitle, tags: [] });

      const [created] = await db
        .insert(note)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          body: noteBody,
          title,
          workspaceId,
        })
        .returning();

      return c.json({ ...created, ingestKind: "note" as const }, 201);
    }

    if (ingestKind === "snippet") {
      const content = await file.text();
      const language =
        languageFromFilename(file.name) ||
        languageFromMime(contentType) ||
        null;

      const [created] = await db
        .insert(vaultItem)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          kind: "snippet",
          title: file.name,
          content,
          language,
          mimeType: contentType,
          workspaceId,
          categoryId,
          parseStatus: "ready",
          parsedAt: new Date(),
        })
        .returning();

      return c.json(serializeVaultItem(created!), 201);
    }

    const id = crypto.randomUUID();
    const r2Key = `${user.id}/${id}/${file.name}`;

    await putVaultObject(
      c.env.VAULT_BUCKET,
      r2Key,
      await file.arrayBuffer(),
      contentType,
    );

    const [created] = await db
      .insert(vaultItem)
      .values({
        id,
        userId: user.id,
        title: file.name,
        r2Key,
        mimeType: contentType,
        workspaceId,
        categoryId,
        parseStatus: "pending",
      })
      .returning();

    scheduleVaultEnrichment(c.executionCtx, c.env, id);

    return c.json(serializeVaultItem(created!), 201);
  })

  .post("/snippet", zValidator("json", createSnippetSchema), async (c) => {
    const user = c.get("user")!;
    const { content, title, language, workspaceId, categoryId } =
      c.req.valid("json");
    const db = createDb(c.env.DB);
    const workspace = workspaceId ?? null;
    if (categoryId) {
      await assertCategoryForWorkspace(db, categoryId, user.id, workspace);
    }

    const resolvedTitle = title?.trim() || titleFromText(content);

    const [created] = await db
      .insert(vaultItem)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "snippet",
        title: resolvedTitle,
        content,
        language: language ?? null,
        workspaceId: workspace,
        categoryId: categoryId ?? null,
        parseStatus: "ready",
        parsedAt: new Date(),
      })
      .returning();

    return c.json(serializeVaultItem(created!), 201);
  })

  .post("/capture", zValidator("json", captureSchema), async (c) => {
    const user = c.get("user")!;
    const { input, workspaceId, categoryId } = c.req.valid("json");
    const db = createDb(c.env.DB);
    const workspace = workspaceId ?? null;
    if (categoryId) {
      await assertCategoryForWorkspace(db, categoryId, user.id, workspace);
    }

    const parsed = parseCaptureInput(input);
    const id = crypto.randomUUID();

    const [created] = await db
      .insert(vaultItem)
      .values(
        parsed.type === "url"
          ? {
              id,
              userId: user.id,
              kind: "link" as const,
              title: parsed.url,
              url: parsed.url,
              workspaceId: workspace,
              categoryId: categoryId ?? null,
              parseStatus: "pending" as const,
            }
          : {
              id,
              userId: user.id,
              kind: "text" as const,
              title: titleFromText(parsed.content),
              content: parsed.content,
              workspaceId: workspace,
              categoryId: categoryId ?? null,
              parseStatus: "pending" as const,
            },
      )
      .returning();

    scheduleVaultEnrichment(c.executionCtx, c.env, id);

    return c.json(serializeVaultItem(created!), 201);
  })

  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { workspaceId } = c.req.valid("query");
    const db = createDb(c.env.DB);

    const conditions = [eq(vaultItem.userId, user.id)];
    if (workspaceId) conditions.push(eq(vaultItem.workspaceId, workspaceId));

    const rows = await db
      .select(listColumns)
      .from(vaultItem)
      .where(and(...conditions))
      .orderBy(desc(vaultItem.createdAt));

    const sizes = await Promise.all(
      rows.map(async (row) => {
        if (row.r2Key) {
          return vaultObjectByteSize(c.env.VAULT_BUCKET, row.r2Key);
        }
        if (row.content) {
          return new TextEncoder().encode(row.content).byteLength;
        }
        return 0;
      }),
    );
    const totalBytes = sizes.reduce((sum, size) => sum + size, 0);

    const items = rows.map(({ content: _content, r2Key: _r2Key, ...item }) =>
      serializeVaultItem(item),
    );

    return c.json({ items, totalBytes });
  })

  .patch("/:id", zValidator("json", updateVaultItemSchema), async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const { workspaceId, categoryId } = c.req.valid("json");
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({
        id: vaultItem.id,
        workspaceId: vaultItem.workspaceId,
      })
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const nextWorkspaceId =
      workspaceId !== undefined ? workspaceId : existing.workspaceId;

    if (categoryId) {
      await assertCategoryForWorkspace(
        db,
        categoryId,
        user.id,
        nextWorkspaceId ?? null,
      );
    }

    const [updated] = await db
      .update(vaultItem)
      .set({
        ...(workspaceId !== undefined ? { workspaceId } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
      })
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .returning();

    return c.json(serializeVaultItem(updated!));
  })

  .delete("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select({
        id: vaultItem.id,
        r2Key: vaultItem.r2Key,
      })
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!item) throw new HTTPException(404, { message: "Not found" });

    await db.delete(vaultItem).where(eq(vaultItem.id, id));
    if (item.r2Key) await c.env.VAULT_BUCKET.delete(item.r2Key);

    return c.json({ id });
  })

  .get("/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select()
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!item) {
      throw new HTTPException(404, { message: "Not found" });
    }

    return c.json(serializeVaultItem(item));
  })

  .get("/:id/file", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = createDb(c.env.DB);

    const [item] = await db
      .select({
        r2Key: vaultItem.r2Key,
        mimeType: vaultItem.mimeType,
      })
      .from(vaultItem)
      .where(ownedBy(vaultItem.id, id, vaultItem.userId, user.id))
      .limit(1);

    if (!item || !item.r2Key || !item.mimeType) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const object = await c.env.VAULT_BUCKET.get(item.r2Key);
    if (!object) throw new HTTPException(404, { message: "File not found" });

    return new Response(object.body, {
      headers: { "Content-Type": item.mimeType },
    });
  });

export default app;
