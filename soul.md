# Pwor — Context for humans and agents

## Pitch

Drop anything. We turn it into clean, portable context that humans and agents can use.

Not a notes app. Not a file manager. Not another second brain. A **context system**: messy inputs go into Packs; the system ingests, parses, and exposes them.

## Core idea

**Drop → Compile → Use**

The main object is a **Pack** — a knowledge boundary (Acme Research, Design System, Customer Interviews). Users drop sources into it; the system organizes underneath. Hierarchy stays shallow: Packs → Sources.

**Workspaces** remain the standing context (company / life container). Packs live under a workspace. Ops surfaces (tasks, notes, calendar, inbox, vault UI, work log) are removed from the product — knowledge is Packs.

## Stack (Cloudflare)

| Layer | Choice |
| --- | --- |
| Frontend | Vite + React 19 + TanStack Router/Query + Tailwind + shadcn |
| API | Hono on Cloudflare Workers |
| Auth | better-auth (magic link) |
| DB | D1 + Drizzle |
| Blobs | R2 |
| Vectors | Vectorize |
| Queue | Cloudflare Queues |
| LLM | OpenRouter (cheap extraction + strong summaries/chat) |
| Embeddings | Workers AI / dedicated embedding model |
| Doc → Markdown | Workers AI `env.AI.toMarkdown()` (free for most formats; no Firecrawl) |

## Mental model

```
Drop → Ingest → Parse → Normalize → Understand → Index → Compile → Agent
```

Workers, not one autonomous agent, for the pipeline.

### Objects

- **Workspace** — org / life container (switcher in user menu)
- **Pack** — knowledge boundary inside a workspace
- **Source** — dropped item (files, URLs, text) — ingestion next; legacy `vault_item` still used by inbound email

## V1 surface (current)

- Workspaces + Packs CRUD
- Context sidebar: Packs for the current workspace
- Pack detail shell (drop zone placeholder, empty sources)
- Command palette (jump + pack search)
- Auth, onboarding, settings

## Next

- Source ingestion (content-addressed R2, `pack_sources`, async parse)
- Ask / compile
- MCP

## Explicitly not V1

Nested folders, team collaboration, task/notes/calendar product surface, web-browsing agents.

## Status

Product cut to Packs. Drop → store (content-hashed R2) → async `toMarkdown` → source list with status is wired. Schema tables: `pack`, `source`, `pack_source` (run migrations). Zip unpack, Browser Rendering for hard URLs, Ask/compile still next. Inbound email still on legacy vault path.
