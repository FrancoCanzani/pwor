# Agent notes

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

## Database

- Never run DB commands (`db:generate`, `db:migrate`, `db:migrate:dev`, `db:studio`, `wrangler d1 …`, drizzle-kit apply/push, etc.) unless the user explicitly asks.
- Never touch migration files or `db/migrations/meta/*` (journal, snapshots) — not by hand, not via drizzle-kit. Only edit schema files in `db/schema/`. Migrations (generating and applying) are the user's to run, always.

## Keyboard

- All shortcuts go through `useHotkey` from `@tanstack/react-hotkeys`. Do not add `window.addEventListener("keydown", …)` in components — there should be exactly one keyboard layer.
- `ignoreInputs` defaults correctly per binding: single keys and Shift/Alt combos are suppressed while typing, `Mod`/`Ctrl` combos and `Escape` still fire. Only override it when a binding genuinely needs the opposite.
- Scope a binding with `{ enabled }` rather than early-returning inside the callback, so the registration stays visible in devtools.
- `Mod+K` opens the command palette (`features/command`). Keep it reachable from anywhere — it's mounted once in `AppShell`.

## Product

- Product name: **Odiseum**.
- Personal intelligence layer: capture anything, AI turns it into connected living objects (people, trips, companies, documents…). Not a task manager, not folders.

## UI

- Font: Geist Sans everywhere. Geist Mono via `font-nums` for dates/numbers (mono + tabular-nums). Geist Pixel (`font-pixel`) for brand / display accents only.
- Minimally rounded: `--radius: 0.5rem` (~8px). Prefer token classes (`rounded-sm` / `rounded-md` / `rounded-lg`) — do not hardcode `rounded-none`.
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
- New users are gated to `/onboarding` until they set a full name. Avatar is optional; missing avatars use [Hashvatar](https://www.hashvatar.com/) from email (soft-squared, not circular).
- Notes use a source markdown editor (CodeMirror) — marks stay visible, autosave, no toolbar.
- Homepage is search-first, not a task feed.
