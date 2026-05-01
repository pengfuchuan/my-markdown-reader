// Handle remote .md URLs — redirect immediately
chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId !== 0) return;

    const url = new URL(details.url);
    if (!url.pathname.endsWith('.md')) return;

    // Let file:// URLs load first (handled by onCompleted below)
    if (details.url.startsWith('file://')) return;

    chrome.storage.session.set({ md_url: details.url }).then(() => {
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('src/reader/index.html'),
      });
    });
  },
  {
    url: [
      { urlMatches: 'https://.*\\.md$' },
      { urlMatches: 'http://.*\\.md$' },
    ],
  },
);

// Handle local file:// .md URLs — read content then redirect
chrome.webNavigation.onCompleted.addListener(
  async (details) => {
    if (details.frameId !== 0) return;
    if (!details.url.startsWith('file://')) return;

    const url = new URL(details.url);
    if (!url.pathname.endsWith('.md')) return;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        func: () => document.body.innerText,
      });
      const content = (results?.[0]?.result as string) || '';
      await chrome.storage.session.set({ md_content: content });
    } catch {
      // Fallback: redirect with URL only (reader will show file:// message)
      await chrome.storage.session.set({ md_url: details.url });
    }

    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL('src/reader/index.html'),
    });
  },
  {
    url: [{ urlMatches: 'file://.*\\.md$' }],
  },
);
