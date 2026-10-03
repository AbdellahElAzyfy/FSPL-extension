/**
 * The extension's own wording follows the site's language: Arabic on the
 * Arabic site (<html lang="ar">), English everywhere else — including the
 * standalone season page. Team codes on fixture chips stay as they are.
 */
export function isArabic(): boolean {
  return document.documentElement.lang === "ar";
}

/** Picks the English or Arabic version of a piece of text. */
export function t(en: string, ar: string): string {
  return isArabic() ? ar : en;
}

/** Locale for dates. Plain "ar" keeps Western digits, matching the site. */
export function dateLocale(): string {
  return isArabic() ? "ar" : "en-GB";
}
