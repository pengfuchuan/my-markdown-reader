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
- **Diagrams** — Mermaid support for flowcharts, sequence diagrams, Gantt charts, and more
- **GitHub Flavored** — Alerts (Note / Tip / Warning…), task lists, footnotes, highlight marks (`==text==`)
- **Export** — Export to PDF (smart page breaks) or long PNG image; print support
- **Themes** — Light and dark themes
- **Session Persistence** — Content survives page refresh

## 功能

- **自动拦截** — 浏览器访问 `.md` URL 时自动以阅读器打开（支持 http/https/file://）
- **本地文件浏览** — 通过工具栏按钮打开文件或文件夹，左侧显示文件树目录结构
- **大纲导航** — 自动生成目录树，支持搜索过滤和滚动追踪高亮
- **代码高亮** — highlight.js 语法着色，带语言标签和一键复制按钮
- **数学公式** — KaTeX 渲染行内 `$...$` 和块级 `$$...$$` 公式
- **Mermaid 图表** — 流程图、序列图、甘特图等自动渲染
- **GitHub 风格** — Alerts（Note / Tip / Warning…）、任务列表、脚注、高亮标记（`==text==`）
- **导出** — 导出为 PDF（智能分页）或长图 PNG，支持打印
- **主题切换** — 亮色 / 暗色主题
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
| UI | React 19 + TypeScript |
| Build | Vite 8 + @crxjs/vite-plugin |
| Markdown | marked 18 (custom renderers + extensions) |
| Code Highlight | highlight.js |
| Math | KaTeX |
| Diagrams | Mermaid |
| Export | html2canvas + jsPDF |
| Testing | Vitest + jsdom |

## Project Structure

```
src/
├── background/index.ts    # Service worker — intercepts .md URL navigation
├── reader/
│   ├── App.tsx            # Main UI (toolbar, sidebar, content area)
│   ├── main.tsx           # Entry point
│   ├── index.html         # HTML template
│   └── styles/
│       ├── global.css     # Main styles + CSS variables
│       └── dark.css       # Dark theme overrides
└── lib/
    ├── markdown.ts        # Markdown parsing (heading/code/alert/math/footnote…)
    ├── fileSystem.ts      # File System Access API wrapper
    └── toc.ts             # TOC tree builder and search filter
```

## Known Limitations

- Local file changes are not auto-detected on refresh (Chrome File System Access API permission constraint) — re-open the file to see updates
- `file://` URLs require enabling "Allow access to file URLs" in extension settings
- The address bar cannot display the local file path (Chrome extension security constraint) — the filename is shown in the toolbar instead

## Contributing

Issues and pull requests are welcome at [GitHub Issues](https://github.com/pengfuchuan/my-markdown-reader/issues).

## License

[MIT](LICENSE) © pengfuchuan
