# label

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated to native <label> (no Base UI Label primitive).

## Changed

- `apps/web/src/frontend/components/ui/label.tsx`: dropped radix Label; kept font-normal.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- None.

## Behavior changes

- None.

## Verify by hand

- Tab to a labeled field; click label to focus control.
