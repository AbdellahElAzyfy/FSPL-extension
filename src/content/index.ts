import "./styles.css";
import { dataStore } from "./dataStore";
import { scanForPlayerRows } from "./playerRowInjector";

async function bootstrap(): Promise<void> {
  try {
    await dataStore.load();
  } catch (err) {
    console.error("[SPL Fantasy Helper] failed to load fixture data", err);
    return;
  }

  scanForPlayerRows();

  // SPA re-renders player rows on every navigation/filter change, so
  // keep re-scanning on DOM mutations. scanForPlayerRows() is
  // idempotent per-row (marked via data attribute), so this is cheap.
  const observer = new MutationObserver(() => scanForPlayerRows());
  observer.observe(document.body, { childList: true, subtree: true });
}

bootstrap();
