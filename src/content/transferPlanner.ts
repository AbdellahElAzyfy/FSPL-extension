import { dataStore, GOALKEEPER_TYPE, positionGroupOf } from "./dataStore";
import { findPitchBox, readPitchCards } from "./pitch";
import { fetchMyTeam } from "../api/myTeam";
import type { DifficultyModel } from "../fdr/difficulty";
import { getModel } from "../fdr/ratingsStore";
import {
  applySquad,
  canSwap,
  isStarter,
  lineupFromPicks,
  setArmband,
  STARTERS,
  swapSlots,
  type Lineup,
  type LineupRules,
} from "../planner/lineup";
import { deletePlan, listPlans, onPlansChange, savePlan, type SavedPlan } from "../planner/plansStore";
import { fixtureChip } from "../ui/fixtureStrip";
import { dateLocale, t } from "../ui/i18n";
import { createRoundNav } from "../ui/roundNav";
import "../ui/planner.css";

/**
 * Team planner, below the pitch on Transfers: the squad as Pick Team would
 * show it (XI by position + bench) for any open gameweek, with each player's
 * fixture(s) that week.
 *
 * Live mode starts from the saved lineup (/api/my-team) and follows the pitch
 * above, which already includes unconfirmed transfers: a player bought takes
 * the sold player's slot. Lineup edits (swaps, armbands) stay in the planner.
 * A lineup can be saved as a named plan (this browser only) and reopened later;
 * an open plan no longer follows the page and saves its edits automatically.
 */
const TRANSFERS_PATH = "/transfers";

interface State {
  entry: number;
  live: Lineup;
  /** Sold on the page but not replaced yet (live mode only). */
  missing: Set<number>;
  squadKey: string;
  plan: SavedPlan | null;
  plans: SavedPlan[];
  round: number | null;
  selected: number | null; // slot
  draftName: string;
  armedDelete: string | null; // plan id awaiting a second click
}

let state: State | null = null;
let status: "idle" | "loading" | "unavailable" = "idle";
let panel: HTMLElement | null = null;
let renderedWith: DifficultyModel | null = null;
let plansListening = false;

const rules: LineupRules = {
  typeOf: (id) => dataStore.player(id)?.element_type,
  limits: (type) => {
    const t = dataStore.elementType(type);
    return t && { min: t.squad_min_play, max: t.squad_max_play };
  },
};

export function ensureTransferPlanner(): void {
  if (location.pathname !== TRANSFERS_PATH) {
    // Fresh start on every visit: the saved team may have changed meanwhile.
    panel?.remove();
    panel = null;
    state = null;
    status = "idle";
    return;
  }
  if (!dataStore.schedule) return;
  if (!state) {
    if (status === "idle") void load();
    return;
  }

  const cards = readPitchCards();
  const squadChanged = followSquad(cards);

  const box = findPitchBox(cards);
  if (!panel) panel = createPanel();
  if (box && panel.previousElementSibling !== box) box.after(panel);
  if (!panel.isConnected) return;

  if (squadChanged || renderedWith !== getModel() || !panel.hasChildNodes()) render();
}

async function load(): Promise<void> {
  status = "loading";
  try {
    const team = await fetchMyTeam();
    if (!team) {
      status = "unavailable"; // logged out or no team yet: nothing to plan
      return;
    }
    state = {
      entry: team.entry,
      live: lineupFromPicks(team.picks),
      missing: new Set(),
      squadKey: "",
      plan: null,
      plans: await listPlans(team.entry),
      round: null,
      selected: null,
      draftName: "",
      armedDelete: null,
    };
    if (!plansListening) {
      plansListening = true;
      onPlansChange(() => void refreshPlans());
    }
    status = "idle";
    ensureTransferPlanner();
  } catch (err) {
    console.error("[SPL Fantasy Helper] team planner failed to load", err);
    status = "unavailable";
  }
}

async function refreshPlans(): Promise<void> {
  if (!state) return;
  state.plans = await listPlans(state.entry);
  if (state.plan && !state.plans.some((p) => p.id === state!.plan!.id)) {
    state.plan = null;
    state.selected = null;
  }
  render();
}

