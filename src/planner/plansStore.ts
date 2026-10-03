import type { Lineup } from "./lineup";

/**
 * Saved team plans, kept in this browser only (chrome.storage.local — no
 * sync, so the 8 KB per-item sync quota never bites). Each plan belongs to the
 * manager (entry) that made it, so two accounts in one browser don't mix.
 */
export interface SavedPlan {
  id: string;
  entry: number;
  name: string;
  savedAt: number;
  lineup: Lineup;
}

const STORAGE_KEY = "teamPlans";

async function readAll(): Promise<SavedPlan[]> {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  return Array.isArray(stored) ? stored.filter(isPlan) : [];
}

/** The manager's plans, newest first. */
export async function listPlans(entry: number): Promise<SavedPlan[]> {
  return (await readAll()).filter((p) => p.entry === entry).sort((a, b) => b.savedAt - a.savedAt);
}

/** Adds the plan, or replaces the one with the same id. */
export async function savePlan(plan: SavedPlan): Promise<void> {
  const plans = (await readAll()).filter((p) => p.id !== plan.id);
  await chrome.storage.local.set({ [STORAGE_KEY]: [...plans, plan] });
}

export async function deletePlan(id: string): Promise<void> {
  const plans = (await readAll()).filter((p) => p.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: plans });
}

/** Called when plans change in any tab. */
export function onPlansChange(listener: () => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && STORAGE_KEY in changes) listener();
  });
}

function isPlan(value: unknown): value is SavedPlan {
  const plan = value as SavedPlan;
  return (
    typeof plan?.id === "string" &&
    typeof plan.entry === "number" &&
    typeof plan.name === "string" &&
    Array.isArray(plan.lineup?.slots) &&
    plan.lineup.slots.length === 15
  );
}
