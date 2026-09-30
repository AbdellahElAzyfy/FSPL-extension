# SPL Fantasy Helper

Unofficial Chrome extension for [SPL Fantasy](https://fantasy.spl.com.sa/) (Arabic and English sites).

- **Next 5 fixtures on every player** — on Pick Team and Transfers, each player row shows their team's next five opponents (UPPERCASE = home, lowercase = away).
- **Position-aware fixture difficulty** — each fixture is coloured 1 (easy) to 5 (hard) from team Expected Goals (xG): attackers are rated on the opponent's xG conceded, defenders on the opponent's xG created, adjusted for home advantage.
- **Full-season difficulty table** — a "Difficulty" tab added to the site's menu (also opened by the toolbar icon): every team × remaining round, attacker/defender toggle, next 5 / 10 / rest of season, sorted easiest first.

Not affiliated with the Saudi Pro League. No data collected — see [PRIVACY.md](PRIVACY.md).

## Development

```sh
npm install
npm run build      # -> dist/, load it via chrome://extensions > Developer mode > Load unpacked
npm run package    # build + zip for the Chrome Web Store -> release/
```

- `src/content/` — content script: fixture strips on player rows, the injected Difficulty tab
- `src/ui/` — fixture strip, season grid component, shared difficulty colours
- `src/fdr/difficulty.ts` — the difficulty model (buckets and shrinkage are tunable at the top)
- `src/pages/season/` — standalone difficulty page (toolbar icon)

## Team xG data

`data/team-xg.json` is served to the extension from this repo. It is refreshed by
`scripts/updateTeamXg.mjs` (`npm run fetch:xg`), run daily on a local machine by
`scripts/update-xg-local.ps1` via Windows Task Scheduler (register with
`scripts/register-xg-task.ps1`). The Sofascore season ID in the script must be
bumped each new season.
