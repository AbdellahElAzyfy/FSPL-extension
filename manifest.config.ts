import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "SPL Fantasy Helper",
  // Store limit: 132 characters. "Unofficial" up front — we are not affiliated with the league.
  description:
    "Unofficial helper for SPL Fantasy: colour-coded next-5 fixtures on every player and a full-season fixture difficulty table.",
  version: pkg.version,
  homepage_url: "https://github.com/AbdellahElAzyfy/FSPL-extension",
  icons: {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  action: {
    default_title: "Open the fixture difficulty table",
    default_icon: {
      16: "icons/icon16.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
  },
  background: {
    service_worker: "src/background/serviceWorker.ts",
    type: "module",
  },
  // Needed so the standalone difficulty page (an extension origin) can read the
  // site's public fixtures API. No other permissions are requested.
  host_permissions: [
    "https://fantasy.spl.com.sa/*",
    "https://*.fantasy.spl.com.sa/*",
  ],
  content_scripts: [
    {
      matches: [
        "https://fantasy.spl.com.sa/*",
        "https://*.fantasy.spl.com.sa/*",
      ],
      js: ["src/content/index.ts"],
      css: ["src/content/styles.css"],
      run_at: "document_idle",
    },
  ],
});
