import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.ts";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      // Extension pages not referenced by the manifest must be listed here.
      input: { season: "src/pages/season/index.html" },
    },
  },
});
