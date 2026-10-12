import type { DifficultyModel, PositionGroup } from "../fdr/difficulty";
import type { TeamFixture } from "../types/fixtures";
import { t } from "./i18n";

/**
 * Renders a compact strip of the next N rounds for a player's team,
 * e.g. [NAS] [hil] [FAT] ... — uppercase = home, lowercase = away. One slot
 * per round: a double round stacks both opponents in its slot, a blank round
 * shows "–".
 *
 * Each chip is coloured 1 (easy, green) to 5 (hard, red) from the team
 * ratings (defaults + the user's edits), rated for the player's position
 * group. If the position can't be determined, chips stay neutral grey.
 */
export function renderFixtureStrip(
  rounds: { round: number; fixtures: TeamFixture[] }[],
  positionGroup: PositionGroup | null,
  difficulty: DifficultyModel | null,
): HTMLElement {
  const container = document.createElement("div");
  container.className = "spl-fh-fixture-strip";
  for (const { round, fixtures } of rounds) {
    const slot = document.createElement("span");
    slot.className = "spl-fh-fixture-slot";
    if (fixtures.length === 0) {
      const blank = document.createElement("span");
      blank.className = "spl-fh-fixture-cell spl-fh-fixture-cell--blank";
      blank.textContent = "–";
      blank.title = t(`No match in round ${round}`, `لا مباراة في الجولة ${round}`);
      slot.appendChild(blank);
    }
    for (const fixture of fixtures) {
      const chip = fixtureChip(fixture, positionGroup, difficulty, "spl-fh-fixture-cell");
      if (fixtures.length > 1) chip.title += t(` — double round ${round}`, ` — جولة مزدوجة ${round}`);
      slot.appendChild(chip);
    }
    container.appendChild(slot);
  }
  return container;
}

/** One fixture as a chip: opponent code (uppercase = home), difficulty colour, details on hover. */
export function fixtureChip(
  { opponent, isHome }: TeamFixture,
  positionGroup: PositionGroup | null,
  difficulty: DifficultyModel | null,
  className: string,
): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = className;
  chip.textContent = isHome ? opponent.short_name.toUpperCase() : opponent.short_name.toLowerCase();
  chip.title = isHome
    ? t(`${opponent.name.trim()} (Home)`, `ضد ${opponent.name.trim()} (على الأرض)`)
    : t(`${opponent.name.trim()} (Away)`, `ضد ${opponent.name.trim()} (خارج الأرض)`);

  const rating = positionGroup && difficulty?.getDifficulty(opponent.id, isHome, positionGroup);
  if (rating) {
    chip.classList.add("spl-fh-fdr");
    chip.dataset.fdr = String(rating);
    chip.title += t(` — difficulty ${rating}/5`, ` — الصعوبة ${rating}/5`);
  }
  return chip;
}
