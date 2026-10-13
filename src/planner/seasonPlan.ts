import type { MyTeam } from "../api/myTeam";
import { applySquad, lineupFromPicks, type Lineup, type LineupRules } from "./lineup";

/**
 * A plan over the coming gameweeks: per round, the transfers made before its
 * deadline, the chip played and (optionally) how the team lines up. Squads,
 * bank, free transfers and hits are never stored: they're worked out by
 * replaying the plan from the manager's real team (`simulate`), so a plan
 * stays valid as prices and the real team move on.
 *
 * Game rules (fantasy.spl.com.sa/help/rules, read 2026-10-13):
 * - 1 free transfer a round, unused ones carry over up to 5; extras cost 4 points.
 * - Wildcard and Loan Rangers make transfers that round unlimited and free;
 *   saved free transfers are kept as they were (not increased) the round after.
 * - Loan Rangers also lifts the 3-per-club limit, and the squad goes back to
 *   how it was at the start of the round at the next deadline.
 * - Park the bus: defenders score double, no captain. Two captains: captain
 *   and vice both score double.
 * - One chip per round. Each chip comes twice, once per half of the season.
 * - A free transfer window runs up to the round 19 deadline. Like a wildcard,
 *   it doesn't add a free transfer for the round after (user, 2026-10-13).
 */
export type ChipName = "wildcard" | "uteam" | "pdbus" | "2capt";
const CHIP_NAMES: ReadonlySet<string> = new Set<ChipName>(["wildcard", "uteam", "pdbus", "2capt"]);
/** Chips that make the round's transfers unlimited and free. */
const TRANSFER_CHIPS: ReadonlySet<ChipName> = new Set<ChipName>(["wildcard", "uteam"]);
const LOAN_RANGERS: ChipName = "uteam";

export interface Transfer {
  out: number;
  in: number;
}

export interface RoundPlan {
  transfers: Transfer[];
  /** null = no chip, even if one is already played for the first round on the site. */
  chip?: ChipName | null;
  /** The lineup this round and onwards, until another round sets one. */
  lineup?: Lineup;
}

/** Keyed by round id. */
export type RoundPlans = Record<number, RoundPlan>;

/** One unplayed chip and the rounds it can be played in. */
export interface ChipSlot {
  name: ChipName;
  start: number;
  stop: number;
}

/** The manager's real team at the first round still open for transfers. */
export interface StartState {
  round: number;
  lineup: Lineup;
  /** What each player in the team sells for, in tenths. */
  selling: Record<number, number>;
  bank: number;
  /** Free transfers left this round; null = unlimited. */
  freeTransfers: number | null;
  chips: ChipSlot[];
  /** Chip already played for the first round on the site (still cancellable there). */
  pendingChip: ChipName | null;
}

export interface PlanRules extends LineupRules {
  /** Open round ids, earliest first. */
  rounds: number[];
  teamOf(playerId: number): number | undefined;
  /** Current price, in tenths; future price changes can't be known. */
  priceOf(playerId: number): number | undefined;
  teamLimit: number;
  maxFreeTransfers: number;
  hitCost: number;
  /** Rounds where transfers are unlimited and free without a chip. */
  freeRounds: ReadonlySet<number>;
}

export type Problem =
  | { kind: "budget"; short: number }
  | { kind: "club"; team: number; count: number }
  | { kind: "chip"; chip: ChipName };

export interface RoundState {
  round: number;
  /** The squad when the round starts, before its transfers. */
  before: number[];
  /** Transfers that still make sense, in order. */
  transfers: Transfer[];
  lineup: Lineup;
  chip: ChipName | null;
  /** Free transfers available this round; null = unlimited. */
  freeTransfers: number | null;
  /** Points deducted for extra transfers. */
  hits: number;
  /** Money left after this round's transfers, in tenths. */
  bank: number;
  /** What each player in the squad sells for after this round's transfers, in tenths. */
  selling: Map<number, number>;
  /** Chips that could be played this round (besides the one played, if any). */
  chipsPlayable: ChipName[];
  problems: Problem[];
}

