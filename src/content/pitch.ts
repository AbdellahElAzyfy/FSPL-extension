import { dataStore } from "./dataStore";
import { extractTeamCodeFromShirtSrc, isGoalkeeperShirt } from "./shirtCode";

const SHIRT_IMG_SELECTOR = 'picture img[src*="/dist/img/shirts/"]';

/** A player row (pitch card or list row) the site rendered, resolved to its team. */
export interface PlayerRow {
  row: HTMLElement;
  teamId: number;
  name: string;
  wearsGkShirt: boolean;
  /**
   * Pitch cards only: the name element. The site leaks its player prop onto
   * it as element="[object Object]" — list rows don't have it, which is how
   * the two are told apart.
   */
  nameEl: HTMLElement | null;
}

/**
 * Pick Team and Transfers share the same player-row component (confirmed by
 * comparing outer HTML on both pages 2026-09-17): find every shirt image and
 * walk up to its row.
 *
 * Deliberately avoids the styled-components hash classnames (sc-xxxx) seen in
 * the row markup — those are build-specific and will change on the site's
 * next deploy. Structural queries (picture > img, closest button, its parent)
 * are more durable.
 */
export function readPlayerRows(): PlayerRow[] {
  const rows: PlayerRow[] = [];
  document.querySelectorAll<HTMLImageElement>(SHIRT_IMG_SELECTOR).forEach((img) => {
    // img.src, not currentSrc: currentSrc keeps the old shirt until the new
    // image has loaded, which would briefly key the row to the previous team.
    const teamCode = extractTeamCodeFromShirtSrc(img.src);
    const teamId = teamCode === null ? undefined : dataStore.teamIdForShirtCode(teamCode);
    const button = img.closest("button");
    const row = button?.parentElement;
    if (teamId === undefined || !button || !row) return;

    const nameEl = button.querySelector<HTMLElement>("[element]");
    rows.push({ row, teamId, name: findPlayerName(img, nameEl), wearsGkShirt: isGoalkeeperShirt(img.src), nameEl });
  });
  return rows;
}

/** The pitch's player cards (not the Transfers player list). */
export function readPitchCards(): (PlayerRow & { nameEl: HTMLElement })[] {
  return readPlayerRows().filter((r): r is PlayerRow & { nameEl: HTMLElement } => r.nameEl !== null);
}

/**
 * The box the site draws the pitch in (with its pitch/list toggle and, on Pick
 * Team, the save button): the smallest ancestor of all the pitch cards that
 * sits in the page's main column, i.e. whose parent holds several page
 * sections. Matches on both Pick Team and Transfers (2026-10-03).
 */
export function findPitchBox(cards = readPitchCards()): HTMLElement | null {
  if (cards.length === 0) return null;
  let box: HTMLElement | null = cards[0].row;
  for (const { row } of cards) {
    while (box && !box.contains(row)) box = box.parentElement;
  }
  while (box?.parentElement && box.parentElement.children.length < 4) box = box.parentElement;
  return box?.parentElement ? box : null;
}

/**
 * Pitch cards: the tagged name element.
 * Transfers player list: the name is the first text block after the shirt —
 * button > [div > picture, div > [name, team]].
 */
function findPlayerName(img: HTMLImageElement, nameEl: HTMLElement | null): string {
  const tagged = nameEl?.textContent?.trim();
  if (tagged) return tagged;

  const picture = img.closest("picture");
  let el = picture?.nextElementSibling ?? picture?.parentElement?.nextElementSibling ?? null;
  while (el?.firstElementChild) el = el.firstElementChild;
  return el?.textContent?.trim() ?? "";
}
