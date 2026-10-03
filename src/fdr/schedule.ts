import type { Fixture, GameEvent, Team, TeamFixture } from "../types/fixtures";

/**
 * Every team's remaining fixtures, by round. Only rounds still open for
 * transfers count: once a round's deadline passes it's being played (teams that
 * already played would show as blank) and transfers apply to the next round
 * anyway — so everything starts there. Shared by the season grid, the fixture
 * strips, the Pick Team round browser and the team planner.
 */
export class Schedule {
  /** Open rounds, earliest first. */
  readonly rounds: GameEvent[];
  // teamId -> roundId -> fixtures that round (none = blank, 2+ = double), by kickoff
  private readonly byTeam = new Map<number, Map<number, TeamFixture[]>>();

  constructor(teams: Team[], events: GameEvent[], fixtures: Fixture[], now = Date.now()) {
    this.rounds = events
      .filter((e) => !e.finished && Date.parse(e.deadline_time) > now)
      .sort((a, b) => a.id - b.id);
    const open = new Set(this.rounds.map((r) => r.id));
    const teamsById = new Map(teams.map((t) => [t.id, t]));

    // Postponed fixtures without a new date have event = null: leave them out
    // rather than guess where they go.
    const kickoff = (f: Fixture) => (f.kickoff_time ? Date.parse(f.kickoff_time) : Infinity);
    const remaining = fixtures
      .filter((f) => f.event != null && !f.finished && open.has(f.event))
      .sort((a, b) => a.event - b.event || kickoff(a) - kickoff(b));

    for (const fixture of remaining) {
      const home = teamsById.get(fixture.team_h);
      const away = teamsById.get(fixture.team_a);
      if (!home || !away) continue;
      this.add(home.id, fixture.event, { opponent: away, isHome: true });
      this.add(away.id, fixture.event, { opponent: home, isHome: false });
    }
  }

  get firstRound(): GameEvent | undefined {
    return this.rounds[0];
  }

  /** A team's fixtures in one round: empty for a blank, two or more for a double. */
  fixtures(teamId: number, roundId: number): TeamFixture[] {
    return this.byTeam.get(teamId)?.get(roundId) ?? [];
  }

  /** A team's next `count` fixtures, starting at `fromRound`. */
  fixturesFrom(teamId: number, fromRound: number, count: number): TeamFixture[] {
    const result: TeamFixture[] = [];
    for (const round of this.rounds) {
      if (round.id < fromRound) continue;
      for (const fixture of this.fixtures(teamId, round.id)) {
        if (result.length === count) return result;
        result.push(fixture);
      }
    }
    return result;
  }

  private add(teamId: number, roundId: number, fixture: TeamFixture): void {
    let byRound = this.byTeam.get(teamId);
    if (!byRound) this.byTeam.set(teamId, (byRound = new Map()));
    byRound.set(roundId, [...(byRound.get(roundId) ?? []), fixture]);
  }
}
