# Pwor Clipper

Browser extension for capturing pages and tweets into Pwor spaces.

Auth uses Better Auth: magic link on the web app, then a long-lived API key
(`x-api-key`) minted for the extension. See Better Auth’s
[browser extension](https://www.better-auth.com/docs/guides/browser-extension-guide),
[bearer](https://www.better-auth.com/docs/plugins/bearer), and
[API key](https://www.better-auth.com/docs/plugins/api-key) docs.

## Develop

```bash
bun install
cp .env.example .env   # WXT_APP_URL=http://localhost:5173
bun run dev
```

WXT opens Chromium with the extension loaded (no manual `chrome://extensions` loop).

Generate and apply DB migrations for `apikey` + `extension_pairing` on the web app first.

## Build

```bash
bun run build
```

Output: `.output/chrome-mv3`.
