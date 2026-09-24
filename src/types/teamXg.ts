// Shape of data/team-xg.json, produced by scripts/updateTeamXg.mjs.

export interface TeamXg {
  splTeamId: number;
  shortName: string;
  matchesPlayed: number;
  xgFor: number;
  xgAgainst: number;
  avgXgFor: number;
  avgXgAgainst: number;
}

export interface LeagueXg {
  matchesPlayed: number;
  avgXg: number;
  homeAvgXg: number;
  awayAvgXg: number;
}

export interface TeamXgSnapshot {
  generatedAt: string;
  league?: LeagueXg; // absent in snapshots generated before 2026-09-24
  teams: TeamXg[];
}
