import type { Player } from "../types/fixtures";

// bootstrap-static has a player's season totals, but not the matches he
// played in or how his price moved before this round. Both come from his
// per-match history in /api/element-summary/{id}/ (public, confirmed
// 2026-10-12): the minutes and the price he had at each match. One request per
// player, so they're made only for players on screen, a few at a time, and kept
// for the rest of the page's life.

/** "none": the price hasn't changed since the season started. */
export type PriceMove = "up" | "down" | "none";

export interface PlayerHistory {
  /** Direction of the most recent price change. */
  priceMove: PriceMove;
  /** Matches he got minutes in. */
  appearances: number;
}

interface ElementSummary {
  history: { value: number; minutes: number }[];
}

const MAX_IN_FLIGHT = 4;
const cache = new Map<number, Promise<PlayerHistory | null>>();
const queue: (() => void)[] = [];
let inFlight = 0;

/** The player's price trend and appearances; null if they couldn't be loaded. */
export function playerHistory(player: Player): Promise<PlayerHistory | null> {
  let history = cache.get(player.id);
  if (!history) {
    history = limited(() => fetchHistory(player)).catch(() => {
      cache.delete(player.id); // let a later scan retry
      return null;
    });
    cache.set(player.id, history);
  }
  return history;
}

async function fetchHistory(player: Player): Promise<PlayerHistory> {
  const res = await fetch(`/api/element-summary/${player.id}/`);
  if (!res.ok) throw new Error(`element-summary ${player.id}: ${res.status}`);
  const { history } = (await res.json()) as ElementSummary;
  return {
    priceMove: lastPriceMove(player, history),
    appearances: history.filter((h) => h.minutes > 0).length,
  };
}

function lastPriceMove(player: Player, history: ElementSummary["history"]): PriceMove {
  // Start price, the price at each match, then today's price.
  const prices = [player.now_cost - player.cost_change_start, ...history.map((h) => h.value), player.now_cost];
  for (let i = prices.length - 1; i > 0; i--) {
    if (prices[i] !== prices[i - 1]) return prices[i] > prices[i - 1] ? "up" : "down";
  }
  return "none";
}

function limited<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      inFlight++;
      task()
        .then(resolve, reject)
        .finally(() => {
          inFlight--;
          queue.shift()?.();
        });
    };
    if (inFlight < MAX_IN_FLIGHT) run();
    else queue.push(run);
  });
}
