import { dataStore } from "./dataStore";
import { extractTeamCodeFromShirtSrc, isGoalkeeperShirt } from "./shirtCode";
import { renderFixtureStrip } from "../ui/fixtureStrip";
import type { DifficultyModel } from "../fdr/difficulty";
import { getModel } from "../fdr/ratingsStore";

// Which player a row's strip was built for. React reuses row elements when a
// player is swapped (substitution, transfer), changing only the name and
// shirt inside — so a row is re-rendered whenever this key no longer matches.
const PLAYER_KEY_ATTR = "data-spl-fh-player";
const STRIP_SELECTOR = ":scope > .spl-fh-fixture-strip";
const SHIRT_IMG_SELECTOR = 'picture img[src*="/dist/img/shirts/"]';
// The ratings model each row's strip was coloured with. The model is replaced
// whenever ratings change (incl. user edits), so a mismatch means "recolour".
const coloredWith = new WeakMap<Element, DifficultyModel>();

/**
 * Pick Team and Transfers screens share the same player-row component
 * (confirmed by comparing outer HTML on both pages 2026-09-17), so one
 * scan covers both: find every shirt image, walk up to the row, and
 * (re)build its fixture strip if the row shows a different player than
 * the strip was built for.
 *
 * Deliberately avoids the styled-components hash classnames (sc-xxxx)
 * seen in the row markup — those are build-specific and will change on
 * the site's next deploy. Structural queries (picture > img, closest
 * button, its parent) are more durable.
 */
export function scanForPlayerRows(): void {
  const shirtImgs = document.querySelectorAll<HTMLImageElement>(SHIRT_IMG_SELECTOR);

  shirtImgs.forEach((img) => {
    // img.src, not currentSrc: currentSrc keeps the old shirt until the new
    // image has loaded, which would briefly key the row to the previous team.
    const shirtSrc = img.src;
    const teamCode = extractTeamCodeFromShirtSrc(shirtSrc);
    if (teamCode === null) return;

    const teamId = dataStore.teamIdForShirtCode(teamCode);
    if (teamId === undefined) return;

    const button = img.closest("button");
    const row = button?.parentElement;
    if (!row) return;

    const playerName = findPlayerName(button, img);
    const wearsGkShirt = isGoalkeeperShirt(shirtSrc);
    const playerKey = `${teamId}|${playerName}|${wearsGkShirt}`;
    const model = getModel();
    if (row.getAttribute(PLAYER_KEY_ATTR) === playerKey && coloredWith.get(row) === model) return;

    row.querySelector(STRIP_SELECTOR)?.remove();
    row.setAttribute(PLAYER_KEY_ATTR, playerKey);
    coloredWith.set(row, model);

    const fixtures = dataStore.getFixturesForTeam(teamId);
    if (fixtures.length === 0) return;

    const positionGroup = playerName ? dataStore.positionGroupFor(teamId, playerName, wearsGkShirt) : null;
    row.appendChild(renderFixtureStrip(fixtures, positionGroup, model));
  });
}

/**
 * Pitch cards: the name div is the only element carrying an "element"
 * attribute (the site leaks its player prop onto the DOM as
 * element="[object Object]").
 * Transfers player list: no such attribute; the name is the first text
 * block after the shirt — button > [div > picture, div > [name, team]].
 * The fallback walks from the shirt to that block, which also matches the
 * pitch layout (button > [picture, div > div > [name, fixture]]).
 */
function findPlayerName(button: HTMLButtonElement, img: HTMLImageElement): string {
  const tagged = button.querySelector("[element]")?.textContent?.trim();
  if (tagged) return tagged;

  const picture = img.closest("picture");
  let el = picture?.nextElementSibling ?? picture?.parentElement?.nextElementSibling ?? null;
  while (el?.firstElementChild) el = el.firstElementChild;
  return el?.textContent?.trim() ?? "";
}