/** Applies the squad shown on the pitch above; true if it changed. */
function followSquad(cards: ReturnType<typeof readPitchCards>): boolean {
  if (!state || cards.length === 0) return false; // e.g. list view: keep what we have
  const ids = cards
    .map((c) => dataStore.findPlayer(c.teamId, c.name, c.wearsGkShirt)?.id)
    .filter((id): id is number => id !== undefined);
  const key = [...ids].sort((a, b) => a - b).join(",");
  if (key === state.squadKey) return false;

  state.squadKey = key;
  const { lineup, missing } = applySquad(state.live, ids, rules);
  state.live = lineup;
  state.missing = missing;
  if (!state.plan) state.selected = null;
  return true;
}

function current(): Lineup | null {
  return state && (state.plan?.lineup ?? state.live);
}

function setCurrent(lineup: Lineup): void {
  if (!state) return;
  if (state.plan) {
    state.plan = { ...state.plan, lineup, savedAt: Date.now() };
    void savePlan(state.plan);
  } else {
    state.live = lineup;
  }
}

function currentRound(): number | null {
  const rounds = dataStore.schedule?.rounds ?? [];
  if (state && state.round !== null && !rounds.some((r) => r.id === state!.round)) state.round = null;
  return state?.round ?? rounds[0]?.id ?? null;
}

// ---------------------------------------------------------------- rendering

function createPanel(): HTMLElement {
  const el = document.createElement("section");
  el.className = "spl-fh-planner";
  el.addEventListener("click", onClick);
  el.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (state && input.name === "plan-name") {
      state.draftName = input.value;
      updateSaveForm(el);
    }
  });
  el.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveAsPlan();
  });
  return el;
}

function render(): void {
  const lineup = current();
  const schedule = dataStore.schedule;
  const round = currentRound();
  if (!panel || !state || !lineup || !schedule || round === null) return;
  const model = getModel();
  renderedWith = model;

  const focusId = (document.activeElement as HTMLElement | null)?.dataset?.focusId;
  const live = !state.plan;

  const head = el("header", "spl-fh-planner__head");
  const intro = el("div");
  intro.append(el("h2", "", t("Team planner", "مخطط الفريق")));
  intro.append(
    el(
      "p",
      "spl-fh-planner__sub",
      live
        ? t(
            "Your team with the transfers made above, as it lines up in any gameweek. Click two players to swap them.",
            "فريقك مع الانتقالات التي أجريتها في الأعلى، كما سيكون في أي جولة. انقر على لاعبَين لتبديلهما.",
          )
        : t("A saved plan. Your changes to it are saved automatically.", "خطة محفوظة. تُحفظ تغييراتك عليها تلقائيًا."),
    ),
  );
  head.append(
    intro,
    createRoundNav(schedule.rounds, round, (id) => {
      state!.round = id;
      render();
    }),
  );

  const parts: HTMLElement[] = [head];
  if (state.plan) {
    const banner = el("div", "spl-fh-planner__banner");
    banner.append(
      el("span", "", `${t("Plan", "الخطة")}: ${state.plan.name}`),
      button(t("Back to my team", "العودة إلى فريقي"), "close-plan"),
    );
    parts.push(banner);
  }

  parts.push(summary(lineup, round));

  const pitch = el("div", "spl-fh-planner__pitch");
  const starters = lineup.slots.slice(0, STARTERS).map((id, slot) => ({ id, slot }));
  for (const type of [1, 2, 3, 4]) {
    const line = el("div", "spl-fh-planner__line");
    for (const { id, slot } of starters) {
      if ((rules.typeOf(id) ?? 3) === type) line.append(card(lineup, slot, round, model));
    }
    pitch.append(line);
  }
  const bench = el("div", "spl-fh-planner__bench");
  for (let slot = STARTERS; slot < 15; slot++) {
    const spot = el("div", "spl-fh-planner__bench-spot");
    spot.append(el("span", "spl-fh-planner__bench-label", slot === STARTERS ? t("GK", "حارس") : String(slot - STARTERS)));
    spot.append(card(lineup, slot, round, model));
    bench.append(spot);
  }
  parts.push(pitch, bench, toolbar(lineup), plansSection());

  panel.replaceChildren(...parts);
  if (focusId) panel.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(focusId)}"]`)?.focus();
}

function summary(lineup: Lineup, round: number): HTMLElement {
  const schedule = dataStore.schedule!;
  let playing = 0;
  let doubles = 0;
  for (const id of lineup.slots.slice(0, STARTERS)) {
    const team = dataStore.player(id)?.team;
    const count = team === undefined ? 0 : schedule.fixtures(team, round).length;
    if (count > 0) playing++;
    if (count > 1) doubles++;
  }
  const text =
    t(`${playing} of ${STARTERS} starters play this gameweek`, `${playing} من ${STARTERS} أساسيين يلعبون في هذه الجولة`) +
    (doubles ? t(` · ${doubles} with a double`, ` · ${doubles} بمباراتين`) : "");
  const box = el("p", "spl-fh-planner__summary", text);
  if (playing < STARTERS) box.dataset.warn = "";
  return box;
}

