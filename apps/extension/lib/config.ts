export const APP_URL = (
  import.meta.env.WXT_APP_URL || "http://localhost:5173"
).replace(/\/$/, "");

export const STORAGE_KEYS = {
  apiKey: "pwor:extension:api-key",
  user: "pwor:extension:user",
  workspaceId: "pwor:extension:workspace-id",
  saveOnBookmark: "pwor:extension:save-on-bookmark",
  showInlineButton: "pwor:extension:show-inline-button",
} as const;

export type ExtensionUser = {
  id: string;
  email: string;
};

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  shader?: string | null;
};

export type VaultItem = {
  id: string;
  kind: string;
  title: string | null;
  workspaceId: string | null;
  url: string | null;
};
