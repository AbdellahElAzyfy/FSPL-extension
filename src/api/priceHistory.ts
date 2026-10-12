import type { Player } from "../types/fixtures";

// bootstrap-static only says how a player's price moved this round
// (cost_change_event) and since the season started (cost_change_start). The
// direction of his last change comes from the price he had at each match, in
// /api/element-summary/{id}/ (public, confirmed 2026-10-12). One request per
// player, so they're made only for players on screen, a few at a time, and
// kept for the rest of the page's life.

/** "none": the price hasn't changed since the season started. */
export type PriceMove = "up" | "down" | "none";

interface ElementSummary {
  history: { value: number }[];
}

const MAX_IN_FLIGHT = 4;
const cache = new Map<number, Promise<PriceMove | null>>();
const queue: (() => void)[] = [];
let inFlight = 0;

/** Whether the player's most recent price change was a rise or a fall; null if it couldn't be loaded. */
export function lastPriceMove(player: Player): Promise<PriceMove | null> {
  let move = cache.get(player.id);
  if (!move) {
    move = limited(() => fetchLastMove(player)).catch(() => {
      cache.delete(player.id); // let a later scan retry
      return null;
    });
    cache.set(player.id, move);
  }
  return move;
}

async function fetchLastMove(player: Player): Promise<PriceMove> {
  const res = await fetch(`/api/element-summary/${player.id}/`);
  if (!res.ok) throw new Error(`element-summary ${player.id}: ${res.status}`);
  const { history } = (await res.json()) as ElementSummary;

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
