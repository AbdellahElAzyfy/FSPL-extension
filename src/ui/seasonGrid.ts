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
import { Schedule } from "../fdr/schedule";
import { dateLocale, t } from "./i18n";
import type { Fixture, GameEvent, Team } from "../types/fixtures";
import type { RatingKey, RatingSide } from "../types/teamRatings";

export interface SeasonGridInput {
  teams: Team[];
  events: GameEvent[];
  fixtures: Fixture[]; // any superset of the remaining fixtures; played ones are skipped
}

/**
 * Full-season fixture difficulty grid: every team x every remaining round,
 * coloured for attackers or defenders, sorted easiest first — plus an editor
 * for the team ratings behind it. Self-contained (own controls and scoped
 * styles) so it can be mounted in the extension's own page or inside the SPL
 * Fantasy site. Re-renders whenever the ratings change.
 */
export function createSeasonGrid(input: SeasonGridInput): HTMLElement {
  const schedule = new Schedule(input.teams, input.events, input.fixtures);
  const rounds = schedule.rounds;

  const state = { group: "attacking" as PositionGroup, horizon: "5", editing: false };
  // Editor: whether a team's home & away values move together, per "teamId|side".
  // Starts linked when the two values are equal.
  const linked = new Map<string, boolean>();

  const root = document.createElement("section");
  root.className = "spl-fh-season";
  root.innerHTML = `
    <header class="spl-fh-season__header">
      <div>
        <h2>${t("Fixture difficulty", "صعوبة المباريات")}</h2>
        <p class="spl-fh-season__subtitle"></p>
      </div>
      <div class="spl-fh-season__controls">
        <div class="spl-fh-season__segmented" role="radiogroup" aria-label="${t("Rate fixtures for", "تقييم المباريات لـ")}">
          <button type="button" role="radio" data-group="attacking" aria-checked="true">${t("Attackers", "الهجوم")} <span>${t("MID / FWD", "وسط / مهاجم")}</span></button>
          <button type="button" role="radio" data-group="defensive" aria-checked="false">${t("Defenders", "الدفاع")} <span>${t("GK / DEF", "حارس / مدافع")}</span></button>
        </div>
        <label class="spl-fh-season__horizon">
          ${t("Show", "عرض")}
          <select>
            <option value="5">${t("Next 5 rounds", "الجولات الخمس القادمة")}</option>
            <option value="10">${t("Next 10 rounds", "الجولات العشر القادمة")}</option>
            <option value="all">${t("Rest of season", "بقية الموسم")}</option>
          </select>
        </label>
        <button type="button" class="spl-fh-season__edit-toggle" aria-expanded="false">${t("Edit ratings", "تعديل التقييمات")}</button>
      </div>
    </header>
    <div class="spl-fh-season__legend" aria-label="${t("Difficulty scale", "مقياس الصعوبة")}">
      <span>${t("Easy", "سهلة")}</span>
      <i class="spl-fh-fdr" data-fdr="1">1</i>
      <i class="spl-fh-fdr" data-fdr="2">2</i>
      <i class="spl-fh-fdr" data-fdr="3">3</i>
      <i class="spl-fh-fdr" data-fdr="4">4</i>
      <i class="spl-fh-fdr" data-fdr="5">5</i>
      <span>${t("Hard", "صعبة")}</span>
      <span class="spl-fh-season__note">${t(
        "UPPERCASE = home, lowercase = away · sorted easiest first",
        "الأحرف الكبيرة = على الأرض، الصغيرة = خارج الأرض · الأسهل أولًا",
      )}</span>
    </div>
    <div class="spl-fh-season__editor" hidden>
      <div class="spl-fh-season__editor-head">
        <p>${t(
          `How strong is each team? <strong>5 = strongest</strong> (hardest to face).
          <strong>Attack</strong> sets the difficulty for goalkeepers &amp; defenders facing them,
          <strong>Defence</strong> for midfielders &amp; forwards.
          <strong>Home / Away</strong> = where that team plays. Your changes are saved in your browser.`,
          `ما مدى قوة كل فريق؟ <strong>5 = الأقوى</strong> (الأصعب في مواجهته).
          <strong>الهجوم</strong> يحدد صعوبة المباراة للحراس والمدافعين الذين يواجهونه،
          و<strong>الدفاع</strong> للاعبي الوسط والمهاجمين.
          <strong>على أرضه / خارج أرضه</strong> = مكان لعب ذلك الفريق. تُحفظ تعديلاتك في متصفحك.`,
        )}</p>
        <div class="spl-fh-season__editor-actions">
          <button type="button" data-action="copy">${t("Copy as JSON", "نسخ بصيغة JSON")}</button>
          <button type="button" data-action="reset-all">${t("Reset all to default", "إعادة الكل إلى الافتراضي")}</button>
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
    // "YYYY-MM-DD" alone parses as UTC midnight, which shows the previous day
    // west of UTC — read it as a local date instead.
    const updated = new Date(`${model.updatedAt}T00:00:00`).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" });
    const edited = model.editedTeamCount;
    subtitle.textContent =
      t(`Ratings based on team stats · updated ${updated}`, `التقييمات مبنية على إحصائيات الفرق · آخر تحديث ${updated}`) +
      (edited ? t(` · ${edited} team${edited === 1 ? "" : "s"} edited by you`, ` · فرق عدّلتها: ${edited}`) : "");
  };

  const renderGrid = (model: DifficultyModel) => {
    const shown = state.horizon === "all" ? rounds : rounds.slice(0, Number(state.horizon));

    const rows = input.teams.map((team) => {
      const ratings: Difficulty[] = [];
      const cells = shown.map((round) =>
        schedule.fixtures(team.id, round.id).map((cell) => {
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
    head.append(th(t("Team", "الفريق"), "spl-fh-season__team"), th(t("Avg", "المعدل"), "spl-fh-season__avg"));
    for (const round of shown) {
      const cell = th(`R${round.id}`); // "R8" in Arabic too (user's choice)
      const date = document.createElement("small");
      date.textContent = new Date(round.deadline_time).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" });
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
          td.title = t("No fixture this round", "لا مباراة في هذه الجولة");
          continue;
        }
        for (const { opponent, isHome, rating } of fixtures) {
          const chip = document.createElement("span");
          chip.className = "spl-fh-season__chip spl-fh-fdr";
          if (rating) chip.dataset.fdr = String(rating);
          chip.textContent = isHome ? opponent.short_name.toUpperCase() : opponent.short_name.toLowerCase();
          chip.title =
            (isHome
              ? t(`${opponent.name.trim()} (Home)`, `ضد ${opponent.name.trim()} (على الأرض)`)
              : t(`${opponent.name.trim()} (Away)`, `ضد ${opponent.name.trim()} (خارج الأرض)`)) +
            (rating ? t(` — difficulty ${rating}/5`, ` — الصعوبة ${rating}/5`) : "");
          td.append(chip);
        }
      }
    }
  };

  const renderEditor = (model: DifficultyModel) => {
    editorTable.replaceChildren();
    const head = editorTable.createTHead();
    const top = head.insertRow();
    top.append(th(t("Team", "الفريق"), "spl-fh-season__team"));
    for (const label of [
      t("Attack — vs GK / DEF", "الهجوم — ضد الحارس / المدافع"),
      t("Defence — vs MID / FWD", "الدفاع — ضد الوسط / المهاجم"),
    ]) {
      const cell = th(label);
      cell.colSpan = 3;
      top.append(cell);
    }
    top.append(th(""));
    const sub = head.insertRow();
    sub.append(th("", "spl-fh-season__team"));
    for (let i = 0; i < 2; i++) sub.append(th(t("Home", "على أرضه")), th(t("Away", "خارج أرضه")), th(""));
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
        link.setAttribute(
          "aria-label",
          t(`${team.short_name} ${side}: same home and away`, `${team.short_name} ${sideName(side)}: نفس القيمة على أرضه وخارجها`),
        );
        link.title = linked.get(linkId)
          ? t("Home & away linked — click to set them separately", "على أرضه وخارجها مرتبطان — انقر لتحديد كل منهما على حدة")
          : t("Click to link home & away", "انقر لربط القيمتين على أرضه وخارجها");
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
        reset.textContent = t("Reset", "إعادة ضبط");
        reset.title = t(`Reset ${team.name.trim()} to the default ratings`, `إعادة ${team.name.trim()} إلى التقييمات الافتراضية`);
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
    group.setAttribute(
      "aria-label",
      t(`${team.name.trim()} ${side}, ${venue}`, `${team.name.trim()} ${sideName(side)}، ${venue === "home" ? "على أرضه" : "خارج أرضه"}`),
    );
    if (model.isEdited(team.id, key)) {
      group.dataset.edited = "";
      group.title = t(
        `Edited by you — default is ${model.defaultRating(team.id, key)}`,
        `عدّلتها أنت — القيمة الافتراضية ${model.defaultRating(team.id, key)}`,
      );
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
    editToggle.textContent = state.editing ? t("Done editing", "إنهاء التعديل") : t("Edit ratings", "تعديل التقييمات");
    editor.hidden = !state.editing;
    render();
  });
  root.querySelector('[data-action="reset-all"]')!.addEventListener("click", () => {
    if (!confirm(t("Reset all team ratings to the defaults? Your edits will be removed.", "إعادة جميع تقييمات الفرق إلى الافتراضي؟ ستُحذف تعديلاتك."))) return;
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
      copyButton.textContent = t("Copied!", "تم النسخ!");
      setTimeout(() => (copyButton.textContent = t("Copy as JSON", "نسخ بصيغة JSON")), 2000);
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

function sideName(side: RatingSide): string {
  return side === "attack" ? "الهجوم" : "الدفاع";
}

function th(text: string, className?: string): HTMLTableCellElement {
  const cell = document.createElement("th");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}
