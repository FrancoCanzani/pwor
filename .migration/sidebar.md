# sidebar

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated Slot/asChild → useRender/render; kept EnterIcon + design tokens.

## Changed

- `apps/web/src/frontend/components/ui/sidebar.tsx`.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- `app-shell.tsx`, `nav-user.tsx` updated to `render` prop.

## Behavior changes

- None beyond tooltip delay feel via nested Tooltip.

## Verify by hand

- Expand/collapse sidebar (cookie persists); keyboard shortcut; mobile sheet; nav links; user menu.
