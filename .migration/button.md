# button

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated to @base-ui/react/button; customizations kept.

## Changed

- `apps/web/src/frontend/components/ui/button.tsx`: Slot/asChild → ButtonPrimitive; kept rounded-none, font-normal, ring-1.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- None.

## Behavior changes

- None.

## Verify by hand

- Click default/outline/ghost/destructive buttons; confirm focus ring and disabled opacity.
