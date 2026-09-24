// Fetches team-level Expected Goals (for and against) from Sofascore's
// unofficial API and writes a static snapshot the extension can read,
// instead of every installed extension hitting Sofascore directly.
//
// Run manually with `node scripts/updateTeamXg.mjs`, or via the
// update-team-xg GitHub Actions workflow.
//
// Sofascore's API 403s plain HTTP clients (curl, Node fetch) even with
// browser-like headers — confirmed it's fingerprint-based bot protection,
// not just header checks. It only responds inside a real browser engine,
// so this drives headless Chromium via Playwright instead of using fetch
// directly.
//
// IMPORTANT: SOFASCORE_SEASON_ID must be bumped at the start of each new
// SPL season (it's Sofascore's internal season id, unrelated to the SPL
// Fantasy site's own ids). Look it up via a browser (not curl):
//   https://api.sofascore.com/api/v1/unique-tournament/955/seasons
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const STATE_PATH = path.join(DATA_DIR, "team-xg-state.json");
const OUTPUT_PATH = path.join(DATA_DIR, "team-xg.json");
const TEAM_MAPPING_PATH = path.join(__dirname, "teamMapping.json");

const SOFASCORE_TOURNAMENT_ID = 955;
const SOFASCORE_SEASON_ID = 99275; // Saudi Pro League 26/27
const MAX_ROUNDS = 40; // safety cap; real season is 34 rounds
const REQUEST_DELAY_MS = 200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  if (!response || !response.ok()) {
    const error = new Error(`Request failed (${response?.status()}) for ${url}`);
    error.status = response?.status();
    throw error;
  }
  const bodyText = await page.evaluate(() => document.body.innerText);
  return JSON.parse(bodyText);
}

async function fetchRoundEvents(page, round) {
  const url = `https://api.sofascore.com/api/v1/unique-tournament/${SOFASCORE_TOURNAMENT_ID}/season/${SOFASCORE_SEASON_ID}/events/round/${round}`;
  try {
    const data = await fetchJson(page, url);
    return data.events ?? [];
  } catch (err) {
    // Only a 404 means the round doesn't exist (season not that long yet, or over).
    // Anything else (e.g. a 403 bot block) must fail the run, not pass as "no more rounds".
    if (err.status === 404) return null;
    throw err;
  }
}

async function fetchMatchExpectedGoals(page, eventId) {
  const url = `https://api.sofascore.com/api/v1/event/${eventId}/statistics`;
  const data = await fetchJson(page, url);
  const overall = data.statistics?.find((s) => s.period === "ALL");
  if (!overall) return null;

  for (const group of overall.groups) {
    const item = group.statisticsItems.find((i) => i.name === "Expected goals");
    if (item) {
      return { homeXg: parseFloat(item.home), awayXg: parseFloat(item.away) };
    }
  }
  return null;
}

async function loadState() {
  if (!existsSync(STATE_PATH)) return { events: {} };
  const raw = await readFile(STATE_PATH, "utf-8");
  return JSON.parse(raw);
}

async function main() {
  const teamMapping = JSON.parse(await readFile(TEAM_MAPPING_PATH, "utf-8"));
  const state = await loadState();
  const roundsSeen = new Set();

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const events = await fetchRoundEvents(page, round);
      if (events === null) break; // no more rounds
      if (events.length === 0) continue;

      roundsSeen.add(round);

      for (const event of events) {
        if (event.status?.type !== "finished") continue;
        if (state.events[event.id]) continue; // already cached, finished matches don't change

        await sleep(REQUEST_DELAY_MS);
        const xg = await fetchMatchExpectedGoals(page, event.id);
        if (!xg) continue;

        state.events[event.id] = {
          round,
          homeTeamId: event.homeTeam.id,
          awayTeamId: event.awayTeam.id,
          ...xg,
        };
        console.log(`Cached xG for event ${event.id}: ${event.homeTeam.name} ${xg.homeXg} - ${xg.awayXg} ${event.awayTeam.name}`);
      }

      await sleep(REQUEST_DELAY_MS);
    }
  } finally {
    await browser.close();
  }

  if (roundsSeen.size === 0) {
    throw new Error("No rounds fetched from Sofascore — refusing to overwrite data with stale output");
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));

  const totals = new Map(); // sofascoreTeamId -> { xgFor, xgAgainst, matchesPlayed }
  for (const match of Object.values(state.events)) {
    const home = totals.get(match.homeTeamId) ?? { xgFor: 0, xgAgainst: 0, matchesPlayed: 0 };
    home.xgFor += match.homeXg;
    home.xgAgainst += match.awayXg;
    home.matchesPlayed += 1;
    totals.set(match.homeTeamId, home);

    const away = totals.get(match.awayTeamId) ?? { xgFor: 0, xgAgainst: 0, matchesPlayed: 0 };
    away.xgFor += match.awayXg;
    away.xgAgainst += match.homeXg;
    away.matchesPlayed += 1;
    totals.set(match.awayTeamId, away);
  }

  const teams = teamMapping
    .map((team) => {
      const totalsForTeam = totals.get(team.sofascoreTeamId) ?? { xgFor: 0, xgAgainst: 0, matchesPlayed: 0 };
      const { xgFor, xgAgainst, matchesPlayed } = totalsForTeam;
      return {
        splTeamId: team.splTeamId,
        shortName: team.shortName,
        matchesPlayed,
        xgFor: round2(xgFor),
        xgAgainst: round2(xgAgainst),
        avgXgFor: matchesPlayed ? round2(xgFor / matchesPlayed) : 0,
        avgXgAgainst: matchesPlayed ? round2(xgAgainst / matchesPlayed) : 0,
      };
    })
    .sort((a, b) => a.splTeamId - b.splTeamId);

  // League-wide per-match averages, used by the extension to normalise team
  // ratings and to derive the home/away advantage.
  const matches = Object.values(state.events);
  const homeAvgXg = matches.reduce((sum, m) => sum + m.homeXg, 0) / matches.length;
  const awayAvgXg = matches.reduce((sum, m) => sum + m.awayXg, 0) / matches.length;

  const output = {
    generatedAt: new Date().toISOString(),
    sofascoreTournamentId: SOFASCORE_TOURNAMENT_ID,
    sofascoreSeasonId: SOFASCORE_SEASON_ID,
    roundsSeen: [...roundsSeen].sort((a, b) => a - b),
    league: {
      matchesPlayed: matches.length,
      avgXg: round2((homeAvgXg + awayAvgXg) / 2),
      homeAvgXg: round2(homeAvgXg),
      awayAvgXg: round2(awayAvgXg),
    },
    teams,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUTPUT_PATH} (${teams.length} teams, ${Object.keys(state.events).length} matches cached)`);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
