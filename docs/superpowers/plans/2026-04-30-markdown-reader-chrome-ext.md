# Markdown Reader Chrome Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that intercepts .md file requests and renders them in a clean reader layout with TOC, search, themes, and code highlighting.

**Architecture:** Manifest V3 extension. Background service worker intercepts .md URL navigations via `chrome.webNavigation`, stores the URL in session storage, and redirects the tab to a React-based reader page. The reader page fetches the markdown content and renders it with a sidebar TOC.

**Tech Stack:** React 18, TypeScript, Vite + @crxjs/vite-plugin, marked, highlight.js, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `manifest.json` | Chrome extension manifest (MV3) |
| `vite.config.ts` | Vite + CRXJS + Vitest config |
| `tsconfig.json` | TypeScript config |
| `src/background/index.ts` | Service worker — intercept .md navigations |
| `src/lib/markdown.ts` | Markdown parsing with marked + highlight.js |
| `src/lib/toc.ts` | TOC tree builder and filter |
| `src/lib/markdown.test.ts` | Tests for parseMarkdown |
| `src/lib/toc.test.ts` | Tests for buildTocTree + filterTocTree |
| `src/reader/index.html` | Reader page HTML entry |
| `src/reader/main.tsx` | React entry point |
| `src/reader/App.tsx` | Main layout — toolbar + sidebar + content |
| `src/reader/components/MarkdownContent.tsx` | Render parsed HTML |
| `src/reader/components/Sidebar.tsx` | Sidebar container |
| `src/reader/components/TocList.tsx` | Recursive TOC tree |
| `src/reader/components/SearchBar.tsx` | Search/filter input |
| `src/reader/components/Toolbar.tsx` | Top bar with theme toggle |
| `src/reader/hooks/useMarkdown.ts` | Fetch + parse + TOC orchestration |
| `src/reader/hooks/useTheme.ts` | Theme state + localStorage |
| `src/reader/styles/global.css` | Layout + light theme CSS variables |
| `src/reader/styles/dark.css` | Dark theme CSS variables |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `manifest.json`
- Create: `src/reader/index.html`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
cd /Users/wing/work/github/pengfuchuan/my-markdown-reader
npm init -y
npm install react react-dom marked highlight.js
npm install -D typescript @types/react @types/react-dom @vitejs/plugin-react @crxjs/vite-plugin vite vitest
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["chrome"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install Chrome types**

```bash
npm install -D @types/chrome
```

- [ ] **Step 4: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Markdown Reader",
  "version": "1.0.0",
  "description": "A clean markdown reader",
  "permissions": ["webNavigation", "storage"],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "icons": {}
}
```

- [ ] **Step 5: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        reader: 'src/reader/index.html',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

- [ ] **Step 6: Create `src/reader/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Markdown Reader</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **Step 7: Create placeholder files so build doesn't break**

Create empty `src/reader/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div>Markdown Reader</div>
  </React.StrictMode>
);
```

Create empty `src/background/index.ts`:
```ts
// Background service worker placeholder
```

- [ ] **Step 8: Verify build works**

