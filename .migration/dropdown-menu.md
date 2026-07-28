# dropdown-menu

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated DropdownMenu → Menu primitives + Positioner.

## Changed

- `apps/web/src/frontend/components/ui/dropdown-menu.tsx`.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- `nav-user.tsx` call sites updated (asChild → render).

## Behavior changes

- CheckboxItem/RadioItem `closeOnClick` defaults false in Base UI (unused here). CSS vars renamed to --available-height / --anchor-width / --transform-origin.

## Verify by hand

- Open user menu: Settings link, Sign out; keyboard arrows + typeahead.
