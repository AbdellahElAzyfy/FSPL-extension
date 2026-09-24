import type { TeamXgSnapshot } from "../types/teamXg";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** Which side of the opponent matters: its defence (for ATT/MID) or its attack (for GK/DEF). */
export type PositionGroup = "attacking" | "defensive";

// Each team's averages are blended with the league average as if it had also
// played this many average matches, so small early-season samples stay near neutral.
const SHRINKAGE_MATCHES = 5;

// Difficulty score (1.00 = league average, higher = harder) -> 1..5 bucket.
// Signed off against the 2026-09-24 data (see project notes); tune here.
const BUCKET_UPPER_BOUNDS = [0.8, 0.93, 1.07, 1.2];

interface TeamRating {
  attack: number; // opponent's xG for, relative to league average
  defence: number; // opponent's xG against, relative to league average
}

export class DifficultyModel {
  private ratings = new Map<number, TeamRating>();
  private homeFactor = 1;
  private awayFactor = 1;

  constructor(snapshot: TeamXgSnapshot) {
    const leagueAvg =
      snapshot.league?.avgXg ??
      snapshot.teams.reduce((sum, t) => sum + t.avgXgFor, 0) / snapshot.teams.length;

    if (snapshot.league) {
      this.homeFactor = snapshot.league.homeAvgXg / leagueAvg;
      this.awayFactor = snapshot.league.awayAvgXg / leagueAvg;
    }

    const shrink = (avg: number, n: number) =>
      (n * avg + SHRINKAGE_MATCHES * leagueAvg) / (n + SHRINKAGE_MATCHES) / leagueAvg;

    for (const team of snapshot.teams) {
      this.ratings.set(team.splTeamId, {
        attack: shrink(team.avgXgFor, team.matchesPlayed),
        defence: shrink(team.avgXgAgainst, team.matchesPlayed),
      });
    }
  }

  /**
   * Difficulty of facing `opponentId` for a player whose team is home/away.
   * Attacking players care how much the opponent concedes; defensive players
   * care how much the opponent creates.
   */
  getDifficulty(opponentId: number, playerIsHome: boolean, group: PositionGroup): Difficulty | null {
    const opponent = this.ratings.get(opponentId);
    if (!opponent) return null;

    const score =
      group === "attacking"
        ? 1 / (opponent.defence * (playerIsHome ? this.homeFactor : this.awayFactor))
        : opponent.attack * (playerIsHome ? this.awayFactor : this.homeFactor);

    const index = BUCKET_UPPER_BOUNDS.findIndex((bound) => score < bound);
    return (index === -1 ? 5 : index + 1) as Difficulty;
  }
}
