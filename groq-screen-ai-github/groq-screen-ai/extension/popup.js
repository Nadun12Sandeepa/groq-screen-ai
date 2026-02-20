// ─── State ────────────────────────────────────────────────────────────────────
let capturedContent = '';
let currentMode = 'page';
let isStreaming = false;

// ─── Elements ─────────────────────────────────────────────────────────────────
const apiKeyInput   = document.getElementById('apiKey');
const saveKeyBtn    = document.getElementById('saveKey');
const previewBox    = document.getElementById('previewBox');
const captureInfo   = document.getElementById('captureInfo');
const questionInput = document.getElementById('question');
const askBtn        = document.getElementById('askBtn');
const answerBox     = document.getElementById('answerBox');
const copyBtn       = document.getElementById('copyBtn');
const clearBtn      = document.getElementById('clearBtn');
const statusMsg     = document.getElementById('statusMsg');
const tokenCount    = document.getElementById('tokenCount');

// ─── Load saved API key ───────────────────────────────────────────────────────
chrome.storage.local.get(['groqApiKey'], (res) => {
  if (res.groqApiKey) {
    apiKeyInput.value = res.groqApiKey;
    setStatus('API key loaded ✓', 'ok');
  }
});

saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) return setStatus('Enter a valid API key', 'err');
  chrome.storage.local.set({ groqApiKey: key }, () => {
    setStatus('API key saved ✓', 'ok');
  });
});

// ─── Capture Mode Buttons ─────────────────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    await capture(currentMode);
  });
});

async function capture(mode) {
  setStatus('Capturing…');
  previewBox.innerHTML = '<span class="empty">Capturing…</span>';

  try {
    if (mode === 'page') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Get visible text, preserving structure
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
                if (['script','style','noscript','svg'].includes(tag)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
              }
            }
          );
          let text = '';
          let node;
          while ((node = walker.nextNode())) {
            const t = node.textContent.trim();
            if (t.length > 0) text += t + ' ';
          }
          return {
            text: text.slice(0, 12000),
            url: window.location.href,
            title: document.title
          };
        }
      });
      const { text, url, title } = results[0].result;
      capturedContent = `Page: ${title}\nURL: ${url}\n\n${text}`;
      showPreview(capturedContent);
      captureInfo.textContent = `— ${Math.round(capturedContent.length / 4)} tokens`;
      setStatus(`Captured page content`, 'ok');

    } else if (mode === 'selection') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const sel = window.getSelection();
          return sel ? sel.toString().trim() : '';
        }
      });
      const selected = results[0].result;
      if (!selected) {
        setStatus('No text selected on page', 'err');
        previewBox.innerHTML = '<span class="empty">Select some text on the page first, then click this mode.</span>';
        capturedContent = '';
        return;
      }
      capturedContent = selected;
      showPreview(capturedContent);
      captureInfo.textContent = `— ${selected.length} chars`;
      setStatus('Captured selection ✓', 'ok');

    } else if (mode === 'screenshot') {
      // Capture visible tab as image, convert to base64 description
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      // Store the screenshot for later use with vision models
      capturedContent = dataUrl; // base64 image
      previewBox.innerHTML = `<img src="${dataUrl}" style="max-width:100%;border-radius:4px;" />`;
      captureInfo.textContent = '— screenshot';
      setStatus('Screenshot captured ✓', 'ok');
    }
  } catch (err) {
    setStatus(`Capture failed: ${err.message}`, 'err');
    previewBox.innerHTML = `<span class="empty">Error: ${err.message}</span>`;
  }
}

// ─── Ask Groq ─────────────────────────────────────────────────────────────────
askBtn.addEventListener('click', askGroq);

questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) askGroq();
});

async function askGroq() {
  if (isStreaming) return;

  const apiKey = apiKeyInput.value.trim() || (await getStoredKey());
  if (!apiKey) return setStatus('Set your Groq API key first!', 'err');

  const question = questionInput.value.trim();
  if (!question) return setStatus('Enter a question', 'err');
  if (!capturedContent) return setStatus('Capture page content first', 'err');

  isStreaming = true;
  askBtn.disabled = true;
  askBtn.innerHTML = '<div class="spinner"></div> Thinking…';
  answerBox.innerHTML = '';
  setStatus('Streaming response…');

  // Build messages
  let messages;
  if (currentMode === 'screenshot' && capturedContent.startsWith('data:image')) {
    // Vision mode
    messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: capturedContent }
          },
          {
            type: 'text',
            text: question
          }
        ]
      }
    ];
  } else {
    messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant. The user has captured content from their browser and has a question about it. Be concise and accurate.'
      },
      {
        role: 'user',
        content: `Browser content:\n\n${capturedContent}\n\n---\n\nQuestion: ${question}`
      }
    ];
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages,
        temperature: 1,
        max_completion_tokens: 8192,
        top_p: 1,
        stream: true
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    answerBox.classList.add('streaming');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let charCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            charCount += delta.length;
            // Render with cursor
            answerBox.innerHTML = escapeHtml(fullText) + '<span class="cursor"></span>';
            answerBox.scrollTop = answerBox.scrollHeight;
            tokenCount.textContent = `~${Math.round(charCount / 4)} tokens`;
          }
        } catch (_) {}
      }
    }

    // Final render without cursor
    answerBox.classList.remove('streaming');
    answerBox.innerHTML = escapeHtml(fullText);
    setStatus('Done ✓', 'ok');

  } catch (err) {
    answerBox.innerHTML = `<span style="color:#ff4444">Error: ${escapeHtml(err.message)}</span>`;
    setStatus(`Error: ${err.message}`, 'err');
    answerBox.classList.remove('streaming');
  } finally {
    isStreaming = false;
    askBtn.disabled = false;
    askBtn.innerHTML = '<span>⚡</span> Ask Groq AI';
  }
}

// ─── Copy & Clear ─────────────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  const text = answerBox.textContent;
  if (!text || text === 'Your answer will appear here…') return;
  await navigator.clipboard.writeText(text);
  copyBtn.textContent = '✓ Copied!';
  setTimeout(() => copyBtn.innerHTML = '📋 Copy Answer', 1500);
});

clearBtn.addEventListener('click', () => {
  answerBox.innerHTML = '<span class="placeholder">Your answer will appear here…</span>';
  questionInput.value = '';
  capturedContent = '';
  previewBox.innerHTML = '<span class="empty">Click a capture mode to grab page content…</span>';
  captureInfo.textContent = '';
  tokenCount.textContent = '';
  setStatus('Cleared');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showPreview(text) {
  previewBox.textContent = text.slice(0, 500) + (text.length > 500 ? '…' : '');
}

function setStatus(msg, type = '') {
  statusMsg.textContent = msg;
  statusMsg.className = type === 'ok' ? 'status-ok' : type === 'err' ? 'status-err' : '';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

async function getStoredKey() {
  return new Promise(resolve => {
    chrome.storage.local.get(['groqApiKey'], res => resolve(res.groqApiKey || ''));
  });
}

// Auto-capture page on open
capture('page');
