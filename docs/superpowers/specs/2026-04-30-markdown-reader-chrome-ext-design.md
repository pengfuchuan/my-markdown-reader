# Markdown Reader Chrome Extension — Design Spec

## Overview

A Chrome extension (Manifest V3) that intercepts `.md` file requests and renders them in a clean, reader-friendly layout with TOC navigation, search, theme switching, and code highlighting.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite + @crxjs/vite-plugin
- **Markdown**: marked (parsing) + highlight.js (code highlighting)
- **Chrome API**: Manifest V3

## Architecture

```
Chrome Extension (Manifest V3)
├── background.js (Service Worker) — intercept .md requests
├── reader.html (Extension Page)   — render markdown in new tab
```

**Workflow**:
1. User navigates to a `.md` URL in Chrome
2. `background.js` intercepts the request via `onBeforeRequest`
3. Fetches raw markdown text from the URL
4. Redirects current tab to `reader.html?src=<original_url>`
5. Reader page fetches content via `src` parameter and renders it

For local files (`file://`): requires "Allow access to file URLs" in extension settings. User selects file, content is read and passed to the reader page.

## Directory Structure

```
my-markdown-reader/
├── public/
│   └── manifest.json
├── src/
│   ├── background/
│   │   └── index.ts
│   ├── reader/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TocList.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   └── MarkdownContent.tsx
│   │   ├── hooks/
│   │   │   ├── useMarkdown.ts
│   │   │   ├── useToc.ts
│   │   │   └── useTheme.ts
│   │   └── styles/
│   │       ├── global.css
│   │       ├── light.css
│   │       └── dark.css
│   └── lib/
│       └── markdown.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Core Features

### 1. TOC Navigation

- `marked.walkTokens` extracts all headings during parsing
- Each heading gets a unique ID (e.g., `h1-0`, `h2-1-0`)
- Builds a tree structure: `{ level, text, id, children[] }`
- TocList renders recursively with indentation
- Click scrolls to heading via `scrollIntoView()`

### 2. Search / Filter

- Text input filters TOC tree by keyword match
- Preserves parent chain for matched nodes
- Real-time filtering on input

### 3. Theme Switching

- Two themes: light (default) and dark
- CSS variables on `:root` / `[data-theme="dark"]`
- Persisted in `localStorage`
- highlight.js theme follows the active theme

### 4. Code Highlighting

- highlight.js integrated with marked renderer
- Auto-detect language when not specified
- Theme switches with light/dark mode

## Visual Design

### Layout

```
┌──────────────────────────────────────────────┐
│ Toolbar: [icons]              [theme toggle] │
├─────────────┬────────────────────────────────┤
│  Sidebar    │  Content Area                  │
│  (280px)    │  (flex: 1, max-width: 900px)   │
│  ┌────────┐ │                                │
│  │ Filter │ │  Heading + metadata + body     │
│  └────────┘ │                                │
│  TOC tree   │                                │
│             │                                │
├─────────────┴────────────────────────────────┤
```

### Color Variables

```css
/* Light theme */
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

/* Dark theme */
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
```

### Styling Details

- Sidebar fixed width 280px
- Content area max-width 900px, centered
- Heading spacing: h1 2em, h2 1.5em, h3 1.25em
- Code blocks: rounded corners, monospace font, themed background
- Tables: zebra striping, rounded borders
- Theme toggle: sun/moon icon in toolbar

## Error Handling

| Scenario | Handling |
|----------|----------|
| Fetch failure | Error page with retry button |
| Empty file | "File is empty" message |
| Non-.md false positive | Only intercept `Content-Type: text/plain` + `.md` extension |
| Encoding issues | Default UTF-8, fallback to GBK/GB2312 for Chinese files |
| Large files (>5MB) | Render normally (virtual scroll deferred to future) |
| Local file:// | Requires user to enable "Allow access to file URLs" |

## Out of Scope (v1)

- Markdown editing
- Multi-file / folder management
- Export to PDF
- Bookmarks / favorites
- Print optimization
- Resizable sidebar
- Mobile adaptation
