# Odiseum — Personal Intelligence Layer

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

## Mental model

```
Capture → OCR/STT → Extract → Embed → Match → Merge/Create → Summarize → Remind → Index
```

Workers, not agents, for ingestion.

### Storage worlds

- **Raw** — immutable inputs (`raw_items`)
- **Knowledge** — generated `objects`, `relationships`, `summaries`, embeddings, reminders, and now `workspaces` (a thin grouping label with inbound routing addresses, not a knowledge object itself)

Everything AI creates can be regenerated.

## V1 surface

- Capture: paste, drag files, email/WhatsApp forward, voice
- Object pages with AI-written briefs
- Workspaces: name, description, linked tasks/notes/vault items, generated inbound email addresses
- Hybrid search (FTS + vectors)
- Chat over your data
- Auto + manual reminders
- Search-first home

## Explicitly not V1

Kanban boards, nested folders, team collaboration, calendar views, web-browsing agents, external action executors.

## Next up: wiring workspace inboxes to real email

`workspace_inbox` generates addresses today but nothing delivers to them yet. Plan:

1. **Domain** (external, not code) — a real domain added to the Cloudflare account, MX pointed at Email Routing. Blocks everything else below.
2. **One catch-all routing rule** — `*@inbound.odiseum.app` → this Worker. Not one rule per workspace; the token in the local-part does the routing, so the rule never changes as workspaces come and go.
3. **`email()` handler**, exported alongside the existing `fetch` (Hono) and `queue` handlers in the same Worker:
   - `token = message.to.split("@")[0]`, look up `workspace_inbox` by token → `workspaceId`. Unknown token → `message.setReject(...)`.
   - Buffer `message.raw` once (single-use stream), parse with `postal-mime` → `subject`, `text`, `html`, `attachments[]`.
   - No attachments → one `vault_item` (`kind: "text"`, `ocrText: parsed.text`, `workspaceId`) — done, no OCR needed.
   - Attachments → one `vault_item` per attachment (`kind: "file"`), bytes to `VAULT_BUCKET`, then enqueue to the existing `VAULT_QUEUE` — reuses the current OCR/extraction consumer as-is.
4. **No confirmation reply for v1** — skip `send_email` here, keep it one-way. Revisit only if silent capture proves confusing.

**No dedicated inbox/triage page.** Every address is bound to a workspace at creation, so items land pre-sorted — there's no unsorted pile to review. The existing global `/vault` page (unfiltered, newest-first) already reads as "what just came in." The one gap: nothing currently distinguishes an item that arrived by email from one added manually — worth a small muted "via email" tag on the vault item row, not a new page.

## Status

Scaffolding + design system built. Notes, Tasks, Vault, Work Log, and Workspaces (grouping tasks/notes/vault items, plus generated inbound email addresses) shipped. Actually receiving mail at those addresses is the next planned step (see above). Capture pipeline (OCR/STT → extract → embed → match) and chat-over-data not yet built.
