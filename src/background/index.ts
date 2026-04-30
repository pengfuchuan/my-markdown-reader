chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId !== 0) return;

    const url = new URL(details.url);
    if (!url.pathname.endsWith('.md')) return;

    // Store the original URL in session storage
    chrome.storage.session.set({ md_url: details.url }).then(() => {
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('src/reader/index.html'),
      });
    });
  },
  { url: [{ urlMatches: '.*\\.md$' }] }
);
