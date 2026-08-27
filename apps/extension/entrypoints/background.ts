import {
  capture,
  clearLinkingState,
  getLinkingState,
  getStoredUser,
  listSpaces,
  pollLink,
  setLinkingState,
  setSession,
  startLink,
  spaceLabel,
} from "../lib/api";
import {
  LINK_TIMEOUT_MS,
  STORAGE_KEYS,
  type LinkingState,
} from "../lib/config";
import { resolveCaptureUrl } from "../lib/page";

let linkPoll: Promise<void> | null = null;

async function beginLinkSession(): Promise<LinkingState> {
  const existing = await getLinkingState();
  if (existing && Date.now() - existing.startedAt < LINK_TIMEOUT_MS) {
    return existing;
  }

  const started = await startLink();
  const state: LinkingState = {
    pairingId: started.pairingId,
    secret: started.secret,
    linkUrl: started.linkUrl,
    startedAt: Date.now(),
  };
  await setLinkingState(state);
  return state;
}

async function runLinkPoll(state: LinkingState) {
  const deadline = state.startedAt + LINK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await pollLink(state.pairingId, state.secret);
    switch (result.status) {
      case "pending":
        await new Promise((resolve) => setTimeout(resolve, 1500));
        break;
      case "approved":
        await setSession(result.apiKey, result.user);
        await clearLinkingState();
        return;
      case "expired":
      case "consumed":
        await clearLinkingState();
        throw new Error("Link expired. Try again.");
      default: {
        const _exhaustive: never = result;
        throw new Error(`Unexpected link status: ${String(_exhaustive)}`);
      }
    }
  }
  await clearLinkingState();
  throw new Error("Link timed out.");
}

function pollLinkSession(state: LinkingState) {
  if (!linkPoll) {
    linkPoll = runLinkPoll(state).finally(() => {
      linkPoll = null;
    });
  }
  return linkPoll;
}

export default defineBackground(() => {
  void getLinkingState().then((state) => {
    if (state) void pollLinkSession(state);
  });

  browser.runtime.onInstalled.addListener(() => {
    void browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: "pwor-save-page",
        title: "Save to Pwor Inbox",
        contexts: ["page", "link"],
      });
      browser.contextMenus.create({
        id: "pwor-save-selection",
        title: "Save selection to Pwor Inbox",
        contexts: ["selection"],
      });
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    void (async () => {
      const user = await getStoredUser();
      if (!user) return;

      try {
        if (info.menuItemId === "pwor-save-selection" && info.selectionText) {
          await capture({
            input: info.selectionText,
          });
          return;
        }

        const url = await resolveCaptureUrl(
          tab ?? {},
          info.linkUrl || info.pageUrl || tab?.url,
        );
        if (!url) return;
        await capture({
          input: url,
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
      try {
        const url = await resolveCaptureUrl(tab, tab.url);
        if (!url) return;
        await capture({
          input: url,
        });
      } catch (error) {
        console.error("hotkey capture failed", error);
      }
    })();
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return;

    // Popup dies when the link tab opens, so pairing continues here.
    if (message.type === "pwor:link-start") {
      void (async () => {
        try {
          const state = await beginLinkSession();
          sendResponse({ ok: true });
          await browser.tabs.create({ url: state.linkUrl });
          await pollLinkSession(state);
        } catch (error) {
          await clearLinkingState();
          try {
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : "Could not sign in",
            });
          } catch {
            console.error("link start failed", error);
          }
        }
      })();
      return true;
    }

    if (message.type === "pwor:capture-tweet") {
      void (async () => {
        try {
          const user = await getStoredUser();
          if (!user) {
            sendResponse({ ok: false, error: "Not signed in" });
            return;
          }

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
            hint: (message.hint as string | undefined) ?? null,
            tags: message.via === "bookmark" ? ["bookmark"] : undefined,
          });
          const spaces = await listSpaces().catch(() => []);

          sendResponse({
            ok: true,
            spaceId: item.spaceId,
            spaceName: spaceLabel(item.spaceId, spaces),
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
