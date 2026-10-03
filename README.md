# SPL Fantasy Helper

Unofficial Chrome extension for [SPL Fantasy](https://fantasy.spl.com.sa/) (Arabic and English sites).

- **Next 5 fixtures on every player** — on Pick Team and Transfers, each player row shows their team's next five opponents (UPPERCASE = home, lowercase = away).
- **Position-aware fixture difficulty** — each fixture is coloured 1 (easy) to 5 (hard) from team ratings based on team stats: attackers are rated against the opponent's defence, defenders against the opponent's attack, with separate home and away values.
- **Full-season difficulty table** — a "Difficulty" tab added to the site's menu (also opened by the toolbar icon): every team × remaining round, attacker/defender toggle, next 5 / 10 / rest of season, sorted easiest first.
- **Editable ratings** — users can adjust any team's ratings from the Difficulty tab ("Edit ratings"); changes recolour everything instantly and can be reset to the defaults.

Not affiliated with the Saudi Pro League. No data collected — see [PRIVACY.md](PRIVACY.md).

## Development

```sh
npm install
npm run build      # -> dist/, load it via chrome://extensions > Developer mode > Load unpacked
npm run package    # build + zip for the Chrome Web Store -> release/
```

- `src/content/` — content script: fixture strips on player rows, the injected Difficulty tab
- `src/ui/` — fixture strip, season grid + ratings editor, shared difficulty colours
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
