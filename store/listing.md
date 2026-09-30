# Chrome Web Store submission — SPL Fantasy Helper

Copy-paste text for the Developer Dashboard. Upload file:
`release/spl-fantasy-helper-<version>.zip` (create it with `npm run package`).

---

## Store listing tab

**Name:** SPL Fantasy Helper

**Summary** (from the manifest, 123/132 chars):
Unofficial helper for SPL Fantasy: colour-coded next-5 fixtures on every player and a full-season fixture difficulty table.

**Category:** Sports

**Language:** English

**Description:**

```
Plan your SPL Fantasy transfers and captaincy faster — see every player's upcoming fixtures and how hard they are, right on the site.

NEXT 5 FIXTURES ON EVERY PLAYER
On the Pick Team and Transfers screens, each player gets a strip of their team's next five opponents. UPPERCASE = home, lowercase = away. No more clicking into each player to check who they play.

POSITION-AWARE FIXTURE DIFFICULTY
Every fixture is colour-coded from 1 (easy, dark green) to 5 (hard, dark red), based on Expected Goals (xG):
• Midfielders and forwards are rated on how much the opponent concedes.
• Goalkeepers and defenders are rated on how much the opponent creates.
So a strong-defence, average-attack opponent is red for your striker but only average for your defender. Home advantage and small early-season samples are accounted for, and ratings update as the season goes on.

FULL-SEASON DIFFICULTY TABLE
A new "Difficulty" tab in the site's menu shows every team's fixtures for the rest of the season in one colour-coded grid:
• Switch between attacker and defender ratings.
• View the next 5 rounds, the next 10, or the rest of the season.
• Teams are sorted easiest run first — spot fixture swings and plan transfers ahead.
You can also open the table from the extension's toolbar icon.

Works on both the Arabic and English versions of the site.

PRIVACY
No accounts, no tracking, no data collected. The extension only runs on the SPL Fantasy website.

This is an unofficial, fan-made tool. It is not affiliated with, endorsed by or connected to the Saudi Pro League or SPL Fantasy.
```

**Graphic assets:**
- Store icon: `icons/icon128.png`
- Screenshots (1280×800, at least 1): suggested —
  1. Pick Team pitch with coloured fixture strips under players
  2. The "Difficulty" tab grid (Attackers, next 5)
  3. Same grid, Defenders, rest of season
- Small promo tile (440×280): optional

---

## Privacy practices tab

**Single purpose:**
Shows each SPL Fantasy player's upcoming fixtures and their difficulty directly on the SPL Fantasy website, plus a full-season fixture difficulty table, to help users plan their fantasy team.

**Permission justification — host permissions** (`fantasy.spl.com.sa`, `*.fantasy.spl.com.sa`):
The extension adds fixture strips and a difficulty table to SPL Fantasy pages, and reads the site's public fixtures and teams API to build them. The toolbar page also reads that same public API. It does not run on any other site.

**Remote code:** No, I am not using remote code. (The extension downloads a JSON data file of team statistics; no scripts are loaded remotely.)

**Data usage:** tick none of the data categories — the extension collects no user data.
Certify all three statements (no selling/transfer, no unrelated use, no creditworthiness use).

**Privacy policy URL:**
https://github.com/AbdellahElAzyfy/FSPL-extension/blob/main/PRIVACY.md

---

## Distribution tab

Visibility: start with **Unlisted** (only people with the link can install), switch to **Public** once happy.
Regions: all (or just Saudi Arabia).
