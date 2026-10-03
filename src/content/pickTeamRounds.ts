import { dataStore } from "./dataStore";
import { readPitchCards, findPitchBox } from "./pitch";
import type { DifficultyModel } from "../fdr/difficulty";
import { getModel } from "../fdr/ratingsStore";
import { fixtureChip } from "../ui/fixtureStrip";
import { t } from "../ui/i18n";
import { createRoundNav } from "../ui/roundNav";

/**
 * Pick Team round browser: a "‹ Gameweek N ›" bar above the pitch. Browsing
 * ahead swaps each card's fixture line (the site's "Al Hazem (A)") for that
 * round's fixture(s) as difficulty chips, and the strips below start at that
 * round too (see playerRowInjector). Back at the next round, the site's own
 * line returns.
 *
 * Works from the DOM, so it follows substitutions made before saving.
 */
const PICK_TEAM_PATH = "/my-team";
const BAR_CLASS = "spl-fh-pick-rounds";
const LABEL_CLASS = "spl-fh-gw-fixture";
const HIDDEN_MARKER = "data-spl-fh-hidden-fixture";

// null = the next open round.
let selectedRound: number | null = null;
// What each card's label was built for, so unchanged cards are left alone.
const labelKeys = new WeakMap<HTMLElement, string>();
const labelModels = new WeakMap<HTMLElement, DifficultyModel>();

/** The round the strips should start at on this page, if browsing ahead on Pick Team. */
export function pickTeamStartRound(): number | null {
  return location.pathname === PICK_TEAM_PATH ? currentRound() : null;
}

function currentRound(): number | null {
  const rounds = dataStore.schedule?.rounds ?? [];
  // A remembered round can close (its deadline passes) while the page is open.
  if (selectedRound !== null && !rounds.some((r) => r.id === selectedRound)) selectedRound = null;
  return selectedRound ?? rounds[0]?.id ?? null;
}

export function ensurePickTeamRounds(rescan: () => void): void {
  const schedule = dataStore.schedule;
  const onPickTeam = location.pathname === PICK_TEAM_PATH;
  if (!onPickTeam) {
    document.querySelectorAll(`.${BAR_CLASS}`).forEach((bar) => bar.remove());
    return;
  }

  const round = currentRound();
  const cards = readPitchCards();
  const box = findPitchBox(cards);
  if (!schedule || round === null || !box) return;

  // The bar sits right above the pitch box; rebuild it when the round changes.
  let bar = box.previousElementSibling as HTMLElement | null;
  if (!bar?.classList.contains(BAR_CLASS)) {
    document.querySelectorAll(`.${BAR_CLASS}`).forEach((old) => old.remove());
    bar = document.createElement("div");
    bar.className = BAR_CLASS;
    box.before(bar);
  }
  if (bar.dataset.round !== String(round)) {
    bar.dataset.round = String(round);
    bar.replaceChildren(
      createRoundNav(schedule.rounds, round, (id) => {
        selectedRound = id;
        rescan();
      }),
    );
  }

  const browsingAhead = round !== schedule.firstRound?.id;
  const model = getModel();
  for (const { row, nameEl, teamId, name, wearsGkShirt } of cards) {
    const siteFixture = nameEl.nextElementSibling as HTMLElement | null;
    if (!siteFixture) continue;
    let label = row.querySelector<HTMLElement>(`.${LABEL_CLASS}`);

    if (!browsingAhead) {
      label?.remove();
      if (siteFixture.hasAttribute(HIDDEN_MARKER)) {
        siteFixture.style.display = "";
        siteFixture.removeAttribute(HIDDEN_MARKER);
      }
      continue;
    }

    if (!siteFixture.hasAttribute(HIDDEN_MARKER)) {
      siteFixture.style.display = "none";
      siteFixture.setAttribute(HIDDEN_MARKER, "");
    }
    const key = `${round}|${teamId}|${name}|${wearsGkShirt}`;
    if (label && label.previousElementSibling === siteFixture && labelKeys.get(label) === key && labelModels.get(label) === model) {
      continue;
    }

    label?.remove();
    label = document.createElement("div");
    label.className = LABEL_CLASS;
    const fixtures = schedule.fixtures(teamId, round);
    const group = dataStore.positionGroupFor(teamId, name, wearsGkShirt);
    if (fixtures.length === 0) {
      const blank = document.createElement("span");
      blank.className = "spl-fh-gw-fixture__blank";
      blank.textContent = "—";
      blank.title = t("No fixture this gameweek", "لا مباراة في هذه الجولة");
      label.append(blank);
    }
    for (const fixture of fixtures) label.append(fixtureChip(fixture, group, model, "spl-fh-gw-fixture__chip"));
    labelKeys.set(label, key);
    labelModels.set(label, model);
    siteFixture.after(label);
  }
}
