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

/** A player ("element" in the FPL-style API). element_type: 1 GKP, 2 DEF, 3 MID, 4 FWD. */
export interface Player {
  id: number;
  web_name: string;
  team: number;
  element_type: number;
}

export interface Bootstrap {
  teams: Team[];
  elements: Player[];
}

export type TeamFixtureMap = Map<number, ResolvedFixture[]>;

export interface ResolvedFixture {
  fixture: Fixture;
  opponent: Team;
  isHome: boolean;
}
