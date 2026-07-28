# project

2026-07-28 — whole-project radix-nova → base-nova migration

## Summary

- Flipped `apps/web/components.json` style `radix-nova` → `base-nova`.
- Installed `@base-ui/react@1.6.0`; removed `radix-ui`.
- Kept `@radix-ui/react-icons` (`iconLibrary: radix`).
- Migrated all radix-backed ui wrappers; left `sonner` and `resizable` alone (third-party).
- Consumer sweep: `app-shell.tsx`, `nav-user.tsx` (`asChild` → `render`).

## Dependency swap

- Added: `@base-ui/react`
- Removed: `radix-ui`
- Kept: `@radix-ui/react-icons`, `sonner`, `react-resizable-panels`

## Build

- Baseline typecheck: pass
- Final typecheck: pass
- Final `bun run build` (apps/web): pass

## Wrappers remaining on Radix

0 (scan of `components/ui` for `from "radix-ui"` / `asChild`).

## Intentionally untouched

- `sonner.tsx` (sonner + radix icons)
- `resizable.tsx` (react-resizable-panels)
