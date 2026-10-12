import { readPitchCards } from "./pitch";

// The fixture strip and stats box bleed past a pitch card's padding so they
// span the card edge-to-edge and leave room for five chips. How far they may
// go depends on how close the neighbouring cards are, which the site decides
// by screen width and by how many players share a line (five midfielders on a
// 320px phone are only 4px apart). So it's measured, not set in CSS.
const MAX_BLEED = 10;
// Below this many px per chip, three-letter codes need the smaller font.
const TIGHT_CHIP_WIDTH = 14.5;
const FITTED_SELECTOR = ":scope > .spl-fh-fixture-strip, :scope > .spl-fh-stats";

/** Sizes every pitch card's strip and stats to the room beside the card. */
export function fitPitchCards(): void {
  // All reads first, then all writes, so the page is laid out once.
  const cards = readPitchCards()
    .map(({ row }) => ({ row, rect: row.getBoundingClientRect(), padding: parseFloat(getComputedStyle(row).paddingLeft) || 0 }))
    .filter((c) => c.rect.width > 0);

  const fits = cards.map((card) => {
    let gap = Infinity;
    for (const other of cards) {
      if (other === card || Math.abs(other.rect.top - card.rect.top) > 2) continue; // not on the same line
      const between = Math.max(other.rect.left - card.rect.right, card.rect.left - other.rect.right);
      gap = Math.min(gap, Math.max(0, between));
    }
    // Keep at least 2px between neighbouring strips.
    const bleed = Math.min(MAX_BLEED, card.padding + Math.max(0, (gap - 2) / 2));
    const stripWidth = card.rect.width - 2 * card.padding + 2 * bleed;
    return { row: card.row, bleed, tight: (stripWidth - 4) / 5 < TIGHT_CHIP_WIDTH };
  });

  for (const { row, bleed, tight } of fits) {
    for (const el of row.querySelectorAll<HTMLElement>(FITTED_SELECTOR)) {
      el.style.setProperty("--fh-bleed", `${bleed}px`);
      el.classList.toggle("spl-fh-tight", tight);
    }
  }
}
