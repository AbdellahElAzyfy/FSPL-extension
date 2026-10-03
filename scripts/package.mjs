// Zips the built extension (dist/) for upload to the Chrome Web Store:
// release/spl-fantasy-helper-<version>.zip, with manifest.json at the zip root.
// Run via `npm run package` (builds first). Uses the tar that ships with
// Windows 10+ / macOS / Linux, which writes zip format with -a.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const { version } = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf-8"));

const releaseDir = join(root, "release");
const zipPath = join(releaseDir, `spl-fantasy-helper-${version}.zip`);
mkdirSync(releaseDir, { recursive: true });
if (existsSync(zipPath)) rmSync(zipPath);

// On Windows, name System32's bsdtar: from Git Bash, plain "tar" is GNU tar,
// which can't write zips and reads "C:\..." as a remote host.
const tar = process.platform === "win32" ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";

// List dist's entries explicitly (rather than ".") so paths have no "./" prefix.
execFileSync(tar, ["-a", "-c", "-f", zipPath, "-C", dist, ...readdirSync(dist)], { stdio: "inherit" });
console.log(`Wrote ${zipPath}`);
