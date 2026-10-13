// The logged-in manager's saved team. Same FPL-style endpoints as the public
// API, but they need the site's session cookie — so they only work from the
// content script (same origin), and answer 401/403 when logged out.
// Confirmed against the live site 2026-10-03; prices, transfers and chips
// confirmed 2026-10-13.

export interface Pick {
  element: number;
  position: number; // 1-11 starters, 12 bench GK, 13-15 bench order
  is_captain: boolean;
  is_vice_captain: boolean;
  /** What the player sells for now, in tenths (after the 50% sell-on fee). */
  selling_price: number;
}

/** One chip, e.g. the first-half wildcard. */
export interface ChipStatus {
  name: string; // "wildcard" | "uteam" (Loan Rangers) | "pdbus" (Park the bus) | "2capt" (Two captains)
  status_for_entry: string; // "available" once unplayed
  start_event: number;
  stop_event: number;
  is_pending: boolean; // played for the coming round, still cancellable
}

export interface TransferStatus {
  /** Free transfers this round; null when transfers are unlimited. */
  limit: number | null;
  made: number;
  /** Money in the bank, in tenths. */
  bank: number;
  status: string; // "cost" normally
}

export interface MyTeam {
  entry: number;
  picks: Pick[];
  chips: ChipStatus[];
  transfers: TransferStatus;
}

interface MeResponse {
  player: { entry: number | null } | null;
}

/** The manager's current team, or null when logged out / no team yet. */
export async function fetchMyTeam(): Promise<MyTeam | null> {
  const meRes = await fetch("/api/me/");
  if (!meRes.ok) return null;
  const entry = ((await meRes.json()) as MeResponse).player?.entry;
  if (!entry) return null;

  const teamRes = await fetch(`/api/my-team/${entry}/`);
  if (!teamRes.ok) return null;
  const { picks, chips, transfers } = (await teamRes.json()) as Omit<MyTeam, "entry">;
  return picks?.length === 15 ? { entry, picks, chips: chips ?? [], transfers } : null;
}
