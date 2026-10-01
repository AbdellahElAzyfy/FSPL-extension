# Privacy Policy — SPL Fantasy Helper

_Last updated: 1 October 2026_

SPL Fantasy Helper is an unofficial browser extension that adds fixture
information to the SPL Fantasy website (fantasy.spl.com.sa). It is not
affiliated with or endorsed by the Saudi Pro League.

## What the extension collects

Nothing. The extension does not collect, sell or share any personal data. It
has no accounts, no analytics, no tracking and no cookies of its own, and it
does not read your SPL Fantasy login, team or any form input.

## What it stores

If you edit the team difficulty ratings, your edited values (numbers from 1 to
5 per team) are saved with Chrome's built-in extension storage
(`chrome.storage.sync`). If you're signed in to Chrome with sync turned on,
Chrome syncs them across your own devices. They are never sent to us. Use
"Reset all to default" in the ratings editor, or remove the extension, to
delete them.

## What network requests it makes

To show fixtures and difficulty ratings, the extension downloads public data
from two places:

- **The SPL Fantasy website's public API** (`fantasy.spl.com.sa`) — the list
  of teams, players and fixtures, the same data the site itself loads.
- **This project's GitHub repository** (`raw.githubusercontent.com`) — a
  small file with the default team difficulty ratings.

These are ordinary web requests. Like any website, those servers may see
standard request information such as your IP address; the extension sends
nothing else about you.

## Permissions

- **Site access** to `fantasy.spl.com.sa` (and its language subdomains such
  as `en.fantasy.spl.com.sa`) — the only site the extension runs on.
- **Storage** — to save your own rating edits, as described above.

## Contact

Questions: open an issue at
https://github.com/AbdellahElAzyfy/FSPL-extension/issues
