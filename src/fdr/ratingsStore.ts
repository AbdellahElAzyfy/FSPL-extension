import bundledFile from "../../data/team-ratings.json";
import { DifficultyModel, isDifficulty, type Difficulty } from "./difficulty";
import {
  RATING_KEYS,
  type RatingKey,
  type RatingOverrides,
  type TeamRating,
  type TeamRatingsFile,
} from "../types/teamRatings";

/**
 * Source of truth for fixture difficulty, shared by every extension context
 * (content script on the site, standalone season page):
 *
 *   1. ratings bundled into the extension at build time (instant, offline-safe)
 *   2. replaced by the repo's data/team-ratings.json if it's at least as new —
 *      so default ratings can be updated by pushing, without a store release.
 *      It's plain data (no code), and every value is validated.
 *   3. the user's own edits on top, kept in chrome.storage.sync (only the
 *      values they changed, so they still get updates for everything else).
 *
 * Views subscribe with onRatingsChange() and re-render; edits made in one
 * tab reach the others through chrome.storage.onChanged.
 */

const REMOTE_URL =
  "https://raw.githubusercontent.com/AbdellahElAzyfy/FSPL-extension/main/data/team-ratings.json";
const STORAGE_KEY = "ratingOverrides";

const bundled = bundledFile as TeamRatingsFile;

let defaults: TeamRating[] = sanitizeTeams(bundled.teams, []);
let defaultsUpdatedAt = bundled.updatedAt;
let overrides: RatingOverrides = {};
let model = buildModel();
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadRatings(): Promise<void> {
  loadPromise ??= (async () => {
    const [remote, stored] = await Promise.all([fetchRemote(), readOverrides()]);
    if (remote && remote.updatedAt >= bundled.updatedAt) {
      defaults = sanitizeTeams(remote.teams, defaults);
      defaultsUpdatedAt = remote.updatedAt;
    }
    overrides = stored;
    model = buildModel();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !(STORAGE_KEY in changes)) return;
      const next = sanitizeOverrides(changes[STORAGE_KEY].newValue);
      if (JSON.stringify(next) === JSON.stringify(overrides)) return; // our own write, already applied
      applyOverrides(next);
    });
  })();
  return loadPromise;
}

export function getModel(): DifficultyModel {
  return model;
}

export function onRatingsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sets ratings for one team. Setting a value back to the default removes that edit. */
export function setRatings(teamId: number, values: Partial<Record<RatingKey, Difficulty>>): Promise<void> {
  const team = { ...overrides[teamId] };
  for (const [key, value] of Object.entries(values) as [RatingKey, Difficulty][]) {
    if (value === model.defaultRating(teamId, key)) delete team[key];
    else team[key] = value;
  }

  const next = { ...overrides };
  if (Object.keys(team).length > 0) next[teamId] = team;
  else delete next[teamId];
  return saveOverrides(next);
}

export function resetTeam(teamId: number): Promise<void> {
  const next = { ...overrides };
  delete next[teamId];
  return saveOverrides(next);
}

export function resetAll(): Promise<void> {
  return saveOverrides({});
}

/** The current ratings (defaults + the user's edits) in data/team-ratings.json format. */
export function exportRatingsJson(): string {
  const file: TeamRatingsFile = {
    updatedAt: new Date().toISOString().slice(0, 10),
    teams: defaults.map((team) => ({
      splTeamId: team.splTeamId,
      shortName: team.shortName,
      attack: { home: model.rating(team.splTeamId, "attack.home")!, away: model.rating(team.splTeamId, "attack.away")! },
      defence: { home: model.rating(team.splTeamId, "defence.home")!, away: model.rating(team.splTeamId, "defence.away")! },
    })),
  };
  return JSON.stringify(file, null, 2) + "\n";
}

function buildModel(): DifficultyModel {
  return new DifficultyModel(defaults, overrides, defaultsUpdatedAt);
}

function applyOverrides(next: RatingOverrides): void {
  overrides = next;
  model = buildModel();
  listeners.forEach((listener) => listener());
}

async function saveOverrides(next: RatingOverrides): Promise<void> {
  applyOverrides(next); // update this tab immediately; storage syncs the rest
  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
}

async function fetchRemote(): Promise<TeamRatingsFile | null> {
  try {
    const res = await fetch(REMOTE_URL, { cache: "no-cache" });
    if (!res.ok) return null;
    const file = (await res.json()) as TeamRatingsFile;
    return typeof file?.updatedAt === "string" && Array.isArray(file.teams) ? file : null;
  } catch {
    return null; // offline or GitHub down: bundled ratings are used
  }
}

async function readOverrides(): Promise<RatingOverrides> {
  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    return sanitizeOverrides(stored[STORAGE_KEY]);
  } catch {
    return {};
  }
}

/** Keeps only whole numbers 1-5; anything else falls back to the matching `fallback` team. */
function sanitizeTeams(teams: TeamRating[], fallback: TeamRating[]): TeamRating[] {
  const fallbackById = new Map(fallback.map((team) => [team.splTeamId, team]));
  const result = new Map(fallbackById);

  for (const team of teams) {
    if (typeof team?.splTeamId !== "number") continue;
    const base = fallbackById.get(team.splTeamId);
    const pick = (side: "attack" | "defence", venue: "home" | "away") => {
      const value = team[side]?.[venue];
      return isDifficulty(value) ? value : (base?.[side][venue] ?? 3);
    };
    result.set(team.splTeamId, {
      splTeamId: team.splTeamId,
      shortName: typeof team.shortName === "string" ? team.shortName : (base?.shortName ?? ""),
      attack: { home: pick("attack", "home"), away: pick("attack", "away") },
      defence: { home: pick("defence", "home"), away: pick("defence", "away") },
    });
  }
  return [...result.values()].sort((a, b) => a.splTeamId - b.splTeamId);
}

function sanitizeOverrides(raw: unknown): RatingOverrides {
  const result: RatingOverrides = {};
  if (!raw || typeof raw !== "object") return result;
  for (const [teamId, values] of Object.entries(raw as Record<string, unknown>)) {
    if (!values || typeof values !== "object") continue;
    const team: Partial<Record<RatingKey, number>> = {};
    for (const key of RATING_KEYS) {
      const value = (values as Record<string, unknown>)[key];
      if (isDifficulty(value)) team[key] = value;
    }
    if (Object.keys(team).length > 0) result[teamId] = team;
  }
  return result;
}
