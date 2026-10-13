import { dataStore, GOALKEEPER_TYPE, positionGroupOf } from "./dataStore";
import { findPitchBox, readPitchCards } from "./pitch";
import { fetchMyTeam } from "../api/myTeam";
import type { DifficultyModel } from "../fdr/difficulty";
import { getModel } from "../fdr/ratingsStore";
import { canSwap, isStarter, setArmband, STARTERS, swapSlots, type Lineup, type LineupRules } from "../planner/lineup";
import { deletePlan, listPlans, loadDraft, onPlansChange, saveDraft, savePlan, type SavedPlan } from "../planner/plansStore";
import {
  addTransfer,
  planFromSnapshot,
  removeTransfer,
  setChip,
  setLineup,
  simulate,
  startFromMyTeam,
  transfersBetween,
  type ChipName,
  type PlanRules,
  type RoundPlans,
  type RoundState,
  type StartState,
  type Transfer,
} from "../planner/seasonPlan";
import type { Player } from "../types/fixtures";
import { fixtureChip } from "../ui/fixtureStrip";
import { dateLocale, t } from "../ui/i18n";
import { createRoundNav } from "../ui/roundNav";
import "../ui/planner.css";

/**
 * Team planner, below the pitch on Transfers: the squad as Pick Team would
 * show it (XI by position + bench) in any open gameweek, with each player's
 * fixture(s) that week, plus transfers and chips planned for later gameweeks.
 *
 * Live mode starts from the saved team (/api/my-team) and is kept in this
 * browser as a draft, so it survives a reload. Transfers made or undone in the
 * site's list above are applied to its first gameweek too, next to any made
 * in the planner. A plan can be saved by name (this browser only) and reopened
 * later; an open plan no longer follows the page and saves its edits
 * automatically. Plans are always replayed from the real team, so
 * bank, free transfers and hits stay current (see planner/seasonPlan.ts).
 */
const TRANSFERS_PATH = "/transfers";

// Game settings (bootstrap game_settings + /help/rules, checked 2026-10-13).
const TEAM_LIMIT = 3; // squad_team_limit
const MAX_FREE_TRANSFERS = 5; // 1 + max_extra_free_transfers
const HIT_COST = 4;
const FREE_ROUNDS = new Set([19]); // free transfer window up to the round 19 deadline
const PICKER_ROUNDS = 5;

type SortKey = "price-desc" | "price-asc" | "points" | "fixtures";

interface Picker {
  round: number;
  out: number;
  query: string;
  sort: SortKey;
}

interface State {
  entry: number;
  start: StartState;
  /** The unsaved plan (kept as a draft); its first gameweek also follows the page. */
  live: RoundPlans;
  /** The unconfirmed transfers on the page, as last applied to the live plan. */
  pageTransfers: Transfer[];
  armedReset: boolean;
  /** Sold on the page but not replaced yet (live mode only). */
  missing: Set<number>;
  squadKey: string;
  plan: SavedPlan | null;
  plans: SavedPlan[];
  round: number | null;
  selected: number | null; // slot
  picker: Picker | null;
  draftName: string;
  armedDelete: string | null; // plan id awaiting a second click
}

let state: State | null = null;
let status: "idle" | "loading" | "unavailable" = "idle";
let panel: HTMLElement | null = null;
let overlay: HTMLElement | null = null;
let renderedWith: DifficultyModel | null = null;
let plansListening = false;
let planRulesCache: PlanRules | null = null;

const rules: LineupRules = {
  typeOf: (id) => dataStore.player(id)?.element_type,
  limits: (type) => {
    const t = dataStore.elementType(type);
    return t && { min: t.squad_min_play, max: t.squad_max_play };
  },
};

function planRules(): PlanRules {
  if (!planRulesCache) {
    planRulesCache = {
      ...rules,
      rounds: dataStore.schedule!.rounds.map((r) => r.id),
      teamOf: (id) => dataStore.player(id)?.team,
      priceOf: (id) => dataStore.player(id)?.now_cost,
      teamLimit: TEAM_LIMIT,
      maxFreeTransfers: MAX_FREE_TRANSFERS,
      hitCost: HIT_COST,
      freeRounds: FREE_ROUNDS,
    };
  }
  return planRulesCache;
}

