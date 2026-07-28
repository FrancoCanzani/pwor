# separator

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated to @base-ui/react/separator; decorative prop dropped.

## Changed

- `apps/web/src/frontend/components/ui/separator.tsx`.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- None.

## Behavior changes

- `decorative` prop removed (harmless if unused).

## Verify by hand

- Confirm horizontal separators still render as hairlines.
