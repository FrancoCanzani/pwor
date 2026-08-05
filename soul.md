# Pwor — Personal Intelligence Layer

## Pitch

Your second brain that builds itself. Throw in emails, WhatsApps, PDFs, voice notes, screenshots, links, and files. AI organizes everything into connected, living pages you can search, chat with, and rely on for reminders — without folders, tags, or manual organization.

Layered on top: a super-indie, Linear-style personal workspace. One person, minimal chrome, no team ceremony — just a place to run your actual work and life.

## Core idea

Not tasks. **Objects + relationships.**

Every capture answers one question: *what part of the user's life does this belong to?*

**Workspaces are the one exception to "no folders."** Not a filing system — a small, fairly fixed set of standing contexts (Work, Life, Holidays…) a user separates their world into. No status, no lifecycle — a workspace is just a label, not a task. Tasks, notes, and vault items can optionally belong to one, and each workspace can generate inbound email addresses so external capture routes straight into the right context instead of landing unsorted. Selection lives in a switcher embedded in the user menu, not its own nav destination, and remembers the last one you picked.

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
Capture → OCR/STT → Extract → Embed → Match → Merge/Create → Summarize → Remind → Index
```

Workers, not agents, for ingestion.

Vault / email attachments: raw bytes stay in R2; `AI.toMarkdown` produces searchable LLM-ready markdown (PDF, DOCX, XLS*, ODT/ODS, CSV, HTML, images). PPTX/RTF/EPUB/legacy `.doc` are out of CF's list — fall back later via pure-JS/WASM or a Container running anydoc if needed. Never pay Firecrawl Parse for the default path.

### Storage worlds

- **Raw** — immutable inputs (`raw_items`)
- **Knowledge** — generated `objects`, `relationships`, `summaries`, embeddings, reminders, and now `workspaces` (a thin grouping label with inbound routing addresses, not a knowledge object itself)

Everything AI creates can be regenerated.

## V1 surface

- Capture: paste, drag files, email/WhatsApp forward, voice
- Object pages with AI-written briefs
- Workspaces: name, description, linked tasks/notes/vault items, generated inbound email addresses
- Calendar: events, plus tasks that carry a due date, as a month grid or an agenda
- Hybrid search (FTS + vectors)
- Chat over your data
- Auto + manual reminders
- Search-first home

## Explicitly not V1

Nested folders, team collaboration, web-browsing agents, external action executors.

Calendar is deliberately narrow: days are buckets, entries are lines of text. No week view, no hour grid, no recurrence.

## Status

Scaffolding + design system built. Notes, Tasks, Calendar, Vault, Work Log, and Workspaces (grouping tasks/notes/vault items, plus generated inbound email addresses) shipped. Inbound email is code-complete: `email()` handler (`apps/web/src/backend/email.ts`) parses with postal-mime, resolves `workspace_inbox` by token, and creates vault items (plus AI task extraction). The only remaining piece is external — pointing a real domain's MX at Cloudflare Email Routing with a catch-all rule to this Worker. Capture pipeline for non-email sources (OCR/STT → extract → embed → match) and chat-over-data not yet built.
