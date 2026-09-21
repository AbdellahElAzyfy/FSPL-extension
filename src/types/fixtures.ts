// Shapes match the real /api/bootstrap-static/ and /api/fixtures/
// responses (subset of fields we actually use). This platform is a
// fork of the Fantasy Premier League API.

export interface Team {
  id: number;
  code: number;
  name: string;
  short_name: string;
}

export interface Fixture {
  id: number;
  event: number;
  kickoff_time: string | null;
  team_a: number;
  team_h: number;
  finished: boolean;
}

export interface Bootstrap {
  teams: Team[];
}

export type TeamFixtureMap = Map<number, ResolvedFixture[]>;

export interface ResolvedFixture {
  fixture: Fixture;
  opponent: Team;
  isHome: boolean;
}
