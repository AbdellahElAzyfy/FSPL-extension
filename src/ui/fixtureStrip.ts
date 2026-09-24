import type { DifficultyModel, PositionGroup } from "../fdr/difficulty";
import type { ResolvedFixture } from "../types/fixtures";

/**
 * Renders a compact strip of the next N fixtures for a player's team,
 * e.g. [NAS] [hil] [FAT] ... — uppercase = home, lowercase = away.
 *
 * Each chip is coloured 1 (easy, green) to 5 (hard, red) by the xG-based
 * difficulty model, rated for the player's position group. If either the
 * position or the xG data is unavailable, chips stay neutral grey.
 */
export function renderFixtureStrip(
  fixtures: ResolvedFixture[],
  positionGroup: PositionGroup | null,
  difficulty: DifficultyModel | null,
): HTMLElement {
  const container = document.createElement("div");
  container.className = "spl-fh-fixture-strip";

  for (const { opponent, isHome } of fixtures) {
    const cell = document.createElement("span");
    cell.className = "spl-fh-fixture-cell";
    cell.textContent = isHome ? opponent.short_name.toUpperCase() : opponent.short_name.toLowerCase();
    cell.title = `${opponent.name.trim()} (${isHome ? "Home" : "Away"})`;

    const rating = positionGroup && difficulty?.getDifficulty(opponent.id, isHome, positionGroup);
    if (rating) {
      cell.dataset.fdr = String(rating);
      cell.title += ` — difficulty ${rating}/5`;
    }

    container.appendChild(cell);
  }

  return container;
}
