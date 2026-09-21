// Service worker: owns cross-tab caching of fixture data so every
// content script instance doesn't refetch on its own. Kept minimal
// for v1; will grow as more features (price alerts, etc.) are added.

chrome.runtime.onInstalled.addListener(() => {
  console.log("[SPL Fantasy Helper] installed");
});