function card(lineup: Lineup, slot: number, round: number, model: DifficultyModel): HTMLElement {
  const id = lineup.slots[slot];
  const player = dataStore.player(id);
  const team = player && dataStore.team(player.team);
  const selected = state!.selected;

  const c = button("", "select", `slot|${slot}`);
  c.className = "spl-fh-pcard";
  c.dataset.slot = String(slot);
  if (selected === slot) c.classList.add("is-selected");
  else if (selected !== null && canSwap(lineup, selected, slot, rules)) c.classList.add("is-target");
  const missing = !state!.plan && state!.missing.has(id);
  if (missing) {
    c.classList.add("is-missing");
    c.title = t("Sold — pick a replacement above", "تم بيعه — اختر بديلًا في الأعلى");
  }

  if (team && player) {
    const shirt = document.createElement("img");
    const gk = player.element_type === GOALKEEPER_TYPE ? "_1" : "";
    shirt.src = `/dist/img/shirts/standard/shirt_${team.code}${gk}-110.webp`;
    shirt.alt = "";
    shirt.className = "spl-fh-pcard__shirt";
    c.append(shirt);
  }
  if (id === lineup.captain || id === lineup.vice) {
    c.append(el("span", "spl-fh-pcard__armband", id === lineup.captain ? "C" : "V"));
  }
  c.append(el("span", "spl-fh-pcard__name", player?.web_name ?? t("Unknown", "غير معروف")));

  const fixturesBox = el("span", "spl-fh-pcard__fixtures");
  const fixtures = player ? dataStore.schedule!.fixtures(player.team, round) : [];
  if (fixtures.length === 0) {
    fixturesBox.append(el("span", "spl-fh-pcard__blank", "—"));
    fixturesBox.title = t("No fixture this gameweek", "لا مباراة في هذه الجولة");
    if (isStarter(slot)) c.classList.add("is-blank");
  }
  for (const fixture of fixtures) {
    fixturesBox.append(fixtureChip(fixture, positionGroupOf(player!.element_type), model, "spl-fh-pcard__chip"));
  }
  c.append(fixturesBox);
  return c;
}

function toolbar(lineup: Lineup): HTMLElement {
  const bar = el("div", "spl-fh-planner__toolbar");
  const slot = state!.selected;
  if (slot === null) {
    bar.append(
      el(
        "span",
        "spl-fh-planner__hint",
        t("Select a player to swap them or give them the armband.", "اختر لاعبًا لتبديله أو لمنحه شارة القيادة."),
      ),
    );
    return bar;
  }
  const id = lineup.slots[slot];
  bar.append(el("strong", "", dataStore.player(id)?.web_name ?? t("Unknown", "غير معروف")));
  if (isStarter(slot)) {
    const captain = button(t("Make captain", "تعيينه قائدًا"), "captain");
    captain.disabled = lineup.captain === id;
    const vice = button(t("Make vice-captain", "تعيينه نائبًا للقائد"), "vice");
    vice.disabled = lineup.vice === id;
    bar.append(captain, vice);
  }
  bar.append(
    el("span", "spl-fh-planner__hint", t("Highlighted players can swap with them.", "يمكن تبديله مع اللاعبين المحدَّدين.")),
    button(t("Cancel", "إلغاء"), "deselect"),
  );
  return bar;
}

