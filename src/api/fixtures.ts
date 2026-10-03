import type { Bootstrap, Fixture } from "../types/fixtures";

// All confirmed public (no auth/cookies needed) via curl against the
// live site on 2026-09-17. Paths are relative for content scripts (same
// origin as the site); extension pages pass an absolute `origin`.
const BOOTSTRAP_ENDPOINT = "/api/bootstrap-static/";
const FUTURE_FIXTURES_ENDPOINT = "/api/fixtures/?future=1";
const ALL_FIXTURES_ENDPOINT = "/api/fixtures/";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchBootstrap(origin = ""): Promise<Bootstrap> {
  return fetchJson<Bootstrap>(origin + BOOTSTRAP_ENDPOINT);
}

export async function fetchFutureFixtures(): Promise<Fixture[]> {
  return fetchJson<Fixture[]>(FUTURE_FIXTURES_ENDPOINT);
}

export async function fetchAllFixtures(origin = ""): Promise<Fixture[]> {
  return fetchJson<Fixture[]>(origin + ALL_FIXTURES_ENDPOINT);
}
