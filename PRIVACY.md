# Privacy Policy — SPL Fantasy Helper

_Last updated: 3 October 2026_

SPL Fantasy Helper is an unofficial browser extension that adds fixture
information and a team planner to the SPL Fantasy website (fantasy.spl.com.sa).
It is not affiliated with or endorsed by the Saudi Pro League.

## What the extension collects

Nothing. The extension does not collect, sell or share any personal data. It
has no accounts, no analytics, no tracking and no cookies of its own. Nothing
about you or your team is ever sent to us or to anyone else.

## What it reads on the SPL Fantasy website

- **Fixtures, teams and players** — the site's public data, the same data the
  site itself loads.
- **Your own team, for the team planner** — when you are signed in to SPL
  Fantasy and open the Transfers page, the extension asks the site for your
  team (your players, their order on the bench, your captain). It does this
  the same way the site does, through your existing login session; it never
  sees or handles your password. The site's answer also includes your account
  details such as your name and email address — the extension ignores them and
  uses only your team ID. Your team is used only to draw the planner in your
  browser.

## What it stores

Everything is stored with Chrome's built-in extension storage, on your device:

- **Your rating edits** — if you edit the team difficulty ratings, your edited
  values (numbers from 1 to 5 per team) are saved in `chrome.storage.sync`. If
  you're signed in to Chrome with sync turned on, Chrome syncs them across your
  own devices. Use "Reset all to default" in the ratings editor to delete them.
- **Your saved plans** — if you save a plan in the team planner, its name, the
  players in it (as player IDs), your lineup and captain, and your team ID are
  saved in `chrome.storage.local`, in this browser only. Use "Delete" next to a
  plan to remove it.

Removing the extension deletes all of it. None of it is ever sent to us.

## What network requests it makes

- **The SPL Fantasy website** (`fantasy.spl.com.sa`) — its public teams,
  players and fixtures, and, on the Transfers page while you are signed in,
  your own team as described above.
- **This project's GitHub repository** (`raw.githubusercontent.com`) — a
  small file with the default team difficulty ratings.

These are ordinary web requests. Like any website, those servers may see
standard request information such as your IP address; the extension sends
nothing else about you.

## Permissions

- **Site access** to `fantasy.spl.com.sa` (and its language subdomains such
  as `en.fantasy.spl.com.sa`) — the only site the extension runs on.
- **Storage** — to save your rating edits and plans, as described above.

## Contact

Questions: open an issue at
https://github.com/AbdellahElAzyfy/FSPL-extension/issues
