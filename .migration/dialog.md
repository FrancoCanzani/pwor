# dialog

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated Overlay→Backdrop, Content→Popup; asChild→render on close.

## Changed

- `apps/web/src/frontend/components/ui/dialog.tsx`.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- No app Dialog consumers beyond ui wrappers.

## Behavior changes

- Focus callbacks `onOpenAutoFocus`/`onCloseAutoFocus` → `initialFocus`/`finalFocus` if used later.

## Verify by hand

- Open/close any dialog; Esc and overlay click; focus returns to trigger.
