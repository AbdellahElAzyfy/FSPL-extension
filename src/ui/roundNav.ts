import "./roundNav.css";
import type { GameEvent } from "../types/fixtures";
import { dateLocale, t } from "./i18n";

/**
 * "‹  Gameweek 9 · 16 Oct  ›" — steps through the open rounds. Always reads
 * earlier -> later left to right, like the fixture strips, even on the RTL
 * Arabic site.
 */
export function createRoundNav(rounds: GameEvent[], current: number, onChange: (roundId: number) => void): HTMLElement {
  const index = rounds.findIndex((r) => r.id === current);
  const round = rounds[index];

  const nav = document.createElement("div");
  nav.className = "spl-fh-round-nav";

  const step = (offset: number, symbol: string, label: string) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spl-fh-round-nav__step";
    button.textContent = symbol;
    button.setAttribute("aria-label", label);
    button.title = label;
    const target = rounds[index + offset];
    button.disabled = !target;
    if (target) button.addEventListener("click", () => onChange(target.id));
    return button;
  };

  const label = document.createElement("div");
  label.className = "spl-fh-round-nav__label";
  const title = document.createElement("strong");
  title.textContent = `${t("Gameweek", "الجولة")} ${round?.id ?? current}`;
  label.append(title);
  if (round) {
    const deadline = document.createElement("small");
    deadline.textContent = new Date(round.deadline_time).toLocaleDateString(dateLocale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    label.append(deadline);
  }

  nav.append(
    step(-1, "‹", t("Previous gameweek", "الجولة السابقة")),
    label,
    step(1, "›", t("Next gameweek", "الجولة التالية")),
  );
  return nav;
}
