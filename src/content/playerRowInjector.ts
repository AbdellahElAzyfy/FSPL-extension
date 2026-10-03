import { dataStore } from "./dataStore";
import { readPlayerRows } from "./pitch";
import { pickTeamStartRound } from "./pickTeamRounds";
import { renderFixtureStrip } from "../ui/fixtureStrip";
import type { DifficultyModel } from "../fdr/difficulty";
import { getModel } from "../fdr/ratingsStore";

// What a row's strip was built for: player and first round. React reuses row
// elements when a player is swapped (substitution, transfer), changing only
// the name and shirt inside — so a row is re-rendered whenever this key no
// longer matches.
const STRIP_KEY_ATTR = "data-spl-fh-player";
const STRIP_SELECTOR = ":scope > .spl-fh-fixture-strip";
const STRIP_LENGTH = 5;
// The ratings model each row's strip was coloured with. The model is replaced
// whenever ratings change (incl. user edits), so a mismatch means "recolour".
const coloredWith = new WeakMap<Element, DifficultyModel>();

/**
 * Adds the next-5 fixture strip under every player row (pitch cards and list
 * rows, Pick Team and Transfers). On Pick Team the strip starts at the round
 * picked in the round browser.
 */
export function scanForPlayerRows(): void {
  const schedule = dataStore.schedule;
  const startRound = pickTeamStartRound() ?? schedule?.firstRound?.id;
  if (!schedule || startRound === undefined) return;
  const model = getModel();

  for (const { row, teamId, name, wearsGkShirt } of readPlayerRows()) {
    const key = `${teamId}|${name}|${wearsGkShirt}|${startRound}`;
    if (row.getAttribute(STRIP_KEY_ATTR) === key && coloredWith.get(row) === model) continue;

    row.querySelector(STRIP_SELECTOR)?.remove();
    row.setAttribute(STRIP_KEY_ATTR, key);
    coloredWith.set(row, model);

    const fixtures = schedule.fixturesFrom(teamId, startRound, STRIP_LENGTH);
    if (fixtures.length === 0) continue;

    const positionGroup = name ? dataStore.positionGroupFor(teamId, name, wearsGkShirt) : null;
    row.appendChild(renderFixtureStrip(fixtures, positionGroup, model));
  }
}
