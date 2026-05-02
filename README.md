# Markdown Reader

A clean, free Chrome extension that replaces the browser's default plain-text rendering of `.md` files with a beautiful reading experience.

一个简洁、免费的 Chrome 扩展，用清晰的阅读界面替代浏览器默认的 `.md` 文件展示。

English | [中文](#功能)


## Features

- **Auto Intercept** — Automatically opens `.md` URLs in the reader (http / https / file://)
- **Local File Browser** — Open files or folders via the toolbar; sidebar shows a file tree
- **Table of Contents** — Auto-generated TOC with search, filter, and scroll-spy highlighting
- **Syntax Highlighting** — highlight.js powered, with language labels and one-click copy
- **Math** — KaTeX rendering for inline `$...$` and block `$$...$$` equations
- **Diagrams** — Mermaid support for flowcharts, sequence diagrams, Gantt charts, and more; source/diagram toggle, copy source, and theme sync with reader
- **GitHub Flavored** — Alerts (Note / Tip / Warning…), task lists, footnotes, highlight marks (`==text==`)
- **Export** — Export to PDF (smart page breaks) or long PNG image; print support
- **Themes** — Light and dark themes, persisted in localStorage
- **Adjustable Width** — Five content width presets (640px – 960px)
- **Encoding Fallback** — Auto-detects encoding; falls back from UTF-8 to GBK when mojibake is detected
- **Session Persistence** — Content survives page refresh

## 功能

- **自动拦截** — 浏览器访问 `.md` URL 时自动以阅读器打开（支持 http/https/file://）
- **本地文件浏览** — 通过工具栏按钮打开文件或文件夹，左侧显示文件树目录结构
- **大纲导航** — 自动生成目录树，支持搜索过滤和滚动追踪高亮
- **代码高亮** — highlight.js 语法着色，带语言标签和一键复制按钮
- **数学公式** — KaTeX 渲染行内 `$...$` 和块级 `$$...$$` 公式
- **Mermaid 图表** — 流程图、序列图、甘特图等自动渲染；支持源码/图表切换、复制源码、主题同步
- **GitHub 风格** — Alerts（Note / Tip / Warning…）、任务列表、脚注、高亮标记（`==text==`）
- **导出** — 导出为 PDF（智能分页）或长图 PNG，支持打印
- **主题切换** — 亮色 / 暗色主题，设置持久化
- **宽度调节** — 五档内容宽度预设（640px – 960px）
- **编码回退** — 自动检测编码，UTF-8 乱码时回退到 GBK
- **内容持久化** — 刷新页面后保留上次阅读的内容

## Screenshots

*Screenshots coming soon.*

## Install

### From Source

```bash
git clone https://github.com/pengfuchuan/my-markdown-reader.git
cd my-markdown-reader
npm install
npm run build
```

Load the extension in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist` directory

### For file:// URLs

To view local `.md` files via file:// protocol:

1. Go to `chrome://extensions/`
2. Find **Markdown Reader**
3. Click **Details**
4. Enable **Allow access to file URLs**

## Development

```bash
npm run dev      # Start dev server with HMR
npm run build    # Production build
npm run test     # Run tests
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript 6 |
| Build | Vite 8 + @crxjs/vite-plugin |
| Markdown | marked 18 (custom renderers + extensions) |
| Code Highlight | highlight.js 11 |
| Math | KaTeX 0.16 |
| Diagrams | Mermaid 11 (isolated iframe rendering) |
| Export | html2canvas + jsPDF |
| Testing | Vitest 3 + jsdom |
| Icons | sharp (SVG → PNG generation) |

## Project Structure

```
src/
├── background/index.ts        # Service worker — intercepts .md URL navigation
├── reader/
│   ├── App.tsx                # Main UI (toolbar, sidebar, content area)
│   ├── main.tsx               # Entry point
│   ├── index.html             # HTML template
│   └── styles/
│       ├── global.css         # Main styles + CSS variables
│       └── dark.css           # Dark theme overrides
├── lib/
│   ├── markdown.ts            # Markdown parsing (heading/code/alert/math/footnote…)
│   ├── fileSystem.ts          # File System Access API wrapper + IndexedDB
│   ├── toc.ts                 # TOC tree builder and search filter
│   └── mermaidRenderer.ts     # Mermaid iframe renderer bridge
└── mermaid-renderer/
    ├── index.html             # Isolated iframe page for Mermaid
    └── index.ts               # Mermaid init + message handling

scripts/
└── generate-icons.mjs         # SVG → PNG icon generation
docs/
└── demo.md                    # Feature demo document
```

## Known Limitations

- Local file changes are not auto-detected on refresh (Chrome File System Access API permission constraint) — re-open the file to see updates
- `file://` URLs require enabling "Allow access to file URLs" in extension settings
- The address bar cannot display the local file path (Chrome extension security constraint) — the filename is shown in the toolbar instead

## Contributing

Issues and pull requests are welcome at [GitHub Issues](https://github.com/pengfuchuan/my-markdown-reader/issues).

## License

[MIT](LICENSE) © pengfuchuan
