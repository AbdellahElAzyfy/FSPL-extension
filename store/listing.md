# Chrome Web Store submission — SPL Fantasy Helper

Copy-paste text for the Developer Dashboard. Upload file:
`release/spl-fantasy-helper-<version>.zip` (create it with `npm run package`).

---

## Store listing tab

**Name:** SPL Fantasy Helper

**Summary** (from the manifest, 129/132 chars):
Unofficial SPL Fantasy helper: colour-coded fixtures on every player, a team planner for future gameweeks and a difficulty table.

**Category:** Sports

**Language:** English

**Description:**

```
Plan your SPL Fantasy transfers and captaincy faster — see every player's upcoming fixtures, how hard they are, and how your team lines up in the weeks ahead, right on the site.

NEXT 5 FIXTURES ON EVERY PLAYER
On the Pick Team and Transfers screens, each player gets a strip of their team's next five opponents. UPPERCASE = home, lowercase = away. No more clicking into each player to check who they play.

LOOK AHEAD TO ANY GAMEWEEK
Step forward through the coming gameweeks on Pick Team: every player on your pitch shows who they face that week, colour-coded by difficulty. Spot the weak weeks before you pick your captain.

TEAM PLANNER
Below the pitch on the Transfers screen, see your starting XI and bench for any upcoming gameweek — including the transfers you've made but not confirmed yet, so you can see how a transfer affects your team before you commit.
• Every player shows their fixture for that week.
• Swap players between the team and the bench, and move the captain's armband.
• Save plans with a name and come back to them later. Plans are kept in your browser.

POSITION-AWARE FIXTURE DIFFICULTY
Every fixture is colour-coded from 1 (easy, dark green) to 5 (hard, dark red), using team ratings based on team stats:
• Midfielders and forwards are rated against the opponent's defence.
• Goalkeepers and defenders are rated against the opponent's attack.
So a strong-defence, average-attack opponent is red for your striker but only average for your defender. Every team has separate home and away ratings, and they're kept up to date through the season.

MAKE THE RATINGS YOUR OWN
Disagree with a rating? Click "Edit ratings" on the Difficulty tab and set any team's attack and defence, home and away. Every fixture strip and the whole table recolour instantly. Your edits are saved in your browser, and "Reset to default" brings back ours anytime.

FULL-SEASON DIFFICULTY TABLE
A new "Difficulty" tab in the site's menu shows every team's fixtures for the rest of the season in one colour-coded grid:
• Switch between attacker and defender ratings.
• View the next 5 rounds, the next 10, or the rest of the season.
• Teams are sorted easiest run first — spot fixture swings and plan transfers ahead.
You can also open the table from the extension's toolbar icon.

ARABIC AND ENGLISH
Works on both the Arabic and English versions of the site, and speaks the site's language.

PRIVACY
No accounts, no tracking, no data collected. The extension only runs on the SPL Fantasy website. The team planner reads your team from the site to show it to you — it never leaves your browser. Your rating edits and plans are stored in your own browser.

This is an unofficial, fan-made tool. It is not affiliated with, endorsed by or connected to the Saudi Pro League or SPL Fantasy.
```

**Graphic assets:**
- Store icon: `icons/icon128.png`
- Screenshots (1280×800 JPEG, upload in this order; the store allows 5):
  1. `store/screenshots/1-fixture-strips.jpeg` — Pick Team pitch with coloured strips (personal leagues sidebar replaced by a caption)
  2. `store/screenshots/2-gameweek-browser.jpeg` — Pick Team browsed ahead to Gameweek 10
  3. `store/screenshots/3-team-planner.jpeg` — the team planner on Transfers, a player selected with swap targets highlighted
  4. `store/screenshots/4-difficulty-attackers.jpeg` — Difficulty tab, Attackers, next 5 rounds
  5. `store/screenshots/5-edit-ratings.jpeg` — the ratings editor open
- Small promo tile (440×280): optional

---

## Privacy practices tab

**Single purpose:**
Helps users plan their SPL Fantasy team: shows each player's upcoming fixtures and their difficulty directly on the SPL Fantasy website, a planner showing the user's team in upcoming gameweeks, and a full-season fixture difficulty table.

**Permission justification — host permissions** (`fantasy.spl.com.sa`, `*.fantasy.spl.com.sa`):
The extension adds fixture strips, a gameweek browser, a team planner and a difficulty table to SPL Fantasy pages. It reads the site's public fixtures and teams API to build them, and — on the Transfers page, for a signed-in user — the user's own team from the site, so the planner can show it. The toolbar page reads the same public API. It does not run on any other site.

**Permission justification — storage:**
Saves the user's own edits to the team difficulty ratings (a few numbers per team, synced across the user's devices via Chrome sync) and the team plans they choose to save (kept locally in the browser). Nothing is sent to the developer.

**Remote code:** No, I am not using remote code. (The extension downloads a JSON data file of default team ratings; no scripts are loaded remotely.)

**Data usage:** tick none of the data categories. The planner reads the user's team from the SPL Fantasy site, but only to display it in the user's own browser; it is never transmitted to the developer or anyone else, and the account details the site returns alongside it (name, email) are ignored. This is described in the privacy policy.
Certify all three statements (no selling/transfer, no unrelated use, no creditworthiness use).

**Privacy policy URL:**
https://github.com/AbdellahElAzyfy/FSPL-extension/blob/main/PRIVACY.md

---

## Distribution tab

Visibility: start with **Unlisted** (only people with the link can install), switch to **Public** once happy.
Regions: all (or just Saudi Arabia).
