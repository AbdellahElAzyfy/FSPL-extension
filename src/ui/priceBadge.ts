import type { PriceMove } from "../api/priceHistory";
import type { Player } from "../types/fixtures";
import { t } from "./i18n";

// 12×12 icons drawn in currentColor.
const ICONS: Record<PriceMove, string> = {
  up: '<path d="M6 1.5l4.8 6H7.6V11H4.4V7.5H1.2z"/>',
  down: '<path d="M6 10.5l-4.8-6h3.2V1h3.2v3.5h3.2z"/>',
  none: '<rect x="1.5" y="3.6" width="9" height="1.8" rx=".6"/><rect x="1.5" y="6.6" width="9" height="1.8" rx=".6"/>',
};

/** Green up / red down arrow for the direction of the player's last price change; grey "=" if it never changed. */
export function renderPriceBadge(move: PriceMove, player: Player): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "spl-fh-price";
  badge.dataset.move = move;
  const price = (player.now_cost / 10).toFixed(1);
  badge.title = {
    up: t(`Last price change: rise (now ${price})`, `آخر تغيير في السعر: ارتفاع (الآن ${price})`),
    down: t(`Last price change: fall (now ${price})`, `آخر تغيير في السعر: انخفاض (الآن ${price})`),
    none: t(`No price change yet (${price})`, `لم يتغير السعر بعد (${price})`),
  }[move];

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 12 12");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = ICONS[move];
  badge.append(icon);
  return badge;
}
