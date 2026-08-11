import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "Pwor",
    description: "Capture pages and tweets into your Pwor spaces.",
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
    permissions: ["storage", "activeTab", "contextMenus", "scripting"],
    host_permissions: [
      "http://localhost:5173/*",
      "https://pwor.app/*",
      "https://x.com/*",
      "https://twitter.com/*",
    ],
    action: {
      default_title: "Save to Pwor",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        128: "icon/128.png",
      },
    },
    commands: {
      "save-page": {
        suggested_key: {
          default: "Ctrl+Shift+S",
          mac: "Command+Shift+S",
        },
        description: "Save current page to Pwor",
      },
    },
  },
});
