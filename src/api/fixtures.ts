import type { Bootstrap, Fixture, Team, TeamFixtureMap } from "../types/fixtures";

// Both confirmed public (no auth/cookies needed) via curl against the
// live site on 2026-09-17.
const BOOTSTRAP_ENDPOINT = "/api/bootstrap-static/";
const FUTURE_FIXTURES_ENDPOINT = "/api/fixtures/?future=1";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchTeams(): Promise<Team[]> {
  const bootstrap = await fetchJson<Bootstrap>(BOOTSTRAP_ENDPOINT);
  return bootstrap.teams;
}

export async function fetchFutureFixtures(): Promise<Fixture[]> {
  return fetchJson<Fixture[]>(FUTURE_FIXTURES_ENDPOINT);
}

/**
 * Builds a teamId -> next N fixtures map from the already-future-filtered
 * fixture list (server sorts/filters by gameweek for us via ?future=1).
 */
export function buildTeamFixtureMap(
  fixtures: Fixture[],
  teamsById: Map<number, Team>,
  count = 5,
): TeamFixtureMap {
  const sorted = [...fixtures].sort((a, b) => a.event - b.event);
  const map: TeamFixtureMap = new Map();

  for (const fixture of sorted) {
    for (const [teamId, opponentId, isHome] of [
      [fixture.team_h, fixture.team_a, true],
      [fixture.team_a, fixture.team_h, false],
    ] as const) {
      const opponent = teamsById.get(opponentId);
      if (!opponent) continue;

      const existing = map.get(teamId) ?? [];
      if (existing.length < count) {
        existing.push({ fixture, opponent, isHome });
        map.set(teamId, existing);
      }
    }
  }

  return map;
}
