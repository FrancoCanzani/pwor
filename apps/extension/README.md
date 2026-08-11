# Pwor Clipper

Browser extension for capturing pages and tweets into Pwor spaces.

## Develop

```bash
bun install
bun run dev
```

WXT opens Chromium with the extension loaded (no manual `chrome://extensions` loop).

Point `WXT_APP_URL` in `.env` at your local or deployed Pwor app (`http://localhost:5173` by default).

## Build

```bash
bun run build
```

Output: `.output/chrome-mv3`.

## Auth

Sign in from the popup — opens `/extension/link` on the web app, then polls for an approved device token.
