# alert-dialog

2026-07-28 — golden pair via CLI (base-nova) + design-system replay — Migrated; Cancel uses Close+render Button; Action is plain Button.

## Changed

- `apps/web/src/frontend/components/ui/alert-dialog.tsx`.

Leftover scan clean: no `radix-ui` / `@radix-ui/react-*` (except icons) / `IconPlaceholder` / `asChild`.

## Left alone

- `notes-layout.tsx` delete confirm (no asChild).

## Behavior changes

- Action no longer auto-closes via AlertDialog.Action primitive — it is a Button; confirm still closes via controlled open state.

## Verify by hand

- Delete a note: cancel and confirm paths; Esc; focus trap.
