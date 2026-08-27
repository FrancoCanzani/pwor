export const APP_URL = (
  import.meta.env.WXT_APP_URL || "http://localhost:5173"
).replace(/\/$/, "");

export const STORAGE_KEYS = {
  apiKey: "pwor:extension:api-key",
  user: "pwor:extension:user",
  spaceId: "pwor:extension:space-id",
  saveOnBookmark: "pwor:extension:save-on-bookmark",
  showInlineButton: "pwor:extension:show-inline-button",
  linking: "pwor:extension:linking",
} as const;

export const LINK_TIMEOUT_MS = 10 * 60 * 1000;

export type LinkingState = {
  pairingId: string;
  secret: string;
  linkUrl: string;
  startedAt: number;
};

export type ExtensionUser = {
  id: string;
  email: string;
};

export type Space = {
  id: string;
  name: string;
  description: string | null;
};

export type Item = {
  id: string;
  kind: string;
  title: string | null;
  spaceId: string | null;
  url: string | null;
};