const CHIPS: { name: ChipName; en: string; ar: string }[] = [
  { name: "wildcard", en: "Wildcard", ar: "الوايلد كارد" },
  { name: "uteam", en: "Loan Rangers", ar: "استعارة اللاعبين" },
  { name: "pdbus", en: "Park the bus", ar: "ركن الحافلة" },
  { name: "2capt", en: "Two captains", ar: "القائدين" },
];

function chipLabel(name: ChipName): string {
  const chip = CHIPS.find((c) => c.name === name)!;
  return t(chip.en, chip.ar);
}

export function ensureTransferPlanner(): void {
  if (location.pathname !== TRANSFERS_PATH) {
    // Fresh start on every visit: the saved team may have changed meanwhile.
    panel?.remove();
    panel = null;
    closePicker();
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
    const first = dataStore.schedule?.firstRound;
    if (!team || !first) {
      status = "unavailable"; // logged out, no team yet or season over: nothing to plan
      return;
    }
    state = {
      entry: team.entry,
      start: startFromMyTeam(team, first.id),
      live: await loadDraft(team.entry),
      pageTransfers: [],
      armedReset: false,
      missing: new Set(),
      squadKey: "",
      plan: null,
      plans: await listPlans(team.entry),
      round: null,
      selected: null,
      picker: null,
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
    closePicker();
  }
  render();
}

/** Applies the squad shown on the pitch above to the first gameweek; true if it changed. */
function followSquad(cards: ReturnType<typeof readPitchCards>): boolean {
  if (!state || cards.length === 0) return false; // e.g. list view: keep what we have
  // A card only shows name + team, and a few teammates share a name (two
  // "A. Al Khaibari" defenders at one club, 2026-10-03): then it's the one
  // already in the team, so they aren't shown as sold. A namesake just
  // bought can't be told apart, so take either rather than show a gap.
  const inTeam = new Set(state.start.lineup.slots);
  const used = new Set<number>();
  const ids: number[] = [];
  for (const c of cards) {
    const candidates = dataStore.candidates(c.teamId, c.name, c.wearsGkShirt).filter((p) => !used.has(p.id));
    const player = candidates.find((p) => inTeam.has(p.id)) ?? candidates[0];
    if (!player) continue;
    used.add(player.id);
    ids.push(player.id);
  }
  const key = [...ids].sort((a, b) => a - b).join(",");
  if (key === state.squadKey) return false;

  state.squadKey = key;
  const prules = planRules();
  const round = state.start.round;
  const transfers = transfersBetween(state.start.lineup.slots, ids, prules);
  const sold = new Set(transfers.map((tr) => tr.out));
  state.missing = new Set(state.start.lineup.slots.filter((id) => !ids.includes(id) && !sold.has(id)));

  // Apply only what changed on the page since last time, so transfers made in
  // the planner stay. Undone on the page = bought back in the planner, which
  // cancels it (unless it has been changed in the planner since).
  const same = (a: Transfer, b: Transfer) => a.out === b.out && a.in === b.in;
  let live = state.live;
  for (const tr of state.pageTransfers) {
    if (!transfers.some((x) => same(x, tr))) live = addTransfer(state.start, live, round, tr.in, tr.out, prules);
  }
  for (const tr of transfers) {
    if (!state.pageTransfers.some((x) => same(x, tr))) live = addTransfer(state.start, live, round, tr.out, tr.in, prules);
  }
  state.pageTransfers = transfers;
  if (live !== state.live) {
    state.live = live;
    void saveDraft(state.entry, live);
  }
  if (!state.plan) state.selected = null;
  return true;
}

function currentPlans(): RoundPlans {
  return state!.plan?.rounds ?? state!.live;
}

function setPlans(rounds: RoundPlans): void {
  if (!state) return;
  if (state.plan) {
    state.plan = { id: state.plan.id, entry: state.plan.entry, name: state.plan.name, savedAt: Date.now(), rounds };
    void savePlan(state.plan);
  } else {
    state.live = rounds;
    void saveDraft(state.entry, rounds);
  }
}

function currentRound(): number | null {
  const rounds = dataStore.schedule?.rounds ?? [];
  if (state && state.round !== null && !rounds.some((r) => r.id === state!.round)) state.round = null;
  return state?.round ?? rounds[0]?.id ?? null;
}

function roundState(round: number): RoundState | undefined {
  return simulate(state!.start, currentPlans(), planRules()).find((s) => s.round === round);
}

/** The first gameweek of live mode also follows the Transfers page. */
function followsPage(round: number): boolean {
  return !state!.plan && round === state!.start.round;
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
  const schedule = dataStore.schedule;
  const round = currentRound();
  if (!panel || !state || !schedule || round === null) return;
  const rs = roundState(round);
  if (!rs) return;
  const lineup = rs.lineup;
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
            "Your team with the transfers made above, in any gameweek. Plan transfers and chips for later gameweeks here. Click two players to swap them.",
            "فريقك مع الانتقالات التي أجريتها في الأعلى، في أي جولة. خطط هنا للانتقالات والخاصيات في الجولات القادمة. انقر على لاعبَين لتبديلهما.",
          )
        : t("A saved plan. Your changes to it are saved automatically.", "خطة محفوظة. تُحفظ تغييراتك عليها تلقائيًا."),
    ),
  );
  head.append(
    intro,
    createRoundNav(schedule.rounds, round, (id) => {
      state!.round = id;
      state!.selected = null;
      render();
    }),
  );

  if (live && Object.keys(state.live).length) {
    const reset = button(
      state.armedReset ? t("Really start over?", "تأكيد البدء من جديد؟") : t("Start over", "البدء من جديد"),
      "reset-live",
    );
    reset.title = t("Clear everything planned here (saved plans stay)", "مسح كل ما خططت له هنا (تبقى الخطط المحفوظة)");
    if (state.armedReset) reset.dataset.armed = "";
    intro.append(reset);
  }

  const parts: HTMLElement[] = [head];
  if (state.plan) {
    const banner = el("div", "spl-fh-planner__banner");
    banner.append(
      el("span", "", `${t("Plan", "الخطة")}: ${state.plan.name}`),
      button(t("Back to my team", "العودة إلى فريقي"), "close-plan"),
    );
    parts.push(banner);
  }

  parts.push(roundPanel(rs), summary(lineup, round));

  const pitch = el("div", "spl-fh-planner__pitch");
  const starters = lineup.slots.slice(0, STARTERS).map((id, slot) => ({ id, slot }));
  for (const type of [1, 2, 3, 4]) {
    const line = el("div", "spl-fh-planner__line");
    for (const { id, slot } of starters) {
      if ((rules.typeOf(id) ?? 3) === type) line.append(card(rs, slot, round, model));
    }
    pitch.append(line);
  }
  const bench = el("div", "spl-fh-planner__bench");
  for (let slot = STARTERS; slot < 15; slot++) {
    const spot = el("div", "spl-fh-planner__bench-spot");
    spot.append(el("span", "spl-fh-planner__bench-label", slot === STARTERS ? t("GK", "حارس") : String(slot - STARTERS)));
    spot.append(card(rs, slot, round, model));
    bench.append(spot);
  }
  parts.push(pitch, bench, toolbar(rs), plansSection());

  panel.replaceChildren(...parts);
  if (focusId) panel.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(focusId)}"]`)?.focus();
}