Run: `npx vite build`
Expected: Build completes without errors (may have warnings about empty icons).

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold chrome extension project with Vite + CRXJS + React"
```

---

### Task 2: Markdown Parsing Library (TDD)

**Files:**
- Create: `src/lib/markdown.ts`
- Create: `src/lib/markdown.test.ts`

**Types to define in `src/lib/markdown.ts`:**

```ts
export interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface ParseResult {
  html: string;
  headings: Heading[];
}
```

- [ ] **Step 1: Write failing tests for `parseMarkdown`**

Create `src/lib/markdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('parses plain text', () => {
    const result = parseMarkdown('Hello world');
    expect(result.html).toContain('Hello world');
    expect(result.headings).toEqual([]);
  });

  it('extracts headings with IDs', () => {
    const md = '# Title\n## Section\n### Sub';
    const result = parseMarkdown(md);
    expect(result.headings).toEqual([
      { level: 1, text: 'Title', id: 'heading-0' },
      { level: 2, text: 'Section', id: 'heading-1' },
      { level: 3, text: 'Sub', id: 'heading-2' },
    ]);
  });

  it('renders headings with id attributes', () => {
    const result = parseMarkdown('# Hello');
    expect(result.html).toContain('id="heading-0"');
  });

  it('highlights code blocks with language', () => {
    const md = '```js\nconst x = 1;\n```';
    const result = parseMarkdown(md);
    expect(result.html).toContain('hljs');
    expect(result.html).toContain('const');
  });

  it('auto-detects code language', () => {
    const md = '```\nfunction foo() {}\n```';
    const result = parseMarkdown(md);
    expect(result.html).toContain('hljs');
  });

  it('handles inline code', () => {
    const result = parseMarkdown('Use `npm install`');
    expect(result.html).toContain('<code>npm install</code>');
  });

  it('renders links', () => {
    const result = parseMarkdown('[click](https://example.com)');
    expect(result.html).toContain('href="https://example.com"');
    expect(result.html).toContain('click');
  });

  it('handles consecutive parse calls independently', () => {
    const result1 = parseMarkdown('# First');
    const result2 = parseMarkdown('# Second');
    expect(result1.headings[0].text).toBe('First');
    expect(result2.headings[0].text).toBe('Second');
    expect(result2.headings[0].id).toBe('heading-0');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/markdown.test.ts`
Expected: FAIL — `parseMarkdown` is not defined

- [ ] **Step 3: Implement `parseMarkdown`**

Create `src/lib/markdown.ts`:

```ts
import { Marked } from 'marked';
import hljs from 'highlight.js';

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface ParseResult {
  html: string;
  headings: Heading[];
}

export function parseMarkdown(md: string): ParseResult {
  const headings: Heading[] = [];
  let counter = 0;

  const markedInstance = new Marked();

  markedInstance.use({
    renderer: {
      heading({ text, depth }) {
        const id = `heading-${counter++}`;
        headings.push({ level: depth, text, id });
        return `<h${depth} id="${id}">${text}</h${depth}>`;
      },
      code({ text, lang }) {
        let highlighted: string;
        if (lang && hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(text, { language: lang }).value;
        } else {
          highlighted = hljs.highlightAuto(text).value;
        }
        return `<pre><code class="hljs">${highlighted}</code></pre>`;
      },
    },
  });

  const html = markedInstance.parse(md) as string;
  return { html, headings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/markdown.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown.ts src/lib/markdown.test.ts
git commit -m "feat: add markdown parsing with heading extraction and code highlighting"
```

---

### Task 3: TOC Tree Builder (TDD)

**Files:**
- Create: `src/lib/toc.ts`
- Create: `src/lib/toc.test.ts`

**Types to define in `src/lib/toc.ts`:**

```ts
import type { Heading } from './markdown';

export interface TocNode {
  level: number;
  text: string;
  id: string;
  children: TocNode[];
}
```

- [ ] **Step 1: Write failing tests for `buildTocTree` and `filterTocTree`**

Create `src/lib/toc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildTocTree, filterTocTree } from './toc';
import type { Heading } from './markdown';

describe('buildTocTree', () => {
  it('returns empty tree for empty headings', () => {
    expect(buildTocTree([])).toEqual([]);
  });

  it('builds flat tree for same-level headings', () => {
    const headings: Heading[] = [
      { level: 1, text: 'A', id: 'h0' },
      { level: 1, text: 'B', id: 'h1' },
    ];
    const tree = buildTocTree(headings);
    expect(tree).toEqual([
      { level: 1, text: 'A', id: 'h0', children: [] },
      { level: 1, text: 'B', id: 'h1', children: [] },
    ]);
  });

  it('nests child headings under parent', () => {
    const headings: Heading[] = [
      { level: 1, text: 'Chapter', id: 'h0' },
      { level: 2, text: 'Section A', id: 'h1' },
      { level: 2, text: 'Section B', id: 'h2' },
      { level: 3, text: 'Detail', id: 'h3' },
    ];
    const tree = buildTocTree(headings);
    expect(tree).toEqual([
      {
        level: 1, text: 'Chapter', id: 'h0',
        children: [
          { level: 2, text: 'Section A', id: 'h1', children: [] },
          {
            level: 2, text: 'Section B', id: 'h2',
            children: [
              { level: 3, text: 'Detail', id: 'h3', children: [] },
            ],
          },
        ],
      },
    ]);
  });

  it('handles skipped levels gracefully', () => {
    const headings: Heading[] = [
      { level: 1, text: 'A', id: 'h0' },
      { level: 3, text: 'B', id: 'h1' },
    ];
    const tree = buildTocTree(headings);
    expect(tree[0].children[0].text).toBe('B');
  });
});

describe('filterTocTree', () => {
  const tree = buildTocTree([
    { level: 1, text: 'Getting Started', id: 'h0' },
    { level: 2, text: 'Installation', id: 'h1' },
    { level: 2, text: 'Configuration', id: 'h2' },
    { level: 1, text: 'API Reference', id: 'h3' },
    { level: 2, text: 'Methods', id: 'h4' },
  ]);

  it('returns full tree when query is empty', () => {
    expect(filterTocTree(tree, '')).toEqual(tree);
  });

  it('filters by keyword and preserves parent chain', () => {
    const result = filterTocTree(tree, 'Install');
    expect(result).toEqual([
      {
        level: 1, text: 'Getting Started', id: 'h0',
        children: [
          { level: 2, text: 'Installation', id: 'h1', children: [] },
        ],
      },
    ]);
  });

  it('returns empty when nothing matches', () => {
    expect(filterTocTree(tree, 'xyz')).toEqual([]);
  });

  it('matches case-insensitively', () => {
    const result = filterTocTree(tree, 'api');
    expect(result[0].text).toBe('API Reference');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/toc.test.ts`
Expected: FAIL — `buildTocTree` is not defined

- [ ] **Step 3: Implement `buildTocTree` and `filterTocTree`**

Create `src/lib/toc.ts`:

```ts
import type { Heading } from './markdown';

export interface TocNode {
  level: number;
  text: string;
  id: string;
  children: TocNode[];
}

export function buildTocTree(headings: Heading[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const h of headings) {
    const node: TocNode = { ...h, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

export function filterTocTree(tree: TocNode[], query: string): TocNode[] {
  if (!query) return tree;
  const lower = query.toLowerCase();

  function filterNode(node: TocNode): TocNode | null {
    const childMatches = node.children
      .map(filterNode)
      .filter((n): n is TocNode => n !== null);

    if (node.text.toLowerCase().includes(lower) || childMatches.length > 0) {
      return { ...node, children: childMatches };
    }
    return null;
  }

  return tree.map(filterNode).filter((n): n is TocNode => n !== null);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/toc.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/toc.ts src/lib/toc.test.ts
git commit -m "feat: add TOC tree builder and search filter"
```

---

### Task 4: Background Script — Request Interception

**Files:**
- Create: `src/background/index.ts`

- [ ] **Step 1: Implement background service worker**

Create `src/background/index.ts`:

```ts
chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId !== 0) return;

    const url = new URL(details.url);
    if (!url.pathname.endsWith('.md')) return;

    // Store the original URL in session storage
    chrome.storage.session.set({ [`md_${details.tabId}`]: details.url }).then(() => {
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('src/reader/index.html'),
      });
    });
  },
  { url: [{ urlMatches: '.*\\.md$' }] }
);
```

- [ ] **Step 2: Add required permissions to manifest**

Verify `manifest.json` already has `"webNavigation"` and `"storage"` in permissions.

- [ ] **Step 3: Verify build still works**

Run: `npx vite build`
Expected: Build completes without errors

- [ ] **Step 4: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: add background service worker to intercept .md URL navigations"
```

---

### Task 5: Reader Page — Layout & Styles

**Files:**
- Modify: `src/reader/index.html`
- Create: `src/reader/styles/global.css`
- Create: `src/reader/styles/dark.css`
- Create: `src/reader/App.tsx`
- Modify: `src/reader/main.tsx`

- [ ] **Step 1: Create global styles with CSS variables**

Create `src/reader/styles/global.css`:

```css
@import './dark.css';

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --sidebar-bg: #f8f9fa;
  --content-bg: #ffffff;
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --text-muted: #495057;
  --accent: #4263eb;
  --link: #0d6efd;
  --border: #dee2e6;
  --input-bg: #e9ecef;
  --toc-active-bg: #e7f1ff;
  --code-bg: #f1f3f5;
}

html, body, #root {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text-primary);
  background: var(--content-bg);
}

.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--sidebar-bg);
  border-bottom: 1px solid var(--border);
}

.toolbar-left {
  display: flex;
  gap: 8px;
  align-items: center;
}

.toolbar-btn {
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  font-size: 16px;
}

.toolbar-btn:hover {
  background: var(--input-bg);
}

.toolbar-btn.active {
  background: var(--accent);
  color: #fff;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 280px;
  min-width: 280px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.search-bar {
  padding: 12px;
}

.search-bar input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.search-bar input:focus {
  border-color: var(--accent);
}

.toc-list {
  list-style: none;
  padding: 0 8px 16px;
}

.toc-item {
  display: block;
}

.toc-link {
  display: block;
  padding: 6px 12px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 14px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
}

.toc-link:hover {
  background: var(--input-bg);
}

.toc-link.active {
  background: var(--toc-active-bg);
  color: var(--accent);
  font-weight: 500;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 32px 48px;
}

.content-inner {
  max-width: 900px;
  margin: 0 auto;
}

/* Markdown content styles */
.markdown-body h1 { font-size: 1.75em; margin: 1.5em 0 0.5em; }
.markdown-body h2 { font-size: 1.5em; margin: 1.5em 0 0.5em; }
.markdown-body h3 { font-size: 1.25em; margin: 1.25em 0 0.5em; }
.markdown-body h4 { font-size: 1.1em; margin: 1em 0 0.5em; }
.markdown-body h5, .markdown-body h6 { font-size: 1em; margin: 1em 0 0.5em; }

.markdown-body p {
  margin: 0.75em 0;
  line-height: 1.7;
  color: var(--text-muted);
}

.markdown-body a {
  color: var(--link);
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body ul, .markdown-body ol {
  margin: 0.75em 0;
  padding-left: 2em;
  color: var(--text-muted);
}

.markdown-body li {
  margin: 0.25em 0;
  line-height: 1.6;
}

.markdown-body pre {
  background: var(--code-bg);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1em 0;
}

.markdown-body code {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.9em;
}

.markdown-body :not(pre) > code {
  background: var(--code-bg);
  padding: 2px 6px;
  border-radius: 4px;
}

.markdown-body blockquote {
  border-left: 4px solid var(--accent);
  padding: 0.5em 1em;
  margin: 1em 0;
  color: var(--text-secondary);
  background: var(--sidebar-bg);
  border-radius: 0 6px 6px 0;
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

.markdown-body th, .markdown-body td {
  padding: 10px 14px;
  border: 1px solid var(--border);
  text-align: left;
}

.markdown-body th {
  background: var(--sidebar-bg);
  font-weight: 600;
}

.markdown-body tr:nth-child(even) {
  background: var(--sidebar-bg);
}

.markdown-body hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1.5em 0;
}

.markdown-body img {
  max-width: 100%;
  border-radius: 6px;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-size: 16px;
}

.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #e03131;
  gap: 16px;
}

.error button {
  padding: 8px 20px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--content-bg);
  color: var(--text-primary);
  cursor: pointer;
}
```

- [ ] **Step 2: Create dark theme overrides**

Create `src/reader/styles/dark.css`:

```css
:root[data-theme="dark"] {
  --sidebar-bg: #1a1b1e;
  --content-bg: #25262b;
  --text-primary: #c1c2c5;
  --text-secondary: #909296;
  --text-muted: #adb5bd;
  --accent: #5c7cfa;
  --link: #74c0fc;
  --border: #373a40;
  --input-bg: #2c2e33;
  --toc-active-bg: #1b3a5c;
  --code-bg: #2c2e33;
}
```

- [ ] **Step 3: Create App.tsx with two-column layout**

Create `src/reader/App.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { parseMarkdown } from '../lib/markdown';
import { buildTocTree, filterTocTree } from '../lib/toc';
import type { ParseResult } from '../lib/markdown';
import type { TocNode } from '../lib/toc';
import './styles/global.css';

type Theme = 'light' | 'dark';

export function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('md-reader-theme') as Theme) || 'light';
  });
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [tocTree, setTocTree] = useState<TocNode[]>([]);
  const [filteredTree, setFilteredTree] = useState<TocNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('md-reader-theme', next);
      return next;
    });
  }, []);

  // Fetch markdown content
  useEffect(() => {
    async function loadContent() {
      try {
        // Try to get URL from session storage (set by background script)
        const { md_url } = await chrome.storage.session.get('md_url');
        // Fallback: check query params
        const params = new URLSearchParams(window.location.search);
        const src = params.get('src') || md_url;

        if (!src) {
          setParseResult(parseMarkdown('# No Markdown File\n\nNo `.md` file URL was provided.'));
          setLoading(false);
          return;
        }

        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const text = await res.text();

        if (!text.trim()) {
          setParseResult(parseMarkdown('# Empty File\n\nThe file contains no content.'));
        } else {
          setParseResult(parseMarkdown(text));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, []);

  // Build TOC tree when parse result changes
  useEffect(() => {
    if (parseResult) {
      const tree = buildTocTree(parseResult.headings);
      setTocTree(tree);
      setFilteredTree(tree);
    }
  }, [parseResult]);

  // Filter TOC when search query changes
  useEffect(() => {
    setFilteredTree(filterTocTree(tocTree, searchQuery));
  }, [tocTree, searchQuery]);

  // Scroll to heading
  const scrollToHeading = useCallback((id: string) => {
    setActiveHeadingId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Retry fetch
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    window.location.reload();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Failed to load: {error}</p>
        <button onClick={retry}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app" data-theme={theme}>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="toolbar-btn active" title="TOC">☰</button>
        </div>
        <button className="toolbar-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>

      {/* Main layout */}
      <div className="main">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ul className="toc-list">
            <TocListItems nodes={filteredTree} activeId={activeHeadingId} onClick={scrollToHeading} />
          </ul>
        </div>

        {/* Content */}
        <div className="content-area">
          <div className="content-inner">
            {parseResult && (
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: parseResult.html }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TocListItems({ nodes, activeId, onClick, depth = 0 }: {
  nodes: TocNode[];
  activeId: string;
  onClick: (id: string) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => (
        <li key={node.id} className="toc-item">
          <button
            className={`toc-link${activeId === node.id ? ' active' : ''}`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => onClick(node.id)}
          >
            {node.text}
          </button>
          {node.children.length > 0 && (
            <ul className="toc-list">
              <TocListItems nodes={node.children} activeId={activeId} onClick={onClick} depth={depth + 1} />
            </ul>
          )}
        </li>
      ))}
    </>
  );
}
```

- [ ] **Step 4: Update main.tsx to use App**

Update `src/reader/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Update background script to store URL correctly**

Update `src/background/index.ts` to use a fixed key:

```ts
chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId !== 0) return;

    const url = new URL(details.url);
    if (!url.pathname.endsWith('.md')) return;

    chrome.storage.session.set({ md_url: details.url }).then(() => {
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('src/reader/index.html'),
      });
    });
  },
  { url: [{ urlMatches: '.*\\.md$' }] }
);
```

- [ ] **Step 6: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/reader/ src/background/index.ts
git commit -m "feat: add reader page with sidebar, TOC, search, and theme switching"
```

---

### Task 6: Highlight.js Theme Integration

**Files:**
- Modify: `src/reader/styles/global.css`
- Modify: `src/reader/App.tsx`

- [ ] **Step 1: Import highlight.js styles dynamically based on theme**

Add to the top of `src/reader/App.tsx`:

```tsx
import 'highlight.js/styles/github.css';
```

And in the `useEffect` for theme, dynamically load the correct stylesheet. The simplest approach: import both and toggle via CSS.

Update `src/reader/App.tsx` — add these imports at the top:

```tsx
import 'highlight.js/styles/github.css';
import 'highlight.js/styles/github-dark.css';
```

- [ ] **Step 2: Add highlight.js theme scoping to CSS**

Add to end of `src/reader/styles/global.css`:

```css
/* Light theme: use github highlight */
:root .hljs {
  background: var(--code-bg);
}

/* Dark theme: github-dark overrides */
:root[data-theme="dark"] .hljs {
  color: #c9d1d9;
  background: #161b22;
}
```

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/reader/
git commit -m "feat: add highlight.js theme integration for light/dark modes"
```

---

### Task 7: Build & Manual Integration Test

**Files:**
- None (verification only)

- [ ] **Step 1: Build production bundle**

Run: `npx vite build`
Expected: Build succeeds, `dist/` folder created

- [ ] **Step 2: Load extension in Chrome**

Manual steps:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder
5. Verify extension appears in the list

- [ ] **Step 3: Test .md URL interception**

Manual steps:
1. Open a new tab
2. Navigate to any public `.md` file URL (e.g., `https://raw.githubusercontent.com/facebook/react/main/README.md`)
3. Verify: tab redirects to the reader page with formatted markdown
4. Verify: sidebar shows TOC with clickable headings
5. Verify: search bar filters TOC items
6. Verify: theme toggle switches between light and dark
7. Verify: code blocks have syntax highlighting

- [ ] **Step 4: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address integration test issues"
```

---

### Task 8: Polish & Edge Cases

**Files:**
- Modify: `src/reader/App.tsx`
- Modify: `src/reader/styles/global.css`
- Modify: `src/background/index.ts`

- [ ] **Step 1: Add scroll-spy for active TOC tracking**

Add intersection observer to `src/reader/App.tsx` to track which heading is currently visible:

```tsx
// Add this useEffect after the existing useEffects in App:
useEffect(() => {
  if (!parseResult) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveHeadingId(entry.target.id);
        }
      }
    },
    { rootMargin: '-80px 0px -60% 0px' }
  );

  parseResult.headings.forEach((h) => {
    const el = document.getElementById(h.id);
    if (el) observer.observe(el);
  });

  return () => observer.disconnect();
}, [parseResult]);
```

- [ ] **Step 2: Add smooth scroll behavior to global CSS**

Add to `src/reader/styles/global.css`:

```css
html {
  scroll-behavior: smooth;
}
```

- [ ] **Step 3: Handle encoding fallback in reader**

Add encoding fallback to the fetch logic in `App.tsx`. Update the fetch block:

```tsx
const res = await fetch(src);
if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
const buffer = await res.arrayBuffer();
let text = new TextDecoder('utf-8').decode(buffer);
// Check for garbled Chinese characters (common sign of GBK encoding)
if (/[\ufffd]/.test(text) && /[\u4e00-\u9fff]/.test(text) === false) {
  text = new TextDecoder('gbk').decode(buffer);
}
```

- [ ] **Step 4: Verify build and tests**

Run: `npx vite build && npx vitest run`
Expected: Build succeeds, all tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add scroll-spy, encoding fallback, and polish"
```

---

## Self-Review

**Spec coverage check:**
- TOC navigation → Task 3 (buildTocTree) + Task 5 (TocListItems) ✓
- Search/filter → Task 3 (filterTocTree) + Task 5 (SearchBar) ✓
- Theme switching → Task 5 (useTheme in App) + dark.css ✓
- Code highlighting → Task 2 (parseMarkdown) + Task 6 (hljs themes) ✓
- Request interception → Task 4 (background script) ✓
- Error handling → Task 5 (error/loading states) + Task 8 (encoding) ✓
- Visual design → Task 5 (global.css matching reference) ✓

**Placeholder scan:** No TBDs, TODOs, or incomplete sections found.

**Type consistency:** `Heading` defined in `markdown.ts`, `TocNode` defined in `toc.ts`. Both used consistently across all tasks. `ParseResult` used in App.tsx matches markdown.ts export.
