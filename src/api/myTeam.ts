// The logged-in manager's saved team. Same FPL-style endpoints as the public
// API, but they need the site's session cookie — so they only work from the
// content script (same origin), and answer 401/403 when logged out.
// Confirmed against the live site 2026-10-03.

export interface Pick {
  element: number;
  position: number; // 1-11 starters, 12 bench GK, 13-15 bench order
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface MyTeam {
  entry: number;
  picks: Pick[];
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
  const { picks } = (await teamRes.json()) as { picks: Pick[] };
  return picks?.length === 15 ? { entry, picks } : null;
}
