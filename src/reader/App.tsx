import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { parseMarkdown } from '../lib/markdown';
import { renderMermaidSvg } from '../lib/mermaidRenderer';
import { buildTocTree, filterTocTree } from '../lib/toc';
import { openFile, openDirectory, readFileContent, restoreLastDirectory, restoreLastFile, storeFileName, isMarkdownFile } from '../lib/fileSystem';
import type { ParseResult } from '../lib/markdown';
import type { TocNode } from '../lib/toc';
import type { FileTreeNode } from '../lib/fileSystem';
import './styles/global.css';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

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
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const markdownBodyRef = useRef<HTMLDivElement>(null);
  const [showBackTop, setShowBackTop] = useState(false);

  // File tree state
  const [activeTab, setActiveTab] = useState<'files' | 'toc'>('toc');
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [currentFileName, setCurrentFileName] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Source URL for display
  const sourceUrlRef = useRef<string>('');

  // Update document title when file changes
  useEffect(() => {
    if (currentFileName) {
      document.title = currentFileName;
    } else if (sourceUrlRef.current) {
      try {
        document.title = decodeURIComponent(new URL(sourceUrlRef.current).pathname.split('/').pop() || '');
      } catch {
        document.title = 'Markdown Reader';
      }
    } else {
      document.title = 'Markdown Reader';
    }
  }, [currentFileName, parseResult]);

  // Sync theme to document element for CSS variable matching
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Code copy button — event delegation on content area
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    function handleClick(e: MouseEvent) {
      // Code block copy button
      const codeBtn = (e.target as HTMLElement).closest('.code-copy-btn') as HTMLButtonElement | null;
      if (codeBtn) {
        const code = codeBtn.getAttribute('data-code');
        if (code) {
          navigator.clipboard.writeText(code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')).then(() => {
            codeBtn.classList.add('copied');
            codeBtn.title = 'Copied!';
            setTimeout(() => { codeBtn.classList.remove('copied'); codeBtn.title = 'Copy'; }, 2000);
          });
        }
        return;
      }

      // Mermaid copy button
      const mermaidBtn = (e.target as HTMLElement).closest('.mermaid-copy-btn') as HTMLButtonElement | null;
      if (mermaidBtn) {
        const code = mermaidBtn.getAttribute('data-code');
        if (code) {
          navigator.clipboard.writeText(code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')).then(() => {
            mermaidBtn.classList.add('copied');
            mermaidBtn.title = 'Copied!';
            setTimeout(() => { mermaidBtn.classList.remove('copied'); mermaidBtn.title = 'Copy source'; }, 2000);
          });
        }
        return;
      }
    }

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [parseResult]);

  // Back-to-top visibility
  useEffect(() => {
    const area = contentAreaRef.current;
    if (!area) return;
    function onScroll() {
      setShowBackTop(area.scrollTop > 300);
    }
    area.addEventListener('scroll', onScroll, { passive: true });
    return () => area.removeEventListener('scroll', onScroll);
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportOpen]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('md-reader-theme', next);
      return next;
    });
  }, []);

  // Persist content to session storage so refresh works
  const persistContent = useCallback((content: string, fileName: string) => {
    try {
      chrome.storage.session.set({ md_content: content, md_filename: fileName });
    } catch {
      // chrome.storage not available in dev mode
    }
  }, []);

  // Open a local .md file
  const handleOpenFile = useCallback(async () => {
    try {
      const result = await openFile();
      setCurrentFileName(result.fileName);
      setFileTree(result.tree);
      setParseResult(parseMarkdown(result.content));
      persistContent(result.content, result.fileName);
      setLoading(false);
      setError(null);
      setActiveTab(result.tree.length > 0 ? 'toc' : 'toc');
    } catch {
      // User cancelled
    }
  }, [persistContent]);

  // Store file handle when clicking a file in the tree
  const handleFileClick = useCallback(async (node: FileTreeNode) => {
    if (!isMarkdownFile(node.name) || node.kind !== 'file') return;
    try {
      const content = await readFileContent(node.handle as FileSystemFileHandle);
      setCurrentFileName(node.name);
      setParseResult(parseMarkdown(content));
      persistContent(content, node.name);
      storeFileName(node.name);
      setActiveTab('toc');
    } catch {
      // File read error
    }
  }, [persistContent]);

  // Open a local directory
  const handleOpenDirectory = useCallback(async () => {
    try {
      const result = await openDirectory();
      setFileTree(result.tree);
      setCurrentFileName('');
      setActiveTab('files');
    } catch {
      // User cancelled
    }
  }, []);

  // Restore last opened directory on mount
  useEffect(() => {
    restoreLastDirectory().then((result) => {
      if (result) {
        setFileTree(result.tree);
      }
    }).catch(() => {});
  }, []);

  // Toggle directory expansion
  const handleToggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Fetch markdown content
  useEffect(() => {
    async function loadContent() {
      try {
        let md_url: string | undefined;
        let md_content: string | undefined;
        let md_filename: string | undefined;
        try {
          const result = await chrome.storage.session.get(['md_url', 'md_content', 'md_filename']);
          md_url = result.md_url;
          md_content = result.md_content;
          md_filename = result.md_filename;
        } catch {
          // chrome.storage may not be available in dev mode
        }
        const params = new URLSearchParams(window.location.search);
        const src = params.get('src') || md_url;
        if (src) sourceUrlRef.current = src;

        // Try to re-read file from disk first (detects changes on refresh)
        const diskFile = await restoreLastFile();
        if (diskFile) {
          setCurrentFileName(diskFile.fileName);
          setParseResult(parseMarkdown(diskFile.content));
          persistContent(diskFile.content, diskFile.fileName);
          setLoading(false);
          return;
        }

        // Content pre-loaded (file:// URLs or restored from last session)
        if (md_content) {
          if (md_filename) setCurrentFileName(md_filename);
          setParseResult(parseMarkdown(md_content));
          setLoading(false);
          return;
        }

        if (!src) {
          setParseResult(parseMarkdown('# No Markdown File\n\nNo `.md` file URL was provided.'));
          setLoading(false);
          return;
        }

        // file:// URLs without pre-loaded content — show hint
        if (src.startsWith('file://')) {
          setParseResult(parseMarkdown(
            '# 本地文件\n\n' +
            '请使用工具栏的 **打开文件** 按钮来选择本地 Markdown 文件。'
          ));
          setLoading(false);
          return;
        }

        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const buffer = await res.arrayBuffer();
        let text = new TextDecoder('utf-8').decode(buffer);
        if (/\ufffd/.test(text) && !/[\u4e00-\u9fff]/.test(text)) {
          try {
            text = new TextDecoder('gbk').decode(buffer);
          } catch {
            // Keep UTF-8 result if GBK decoding fails
          }
        }

        if (!text.trim()) {
          setParseResult(parseMarkdown('# Empty File\n\nThe file contains no content.'));
        } else {
          setParseResult(parseMarkdown(text));
          // Extract filename from URL and persist for refresh
          const fileName = decodeURIComponent(src.split('/').pop() || 'document.md');
          setCurrentFileName(fileName);
          persistContent(text, fileName);
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

  // Scroll-spy: track active heading on scroll
  useEffect(() => {
    if (!parseResult || !contentAreaRef.current) return;
    const area = contentAreaRef.current;

    function update() {
      const areaRect = area.getBoundingClientRect();
      const threshold = areaRect.top + 120;
      let activeId = '';
      for (const h of parseResult.headings) {
        const el = document.getElementById(h.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= threshold) {
          activeId = h.id;
        }
      }
      if (activeId) setActiveHeadingId(activeId);
    }

    area.addEventListener('scroll', update, { passive: true });
    update();
    return () => area.removeEventListener('scroll', update);
  }, [parseResult]);

  // Per-block mermaid state: id → mode
  const mermaidModesRef = useRef<Map<string, 'source' | 'diagram'>>(new Map());
  // SVG cache: id → svg string
  const mermaidCacheRef = useRef<Map<string, string>>(new Map());

  // Restore mermaid state after React re-renders (runs before browser paint)
  useLayoutEffect(() => {
    const body = markdownBodyRef.current;
    if (!body) return;
    const modes = mermaidModesRef.current;
    if (modes.size === 0) return;

    for (const [id, mode] of modes) {
      const wrapper = document.getElementById(id);
      if (!wrapper) continue;
      wrapper.setAttribute('data-mode', mode);
      const label = wrapper.querySelector('.mermaid-toggle-btn span');
      if (label) label.textContent = mode === 'diagram' ? 'Show Source' : 'Show Diagram';

      if (mode === 'diagram') {
        const diagramEl = wrapper.querySelector('.mermaid-diagram') as HTMLElement;
        if (diagramEl && !diagramEl.querySelector('svg')) {
          const cached = mermaidCacheRef.current.get(id);
          if (cached) diagramEl.innerHTML = cached;
        }
      }
    }
  });

  // Mermaid toggle — event delegation, per-block
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    async function handleClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest('.mermaid-toggle-btn') as HTMLButtonElement | null;
      if (!btn) return;

      const wrapper = btn.closest('.mermaid-wrapper') as HTMLElement | null;
      if (!wrapper) return;

      const id = wrapper.id;
      const current = wrapper.getAttribute('data-mode') || 'source';
      const next = current === 'source' ? 'diagram' : 'source';

      wrapper.setAttribute('data-mode', next);
      mermaidModesRef.current.set(id, next);

      const label = btn.querySelector('span');
      if (label) label.textContent = next === 'diagram' ? 'Show Source' : 'Show Diagram';

      if (next === 'diagram') {
        const diagramEl = wrapper.querySelector('.mermaid-diagram') as HTMLElement;
        if (!diagramEl) return;

        const cached = mermaidCacheRef.current.get(id);
        if (cached) {
          diagramEl.innerHTML = cached;
          return;
        }

        diagramEl.innerHTML = '<div class="mermaid-loading">Rendering diagram...</div>';
        const raw = wrapper.getAttribute('data-raw') || '';
        const source = raw.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

        try {
          const svg = await renderMermaidSvg(source);
          mermaidCacheRef.current.set(id, svg);
          diagramEl.innerHTML = svg;
        } catch (err) {
          console.error('[Mermaid] Render error:', err);
          diagramEl.innerHTML = `<div class="mermaid-error"><p>${err instanceof Error ? err.message : 'Unknown error'}</p></div>`;
        }
      }
    }

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [parseResult]);

  const scrollToHeading = useCallback((id: string) => {
    setActiveHeadingId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    window.location.reload();
  }, []);

  // Export as PDF — smart page breaks at element boundaries
  const exportPDF = useCallback(async () => {
    setExportOpen(false);
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const el = contentRef.current;
      const mdBody = el.querySelector('.markdown-body') as HTMLElement;
      if (!mdBody) return;

      // Render full content to canvas
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollY: -window.scrollY,
        height: el.scrollHeight,
        width: el.scrollWidth,
      });

      // Collect element break points — top of each top-level child
      const children = Array.from(mdBody.children) as HTMLElement[];
      const baseRect = el.getBoundingClientRect();
      const pxToCanvas = canvas.height / el.scrollHeight;

      const breakPoints: number[] = [0];
      for (const child of children) {
        const relTop = child.getBoundingClientRect().top - baseRect.top;
        const cy = Math.round(relTop * pxToCanvas);
        if (cy > 0) breakPoints.push(cy);
      }
      breakPoints.push(canvas.height);

      // A4 dimensions
      const margin = 10;
      const cw = 210 - margin * 2;
      const ch = 297 - margin * 2;
      const pxPerMm = canvas.width / cw;
      const pagePx = Math.floor(ch * pxPerMm);

      // Calculate smart page boundaries — snap to element gaps
      const boundaries: number[] = [0];
      let cur = 0;

      while (cur < canvas.height) {
        const ideal = cur + pagePx;
        if (ideal >= canvas.height) {
          boundaries.push(canvas.height);
          break;
        }

        // Find nearest element gap to ideal break, within ±20% tolerance
        let best = ideal;
        let bestDist = Infinity;
        const tolerance = pagePx * 0.2;

        for (const bp of breakPoints) {
          if (bp <= cur + pagePx * 0.5) continue; // too early, wastes space
          const dist = Math.abs(bp - ideal);
          if (dist <= tolerance && dist < bestDist) {
            best = bp;
            bestDist = dist;
          }
        }

        boundaries.push(best);
        cur = best;
      }

      // Generate PDF with one cropped canvas per page
      const pdf = new jsPDF('p', 'mm', 'a4');

      for (let i = 0; i < boundaries.length - 1; i++) {
        if (i > 0) pdf.addPage();

        const srcY = boundaries[i];
        const srcH = boundaries[i + 1] - srcY;
        if (srcH <= 0) continue;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        const pageHmm = srcH / pxPerMm;
        pdf.addImage(
          pageCanvas.toDataURL('image/jpeg', 0.92),
          'JPEG',
          margin,
          margin,
          cw,
          pageHmm
        );
      }

      pdf.save('markdown-export.pdf');
    } finally {
      setExporting(false);
    }
  }, []);

  // Export as high-res long image (PNG)
  const exportImage = useCallback(async () => {
    setExportOpen(false);
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const el = contentRef.current;
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: theme === 'dark' ? '#1c1c1e' : '#ffffff',
        logging: false,
        width: el.scrollWidth,
        height: el.scrollHeight,
      });
      const link = document.createElement('a');
      link.download = 'markdown-export.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  }, [theme]);

  // Print
  const handlePrint = useCallback(() => {
    setExportOpen(false);
    window.print();
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
      <div className="toolbar no-print">
        <div className="toolbar-left">
          <button className="toolbar-btn" onClick={handleOpenFile} title="Open file" aria-label="Open file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="12" x2="12" y2="18" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </button>
          <button className="toolbar-btn" onClick={handleOpenDirectory} title="Open folder" aria-label="Open folder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
        </div>
        <div className="toolbar-center">
          <span className="toolbar-filename">
            {currentFileName || (sourceUrlRef.current ? decodeURIComponent(sourceUrlRef.current.split('/').pop() || '') : '')}
          </span>
        </div>
        <div className="toolbar-right">
          {/* Export dropdown */}
          <div className="export-menu" ref={exportMenuRef}>
            <button
              className="toolbar-btn"
              title="Export"
              aria-label="Export"
              onClick={() => setExportOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {exportOpen && (
              <div className="export-dropdown">
                <button className="export-option" onClick={exportPDF} disabled={exporting}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Export as PDF
                </button>
                <button className="export-option" onClick={exportImage} disabled={exporting}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Export as Image
                </button>
                <div className="export-divider" />
                <button className="export-option" onClick={handlePrint}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print
                </button>
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button className="toolbar-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Exporting overlay */}
      {exporting && (
        <div className="export-overlay">
          <div className="export-overlay-content">
            <div className="export-spinner" />
            <span>Generating...</span>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="main">
        {/* Sidebar */}
        <div className="sidebar no-print">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab${activeTab === 'files' ? ' active' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              文件
            </button>
            <button
              className={`sidebar-tab${activeTab === 'toc' ? ' active' : ''}`}
              onClick={() => setActiveTab('toc')}
            >
              大纲
            </button>
          </div>
          <div className="sidebar-content">
            {activeTab === 'files' && (
              fileTree.length === 0 ? (
                <div className="file-tree-empty">
                  点击上方按钮打开文件或文件夹
                </div>
              ) : (
                <FileTree
                  nodes={fileTree}
                  currentFileName={currentFileName}
                  expandedDirs={expandedDirs}
                  onToggleDir={handleToggleDir}
                  onFileClick={handleFileClick}
                />
              )
            )}
            {activeTab === 'toc' && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="content-area" ref={contentAreaRef}>
          <div className="content-inner" ref={contentRef}>
            {parseResult && (
              <div
                ref={markdownBodyRef}
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: parseResult.html }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Back to top */}
      <button
        className={`back-to-top no-print${showBackTop ? ' visible' : ''}`}
        onClick={() => contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
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

function FileTree({ nodes, currentFileName, expandedDirs, onToggleDir, onFileClick, depth = 0 }: {
  nodes: FileTreeNode[];
  currentFileName: string;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onFileClick: (node: FileTreeNode) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isMd = isMarkdownFile(node.name);
        const isActive = node.kind === 'file' && node.name === currentFileName;
        const isExpanded = expandedDirs.has(node.path);

        return (
          <div key={node.path}>
            <button
              className={`tree-item${isActive ? ' active' : ''}${!isMd && node.kind === 'file' ? ' disabled' : ''}`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              onClick={() => {
                if (node.kind === 'directory') onToggleDir(node.path);
                else if (isMd) onFileClick(node);
              }}
            >
              {node.kind === 'directory' ? (
                <>
                  <span className={`tree-arrow${isExpanded ? ' open' : ''}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                  <span className="tree-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                </>
              ) : (
                <>
                  <span className="tree-icon" style={{ opacity: 0 }}>
                    <svg viewBox="0 0 24 24" width="14" height="14"><rect /></svg>
                  </span>
                  <span className="tree-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </span>
                </>
              )}
              <span className="tree-name">{node.name}</span>
            </button>
            {node.kind === 'directory' && isExpanded && node.children && (
              <FileTree
                nodes={node.children}
                currentFileName={currentFileName}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                onFileClick={onFileClick}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
