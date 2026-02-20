# ⚡ Groq Screen AI — Chrome Extension

> Ask AI anything about what's on your browser screen. Powered by Groq's ultra-fast inference.

![License](https://img.shields.io/badge/license-MIT-green)
![Manifest](https://img.shields.io/badge/manifest-v3-blue)
![Groq](https://img.shields.io/badge/powered%20by-Groq-orange)

---

## 🎯 What it does

A Chrome extension that captures content from your browser and answers your questions using Groq AI with real-time streaming responses.

**3 capture modes:**
- 📄 **Full Page** — extracts all visible text from any webpage
- ✂️ **Selection** — asks about text you've highlighted  
- 📸 **Screenshot** — sends a visual screenshot to AI

---

## 🚀 Install (5 minutes)

### Step 1 — Get a free Groq API key
Go to [console.groq.com](https://console.groq.com), sign up free, create an API key.

### Step 2 — Download the extension
👉 **[Download extension.zip](../../releases/latest/download/extension.zip)**

### Step 3 — Extract the ZIP
Right-click → Extract All. Open the folder, find the `extension/` subfolder.

### Step 4 — Load into Chrome
1. Open `chrome://extensions/`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder *(the one containing `manifest.json`)*

### Step 5 — Enter your API key
Click the extension icon → paste your Groq API key → click **Save** → done! ⚡

---

## 📁 Repository Structure

```
groq-screen-ai/
├── index.html          ← Landing page (GitHub Pages)
├── extension/          ← Load THIS into Chrome
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── content.js
│   ├── background.js
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── server/
│   └── server.py       ← Optional Python backend
└── README.md
```

---

## 🔒 Privacy

Your API key is stored **only in your local Chrome storage** and sent **directly to Groq's API**. No middleman server, no data collection.

---

## 📄 License

MIT — free to use, modify, and share.
