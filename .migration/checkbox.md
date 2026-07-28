# checkbox

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated to @base-ui/react/checkbox.

## Changed

- `apps/web/src/frontend/components/ui/checkbox.tsx`: Root.Props typing; CheckIcon kept.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- Task row checkbox consumers (no call-site prop changes needed).

## Behavior changes

- `checked="indeterminate"` would need `indeterminate` boolean — not used in app.

## Verify by hand

- Toggle a task checkbox; keyboard Space to check/uncheck.
