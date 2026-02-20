// content.js - injected into pages
// Listens for messages from the popup/background

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageText') {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'svg', 'head'].includes(tag)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let text = '';
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      if (t.length > 1) text += t + '\n';
    }

    sendResponse({
      text: text.slice(0, 15000),
      title: document.title,
      url: window.location.href,
      metaDesc: document.querySelector('meta[name="description"]')?.content || ''
    });
  }

  if (request.action === 'getSelection') {
    const sel = window.getSelection();
    sendResponse({ text: sel ? sel.toString().trim() : '' });
  }

  return true; // keep channel open for async
});
