// Shape of data/team-ratings.json — the default fixture difficulty ratings,
// maintained by hand (based on team stats) and served from the repo.
//
// Each value is 1 (weakest, easiest to face) .. 5 (strongest, hardest).
// home/away is where the RATED team plays: defence.home = how hard it is to
// score away at this team.
//   attack  -> difficulty for goalkeepers/defenders facing this team
//   defence -> difficulty for midfielders/forwards facing this team

export interface VenueRating {
  home: number;
  away: number;
}

export interface TeamRating {
  splTeamId: number;
  shortName: string;
  attack: VenueRating;
  defence: VenueRating;
}

export interface TeamRatingsFile {
  updatedAt: string; // YYYY-MM-DD
  teams: TeamRating[];
}

export type RatingSide = "attack" | "defence";
export type Venue = "home" | "away";
export type RatingKey = `${RatingSide}.${Venue}`;

export const RATING_KEYS: RatingKey[] = ["attack.home", "attack.away", "defence.home", "defence.away"];

/** A user's edits: only the values they changed, per SPL team id. */
export type RatingOverrides = Record<string, Partial<Record<RatingKey, number>>>;
