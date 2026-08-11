import { useEffect, useState } from "react";

import {
  capture,
  clearSession,
  fetchMe,
  getStoredUser,
  getStoredWorkspaceId,
  listWorkspaces,
  pollLink,
  setSession,
  setStoredWorkspaceId,
  startLink,
} from "../../lib/api";
import { APP_URL, STORAGE_KEYS, type Workspace } from "../../lib/config";
import { cn } from "../../lib/utils";

type PageInfo = {
  title: string;
  url: string;
  selection: string;
};

async function readActivePage(): Promise<PageInfo> {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const url = tab?.url ?? "";
  const title = tab?.title ?? url;
  let selection = "";

  if (tab?.id != null) {
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() ?? "",
      });
      const first = results?.[0]?.result;
      selection = typeof first === "string" ? first : "";
    } catch {
      selection = "";
    }
  }

  return { title, url, selection };
}

function Button({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "default" | "outline" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-transparent px-2.5 text-xs font-normal transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-primary text-primary-foreground hover:bg-primary/80",
        variant === "outline" && "border-border bg-background hover:bg-muted",
        variant === "ghost" && "hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [spaces, setSpaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveOnBookmark, setSaveOnBookmark] = useState(true);
  const [showInlineButton, setShowInlineButton] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [user, pageInfo, settings] = await Promise.all([
          getStoredUser(),
          readActivePage(),
          browser.storage.local.get([
            STORAGE_KEYS.saveOnBookmark,
            STORAGE_KEYS.showInlineButton,
          ]),
        ]);
        setPage(pageInfo);
        setSaveOnBookmark(settings[STORAGE_KEYS.saveOnBookmark] !== false);
        setShowInlineButton(settings[STORAGE_KEYS.showInlineButton] !== false);

        if (!user) {
          setLoading(false);
          return;
        }

        const me = await fetchMe().catch(async () => {
          await clearSession();
          return null;
        });
        if (!me) {
          setLoading(false);
          return;
        }

        setEmail(me.email);
        const items = await listWorkspaces();
        setSpaces(items);
        const stored = await getStoredWorkspaceId();
        const initial =
          (stored && items.some((item) => item.id === stored)
            ? stored
            : items[0]?.id) ?? "";
        setWorkspaceId(initial);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSignIn() {
    setError(null);
    setLinking(true);
    try {
      const { pairingId, secret, linkUrl } = await startLink();
      await browser.tabs.create({ url: linkUrl });

      const started = Date.now();
      while (Date.now() - started < 10 * 60 * 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const result = await pollLink(pairingId, secret);
        if (result.status === "approved") {
          await setSession(result.apiKey, result.user);
          setEmail(result.user.email);
          const items = await listWorkspaces();
          setSpaces(items);
          const initial = items[0]?.id ?? "";
          setWorkspaceId(initial);
          if (initial) await setStoredWorkspaceId(initial);
          setLinking(false);
          return;
        }
        if (result.status === "expired" || result.status === "consumed") {
          throw new Error("Link expired. Try again.");
        }
      }
      throw new Error("Link timed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setLinking(false);
    }
  }

  async function handleSignOut() {
    await clearSession();
    setEmail(null);
    setSpaces([]);
    setWorkspaceId("");
    setStatus(null);
  }

  async function handleSave(kind: "page" | "selection") {
    if (!page?.url || !workspaceId) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const space = spaces.find((item) => item.id === workspaceId);
      if (kind === "selection") {
        if (!page.selection.trim()) {
          throw new Error("Nothing selected on the page.");
        }
        await capture({ input: page.selection, workspaceId });
      } else {
        await capture({ input: page.url, workspaceId });
      }
      await setStoredWorkspaceId(workspaceId);
      setStatus(`Saved to ${space?.name ?? "space"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSetting(
    key: typeof STORAGE_KEYS.saveOnBookmark | typeof STORAGE_KEYS.showInlineButton,
    value: boolean,
  ) {
    await browser.storage.local.set({ [key]: value });
    if (key === STORAGE_KEYS.saveOnBookmark) setSaveOnBookmark(value);
    if (key === STORAGE_KEYS.showInlineButton) setShowInlineButton(value);
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center p-4 text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex min-h-[280px] flex-col p-4">
        <h1 className="font-pixel text-base font-normal tracking-tight">
          Pwor
        </h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Capture the web into your spaces.
        </p>
        {error ? (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        ) : null}
        <div className="mt-auto pt-6">
          <Button
            type="button"
            className="w-full"
            disabled={linking}
            onClick={() => void handleSignIn()}
          >
            {linking ? "Waiting for link…" : "Sign in"}
          </Button>
        </div>
      </div>
    );
  }

  const host = (() => {
    try {
      return page?.url ? new URL(page.url).host : "";
    } catch {
      return "";
    }
  })();

  return (
    <div className="flex min-h-[280px] flex-col p-4">
      <h1 className="mb-3 font-pixel text-base font-normal tracking-tight">
        Save to Pwor
      </h1>

      <div className="mb-3 min-w-0">
        <div className="truncate text-xs">{page?.title || "This page"}</div>
        <div className="truncate text-xs text-muted-foreground">{host}</div>
      </div>

      <label className="mb-1 text-xs text-muted-foreground">Space</label>
      <select
        className="mb-4 h-7 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
        value={workspaceId}
        onChange={(event) => {
          setWorkspaceId(event.target.value);
          void setStoredWorkspaceId(event.target.value);
        }}
        disabled={spaces.length === 0}
      >
        {spaces.length === 0 ? (
          <option value="">No spaces yet</option>
        ) : (
          spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))
        )}
      </select>

      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
      {status ? <p className="mb-2 text-xs">{status}</p> : null}

      <Button
        type="button"
        className="w-full"
        disabled={busy || !workspaceId || !page?.url}
        onClick={() => void handleSave("page")}
      >
        {busy ? "Saving…" : "Save page"}
      </Button>

      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={busy || !workspaceId || !page?.selection.trim()}
          onClick={() => void handleSave("selection")}
        >
          Save selection
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={!workspaceId}
          onClick={() => {
            void browser.tabs.create({
              url: workspaceId ? `${APP_URL}/${workspaceId}/vault` : APP_URL,
            });
          }}
        >
          Open
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
        <label className="flex items-center justify-between gap-3 text-xs">
          <span>Save X bookmarks</span>
          <input
            type="checkbox"
            checked={saveOnBookmark}
            onChange={(event) =>
              void toggleSetting(
                STORAGE_KEYS.saveOnBookmark,
                event.target.checked,
              )
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-xs">
          <span>Show X button</span>
          <input
            type="checkbox"
            checked={showInlineButton}
            onChange={(event) =>
              void toggleSetting(
                STORAGE_KEYS.showInlineButton,
                event.target.checked,
              )
            }
          />
        </label>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="truncate">{email}</span>
        <Button
          type="button"
          variant="ghost"
          className="h-6 px-2"
          onClick={() => void handleSignOut()}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
