import path from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      routesDirectory: "./src/frontend/routes",
      generatedRouteTree: "./src/frontend/route-tree.gen.ts",
    }),
    react(),
    cloudflare(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
      "@backend": path.resolve(__dirname, "./src/backend"),
      "@frontend": path.resolve(__dirname, "./src/frontend"),
      "@features": path.resolve(__dirname, "./src/frontend/features"),
      "@lib": path.resolve(__dirname, "./src/frontend/lib"),
      "@routes": path.resolve(__dirname, "./src/frontend/routes"),
      "@components": path.resolve(__dirname, "./src/frontend/components"),
    },
  },
  build: {
    outDir: "dist/client",
  },
});
