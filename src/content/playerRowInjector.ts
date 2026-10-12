import { dataStore } from "./dataStore";
import { readPlayerRows } from "./pitch";
import { pickTeamStartRound } from "./pickTeamRounds";
import { renderFixtureStrip } from "../ui/fixtureStrip";
import { renderPriceBadge } from "../ui/priceBadge";
import { lastPriceMove } from "../api/priceHistory";
import type { DifficultyModel } from "../fdr/difficulty";
import { getModel } from "../fdr/ratingsStore";

// What a row's strip was built for: player and first round. React reuses row
// elements when a player is swapped (substitution, transfer), changing only
// the name and shirt inside — so a row is re-rendered whenever this key no
// longer matches.
const STRIP_KEY_ATTR = "data-spl-fh-player";
const ADDED_SELECTOR = ":scope > .spl-fh-fixture-strip, :scope > .spl-fh-price";
const STRIP_LENGTH = 5;
// The ratings model each row's strip was coloured with. The model is replaced
// whenever ratings change (incl. user edits), so a mismatch means "recolour".
const coloredWith = new WeakMap<Element, DifficultyModel>();
// The latest build of each row, so a price badge that loads after the row was
// rebuilt (player swapped, ratings recoloured) is dropped.
const latestBuild = new WeakMap<Element, object>();

/**
 * Adds the next-5 fixture strip and a price-change arrow to every player row
 * (pitch cards and list rows, Pick Team and Transfers). On Pick Team the strip
 * starts at the round picked in the round browser.
 */
export function scanForPlayerRows(): void {
  const schedule = dataStore.schedule;
  const startRound = pickTeamStartRound() ?? schedule?.firstRound?.id;
  if (!schedule || startRound === undefined) return;
  const model = getModel();

  for (const { row, teamId, name, wearsGkShirt, nameEl } of readPlayerRows()) {
    const key = `${teamId}|${name}|${wearsGkShirt}|${startRound}`;
    if (row.getAttribute(STRIP_KEY_ATTR) === key && coloredWith.get(row) === model) continue;

    row.querySelectorAll(ADDED_SELECTOR).forEach((el) => el.remove());
    row.setAttribute(STRIP_KEY_ATTR, key);
    coloredWith.set(row, model);
    const build = {};
    latestBuild.set(row, build);

    const positionGroup = name ? dataStore.positionGroupFor(teamId, name, wearsGkShirt) : null;
    const rounds = schedule.roundsFrom(teamId, startRound, STRIP_LENGTH);
    if (rounds.length > 0) row.appendChild(renderFixtureStrip(rounds, positionGroup, model));

    // Same-name teammates can't be told apart from the row: show no price
    // arrow rather than someone else's.
    const candidates = name ? dataStore.candidates(teamId, name, wearsGkShirt) : [];
    if (candidates.length !== 1) continue;
    const player = candidates[0];

    lastPriceMove(player).then((move) => {
      if (!move || latestBuild.get(row) !== build) return;
      const badge = renderPriceBadge(move, player);
      badge.classList.add(nameEl ? "spl-fh-price--card" : "spl-fh-price--list");
      row.appendChild(badge);
    });
  }
}
