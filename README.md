# SPL Fantasy Helper

Unofficial Chrome extension for [SPL Fantasy](https://fantasy.spl.com.sa/) (Arabic and English sites).

- **Next 5 fixtures on every player** — on Pick Team and Transfers, each player row shows their team's next five gameweeks (UPPERCASE = home, lowercase = away). A double gameweek shows both opponents stacked in that week's slot; a blank one shows "–".
- **Price-change arrow** — a badge on each player's shirt shows his last price change: green ▲ rise, red ▼ fall, grey = unchanged this season.
- **Gameweek browser** — on Pick Team, step through the coming gameweeks; each player shows that week's fixture, coloured by difficulty.
- **Team planner** — below the pitch on Transfers: plan transfers and chips for every upcoming gameweek. Each gameweek shows the XI and bench, free transfers, points hits and bank; a player picker (search, sort by price, points or fixtures) makes transfers, and chips (Wildcard, Loan Rangers, Park the bus, Two captains) are offered only while unplayed. Changing an earlier gameweek updates later transfers to match. The coming gameweek also follows the site's unconfirmed transfers. Swap players, move the armband, and save named plans (kept in the browser; the unsaved plan survives a reload).
- **Position-aware fixture difficulty** — each fixture is coloured 1 (easy) to 5 (hard) from team ratings based on team stats: attackers are rated against the opponent's defence, defenders against the opponent's attack, with separate home and away values.
- **Full-season difficulty table** — a "Difficulty" tab added to the site's menu (also opened by the toolbar icon): every team × remaining round, attacker / defender / general (average of both) toggle, next 5 / 10 / rest of season, sorted easiest run first (a double gameweek counts both games, a blank counts nothing).
- **Editable ratings** — users can adjust any team's ratings from the Difficulty tab ("Edit ratings"); changes recolour everything instantly and can be reset to the defaults.
- **Arabic and English** — the extension's own text follows the site's language.

Not affiliated with the Saudi Pro League. No data collected — see [PRIVACY.md](PRIVACY.md).

## Development

```sh
npm install
npm run build      # -> dist/, load it via chrome://extensions > Developer mode > Load unpacked
npm run package    # build + zip for the Chrome Web Store -> release/
```

- `src/content/` — content script: fixture strips on player rows, the Pick Team gameweek browser, the Transfers team planner, the injected Difficulty tab
- `src/ui/` — fixture strip, price-change badge, gameweek stepper, season grid + ratings editor, shared difficulty colours, `i18n.ts` (English/Arabic text)
- `src/planner/` — lineup rules (swaps, armbands), `seasonPlan.ts` (replays a plan gameweek by gameweek: transfers, chips, free transfers, hits, bank) and saved plans
- `src/api/` — the site's public API, players' price history (`priceHistory.ts`), plus the signed-in user's team (`myTeam.ts`)
- `src/fdr/schedule.ts` — remaining fixtures by team and open gameweek
- `src/fdr/difficulty.ts` — difficulty lookup from team ratings
- `src/fdr/ratingsStore.ts` — loads default ratings (bundled, then the repo copy) and the user's edits
- `src/pages/season/` — standalone difficulty page (toolbar icon)

## Updating the default ratings

`data/team-ratings.json` holds the default ratings: per team, `attack` and
`defence`, each with `home` and `away` values from 1 (weakest) to 5 (strongest).
`home`/`away` is where that team plays.

The extension bundles a copy at build time and, on every page load, also reads
the copy in this repo — so **editing the file and pushing to `main` updates every
user** without a store release (the repo copy wins when its `updatedAt` is the
same or newer than the bundled one). Users' own edits stay on top.

Easiest way to edit: open the Difficulty tab → Edit ratings, set the values,
click **Copy as JSON**, paste over `data/team-ratings.json`, commit and push.

## License

Copyright © 2026 Abdellah El Azyfy. All rights reserved. The source is public
for transparency only. Copying, modifying or republishing it is not permitted
without written permission. See [LICENSE](LICENSE).
