import "./seasonGrid.css";
import "./fdrColors.css";
import type { Difficulty, DifficultyModel, PositionGroup } from "../fdr/difficulty";
import type { Fixture, GameEvent, Team } from "../types/fixtures";

export interface SeasonGridInput {
  teams: Team[];
  events: GameEvent[];
  fixtures: Fixture[]; // any superset of the remaining fixtures; played ones are skipped
  model: DifficultyModel;
  xgGeneratedAt: string;
}

interface Cell {
  opponent: Team;
  isHome: boolean;
}

/**
 * Full-season fixture difficulty grid: every team x every remaining round,
 * coloured for attackers or defenders, sorted easiest first. Self-contained
 * (own controls and scoped styles) so it can be mounted in the extension's
 * own page or inside the SPL Fantasy site.
 */
export function createSeasonGrid(input: SeasonGridInput): HTMLElement {
  const teamsById = new Map(input.teams.map((t) => [t.id, t]));
  const rounds = input.events.filter((e) => !e.finished).sort((a, b) => a.id - b.id);
  const remainingRoundIds = new Set(rounds.map((r) => r.id));

  // teamId -> roundId -> fixtures that round (0 = blank, 2+ = double)
  const schedule = new Map<number, Map<number, Cell[]>>(input.teams.map((t) => [t.id, new Map()]));
  const add = (teamId: number, round: number, cell: Cell) => {
    const byRound = schedule.get(teamId);
    if (!byRound) return;
    byRound.set(round, [...(byRound.get(round) ?? []), cell]);
  };
  for (const fixture of input.fixtures) {
    if (fixture.event == null || fixture.finished || !remainingRoundIds.has(fixture.event)) continue;
    const home = teamsById.get(fixture.team_h);
    const away = teamsById.get(fixture.team_a);
    if (!home || !away) continue;
    add(home.id, fixture.event, { opponent: away, isHome: true });
    add(away.id, fixture.event, { opponent: home, isHome: false });
  }

  const state = { group: "attacking" as PositionGroup, horizon: "5" };

  const root = document.createElement("section");
  root.className = "spl-fh-season";
  const updated = new Date(input.xgGeneratedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  root.innerHTML = `
    <header class="spl-fh-season__header">
      <div>
        <h2>Fixture difficulty</h2>
        <p class="spl-fh-season__subtitle">Rated from Expected Goals (xG) · data updated ${updated}</p>
      </div>
      <div class="spl-fh-season__controls">
        <div class="spl-fh-season__segmented" role="radiogroup" aria-label="Rate fixtures for">
          <button type="button" role="radio" data-group="attacking" aria-checked="true">Attackers <span>MID / FWD</span></button>
          <button type="button" role="radio" data-group="defensive" aria-checked="false">Defenders <span>GK / DEF</span></button>
        </div>
        <label class="spl-fh-season__horizon">
          Show
          <select>
            <option value="5">Next 5 rounds</option>
            <option value="10">Next 10 rounds</option>
            <option value="all">Rest of season</option>
          </select>
        </label>
      </div>
    </header>
    <div class="spl-fh-season__legend" aria-label="Difficulty scale">
      <span>Easy</span>
      <i class="spl-fh-fdr" data-fdr="1">1</i>
      <i class="spl-fh-fdr" data-fdr="2">2</i>
      <i class="spl-fh-fdr" data-fdr="3">3</i>
      <i class="spl-fh-fdr" data-fdr="4">4</i>
      <i class="spl-fh-fdr" data-fdr="5">5</i>
      <span>Hard</span>
      <span class="spl-fh-season__note">UPPERCASE = home, lowercase = away · sorted easiest first</span>
    </div>
    <div class="spl-fh-season__table-wrap"><table></table></div>`;

  const table = root.querySelector("table")!;

  const render = () => {
    const shown = state.horizon === "all" ? rounds : rounds.slice(0, Number(state.horizon));

    const rows = input.teams.map((team) => {
      const byRound = schedule.get(team.id)!;
      const ratings: Difficulty[] = [];
      const cells = shown.map((round) =>
        (byRound.get(round.id) ?? []).map((cell) => {
          const rating = input.model.getDifficulty(cell.opponent.id, cell.isHome, state.group);
          if (rating) ratings.push(rating);
          return { ...cell, rating };
        }),
      );
      const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : Infinity;
      return { team, cells, avg };
    });
    rows.sort((a, b) => a.avg - b.avg || a.team.name.localeCompare(b.team.name));

    table.replaceChildren();
    const head = table.createTHead().insertRow();
    head.append(th("Team", "spl-fh-season__team"), th("Avg", "spl-fh-season__avg"));
    for (const round of shown) {
      const cell = th(`R${round.id}`);
      const date = document.createElement("small");
      date.textContent = new Date(round.deadline_time).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      cell.append(date);
      head.append(cell);
    }

    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      const name = th(row.team.name.trim(), "spl-fh-season__team");
      name.setAttribute("scope", "row");
      tr.append(name);

      const avg = tr.insertCell();
      avg.className = "spl-fh-season__avg";
      avg.textContent = Number.isFinite(row.avg) ? row.avg.toFixed(2) : "–";

      for (const fixtures of row.cells) {
        const td = tr.insertCell();
        td.className = "spl-fh-season__fixture";
        if (fixtures.length === 0) {
          td.classList.add("spl-fh-season__blank");
          td.textContent = "—";
          td.title = "No fixture this round";
          continue;
        }
        for (const { opponent, isHome, rating } of fixtures) {
          const chip = document.createElement("span");
          chip.className = "spl-fh-season__chip spl-fh-fdr";
          if (rating) chip.dataset.fdr = String(rating);
          chip.textContent = isHome ? opponent.short_name.toUpperCase() : opponent.short_name.toLowerCase();
          chip.title = `${opponent.name.trim()} (${isHome ? "Home" : "Away"})${rating ? ` — difficulty ${rating}/5` : ""}`;
          td.append(chip);
        }
      }
    }
  };

  const radios = root.querySelectorAll<HTMLButtonElement>(".spl-fh-season__segmented button");
  radios.forEach((button) =>
    button.addEventListener("click", () => {
      state.group = button.dataset.group as PositionGroup;
      radios.forEach((b) => b.setAttribute("aria-checked", String(b === button)));
      render();
    }),
  );
  const horizon = root.querySelector("select")!;
  horizon.addEventListener("change", () => {
    state.horizon = horizon.value;
    render();
  });

  render();
  return root;
}

function th(text: string, className?: string): HTMLTableCellElement {
  const cell = document.createElement("th");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}
