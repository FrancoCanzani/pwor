# sheet

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated Dialog-based sheet to Base UI dialog primitives.

## Changed

- `apps/web/src/frontend/components/ui/sheet.tsx`.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- Sidebar mobile sheet usage.

## Behavior changes

- Same focus callback renames as dialog if used later.

## Verify by hand

- Narrow viewport: open mobile sidebar sheet; swipe/Esc close.
