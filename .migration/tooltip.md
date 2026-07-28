# tooltip

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated to positioner model; delayDuration → delay.

## Changed

- `apps/web/src/frontend/components/ui/tooltip.tsx`: Portal > Positioner > Popup; rounded-none kept.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- None.

## Behavior changes

- Provider `delayDuration` renamed to `delay` (default 0 preserved). `disableHoverableContent` has no equivalent (unused).

## Verify by hand

- Collapse sidebar to icon mode; hover nav items for tooltips.