function plansSection(): HTMLElement {
  const section = el("section", "spl-fh-planner__plans");
  section.append(el("h3", "", t("Saved plans", "الخطط المحفوظة")));

  const form = document.createElement("form");
  form.className = "spl-fh-planner__save";
  const input = document.createElement("input");
  input.name = "plan-name";
  input.placeholder = state!.plan
    ? t("Name for a copy of this plan", "اسم لنسخة من هذه الخطة")
    : t("Plan name, e.g. GW10 wildcard", "اسم الخطة، مثلًا: وايلد كارد الجولة 10");
  input.maxLength = 60;
  input.value = state!.draftName;
  input.dataset.focusId = "plan-name";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = state!.plan ? t("Save as new plan", "حفظ كخطة جديدة") : t("Save as plan", "حفظ كخطة");
  form.append(input, submit);
  const message = el("p", "spl-fh-planner__name-error");
  message.setAttribute("aria-live", "polite");
  section.append(form, message);
  updateSaveForm(section);

  if (state!.plans.length === 0) {
    section.append(
      el(
        "p",
        "spl-fh-planner__hint",
        t("No saved plans yet. Plans are kept in this browser only.", "لا توجد خطط محفوظة بعد. تُحفظ الخطط في هذا المتصفح فقط."),
      ),
    );
    return section;
  }
  const list = el("ul", "spl-fh-planner__plan-list");
  for (const plan of state!.plans) {
    const item = el("li");
    if (plan.id === state!.plan?.id) item.dataset.open = "";
    const open = button(plan.name, "open-plan", `open|${plan.id}`);
    open.dataset.plan = plan.id;
    open.className = "spl-fh-planner__plan-name";
    const date = new Date(plan.savedAt).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const armed = state!.armedDelete === plan.id;
    const remove = button(armed ? t("Really delete?", "تأكيد الحذف؟") : t("Delete", "حذف"), "delete-plan", `delete|${plan.id}`);
    remove.dataset.plan = plan.id;
    if (armed) remove.dataset.armed = "";
    item.append(open, el("small", "", date), remove);
    list.append(item);
  }
  section.append(list);
  return section;
}

// ------------------------------------------------------------------ actions

function onClick(event: Event): void {
  const target = (event.target as Element).closest<HTMLElement>("[data-action]");
  const lineup = current();
  if (!target || !state || !lineup) return;
  const action = target.dataset.action;
  if (action !== "delete-plan") state.armedDelete = null;

  switch (action) {
    case "select": {
      const slot = Number(target.dataset.slot);
      const selected = state.selected;
      if (selected === null || selected === slot) {
        state.selected = selected === slot ? null : slot;
      } else {
        const swapped = swapSlots(lineup, selected, slot, rules);
        if (swapped) setCurrent(swapped);
        state.selected = swapped ? null : slot;
      }
      break;
    }
    case "captain":
    case "vice":
      if (state.selected !== null) setCurrent(setArmband(lineup, lineup.slots[state.selected], action));
      break;
    case "deselect":
      state.selected = null;
      break;
    case "close-plan":
      state.plan = null;
      state.selected = null;
      break;
    case "open-plan":
      state.plan = state.plans.find((p) => p.id === target.dataset.plan) ?? null;
      state.selected = null;
      break;
    case "delete-plan": {
      const id = target.dataset.plan!;
      if (state.armedDelete !== id) {
        state.armedDelete = id;
        break;
      }
      state.armedDelete = null;
      if (state.plan?.id === id) state.plan = null;
      void deletePlan(id); // the list re-renders via onPlansChange
      break;
    }
    default:
      return;
  }
  render();
}

async function saveAsPlan(): Promise<void> {
  const lineup = current();
  if (!state || !lineup) return;
  // Re-read first: another tab may have saved a plan with this name meanwhile.
  state.plans = await listPlans(state.entry);
  const name = state.draftName.trim();
  if (nameProblem(name)) {
    if (panel) updateSaveForm(panel);
    return;
  }
  const plan: SavedPlan = { id: crypto.randomUUID(), entry: state.entry, name, savedAt: Date.now(), lineup };
  state.draftName = "";
  await savePlan(plan); // the list re-renders via onPlansChange
}

/** Why a plan can't be saved under this name, or null if it can. Names are unique, ignoring case. */
function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return t("Give the plan a name.", "أدخل اسمًا للخطة.");
  const taken = state?.plans.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  return taken ? t("You already have a plan with this name.", "لديك خطة بهذا الاسم بالفعل.") : null;
}

/**
 * Enables Save only for a valid name. Runs on every keystroke without a full
 * re-render, so the input keeps focus. An empty field shows no message: the
 * disabled button says enough until the user has typed something.
 */
function updateSaveForm(root: HTMLElement): void {
  const submit = root.querySelector<HTMLButtonElement>(".spl-fh-planner__save button");
  const message = root.querySelector<HTMLElement>(".spl-fh-planner__name-error");
  if (!state || !submit || !message) return;
  const problem = nameProblem(state.draftName);
  submit.disabled = problem !== null;
  message.textContent = state.draftName.trim() ? (problem ?? "") : "";
}

// ------------------------------------------------------------------ helpers

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, action: string, focusId = action): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.dataset.action = action;
  b.dataset.focusId = focusId;
  return b;
}
