import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "SPL Fantasy Helper",
  description:
    "Adds extra stats and fixture info directly into the SPL Fantasy site.",
  version: pkg.version,
  icons: {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  action: {
    default_icon: {
      16: "icons/icon16.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  host_permissions: [
    "https://fantasy.spl.com.sa/*",
    "https://*.fantasy.spl.com.sa/*",
  ],
  permissions: ["storage"],
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
