import { dataStore } from "./dataStore";
import { createSeasonGrid } from "../ui/seasonGrid";

const TAB_MARKER = "data-spl-fh-difficulty-tab";
const VIEW_CLASS = "spl-fh-difficulty-view";
const HIDDEN_MARKER = "data-spl-fh-hidden";

/**
 * Adds a "Difficulty" tab to the site's top nav. Clicking it swaps the page's
 * main content for the season difficulty grid, without changing the route.
 * Any other nav click, a route change or back/forward restores the site page.
 *
 * Relies on the site's stable (non styled-components) nav classes:
 * .ism-nav, .ism-nav__tab and .active. Page layout is .ism > [header,
 * nav wrapper, main content, footer]; the grid goes right after the nav wrapper.
 */
let view: HTMLElement | null = null;
let openedAtPath = "";

export function ensureDifficultyTab(): void {
  if (!dataStore.seasonGridInput) return;

  const fixturesLink = document.querySelector<HTMLAnchorElement>('.ism-nav a.ism-nav__tab[href$="/fixtures"]');
  const list = fixturesLink?.closest("ul");
  if (!fixturesLink || !list) return;

  let tab = list.querySelector<HTMLAnchorElement>(`[${TAB_MARKER}]`);
  if (!tab) {
    tab = createTab();
    const item = document.createElement("li");
    item.append(tab);
    fixturesLink.closest("li")!.after(item);
    // Capture phase so we restore the site page before its router handles the click.
    list.addEventListener("click", (event) => {
      const link = (event.target as Element).closest("a");
      if (link && !link.hasAttribute(TAB_MARKER)) closeView();
    }, true);
  }

  if (view) syncOpenView(tab);
}

function createTab(): HTMLAnchorElement {
  const tab = document.createElement("a");
  tab.className = "ism-nav__tab";
  tab.href = "#";
  tab.setAttribute(TAB_MARKER, "");
  tab.textContent = document.documentElement.lang === "ar" ? "صعوبة المباريات" : "Difficulty";
  tab.addEventListener("click", (event) => {
    event.preventDefault();
    openView();
  });
  return tab;
}

function openView(): void {
  const input = dataStore.seasonGridInput;
  const navWrapper = findNavWrapper();
  if (view || !input || !navWrapper) return;

  view = document.createElement("div");
  view.className = VIEW_CLASS;
  view.append(createSeasonGrid(input));
  navWrapper.after(view);
  openedAtPath = location.pathname;
  window.addEventListener("popstate", closeView, { once: true });

  const tab = document.querySelector<HTMLAnchorElement>(`[${TAB_MARKER}]`);
  if (tab) syncOpenView(tab);
}

function closeView(): void {
  if (!view) return;
  view.remove();
  view = null;

  document.querySelectorAll<HTMLElement>(`[${HIDDEN_MARKER}]`).forEach((el) => {
    el.style.display = "";
    el.removeAttribute(HIDDEN_MARKER);
  });

  const tab = document.querySelector<HTMLAnchorElement>(`[${TAB_MARKER}]`);
  tab?.classList.remove("active");
  tab?.removeAttribute("aria-current");

  // Re-highlight the site's own tab we took the highlight from — but only if
  // it's still the current route (after back/forward the router has moved on).
  document.querySelectorAll<HTMLAnchorElement>(".ism-nav a.ism-nav__tab[data-spl-fh-was-active]").forEach((link) => {
    link.removeAttribute("data-spl-fh-was-active");
    if (link.pathname === location.pathname) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
}

/**
 * Keeps the open view consistent while the SPA re-renders around it: closes it
 * if the route changed, and (re)hides the site's content and nav highlight.
 * Only touches the DOM when something is actually out of sync, since it runs
 * from the MutationObserver.
 */
function syncOpenView(tab: HTMLAnchorElement): void {
  if (!view) return;
  if (location.pathname !== openedAtPath || !view.isConnected) {
    closeView();
    return;
  }

  for (let el = view.nextElementSibling; el && el.tagName !== "FOOTER"; el = el.nextElementSibling) {
    if (el instanceof HTMLElement && !el.hasAttribute(HIDDEN_MARKER)) {
      el.style.display = "none";
      el.setAttribute(HIDDEN_MARKER, "");
    }
  }

  document.querySelectorAll<HTMLAnchorElement>(".ism-nav a.ism-nav__tab.active").forEach((link) => {
    if (link === tab) return;
    link.classList.remove("active");
    link.removeAttribute("aria-current");
    link.setAttribute("data-spl-fh-was-active", "");
  });
  if (!tab.classList.contains("active")) {
    tab.classList.add("active");
    tab.setAttribute("aria-current", "page");
  }
}

function findNavWrapper(): Element | null {
  const nav = document.querySelector(".ism-nav");
  const page = nav?.closest(".ism");
  if (!nav || !page) return null;
  return [...page.children].find((child) => child.contains(nav)) ?? null;
}
