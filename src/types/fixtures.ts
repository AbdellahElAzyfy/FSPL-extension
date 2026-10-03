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
  event: number; // null in the API for unscheduled (postponed, no new date) fixtures
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

/** A gameweek ("round" on this site). */
export interface GameEvent {
  id: number;
  finished: boolean;
  deadline_time: string;
}

/** A position. squad_min_play / squad_max_play bound how many may start. */
export interface ElementType {
  id: number;
  squad_min_play: number;
  squad_max_play: number;
}

export interface Bootstrap {
  teams: Team[];
  elements: Player[];
  events: GameEvent[];
  element_types: ElementType[];
}

/** One side of a fixture, seen from a team: who it plays and where. */
export interface TeamFixture {
  opponent: Team;
  isHome: boolean;
}