export function startFromMyTeam(team: MyTeam, round: number): StartState {
  const chips: ChipSlot[] = [];
  let pendingChip: ChipName | null = null;
  for (const chip of team.chips) {
    if (!CHIP_NAMES.has(chip.name)) continue;
    const name = chip.name as ChipName;
    if (chip.is_pending) pendingChip = name;
    if (chip.status_for_entry === "available" || chip.is_pending) {
      chips.push({ name, start: chip.start_event, stop: chip.stop_event });
    }
  }
  const { limit, made, bank } = team.transfers;
  return {
    round,
    lineup: lineupFromPicks(team.picks),
    selling: Object.fromEntries(team.picks.map((p) => [p.element, p.selling_price])),
    bank,
    freeTransfers: limit === null ? null : Math.max(0, limit - made),
    chips,
    pendingChip,
  };
}

/** Replays the plan round by round from the real team. */
export function simulate(start: StartState, plans: RoundPlans, rules: PlanRules): RoundState[] {
  const rounds = rules.rounds.filter((r) => r >= start.round);
  const chipSlots = assignChips(start, plans, rounds);
  const states: RoundState[] = [];

  let lineup = start.lineup;
  let bank = start.bank;
  let selling = new Map(Object.entries(start.selling).map(([id, price]) => [Number(id), price]));
  let freeTransfers = start.freeTransfers;

  for (const round of rounds) {
    const plan = plans[round];
    const chip = chipOf(start, plans, round);
    const chipValid = chip === null || chipSlots.get(round) !== undefined;
    const activeChip = chipValid ? chip : null;
    const unlimited = freeTransfers === null || (activeChip !== null && TRANSFER_CHIPS.has(activeChip)) || rules.freeRounds.has(round);

    const before = lineup.slots;
    const squad = new Set(before);
    const transfers: Transfer[] = [];
    const roundSelling = new Map(selling);
    let roundBank = bank;
    for (const t of plan?.transfers ?? []) {
      if (!validTransfer(t, squad, rules)) continue;
      roundBank += roundSelling.get(t.out) ?? rules.priceOf(t.out) ?? 0;
      roundBank -= rules.priceOf(t.in) ?? 0;
      roundSelling.delete(t.out);
      roundSelling.set(t.in, rules.priceOf(t.in) ?? 0);
      squad.delete(t.out);
      squad.add(t.in);
      transfers.push({ out: t.out, in: t.in });
    }
    const roundLineup = applySquad(plan?.lineup ?? lineup, [...squad], rules).lineup;

    const problems: Problem[] = [];
    if (!chipValid && chip) problems.push({ kind: "chip", chip });
    if (roundBank < 0) problems.push({ kind: "budget", short: -roundBank });
    if (activeChip !== LOAN_RANGERS) {
      for (const [team, count] of clubCounts(squad, rules)) {
        if (count > rules.teamLimit) problems.push({ kind: "club", team, count });
      }
    }

    states.push({
      round,
      before,
      transfers,
      lineup: roundLineup,
      chip: activeChip,
      freeTransfers: unlimited ? null : freeTransfers,
      hits: unlimited ? 0 : Math.max(0, transfers.length - (freeTransfers ?? 0)) * rules.hitCost,
      bank: roundBank,
      selling: roundSelling,
      chipsPlayable: playableChips(start, chipSlots, round),
      problems,
    });

    // Into the next round. Loan Rangers hands the squad (and money) back.
    if (activeChip !== LOAN_RANGERS) {
      lineup = roundLineup;
      bank = roundBank;
      selling = roundSelling;
    }
    if (freeTransfers === null) freeTransfers = 1;
    else if (unlimited) freeTransfers = Math.min(rules.maxFreeTransfers, freeTransfers); // kept, not increased
    else freeTransfers = Math.min(rules.maxFreeTransfers, Math.max(0, freeTransfers - transfers.length) + 1);
  }
  return states;
}

