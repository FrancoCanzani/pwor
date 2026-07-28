# avatar

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated to @base-ui/react/avatar.

## Changed

- `apps/web/src/frontend/components/ui/avatar.tsx`.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- `user-avatar.tsx` (no asChild).

## Behavior changes

- None.

## Verify by hand

- Confirm avatar image + fallback (hashvatar) in sidebar footer.
