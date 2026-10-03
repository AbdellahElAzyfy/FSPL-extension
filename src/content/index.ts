import "./styles.css";
import "../ui/fdrColors.css";
import { dataStore } from "./dataStore";
import { scanForPlayerRows } from "./playerRowInjector";
import { ensureDifficultyTab } from "./difficultyTab";
import { ensurePickTeamRounds } from "./pickTeamRounds";
import { ensureTransferPlanner } from "./transferPlanner";
import { onRatingsChange } from "../fdr/ratingsStore";

function scanPage(): void {
  // Round browser first: it decides which round the strips start at.
  ensurePickTeamRounds(scanPage);
  scanForPlayerRows();
  ensureTransferPlanner();
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

  // Rating edits (here, in another tab, or a reset) recolour every strip at once.
  onRatingsChange(() => scanPage());

  // SPA re-renders player rows and the nav on every navigation/filter
  // change, so keep re-scanning on DOM mutations. Swapping a player often
  // only changes a row's name text and shirt src in place, so watch text
  // and src changes too. Both scans are idempotent, so this is cheap.
  const observer = new MutationObserver(() => scanPage());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["src"],
  });
}

bootstrap();
