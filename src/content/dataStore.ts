import { buildTeamFixtureMap, fetchBootstrap, fetchFutureFixtures, fetchTeamXg } from "../api/fixtures";
import { DifficultyModel, type PositionGroup } from "../fdr/difficulty";
import type { ResolvedFixture, Team } from "../types/fixtures";

const GOALKEEPER_TYPE = 1;
const ATTACKING_TYPES = new Set([3, 4]); // MID, FWD

class DataStore {
  private teamsById: Map<number, Team> | null = null;
  private teamIdByCode: Map<number, number> | null = null;
  private teamFixtureMap: Map<number, ResolvedFixture[]> | null = null;
  // "teamId|web_name" -> element_types of every player with that name in that team
  private playerTypesByTeamAndName = new Map<string, number[]>();
  private difficultyModel: DifficultyModel | null = null;
  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.doLoad();
    }
    return this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    const [bootstrap, fixtures] = await Promise.all([fetchBootstrap(), fetchFutureFixtures()]);

    this.teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));
    this.teamIdByCode = new Map(bootstrap.teams.map((t) => [t.code, t.id]));
    this.teamFixtureMap = buildTeamFixtureMap(fixtures, this.teamsById, 5);

    for (const player of bootstrap.elements) {
      const key = `${player.team}|${player.web_name}`;
      const types = this.playerTypesByTeamAndName.get(key) ?? [];
      types.push(player.element_type);
      this.playerTypesByTeamAndName.set(key, types);
    }

    // xG lives outside the site; if it can't be fetched, chips still render
    // without difficulty colours.
    try {
      this.difficultyModel = new DifficultyModel(await fetchTeamXg());
    } catch (err) {
      console.warn("[SPL Fantasy Helper] team xG unavailable, skipping difficulty colours", err);
    }
  }

  teamIdForShirtCode(shirtCode: number): number | undefined {
    return this.teamIdByCode?.get(shirtCode);
  }

  getFixturesForTeam(teamId: number): ResolvedFixture[] {
    return this.teamFixtureMap?.get(teamId) ?? [];
  }

  /**
   * Rows only show a player's name and shirt, so position comes from matching
   * name + team against bootstrap-static. A handful of same-name teammates
   * exist; the GK shirt tells a keeper apart from an outfield namesake.
   * Returns null if the row can't be resolved to one group.
   */
  positionGroupFor(teamId: number, webName: string, wearsGkShirt: boolean): PositionGroup | null {
    const types = this.playerTypesByTeamAndName.get(`${teamId}|${webName}`);
    if (!types) return null;

    const candidates = types.filter((type) => (type === GOALKEEPER_TYPE) === wearsGkShirt);
    if (candidates.length === 0) return null;

    const groups = new Set(candidates.map((type) => (ATTACKING_TYPES.has(type) ? "attacking" : "defensive")));
    return groups.size === 1 ? [...groups][0] : null;
  }

  get difficulty(): DifficultyModel | null {
    return this.difficultyModel;
  }
}

export const dataStore = new DataStore();
