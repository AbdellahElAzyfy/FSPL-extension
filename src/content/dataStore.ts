import { buildTeamFixtureMap, fetchFutureFixtures, fetchTeams } from "../api/fixtures";
import type { ResolvedFixture, Team } from "../types/fixtures";

class DataStore {
  private teamsById: Map<number, Team> | null = null;
  private teamIdByCode: Map<number, number> | null = null;
  private teamFixtureMap: Map<number, ResolvedFixture[]> | null = null;
  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.doLoad();
    }
    return this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    const [teams, fixtures] = await Promise.all([fetchTeams(), fetchFutureFixtures()]);

    this.teamsById = new Map(teams.map((t) => [t.id, t]));
    this.teamIdByCode = new Map(teams.map((t) => [t.code, t.id]));
    this.teamFixtureMap = buildTeamFixtureMap(fixtures, this.teamsById, 5);
  }

  teamIdForShirtCode(shirtCode: number): number | undefined {
    return this.teamIdByCode?.get(shirtCode);
  }

  getFixturesForTeam(teamId: number): ResolvedFixture[] {
    return this.teamFixtureMap?.get(teamId) ?? [];
  }
}

export const dataStore = new DataStore();
