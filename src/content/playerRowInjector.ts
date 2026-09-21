import { dataStore } from "./dataStore";
import { extractTeamCodeFromShirtSrc } from "./shirtCode";
import { renderFixtureStrip } from "../ui/fixtureStrip";

const INJECTED_MARKER = "data-spl-fh-injected";
const SHIRT_IMG_SELECTOR = 'picture img[src*="/dist/img/shirts/"]';

/**
 * Pick Team and Transfers screens share the same player-row component
 * (confirmed by comparing outer HTML on both pages 2026-09-17), so one
 * scan covers both: find every shirt image, walk up to the row, and
 * append a fixture strip if not already done.
 *
 * Deliberately avoids the styled-components hash classnames (sc-xxxx)
 * seen in the row markup — those are build-specific and will change on
 * the site's next deploy. Structural queries (picture > img, closest
 * button, its parent) are more durable.
 */
export function scanForPlayerRows(): void {
  const shirtImgs = document.querySelectorAll<HTMLImageElement>(SHIRT_IMG_SELECTOR);

  shirtImgs.forEach((img) => {
    const teamCode = extractTeamCodeFromShirtSrc(img.currentSrc || img.src);
    if (teamCode === null) return;

    const teamId = dataStore.teamIdForShirtCode(teamCode);
    if (teamId === undefined) return;

    const button = img.closest("button");
    const row = button?.parentElement;
    if (!row || row.hasAttribute(INJECTED_MARKER)) return;

    const fixtures = dataStore.getFixturesForTeam(teamId);
    if (fixtures.length === 0) return;

    row.appendChild(renderFixtureStrip(fixtures));
    row.setAttribute(INJECTED_MARKER, "true");
  });
}
