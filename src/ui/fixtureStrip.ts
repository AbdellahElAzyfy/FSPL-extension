import type { ResolvedFixture } from "../types/fixtures";

/**
 * Renders a compact strip of the next N fixtures for a player's team,
 * e.g. [NAS] [hil] [FAT] ... — uppercase = home, lowercase = away.
 *
 * No difficulty coloring yet: the site's team data has strength/position
 * all null/0 (no standings computed), so there's no real signal to color
 * by. Revisit once the season has enough finished gameweeks to derive a
 * form-based rating ourselves.
 */
export function renderFixtureStrip(fixtures: ResolvedFixture[]): HTMLElement {
  const container = document.createElement("div");
  container.className = "spl-fh-fixture-strip";

  for (const { opponent, isHome } of fixtures) {
    const cell = document.createElement("span");
    cell.className = "spl-fh-fixture-cell";
    cell.textContent = isHome ? opponent.short_name.toUpperCase() : opponent.short_name.toLowerCase();
    cell.title = `${opponent.name.trim()} (${isHome ? "Home" : "Away"})`;
    container.appendChild(cell);
  }

  return container;
}
