import "./styles.css";
import "../ui/fdrColors.css";
import { dataStore } from "./dataStore";
import { scanForPlayerRows } from "./playerRowInjector";
import { ensureDifficultyTab } from "./difficultyTab";

function scanPage(): void {
  scanForPlayerRows();
  ensureDifficultyTab();
}

async function bootstrap(): Promise<void> {
  try {
    await dataStore.load();
  } catch (err) {
    console.error("[SPL Fantasy Helper] failed to load fixture data", err);
    return;
  }

  scanPage();

  // SPA re-renders player rows and the nav on every navigation/filter
  // change, so keep re-scanning on DOM mutations. Both scans are
  // idempotent (marked via data attributes), so this is cheap.
  const observer = new MutationObserver(() => scanPage());
  observer.observe(document.body, { childList: true, subtree: true });
}

bootstrap();
