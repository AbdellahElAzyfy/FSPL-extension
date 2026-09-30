// Service worker. Its only job is the toolbar icon: clicking it opens the
// full-season fixture difficulty page (the manifest's action has no popup,
// so onClicked fires).

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/season/index.html") });
});
