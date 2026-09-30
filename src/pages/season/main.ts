import "./season.css";
import { fetchAllFixtures, fetchBootstrap, fetchTeamXg } from "../../api/fixtures";
import { DifficultyModel } from "../../fdr/difficulty";
import { createSeasonGrid } from "../../ui/seasonGrid";

// Standalone version of the season grid (toolbar icon). The same grid is also
// available inside the site via the injected "Difficulty" nav tab.

// English host so team names come back in English (the API localises by host).
const SITE_ORIGIN = "https://en.fantasy.spl.com.sa";

async function main(): Promise<void> {
  const app = document.getElementById("app")!;
  try {
    const [bootstrap, fixtures, xg] = await Promise.all([
      fetchBootstrap(SITE_ORIGIN),
      fetchAllFixtures(SITE_ORIGIN),
      fetchTeamXg(),
    ]);
    app.replaceChildren(
      createSeasonGrid({
        teams: bootstrap.teams,
        events: bootstrap.events,
        fixtures,
        model: new DifficultyModel(xg),
        xgGeneratedAt: xg.generatedAt,
      }),
    );
  } catch (err) {
    console.error("[SPL Fantasy Helper] season page failed to load", err);
    document.getElementById("status")!.textContent = "Couldn't load fixture data. Check your connection and reload.";
  }
}

main();