/** Drops transfers that no longer make sense and rounds with nothing planned. */
export function normalize(start: StartState, plans: RoundPlans, rules: PlanRules): RoundPlans {
  const result: RoundPlans = {};
  for (const state of simulate(start, plans, rules)) {
    const plan = plans[state.round];
    if (!plan) continue;
    const next: RoundPlan = { transfers: state.transfers };
    if (plan.chip !== undefined) next.chip = plan.chip;
    if (plan.lineup) next.lineup = plan.lineup;
    if (next.transfers.length || next.chip !== undefined || next.lineup) result[state.round] = next;
  }
  return result;
}

/**
 * Sells `out` and buys `incoming` in `round`. Selling a player bought earlier
 * the same round changes that transfer instead (and buying back a player sold
 * that round cancels the sale), like on the site.
 */
export function addTransfer(start: StartState, plans: RoundPlans, round: number, out: number, incoming: number, rules: PlanRules): RoundPlans {
  return editRound(start, plans, round, rules, (plan, before) => ({
    ...plan,
    transfers: net(before, [...plan.transfers, { out, in: incoming }], rules),
  }));
}

/** The transfers that turn one squad into another, pairing players of the same position. */
export function transfersBetween(before: number[], after: number[], rules: PlanRules): Transfer[] {
  return pair(
    before.filter((id) => !after.includes(id)),
    after.filter((id) => !before.includes(id)),
    [],
    rules,
  );
}

/** Undoes one of the round's transfers. */
export function removeTransfer(start: StartState, plans: RoundPlans, round: number, index: number, rules: PlanRules): RoundPlans {
  return editRound(start, plans, round, rules, (plan) => ({
    ...plan,
    transfers: plan.transfers.filter((_, i) => i !== index),
  }));
}

/** Plays a chip in the round, or none (null). */
export function setChip(start: StartState, plans: RoundPlans, round: number, chip: ChipName | null, rules: PlanRules): RoundPlans {
  return editRound(start, plans, round, rules, (plan) => ({ ...plan, chip }));
}

/** Sets the round's lineup (swaps, armbands); it holds for later rounds too. */
export function setLineup(plans: RoundPlans, round: number, lineup: Lineup): RoundPlans {
  return { ...plans, [round]: { ...(plans[round] ?? { transfers: [] }), lineup } };
}

/**
 * A plan from an older version, which saved only the squad as one lineup:
 * the difference from the real team becomes transfers in the first round.
 */
export function planFromSnapshot(start: StartState, lineup: Lineup, rules: PlanRules): RoundPlans {
  const transfers = transfersBetween(start.lineup.slots, lineup.slots, rules);
  return normalize(start, { [start.round]: { transfers, lineup } }, rules);
}

// ------------------------------------------------------------------ internals

/**
 * Applies a change to one round, then carries it into later rounds: if the
 * squad the round hands on now has Y where it had X, later transfers that sold
 * X sell Y instead (and lineups that had X have Y). Later transfers that no
 * longer make sense — selling and buying the same player, or buying someone
 * already in the squad — are dropped.
 */
function editRound(
  start: StartState,
  plans: RoundPlans,
  round: number,
  rules: PlanRules,
  change: (plan: RoundPlan, before: Set<number>) => RoundPlan,
): RoundPlans {
  const clean = normalize(start, plans, rules);
  const oldState = simulate(start, clean, rules).find((s) => s.round === round);
  if (!oldState) return clean;

  const before = new Set(oldState.before);
  const edited = { ...clean, [round]: change(clean[round] ?? { transfers: [] }, before) };
  const newState = simulate(start, edited, rules).find((s) => s.round === round)!;

  const oldCarry = handedOn(oldState);
  const newCarry = handedOn(newState);
  const replaced = pair(
    oldCarry.filter((id) => !newCarry.includes(id)),
    newCarry.filter((id) => !oldCarry.includes(id)),
    [],
    rules,
  );
  const swap = new Map(replaced.map((t) => [t.out, t.in]));
  const rename = (id: number) => swap.get(id) ?? id;

  if (swap.size) {
    for (const r of Object.keys(edited).map(Number)) {
      if (r <= round) continue;
      const plan = edited[r];
      const lineup = plan.lineup && {
        slots: plan.lineup.slots.map(rename),
        captain: rename(plan.lineup.captain),
        vice: rename(plan.lineup.vice),
      };
      edited[r] = {
        ...plan,
        transfers: plan.transfers.map((t) => ({ out: rename(t.out), in: t.in })),
        ...(lineup && { lineup }),
      };
    }
  }
  return normalize(start, edited, rules);
}

