import "./seasonGrid.css";
import "./fdrColors.css";
import type { Difficulty, DifficultyModel, PositionGroup } from "../fdr/difficulty";
import {
  exportRatingsJson,
  getModel,
  onRatingsChange,
  resetAll,
  resetTeam,
  setRatings,
} from "../fdr/ratingsStore";
import type { Fixture, GameEvent, Team } from "../types/fixtures";
import type { RatingKey, RatingSide } from "../types/teamRatings";

export interface SeasonGridInput {
  teams: Team[];
  events: GameEvent[];
  fixtures: Fixture[]; // any superset of the remaining fixtures; played ones are skipped
}

interface Cell {
  opponent: Team;
  isHome: boolean;
}

/**
 * Full-season fixture difficulty grid: every team x every remaining round,
 * coloured for attackers or defenders, sorted easiest first — plus an editor
 * for the team ratings behind it. Self-contained (own controls and scoped
 * styles) so it can be mounted in the extension's own page or inside the SPL
 * Fantasy site. Re-renders whenever the ratings change.
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

  const state = { group: "attacking" as PositionGroup, horizon: "5", editing: false };
  // Editor: whether a team's home & away values move together, per "teamId|side".
  // Starts linked when the two values are equal.
  const linked = new Map<string, boolean>();

  const root = document.createElement("section");
  root.className = "spl-fh-season";
  root.innerHTML = `
    <header class="spl-fh-season__header">
      <div>
        <h2>Fixture difficulty</h2>
        <p class="spl-fh-season__subtitle"></p>
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
        <button type="button" class="spl-fh-season__edit-toggle" aria-expanded="false">Edit ratings</button>
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
    <div class="spl-fh-season__editor" hidden>
      <div class="spl-fh-season__editor-head">
        <p>
          How strong is each team? <strong>5 = strongest</strong> (hardest to face).
          <strong>Attack</strong> sets the difficulty for goalkeepers &amp; defenders facing them,
          <strong>Defence</strong> for midfielders &amp; forwards.
          <strong>Home / Away</strong> = where that team plays. Your changes are saved in your browser.
        </p>
        <div class="spl-fh-season__editor-actions">
          <button type="button" data-action="copy">Copy as JSON</button>
          <button type="button" data-action="reset-all">Reset all to default</button>
        </div>
      </div>
      <textarea class="spl-fh-season__export" readonly hidden></textarea>
      <div class="spl-fh-season__table-wrap"><table class="spl-fh-season__editor-table"></table></div>
    </div>
    <div class="spl-fh-season__table-wrap"><table class="spl-fh-season__grid"></table></div>`;

  const subtitle = root.querySelector<HTMLElement>(".spl-fh-season__subtitle")!;
  const grid = root.querySelector<HTMLTableElement>(".spl-fh-season__grid")!;
  const editor = root.querySelector<HTMLElement>(".spl-fh-season__editor")!;
  const editorTable = root.querySelector<HTMLTableElement>(".spl-fh-season__editor-table")!;
  const exportBox = root.querySelector<HTMLTextAreaElement>(".spl-fh-season__export")!;
  const editToggle = root.querySelector<HTMLButtonElement>(".spl-fh-season__edit-toggle")!;

  const renderSubtitle = (model: DifficultyModel) => {
    const updated = new Date(model.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const edited = model.editedTeamCount;
    subtitle.textContent =
      `Ratings based on team stats · updated ${updated}` +
      (edited ? ` · ${edited} team${edited === 1 ? "" : "s"} edited by you` : "");
  };

  const renderGrid = (model: DifficultyModel) => {
    const shown = state.horizon === "all" ? rounds : rounds.slice(0, Number(state.horizon));

    const rows = input.teams.map((team) => {
      const byRound = schedule.get(team.id)!;
      const ratings: Difficulty[] = [];
      const cells = shown.map((round) =>
        (byRound.get(round.id) ?? []).map((cell) => {
          const rating = model.getDifficulty(cell.opponent.id, cell.isHome, state.group);
          if (rating) ratings.push(rating);
          return { ...cell, rating };
        }),
      );
      const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : Infinity;
      return { team, cells, avg };
    });
    rows.sort((a, b) => a.avg - b.avg || a.team.name.localeCompare(b.team.name));

    grid.replaceChildren();
    const head = grid.createTHead().insertRow();
    head.append(th("Team", "spl-fh-season__team"), th("Avg", "spl-fh-season__avg"));
    for (const round of shown) {
      const cell = th(`R${round.id}`);
      const date = document.createElement("small");
      date.textContent = new Date(round.deadline_time).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      cell.append(date);
      head.append(cell);
    }

    const body = grid.createTBody();
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

  const renderEditor = (model: DifficultyModel) => {
    editorTable.replaceChildren();
    const head = editorTable.createTHead();
    const top = head.insertRow();
    top.append(th("Team", "spl-fh-season__team"));
    for (const label of ["Attack — vs GK / DEF", "Defence — vs MID / FWD"]) {
      const cell = th(label);
      cell.colSpan = 3;
      top.append(cell);
    }
    top.append(th(""));
    const sub = head.insertRow();
    sub.append(th("", "spl-fh-season__team"));
    for (let i = 0; i < 2; i++) sub.append(th("Home"), th("Away"), th(""));
    sub.append(th(""));

    const body = editorTable.createTBody();
    const teams = [...input.teams].sort((a, b) => a.name.localeCompare(b.name));
    for (const team of teams) {
      const tr = body.insertRow();
      const name = th(team.name.trim(), "spl-fh-season__team");
      name.setAttribute("scope", "row");
      tr.append(name);

      for (const side of ["attack", "defence"] as RatingSide[]) {
        const linkId = `${team.id}|${side}`;
        if (!linked.has(linkId)) {
          linked.set(linkId, model.rating(team.id, `${side}.home`) === model.rating(team.id, `${side}.away`));
        }
        for (const venue of ["home", "away"] as const) {
          tr.insertCell().append(picker(model, team, side, venue, linked.get(linkId)!));
        }
        const linkCell = tr.insertCell();
        const link = document.createElement("button");
        link.type = "button";
        link.className = "spl-fh-season__link";
        link.dataset.focusId = `link|${linkId}`;
        link.setAttribute("aria-pressed", String(linked.get(linkId)));
        link.setAttribute("aria-label", `${team.short_name} ${side}: same home and away`);
        link.title = linked.get(linkId) ? "Home & away linked — click to set them separately" : "Click to link home & away";
        link.textContent = "🔗"; // faded via CSS when unlinked
        link.addEventListener("click", () => {
          const nowLinked = !linked.get(linkId);
          linked.set(linkId, nowLinked);
          // Linking copies home onto away so the two match.
          const home = model.rating(team.id, `${side}.home`);
          if (nowLinked && home) void setRatings(team.id, { [`${side}.away`]: home });
          else render();
        });
        linkCell.append(link);
      }

      const resetCell = tr.insertCell();
      const edited = (["attack.home", "attack.away", "defence.home", "defence.away"] as RatingKey[]).some((key) =>
        model.isEdited(team.id, key),
      );
      if (edited) {
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "spl-fh-season__row-reset";
        reset.dataset.focusId = `reset|${team.id}`;
        reset.textContent = "Reset";
        reset.title = `Reset ${team.name.trim()} to the default ratings`;
        reset.addEventListener("click", () => {
          linked.delete(`${team.id}|attack`);
          linked.delete(`${team.id}|defence`);
          void resetTeam(team.id);
        });
        resetCell.append(reset);
      }
    }
  };

  const picker = (model: DifficultyModel, team: Team, side: RatingSide, venue: "home" | "away", isLinked: boolean) => {
    const key: RatingKey = `${side}.${venue}`;
    const current = model.rating(team.id, key);
    const group = document.createElement("div");
    group.className = "spl-fh-season__picker";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", `${team.name.trim()} ${side}, ${venue}`);
    if (model.isEdited(team.id, key)) {
      group.dataset.edited = "";
      group.title = `Edited by you — default is ${model.defaultRating(team.id, key)}`;
    }
    for (let value = 1 as Difficulty; value <= 5; value = (value + 1) as Difficulty) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "spl-fh-fdr";
      option.dataset.fdr = String(value);
      option.dataset.focusId = `pick|${team.id}|${key}|${value}`;
      option.setAttribute("role", "radio");
      option.setAttribute("aria-checked", String(value === current));
      option.textContent = String(value);
      const v = value;
      option.addEventListener("click", () => {
        const other: RatingKey = `${side}.${venue === "home" ? "away" : "home"}`;
        void setRatings(team.id, isLinked ? { [key]: v, [other]: v } : { [key]: v });
      });
      group.append(option);
    }
    return group;
  };

  const render = () => {
    const focusId = (document.activeElement as HTMLElement | null)?.dataset?.focusId;
    const model = getModel();
    renderSubtitle(model);
    renderGrid(model);
    if (state.editing) renderEditor(model);
    // Re-rendering replaces the buttons; keep keyboard focus where it was.
    if (focusId) root.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(focusId)}"]`)?.focus();
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
  editToggle.addEventListener("click", () => {
    state.editing = !state.editing;
    editToggle.setAttribute("aria-expanded", String(state.editing));
    editToggle.textContent = state.editing ? "Done editing" : "Edit ratings";
    editor.hidden = !state.editing;
    render();
  });
  root.querySelector('[data-action="reset-all"]')!.addEventListener("click", () => {
    if (!confirm("Reset all team ratings to the defaults? Your edits will be removed.")) return;
    linked.clear();
    void resetAll();
  });
  const copyButton = root.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
  copyButton.addEventListener("click", async () => {
    const json = exportRatingsJson();
    try {
      // writeText can hang (not just reject) when the page isn't focused, so cap it.
      await Promise.race([
        navigator.clipboard.writeText(json),
        new Promise((_, reject) => setTimeout(() => reject(new Error("clipboard timeout")), 1500)),
      ]);
      copyButton.textContent = "Copied!";
      setTimeout(() => (copyButton.textContent = "Copy as JSON"), 2000);
    } catch {
      // Clipboard can be blocked on some pages; show it for manual copying instead.
      exportBox.value = json;
      exportBox.hidden = false;
      exportBox.select();
    }
  });

  // Live updates; stop listening once the grid has been removed from the page.
  const unsubscribe = onRatingsChange(() => {
    if (!root.isConnected) {
      unsubscribe();
      return;
    }
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
