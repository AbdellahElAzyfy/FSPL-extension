import type { PriceMove } from "../api/playerHistory";
import type { Player } from "../types/fixtures";
import { t } from "./i18n";

// 12×12 icons drawn in currentColor, one per stat.
const ICONS = {
  ownership:
    '<circle cx="4.3" cy="3.6" r="2"/><path d="M0.6 11c0-2.4 1.6-4.2 3.7-4.2S8 8.6 8 11z"/><circle cx="8.6" cy="4.3" r="1.6"/><path d="M8.3 7.2c1.8-.4 3.2 1.1 3.2 3.8H9c0-1.5-.2-2.7-.7-3.8z"/>',
  totalPoints: '<path d="M6 .6l1.7 3.5 3.8.5-2.8 2.6.7 3.8L6 9.2l-3.4 1.8.7-3.8L.5 4.6l3.8-.5z"/>',
  roundPoints:
    '<path d="M1 3.2c0-.7.5-1.2 1.2-1.2h7.6c.7 0 1.2.5 1.2 1.2V10c0 .7-.5 1.2-1.2 1.2H2.2C1.5 11.2 1 10.7 1 10zm1.2 1.9V10h7.6V5.1z"/><rect x="3" y=".6" width="1.4" height="2.6" rx=".5"/><rect x="7.6" y=".6" width="1.4" height="2.6" rx=".5"/><rect x="5" y="6.3" width="2.2" height="2.2"/>',
  goals:
    '<path d="M6 .8a5.2 5.2 0 110 10.4A5.2 5.2 0 016 .8zm0 1.3a3.9 3.9 0 100 7.8 3.9 3.9 0 000-7.8z"/><path d="M6 3.9l2 1.4-.8 2.3H4.8L4 5.3z"/>',
  assists:
    '<path d="M1.2 2h3.6v3.3l4.6 1.2c1 .3 1.6 1.1 1.6 2.1v.8H1.2z"/><rect x="1.2" y="10" width="1.5" height="1.2"/><rect x="4.6" y="10" width="1.5" height="1.2"/><rect x="8" y="10" width="1.5" height="1.2"/>',
  minutes:
    '<rect x="4.6" y=".4" width="2.8" height="1.3" rx=".4"/><path d="M6 2.3a4.6 4.6 0 110 9.2 4.6 4.6 0 010-9.2zm0 1.3a3.3 3.3 0 100 6.6 3.3 3.3 0 000-6.6z"/><path d="M5.4 4.5h1.2v2.8H5.4z"/>',
  up: '<path d="M6 1.5l4.8 6H7.6V11H4.4V7.5H1.2z"/>',
  down: '<path d="M6 10.5l-4.8-6h3.2V1h3.2v3.5h3.2z"/>',
  none: '<rect x="1.5" y="3.6" width="9" height="1.8" rx=".6"/><rect x="1.5" y="6.6" width="9" height="1.8" rx=".6"/>',
};

function icon(svg: string): SVGSVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("viewBox", "0 0 12 12");
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = svg;
  return el;
}

function stat(iconSvg: string, value: string, title: string): HTMLSpanElement {
  const cell = document.createElement("span");
  cell.className = "spl-fh-stat";
  cell.title = title;
  const text = document.createElement("span");
  text.textContent = value;
  cell.append(icon(iconSvg), text);
  return cell;
}

/**
 * Six season stats in two rows of three, each with an icon and a hover title:
 * ownership, total points, last round's points / goals, assists, minutes per
 * game. Minutes per game needs the player's appearances, so it shows "–" until
 * setMinutesPerGame fills it in.
 */
export function renderPlayerStats(player: Player, round: number | null): HTMLElement {
  const box = document.createElement("div");
  box.className = "spl-fh-stats";
  const minutes = stat(ICONS.minutes, "–", t(`${player.minutes} minutes this season`, `${player.minutes} دقيقة هذا الموسم`));
  minutes.dataset.stat = "minutes";
  const roundText = round === null ? t("last round", "آخر جولة") : t(`round ${round}`, `الجولة ${round}`);
  box.append(
    stat(ICONS.ownership, `${player.selected_by_percent}%`, t(`Selected by ${player.selected_by_percent}% of managers`, `اختاره ${player.selected_by_percent}% من المدربين`)),
    stat(ICONS.totalPoints, String(player.total_points), t(`${player.total_points} points this season`, `${player.total_points} نقطة هذا الموسم`)),
    stat(ICONS.roundPoints, String(player.event_points), t(`${player.event_points} points in ${roundText}`, `${player.event_points} نقطة في ${roundText}`)),
    stat(ICONS.goals, String(player.goals_scored), t(`${player.goals_scored} goals`, `${player.goals_scored} أهداف`)),
    stat(ICONS.assists, String(player.assists), t(`${player.assists} assists`, `${player.assists} تمريرات حاسمة`)),
    minutes,
  );
  return box;
}

/** Average minutes in the matches the player got on the pitch. */
export function setMinutesPerGame(stats: HTMLElement, player: Player, appearances: number): void {
  const cell = stats.querySelector<HTMLElement>('[data-stat="minutes"]');
  if (!cell) return;
  const perGame = appearances > 0 ? Math.round(player.minutes / appearances) : 0;
  cell.lastElementChild!.textContent = String(perGame);
  cell.title = t(
    `${perGame} minutes per game (${player.minutes} minutes in ${appearances} games)`,
    `${perGame} دقيقة في المباراة (${player.minutes} دقيقة في ${appearances} مباراة)`,
  );
}

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
  badge.append(icon(ICONS[move]));
  return badge;
}
