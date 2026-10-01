import type { RatingKey, RatingOverrides, TeamRating } from "../types/teamRatings";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** Which side of the opponent matters: its defence (for ATT/MID) or its attack (for GK/DEF). */
export type PositionGroup = "attacking" | "defensive";

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Fixture difficulty from team ratings: the default ratings (data/team-ratings.json)
 * with the user's own edits layered on top. Immutable — a new model is built
 * whenever the ratings or the user's edits change.
 */
export class DifficultyModel {
  private readonly defaults: Map<number, TeamRating>;
  private readonly overrides: RatingOverrides;
  readonly updatedAt: string;

  constructor(defaults: TeamRating[], overrides: RatingOverrides, updatedAt: string) {
    this.defaults = new Map(defaults.map((team) => [team.splTeamId, team]));
    this.overrides = overrides;
    this.updatedAt = updatedAt;
  }

  /** Difficulty of facing `opponentId` for a player whose team is home/away. */
  getDifficulty(opponentId: number, playerIsHome: boolean, group: PositionGroup): Difficulty | null {
    // Ratings are stored from the rated (opponent) team's venue.
    const venue = playerIsHome ? "away" : "home";
    return this.rating(opponentId, group === "attacking" ? `defence.${venue}` : `attack.${venue}`);
  }

  rating(teamId: number, key: RatingKey): Difficulty | null {
    const edited = this.overrides[teamId]?.[key];
    return isDifficulty(edited) ? edited : this.defaultRating(teamId, key);
  }

  defaultRating(teamId: number, key: RatingKey): Difficulty | null {
    const team = this.defaults.get(teamId);
    if (!team) return null;
    const [side, venue] = key.split(".") as ["attack" | "defence", "home" | "away"];
    const value = team[side][venue];
    return isDifficulty(value) ? value : null;
  }

  isEdited(teamId: number, key: RatingKey): boolean {
    return isDifficulty(this.overrides[teamId]?.[key]);
  }

  /** Number of teams with at least one edited value. */
  get editedTeamCount(): number {
    return Object.values(this.overrides).filter((values) => Object.values(values).some(isDifficulty)).length;
  }
}