/** The gameweek's numbers, chips and transfers. */
function roundPanel(rs: RoundState): HTMLElement {
  const box = el("div", "spl-fh-planner__round");

  const stats = el("div", "spl-fh-planner__stats");
  const stat = (label: string, value: string, warn = false) => {
    const item = el("span", "spl-fh-planner__stat");
    if (warn) item.dataset.warn = "";
    item.append(el("small", "", label), el("strong", "", value));
    stats.append(item);
  };
  stat(t("Free transfers", "انتقالات مجانية"), rs.freeTransfers === null ? t("Unlimited", "غير محدودة") : String(rs.freeTransfers));
  stat(t("Transfers", "الانتقالات"), String(rs.transfers.length));
  stat(t("Points hit", "خصم النقاط"), rs.hits ? `-${rs.hits}` : "0", rs.hits > 0);
  stat(t("Bank", "الرصيد"), money(rs.bank), rs.bank < 0);
  box.append(stats);

  // Chips: the one played this gameweek, and the unplayed ones that could be.
  const chips = el("div", "spl-fh-planner__chips");
  chips.append(el("small", "", t("Chip", "الخاصية")));
  const names = CHIPS.filter((c) => c.name === rs.chip || rs.chipsPlayable.includes(c.name));
  if (names.length === 0) chips.append(el("span", "spl-fh-planner__hint", t("None left to play this gameweek", "لا خاصيات متاحة في هذه الجولة")));
  for (const chip of names) {
    const b = button(chipLabel(chip.name), "chip", `chip|${chip.name}`);
    b.dataset.chip = chip.name;
    b.setAttribute("aria-pressed", String(rs.chip === chip.name));
    chips.append(b);
  }
  box.append(chips);

  if (rs.transfers.length) {
    const list = el("ul", "spl-fh-planner__transfers");
    rs.transfers.forEach((tr, i) => {
      const item = el("li");
      item.append(
        el("span", "spl-fh-planner__out", name(tr.out)),
        el("span", "spl-fh-planner__arrow", "→"),
        el("span", "spl-fh-planner__in", name(tr.in)),
      );
      const undo = button("✕", "undo-transfer", `undo|${i}`);
      undo.dataset.index = String(i);
      undo.title = t("Undo this transfer", "التراجع عن هذا الانتقال");
      undo.setAttribute("aria-label", undo.title);
      item.append(undo);
      list.append(item);
    });
    box.append(list);
  }
  if (followsPage(rs.round)) {
    box.append(
      el(
        "p",
        "spl-fh-planner__hint",
        t(
          "Transfers made in the list above are added here too. Transfers made here don't change the list above.",
          "الانتقالات التي تجريها في القائمة أعلاه تُضاف هنا أيضًا. الانتقالات التي تجريها هنا لا تغيّر القائمة أعلاه.",
        ),
      ),
    );
  }

  for (const problem of rs.problems) {
    let text: string;
    if (problem.kind === "budget") text = t(`Over budget by ${money(problem.short)}`, `تجاوزت الميزانية بمقدار ${money(problem.short)}`);
    else if (problem.kind === "club") {
      const club = dataStore.team(problem.team)?.name.trim() ?? "";
      text = t(`${problem.count} players from ${club} (max ${TEAM_LIMIT})`, `${problem.count} لاعبين من ${club} (الحد ${TEAM_LIMIT})`);
    } else text = t(`${chipLabel(problem.chip)} can't be played this gameweek`, `لا يمكن استخدام ${chipLabel(problem.chip)} في هذه الجولة`);
    box.append(el("p", "spl-fh-planner__problem", text));
  }
  return box;
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

function card(rs: RoundState, slot: number, round: number, model: DifficultyModel): HTMLElement {
  const lineup = rs.lineup;
  const id = lineup.slots[slot];
  const player = dataStore.player(id);
  const team = player && dataStore.team(player.team);
  const selected = state!.selected;

  const c = button("", "select", `slot|${slot}`);
  c.className = "spl-fh-pcard";
  c.dataset.slot = String(slot);
  if (selected === slot) c.classList.add("is-selected");
  else if (selected !== null && canSwap(lineup, selected, slot, rules)) c.classList.add("is-target");
  const missing = followsPage(round) && state!.missing.has(id);
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
  // Park the bus means no captain that gameweek.
  if (rs.chip !== "pdbus" && (id === lineup.captain || id === lineup.vice)) {
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

function toolbar(rs: RoundState): HTMLElement {
  const lineup = rs.lineup;
  const bar = el("div", "spl-fh-planner__toolbar");
  const slot = state!.selected;
  if (slot === null) {
    bar.append(
      el(
        "span",
        "spl-fh-planner__hint",
        t("Select a player to transfer them out, swap them or give them the armband.", "اختر لاعبًا لبيعه أو تبديله أو منحه شارة القيادة."),
      ),
    );
    return bar;
  }
  const id = lineup.slots[slot];
  bar.append(el("strong", "", name(id)));
  bar.append(button(t("Transfer out", "بيع اللاعب"), "transfer-out"));
  if (isStarter(slot) && rs.chip !== "pdbus") {
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

// ------------------------------------------------------------- transfer picker

/** Players who could replace `picker.out` that gameweek, as an overlay over the page. */
function openPicker(round: number, out: number): void {
  if (!state) return;
  state.picker = { round, out, query: "", sort: "price-desc" };
  closePickerElement();
  overlay = document.createElement("div");
  overlay.className = "spl-fh-picker";
  overlay.addEventListener("click", onPickerClick);
  overlay.addEventListener("input", onPickerInput);
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePicker();
  });
  document.body.append(overlay);

  const player = dataStore.player(out);
  const rs = roundState(round)!;
  const budget = rs.bank + (rs.selling.get(out) ?? 0);

  const dialog = el("div", "spl-fh-picker__dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  const head = el("header", "spl-fh-picker__head");
  const title = el("div");
  title.append(
    el("h3", "", t(`Replace ${player?.web_name ?? ""} · GW${round}`, `استبدال ${player?.web_name ?? ""} · الجولة ${round}`)),
    el(
      "p",
      "spl-fh-planner__hint",
      t(
        `Sells for ${money(rs.selling.get(out) ?? 0)} · you can spend up to ${money(budget)}. Prices are today's.`,
        `يُباع بـ ${money(rs.selling.get(out) ?? 0)} · يمكنك إنفاق حتى ${money(budget)}. الأسعار الحالية.`,
      ),
    ),
  );
  const close = button("✕", "close-picker");
  close.className = "spl-fh-picker__close";
  close.setAttribute("aria-label", t("Close", "إغلاق"));
  head.append(title, close);

  const controls = el("div", "spl-fh-picker__controls");
  const search = document.createElement("input");
  search.type = "search";
  search.name = "picker-query";
  search.placeholder = t("Search player or club", "ابحث عن لاعب أو نادٍ");
  const sort = document.createElement("select");
  sort.name = "picker-sort";
  for (const [value, en, ar] of [
    ["price-desc", "Price: high to low", "السعر: من الأعلى"],
    ["price-asc", "Price: low to high", "السعر: من الأقل"],
    ["points", "Total points", "مجموع النقاط"],
    ["fixtures", `Easiest next ${PICKER_ROUNDS} gameweeks`, `الأسهل في ${PICKER_ROUNDS} جولات قادمة`],
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = t(en, ar);
    sort.append(option);
  }
  controls.append(search, sort);

  const list = el("div", "spl-fh-picker__list");
  dialog.append(head, controls, list);
  overlay.append(dialog);
  renderPickerList();
  search.focus();
}

function renderPickerList(): void {
  const list = overlay?.querySelector<HTMLElement>(".spl-fh-picker__list");
  const picker = state?.picker;
  const out = picker && dataStore.player(picker.out);
  if (!list || !picker || !out) return;

  const rs = roundState(picker.round)!;
  const budget = rs.bank + (rs.selling.get(picker.out) ?? 0);
  const owned = new Set(rs.lineup.slots);
  const clubCounts = new Map<number, number>();
  for (const id of owned) {
    const team = dataStore.player(id)?.team;
    if (team !== undefined && id !== picker.out) clubCounts.set(team, (clubCounts.get(team) ?? 0) + 1);
  }
  const noClubLimit = rs.chip === "uteam";
  const model = getModel();
  const group = positionGroupOf(out.element_type);
  const rounds = dataStore.schedule!.rounds.filter((r) => r.id >= picker.round).slice(0, PICKER_ROUNDS);
  const query = picker.query.trim().toLowerCase();

  const fixtureScore = (p: Player) => {
    let score = 0; // higher = easier; a double counts twice, a blank adds nothing
    for (const r of rounds) {
      for (const f of dataStore.schedule!.fixtures(p.team, r.id)) score += 6 - (model.getDifficulty(f.opponent.id, f.isHome, group) ?? 3);
    }
    return score;
  };

  const candidates = [...dataStore.players()].filter((p) => {
    if (p.element_type !== out.element_type || owned.has(p.id) || p.status === "u") return false;
    if (!query) return true;
    const team = dataStore.team(p.team);
    return [p.web_name, team?.name, team?.short_name].some((s) => s?.toLowerCase().includes(query));
  });
  const scores = new Map(picker.sort === "fixtures" ? candidates.map((p) => [p.id, fixtureScore(p)]) : []);
  candidates.sort((a, b) => {
    switch (picker.sort) {
      case "price-asc":
        return a.now_cost - b.now_cost || b.total_points - a.total_points;
      case "points":
        return b.total_points - a.total_points;
      case "fixtures":
        return scores.get(b.id)! - scores.get(a.id)! || b.total_points - a.total_points;
      default:
        return b.now_cost - a.now_cost || b.total_points - a.total_points;
    }
  });

  const rows = candidates.map((p) => {
    const team = dataStore.team(p.team);
    const row = button("", "pick", `pick|${p.id}`);
    row.className = "spl-fh-picker__row";
    row.dataset.player = String(p.id);
    const tooExpensive = p.now_cost > budget;
    const clubFull = !noClubLimit && (clubCounts.get(p.team) ?? 0) >= TEAM_LIMIT;
    if (tooExpensive || clubFull) {
      row.disabled = true;
      row.title = tooExpensive
        ? t("Not enough money", "الرصيد غير كافٍ")
        : t(`Already ${TEAM_LIMIT} players from this club`, `لديك ${TEAM_LIMIT} لاعبين من هذا النادي بالفعل`);
    }

    const who = el("span", "spl-fh-picker__who");
    who.append(el("strong", "", p.web_name), el("small", "", team?.short_name ?? ""));
    const strip = el("span", "spl-fh-picker__fixtures");
    for (const r of rounds) {
      const slot = el("span", "spl-fh-picker__slot");
      const fixtures = dataStore.schedule!.fixtures(p.team, r.id);
      if (fixtures.length === 0) slot.append(el("span", "spl-fh-picker__chip", "–"));
      for (const f of fixtures) slot.append(fixtureChip(f, group, model, "spl-fh-picker__chip"));
      strip.append(slot);
    }
    row.append(who, strip, el("span", "spl-fh-picker__pts", String(p.total_points)), el("span", "spl-fh-picker__price", money(p.now_cost)));
    return row;
  });

  const header = el("div", "spl-fh-picker__row spl-fh-picker__row--head");
  header.append(
    el("span", "spl-fh-picker__who", t("Player", "اللاعب")),
    el("span", "spl-fh-picker__fixtures", t(`GW${rounds[0]?.id ?? ""} onwards`, `من الجولة ${rounds[0]?.id ?? ""}`)),
    el("span", "spl-fh-picker__pts", t("Pts", "نقاط")),
    el("span", "spl-fh-picker__price", t("Price", "السعر")),
  );
  if (rows.length === 0) list.replaceChildren(header, el("p", "spl-fh-planner__hint", t("No players found.", "لا يوجد لاعبون.")));
  else list.replaceChildren(header, ...rows);
}

function onPickerInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (!state?.picker) return;
  if (target.name === "picker-query") state.picker.query = target.value;
  else if (target.name === "picker-sort") state.picker.sort = target.value as SortKey;
  else return;
  renderPickerList();
}

function onPickerClick(event: Event): void {
  if (event.target === overlay) {
    closePicker(); // backdrop
    return;
  }
  const target = (event.target as Element).closest<HTMLElement>("[data-action]");
  if (!target || !state?.picker) return;
  if (target.dataset.action === "close-picker") {
    closePicker();
  } else if (target.dataset.action === "pick") {
    const { round, out } = state.picker;
    setPlans(addTransfer(state.start, currentPlans(), round, out, Number(target.dataset.player), planRules()));
    state.selected = null;
    closePicker();
  }
}

function closePicker(): void {
  if (state) state.picker = null;
  closePickerElement();
  if (state && panel) render();
}

function closePickerElement(): void {
  overlay?.remove();
  overlay = null;
}

// ------------------------------------------------------------------ actions

function onClick(event: Event): void {
  const target = (event.target as Element).closest<HTMLElement>("[data-action]");
  const round = currentRound();
  if (!target || !state || round === null) return;
  const rs = roundState(round);
  if (!rs) return;
  const lineup = rs.lineup;
  const action = target.dataset.action;
  if (action !== "delete-plan") state.armedDelete = null;
  if (action !== "reset-live") state.armedReset = false;

  switch (action) {
    case "select": {
      const slot = Number(target.dataset.slot);
      const selected = state.selected;
      if (selected === null || selected === slot) {
        state.selected = selected === slot ? null : slot;
      } else {
        const swapped = swapSlots(lineup, selected, slot, rules);
        if (swapped) setPlans(setLineup(currentPlans(), round, swapped));
        state.selected = swapped ? null : slot;
      }
      break;
    }
    case "captain":
    case "vice":
      if (state.selected !== null) setPlans(setLineup(currentPlans(), round, setArmband(lineup, lineup.slots[state.selected], action)));
      break;
    case "transfer-out":
      if (state.selected !== null) openPicker(round, lineup.slots[state.selected]);
      return;
    case "undo-transfer":
      setPlans(removeTransfer(state.start, currentPlans(), round, Number(target.dataset.index), planRules()));
      break;
    case "chip": {
      const chip = target.dataset.chip as ChipName;
      setPlans(setChip(state.start, currentPlans(), round, rs.chip === chip ? null : chip, planRules()));
      break;
    }
    case "deselect":
      state.selected = null;
      break;
    case "reset-live":
      if (!state.armedReset) {
        state.armedReset = true;
        break;
      }
      state.armedReset = false;
      state.selected = null;
      setPlans({});
      // Re-apply the page's unconfirmed transfers on the next pass.
      state.pageTransfers = [];
      state.squadKey = "";
      followSquad(readPitchCards());
      break;
    case "close-plan":
      state.plan = null;
      state.selected = null;
      break;
    case "open-plan": {
      const plan = state.plans.find((p) => p.id === target.dataset.plan);
      // Plans from before multi-gameweek planning hold one squad: turn it into first-gameweek transfers.
      state.plan = plan ? { ...plan, rounds: plan.rounds ?? (plan.lineup ? planFromSnapshot(state.start, plan.lineup, planRules()) : {}) } : null;
      state.selected = null;
      break;
    }
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
  if (!state) return;
  // Re-read first: another tab may have saved a plan with this name meanwhile.
  state.plans = await listPlans(state.entry);
  const name = state.draftName.trim();
  if (nameProblem(name)) {
    if (panel) updateSaveForm(panel);
    return;
  }
  const plan: SavedPlan = { id: crypto.randomUUID(), entry: state.entry, name, savedAt: Date.now(), rounds: currentPlans() };
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

function name(playerId: number): string {
  return dataStore.player(playerId)?.web_name ?? t("Unknown", "غير معروف");
}

/** 21 -> "2.1M" (prices are in tenths of a million SAR). */
function money(tenths: number): string {
  return `${(tenths / 10).toFixed(1)}M`;
}

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
