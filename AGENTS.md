# Agent notes

## Dev server

- Never kill, restart, or replace a running dev server unless the user explicitly asks.
- Do not start a second `bun run dev` / Vite process if one is already running — reuse the existing one.
- Prefer HMR / file edits over process restarts.

## Product

- Product name: **Odiseum**.
- Personal intelligence layer: capture anything, AI turns it into connected living objects (people, trips, companies, documents…). Not a task manager, not folders.

## UI

- Font: Geist Mono everywhere. Geist Pixel (`font-pixel`) for brand / display accents only.
- All squared: `--radius: 0` — no rounded corners.
- Style with **Tailwind utilities** in components. Keep `index.css` to theme tokens + base only — no hand-rolled layout/component CSS classes.
- Prefer shadcn primitives (`Button`, `Input`, `Empty`, `DropdownMenu`, …) over custom markup.
- White background.
- Super minimal and clean. Small interface — tight type, padding, and chrome.
- No card-based design: no elevated panels, soft drop shadows as surface treatment, or boxed content blocks. Prefer flat layout with hairline borders or spacing alone.
- Never use all-caps text (`text-transform: uppercase` or hand-typed caps for labels).
- Never use semibold / medium weights (no 500–600). Use regular (400) by default; bold (700) only when emphasis is needed. When using shadcn components that ship `font-medium`, override with `font-normal`.
- Monochrome first. Hierarchy via size, color (muted), and weight (400/700 only) — not surfaces.
- Numbers use `tabular-nums` (already mono).
- Empty states use shadcn `Empty`.
- App chrome uses shadcn `Sidebar` (brand, nav, user footer dropdown). Keep it minimal — no inset/floating chrome.
- New users are gated to `/onboarding` until they set a full name. Avatar is optional; missing avatars use squared [Hashvatar](https://www.hashvatar.com/) from email.
- Homepage is search-first, not a task feed.