/** The squad a round hands on to the next one. */
function handedOn(state: RoundState): number[] {
  return state.chip === LOAN_RANGERS ? state.before : state.lineup.slots;
}

/** The round's transfers boiled down to who actually leaves and arrives. */
function net(before: Set<number>, transfers: Transfer[], rules: PlanRules): Transfer[] {
  const squad = new Set(before);
  for (const t of transfers) {
    if (!validTransfer(t, squad, rules)) continue;
    squad.delete(t.out);
    squad.add(t.in);
  }
  return pair(
    [...before].filter((id) => !squad.has(id)),
    [...squad].filter((id) => !before.has(id)),
    transfers,
    rules,
  );
}

/** Pairs players out with players in of the same position, keeping existing pairs where possible. */
function pair(outs: number[], ins: number[], existing: Transfer[], rules: PlanRules): Transfer[] {
  const freeOuts = [...outs];
  const freeIns = [...ins];
  const result: Transfer[] = [];
  const take = (o: number, i: number) => {
    freeOuts.splice(freeOuts.indexOf(o), 1);
    freeIns.splice(freeIns.indexOf(i), 1);
    result.push({ out: o, in: i });
  };
  for (const t of existing) {
    if (freeOuts.includes(t.out) && freeIns.includes(t.in) && rules.typeOf(t.out) === rules.typeOf(t.in)) take(t.out, t.in);
  }
  for (const o of [...freeOuts]) {
    const i = freeIns.find((candidate) => rules.typeOf(candidate) === rules.typeOf(o));
    if (i !== undefined) take(o, i);
  }
  return result;
}

function validTransfer(t: Transfer, squad: Set<number>, rules: PlanRules): boolean {
  return (
    t.out !== t.in &&
    squad.has(t.out) &&
    !squad.has(t.in) && // can't buy a player already in the squad
    rules.typeOf(t.in) !== undefined &&
    rules.typeOf(t.out) === rules.typeOf(t.in)
  );
}

function clubCounts(squad: Iterable<number>, rules: PlanRules): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of squad) {
    const team = rules.teamOf(id);
    if (team !== undefined) counts.set(team, (counts.get(team) ?? 0) + 1);
  }
  return counts;
}

function chipOf(start: StartState, plans: RoundPlans, round: number): ChipName | null {
  const chip = plans[round]?.chip;
  if (chip !== undefined) return chip;
  return round === start.round ? start.pendingChip : null;
}

/** Which unplayed chip (index into start.chips) each round's chip uses, earliest round first. */
function assignChips(start: StartState, plans: RoundPlans, rounds: number[]): Map<number, number> {
  const used = new Map<number, number>();
  const taken = new Set<number>();
  for (const round of rounds) {
    const chip = chipOf(start, plans, round);
    if (!chip) continue;
    const slot = bestSlot(start, chip, round, taken);
    if (slot === undefined) continue;
    taken.add(slot);
    used.set(round, slot);
  }
  return used;
}

function playableChips(start: StartState, assigned: Map<number, number>, round: number): ChipName[] {
  const taken = new Set([...assigned].filter(([r]) => r !== round).map(([, slot]) => slot));
  const names = new Set<ChipName>();
  for (const chip of start.chips) {
    if (bestSlot(start, chip.name, round, taken) !== undefined) names.add(chip.name);
  }
  return [...names];
}

/** The unplayed chip of this kind that can be played in the round and runs out soonest. */
function bestSlot(start: StartState, name: ChipName, round: number, taken: Set<number>): number | undefined {
  let best: number | undefined;
  start.chips.forEach((chip, i) => {
    if (chip.name !== name || taken.has(i) || round < chip.start || round > chip.stop) return;
    if (best === undefined || chip.stop < start.chips[best].stop) best = i;
  });
  return best;
}
