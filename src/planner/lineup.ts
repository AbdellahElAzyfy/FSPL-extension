import type { Pick } from "../api/myTeam";

/**
 * A 15-player squad laid out like the game's Pick Team: slots[0..10] start,
 * slots[11] is the bench goalkeeper, slots[12..14] the outfield bench in
 * substitution order. Values are player (element) ids. Plain data, so plans
 * can be stored as-is.
 */
export interface Lineup {
  slots: number[];
  captain: number;
  vice: number;
}

export const STARTERS = 11;
const BENCH_GK_SLOT = 11;
const GOALKEEPER_TYPE = 1;

/** How many of a position may start (squad_min_play / squad_max_play). */
export interface StartLimits {
  min: number;
  max: number;
}

export interface LineupRules {
  typeOf(playerId: number): number | undefined;
  limits(elementType: number): StartLimits | undefined;
}

export function lineupFromPicks(picks: Pick[]): Lineup {
  const sorted = [...picks].sort((a, b) => a.position - b.position);
  return {
    slots: sorted.map((p) => p.element),
    captain: sorted.find((p) => p.is_captain)?.element ?? sorted[0].element,
    vice: sorted.find((p) => p.is_vice_captain)?.element ?? sorted[1].element,
  };
}

export const isStarter = (slot: number) => slot < STARTERS;

/**
 * Brings the lineup in line with the squad the Transfers page currently shows
 * (unconfirmed transfers included). As in the game, a player bought takes the
 * slot — and armband — of the player sold in the same position. Players sold
 * but not yet replaced keep their slot and are returned as `missing`.
 */
export function applySquad(lineup: Lineup, squad: number[], rules: LineupRules): { lineup: Lineup; missing: Set<number> } {
  const inSquad = new Set(squad);
  const inLineup = new Set(lineup.slots);
  const added = squad.filter((id) => !inLineup.has(id));
  const next = { ...lineup, slots: [...lineup.slots] };
  const missing = new Set<number>();

  next.slots.forEach((id, slot) => {
    if (inSquad.has(id)) return;
    const type = rules.typeOf(id);
    const replacement = added.findIndex((candidate) => rules.typeOf(candidate) === type);
    if (replacement === -1) {
      missing.add(id);
      return;
    }
    const [incoming] = added.splice(replacement, 1);
    next.slots[slot] = incoming;
    if (next.captain === id) next.captain = incoming;
    if (next.vice === id) next.vice = incoming;
  });

  return { lineup: next, missing };
}

/**
 * Swaps the players in two slots, or returns null if the game wouldn't allow
 * it: the bench goalkeeper only swaps with the starting one, and every
 * position keeps its minimum (and maximum) number of starters. Swapping two
 * starters changes nothing, so it also returns null.
 */
export function swapSlots(lineup: Lineup, a: number, b: number, rules: LineupRules): Lineup | null {
  if (a === b || (isStarter(a) && isStarter(b))) return null;

  const typeA = rules.typeOf(lineup.slots[a]);
  const typeB = rules.typeOf(lineup.slots[b]);
  const involvesGk = typeA === GOALKEEPER_TYPE || typeB === GOALKEEPER_TYPE || a === BENCH_GK_SLOT || b === BENCH_GK_SLOT;
  if (involvesGk && !(typeA === GOALKEEPER_TYPE && typeB === GOALKEEPER_TYPE)) return null;

  const slots = [...lineup.slots];
  [slots[a], slots[b]] = [slots[b], slots[a]];
  if (!startersValid(slots, rules)) return null;

  // A captain dropped to the bench hands the armband to whoever replaces them.
  const next = { ...lineup, slots };
  for (const role of ["captain", "vice"] as const) {
    const holder = lineup[role];
    if (holder === lineup.slots[a] && !isStarter(b) && isStarter(a)) next[role] = lineup.slots[b];
    if (holder === lineup.slots[b] && !isStarter(a) && isStarter(b)) next[role] = lineup.slots[a];
  }
  return next;
}

/** Whether `slot` and `other` may be swapped. */
export function canSwap(lineup: Lineup, slot: number, other: number, rules: LineupRules): boolean {
  return swapSlots(lineup, slot, other, rules) !== null;
}

/** Gives a starter the captain's (or vice-captain's) armband; the two swap if needed. */
export function setArmband(lineup: Lineup, playerId: number, role: "captain" | "vice"): Lineup {
  const slot = lineup.slots.indexOf(playerId);
  if (!isStarter(slot) || lineup[role] === playerId) return lineup;
  const other = role === "captain" ? "vice" : "captain";
  const next = { ...lineup, [role]: playerId };
  if (lineup[other] === playerId) next[other] = lineup[role];
  return next;
}

function startersValid(slots: number[], rules: LineupRules): boolean {
  const counts = new Map<number, number>();
  for (const id of slots.slice(0, STARTERS)) {
    const type = rules.typeOf(id);
    if (type === undefined) continue; // unknown player (e.g. left the league): don't block
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  for (const [type, count] of counts) {
    const limits = rules.limits(type);
    if (limits && (count < limits.min || count > limits.max)) return false;
  }
  // A position with no starters at all must allow zero.
  for (const type of [1, 2, 3, 4]) {
    if (!counts.has(type) && (rules.limits(type)?.min ?? 0) > 0) return false;
  }
  return true;
}
