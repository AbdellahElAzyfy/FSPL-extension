import { fetchBootstrap, fetchFutureFixtures } from "../api/fixtures";
import type { PositionGroup } from "../fdr/difficulty";
import { loadRatings } from "../fdr/ratingsStore";
import { Schedule } from "../fdr/schedule";
import type { ElementType, Player, Team } from "../types/fixtures";
import type { SeasonGridInput } from "../ui/seasonGrid";

export const GOALKEEPER_TYPE = 1;
const ATTACKING_TYPES = new Set([3, 4]); // MID, FWD

export function positionGroupOf(elementType: number): PositionGroup {
  return ATTACKING_TYPES.has(elementType) ? "attacking" : "defensive";
}

class DataStore {
  private teamsById = new Map<number, Team>();
  private teamIdByCode = new Map<number, number>();
  private playersById = new Map<number, Player>();
  // "teamId|web_name" -> every player with that name in that team
  private playersByTeamAndName = new Map<string, Player[]>();
  private elementTypes: ElementType[] = [];
  private scheduleData: Schedule | null = null;
  private seasonInput: SeasonGridInput | null = null;
  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.doLoad();
    }
    return this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    // loadRatings never rejects: it falls back to the ratings bundled with the extension.
    const [bootstrap, fixtures] = await Promise.all([fetchBootstrap(), fetchFutureFixtures(), loadRatings()]);

    this.teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));
    this.teamIdByCode = new Map(bootstrap.teams.map((t) => [t.code, t.id]));
    this.playersById = new Map(bootstrap.elements.map((p) => [p.id, p]));
    this.elementTypes = bootstrap.element_types;

    for (const player of bootstrap.elements) {
      const key = `${player.team}|${player.web_name}`;
      this.playersByTeamAndName.set(key, [...(this.playersByTeamAndName.get(key) ?? []), player]);
    }

    // ?future=1 already holds every unplayed fixture, which is all the schedule needs.
    this.scheduleData = new Schedule(bootstrap.teams, bootstrap.events, fixtures);
    this.seasonInput = { teams: bootstrap.teams, events: bootstrap.events, fixtures };
  }

  /** Everything the season difficulty grid needs; null until loaded. */
  get seasonGridInput(): SeasonGridInput | null {
    return this.seasonInput;
  }

  /** Remaining fixtures by team and open round; null until loaded. */
  get schedule(): Schedule | null {
    return this.scheduleData;
  }

  teamIdForShirtCode(shirtCode: number): number | undefined {
    return this.teamIdByCode.get(shirtCode);
  }

  team(teamId: number): Team | undefined {
    return this.teamsById.get(teamId);
  }

  player(playerId: number): Player | undefined {
    return this.playersById.get(playerId);
  }

  elementType(typeId: number): ElementType | undefined {
    return this.elementTypes.find((t) => t.id === typeId);
  }

  /**
   * Rows only show a player's name and shirt, so the player comes from matching
   * name + team against bootstrap-static. A handful of same-name teammates
   * exist; the GK shirt tells a keeper apart from an outfield namesake.
   * Returns null if the row can't be resolved to exactly one player.
   */
  findPlayer(teamId: number, webName: string, wearsGkShirt: boolean): Player | null {
    const candidates = this.candidates(teamId, webName, wearsGkShirt);
    return candidates.length === 1 ? candidates[0] : null;
  }

  /** Like findPlayer, but only the position group must be unambiguous. */
  positionGroupFor(teamId: number, webName: string, wearsGkShirt: boolean): PositionGroup | null {
    const groups = new Set(this.candidates(teamId, webName, wearsGkShirt).map((p) => positionGroupOf(p.element_type)));
    return groups.size === 1 ? [...groups][0] : null;
  }

  private candidates(teamId: number, webName: string, wearsGkShirt: boolean): Player[] {
    const players = this.playersByTeamAndName.get(`${teamId}|${webName}`) ?? [];
    return players.filter((p) => (p.element_type === GOALKEEPER_TYPE) === wearsGkShirt);
  }
}

export const dataStore = new DataStore();
