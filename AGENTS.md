# Agent notes

## Comments (enforced)

Never add JSDoc. Never add comments that narrate what the next lines do. Names, types, and signatures are the docs.

Illegal: `/** Rejects URLs a server-side fetch should never follow… Returns the parsed URL for convenience. */`, `/** Format item storage as GB… */`, `/** Extension starts a pairing session. */`, or any other restatement of the function/field/route sitting under it.

The only legal comment is a short `//` that explains a non-obvious **why**: a platform limit, a security constraint, a workaround, an invisible character, a surprising default. If a competent reader would not ask "why is this here?", delete the comment. Prefer renaming over documenting.

## Git

- Never run `git commit` unless the user explicitly asks for it in that turn. Staging/inspecting changes is fine; committing is not.
- Never create a new branch unless the user explicitly asks for it in that turn.

## Verification

- The user verifies changes by running the app. Do not drive a browser, take screenshots, seed or copy databases, write throwaway harness scripts, or hit endpoints to prove a change works.
- `bun run check-types` is the check to run. Stop there and report what it says.
- Never insert, copy, or mutate data — real or fake — to see something render. If a change can only be judged by running it, say so and hand it over.

## Dev server

- Never kill, restart, or replace a running dev server unless the user explicitly asks. Reuse whatever is already running; don't stop it and don't start a second one.
- Do not start a second `bun run dev` / Vite process if one is already running — reuse the existing one.
- Prefer HMR / file edits over process restarts.

## Routing

- Never hand-edit `apps/web/src/frontend/route-tree.gen.ts`. The TanStack Router Vite plugin regenerates it from `apps/web/src/frontend/routes/` during `bun run dev` / build. Add or change route files only — do not patch the generated tree, and do not add a separate generate script.
- Loading UI belongs only on routes via `pendingComponent` (e.g. the shared `Loading` on `/_app`). Do not add component-level spinners, skeleton loaders, or `isLoading ? null` / `isLoading ? <Spinner />` branches in feature pages. While data is pending, render the empty/default UI or `null` for missing entities — never a local loader.
- Never add a route component that only unpacks `useParams` / `useSearch` and forwards them as props. Pages read their own route state. Route files should be `component: ThePage` (plus `validateSearch` if needed) — not `function FooRoute() { const { id } = Route.useParams(); return <FooPage id={id} /> }`.

## Database

- Never run DB commands (`db:generate`, `db:migrate`, `db:migrate:dev`, `db:studio`, `wrangler d1 …`, drizzle-kit apply/push, etc.) unless the user explicitly asks.
- Never touch migration files or `db/migrations/meta/*` (journal, snapshots) — not by hand, not via drizzle-kit. Only edit schema files in `db/schema/`. Migrations (generating and applying) are the user's to run, always.

## Fetch

Call `fetch` where the result is used (`queryFn`, `mutationFn`, the handler). Do not wrap a request in a named helper.

Illegal: `features/feedback/api.ts` exporting `sendFeedback` whose body is `parseJson(await fetch("/api/feedback", …))`. A one-off POST does not get its own module.

Shared types and `queryOptions` reused across files are fine. Do not add an API client layer.

## Keyboard

- All shortcuts go through `useHotkey` from `@tanstack/react-hotkeys`. Do not add `window.addEventListener("keydown", …)` in components — there should be exactly one keyboard layer.
- `ignoreInputs` defaults correctly per binding: single keys and Shift/Alt combos are suppressed while typing, `Mod`/`Ctrl` combos and `Escape` still fire. Only override it when a binding genuinely needs the opposite.
- Scope a binding with `{ enabled }` rather than early-returning inside the callback, so the registration stays visible in devtools.
- `Mod+K` opens the command palette (`features/command`). Keep it reachable from anywhere — it's mounted once in `AppShell`.

## Product

- Product name: **Pwor**.
- Capture for humans, memory for any AI. Dump anything in. Find it later. Give it to the model you already use.
- Spaces are folders (`space` table, `spaceId` everywhere). Inbox is unfiled (`spaceId` null). Not objects, not a task manager.
- Notes are TipTap documents via `@pwor/editor`. Autosave, no toolbar.
- Onboarding: full name, then first space. Avatar is optional; missing avatars use [Hashvatar](https://www.hashvatar.com/) from email (soft-squared, not circular).

## UI

- Font: Geist Sans everywhere. Geist Mono via `font-nums` for dates/numbers (mono + tabular-nums).
- Minimally rounded: `--radius: 0.25rem` (~4px). Prefer token classes (`rounded-sm` / `rounded-md` / `rounded-lg`) — do not hardcode `rounded-none`.
- Style with **Tailwind utilities** in components. Keep `index.css` to theme tokens + base only — no hand-rolled layout/component CSS classes.
- Prefer shadcn primitives (`Button`, `Input`, `Empty`, `DropdownMenu`, …) over custom markup.
- White background.
- Super minimal and clean. Small interface — tight type, padding, and chrome.
- No card-based design: no elevated panels, soft drop shadows as surface treatment, or boxed content blocks. Prefer flat layout with hairline borders or spacing alone.
- Never use all-caps text (`text-transform: uppercase` or hand-typed caps for labels).
- Never use semibold / medium weights (no 500–600). Use regular (400) by default; bold (700) only when emphasis is needed. When using shadcn components that ship `font-medium`, override with `font-normal`.
- Monochrome first. Hierarchy via size, color (muted), and weight (400/700 only) — not surfaces.
- Numbers and dates use `font-nums` (Geist Mono + tabular-nums).
- Empty states use shadcn `Empty`.
- App chrome uses shadcn `Sidebar` (brand, nav, user footer dropdown). Keep it minimal — no inset/floating chrome.
