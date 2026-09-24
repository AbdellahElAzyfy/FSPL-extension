// Player shirt images are served as /dist/img/shirts/standard/shirt_{teamCode}-{size}.png
// e.g. shirt_6780-66.png for team code 6780 (confirmed against
// bootstrap-static: code 6780 == team id 8, Al Nassr). This is the only
// reliable way to identify a player row's team from the DOM, since rows
// carry no data-team-id attribute.
// Goalkeepers use a separate kit variant suffix, e.g. shirt_15209_1-110.webp
// (team code 15209, GK kit "_1") — the trailing "_\d+" is optional.
const SHIRT_SRC_PATTERN = /shirt_(\d+)(?:_\d+)?-/;
const GK_SHIRT_PATTERN = /shirt_\d+_1-/;

export function extractTeamCodeFromShirtSrc(src: string): number | null {
  const match = SHIRT_SRC_PATTERN.exec(src);
  if (!match) return null;
  return Number(match[1]);
}

export function isGoalkeeperShirt(src: string): boolean {
  return GK_SHIRT_PATTERN.test(src);
}
