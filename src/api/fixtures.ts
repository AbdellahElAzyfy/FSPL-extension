import type { Bootstrap, Fixture, Team, TeamFixtureMap } from "../types/fixtures";

// All confirmed public (no auth/cookies needed) via curl against the
// live site on 2026-09-17. Paths are relative for content scripts (same
// origin as the site); extension pages pass an absolute `origin`.
const BOOTSTRAP_ENDPOINT = "/api/bootstrap-static/";
const FUTURE_FIXTURES_ENDPOINT = "/api/fixtures/?future=1";
const ALL_FIXTURES_ENDPOINT = "/api/fixtures/";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchBootstrap(origin = ""): Promise<Bootstrap> {
  return fetchJson<Bootstrap>(origin + BOOTSTRAP_ENDPOINT);
}

export async function fetchFutureFixtures(): Promise<Fixture[]> {
  return fetchJson<Fixture[]>(FUTURE_FIXTURES_ENDPOINT);
}

export async function fetchAllFixtures(origin = ""): Promise<Fixture[]> {
  return fetchJson<Fixture[]>(origin + ALL_FIXTURES_ENDPOINT);
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
  // Postponed fixtures without a new date have event = null: leave them out
  // rather than guess where they go. Within a round (double gameweeks), order
  // by kickoff.
  const kickoff = (f: Fixture) => (f.kickoff_time ? Date.parse(f.kickoff_time) : Infinity);
  const sorted = fixtures
    .filter((f) => f.event != null)
    .sort((a, b) => a.event - b.event || kickoff(a) - kickoff(b));
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
