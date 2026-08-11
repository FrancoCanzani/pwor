import {
  capture,
  getStoredUser,
  getStoredWorkspaceId,
  listWorkspaces,
} from "../lib/api";
import { STORAGE_KEYS } from "../lib/config";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: "pwor-save-page",
        title: "Save to Pwor",
        contexts: ["page", "link"],
      });
      browser.contextMenus.create({
        id: "pwor-save-selection",
        title: "Save selection to Pwor",
        contexts: ["selection"],
      });
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    void (async () => {
      const user = await getStoredUser();
      if (!user) return;

      const preferred = await getStoredWorkspaceId();
      try {
        if (info.menuItemId === "pwor-save-selection" && info.selectionText) {
          await capture({
            input: info.selectionText,
            workspaceId: preferred,
            preferredWorkspaceId: preferred,
          });
          return;
        }

        const url = info.linkUrl || info.pageUrl || tab?.url;
        if (!url) return;
        await capture({
          input: url,
          workspaceId: preferred,
          preferredWorkspaceId: preferred,
        });
      } catch (error) {
        console.error("context menu capture failed", error);
      }
    })();
  });

  browser.commands.onCommand.addListener((command) => {
    if (command !== "save-page") return;
    void (async () => {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.url) return;
      const user = await getStoredUser();
      if (!user) return;
      const preferred = await getStoredWorkspaceId();
      try {
        const spaces = await listWorkspaces();
        const workspaceId =
          (preferred && spaces.some((space) => space.id === preferred)
            ? preferred
            : spaces[0]?.id) ?? null;
        if (!workspaceId) return;
        await capture({
          input: tab.url,
          workspaceId,
          preferredWorkspaceId: preferred,
        });
      } catch (error) {
        console.error("hotkey capture failed", error);
      }
    })();
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return;

    if (message.type === "pwor:capture-tweet") {
      void (async () => {
        try {
          const user = await getStoredUser();
          if (!user) {
            sendResponse({ ok: false, error: "Not signed in" });
            return;
          }

          const preferred = await getStoredWorkspaceId();
          const settings = await browser.storage.local.get([
            STORAGE_KEYS.saveOnBookmark,
          ]);
          const saveOnBookmark =
            settings[STORAGE_KEYS.saveOnBookmark] !== false;

          if (message.via === "bookmark" && !saveOnBookmark) {
            sendResponse({ ok: false, error: "disabled" });
            return;
          }

          const item = await capture({
            input: message.url as string,
            autoSpace: true,
            hint: (message.hint as string | undefined) ?? null,
            tags: ["x", "bookmark"],
            preferredWorkspaceId: preferred,
          });

          let spaceName = "space";
          try {
            const spaces = await listWorkspaces();
            spaceName =
              spaces.find((space) => space.id === item.workspaceId)?.name ??
              spaceName;
          } catch {
            // ignore name lookup failures
          }

          sendResponse({
            ok: true,
            workspaceId: item.workspaceId,
            spaceName,
          });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "Save failed",
          });
        }
      })();
      return true;
    }

    return undefined;
  });
});
