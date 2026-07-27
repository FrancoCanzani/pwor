# Odiseum — Personal Intelligence Layer

## Pitch

Your second brain that builds itself. Throw in emails, WhatsApps, PDFs, voice notes, screenshots, links, and files. AI organizes everything into connected, living pages you can search, chat with, and rely on for reminders — without folders, tags, or manual organization.

## Core idea

Not tasks. **Objects + relationships.**

Every capture answers one question: *what part of the user's life does this belong to?*

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

## Mental model

```
Capture → OCR/STT → Extract → Embed → Match → Merge/Create → Summarize → Remind → Index
```

Workers, not agents, for ingestion.

### Storage worlds

- **Raw** — immutable inputs (`raw_items`)
- **Knowledge** — generated `objects`, `relationships`, `summaries`, embeddings, reminders

Everything AI creates can be regenerated.

## V1 surface

- Capture: paste, drag files, email/WhatsApp forward, voice
- Object pages with AI-written briefs
- Hybrid search (FTS + vectors)
- Chat over your data
- Auto + manual reminders
- Search-first home

## Explicitly not V1

Kanban, projects, tags, nested folders, collaboration, calendar views, web-browsing agents, external action executors.

## Status

Scaffolding + design system only. Product features not built yet.
