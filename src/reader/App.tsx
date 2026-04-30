import { useState, useEffect, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { parseMarkdown } from '../lib/markdown';
import { buildTocTree, filterTocTree } from '../lib/toc';
import type { ParseResult } from '../lib/markdown';
import type { TocNode } from '../lib/toc';
import './styles/global.css';
import 'highlight.js/styles/github.css';
import 'highlight.js/styles/github-dark.css';

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
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Sync theme to document element for CSS variable matching
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  // Fetch markdown content
  useEffect(() => {
    async function loadContent() {
      try {
        let md_url: string | undefined;
        try {
          const result = await chrome.storage.session.get('md_url');
          md_url = result.md_url;
        } catch {
          // chrome.storage may not be available in dev mode
        }
        const params = new URLSearchParams(window.location.search);
        const src = params.get('src') || md_url;

        if (!src) {
          setParseResult(parseMarkdown('# No Markdown File\n\nNo `.md` file URL was provided.'));
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

  // Scroll-spy: track active heading via IntersectionObserver
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

  const scrollToHeading = useCallback((id: string) => {
    setActiveHeadingId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    window.location.reload();
  }, []);

  // Export as PDF (uses browser print with print-optimized CSS)
  const exportPDF = useCallback(() => {
    setExportOpen(false);
    window.print();
  }, []);

  // Export as long image (PNG)
  const exportImage = useCallback(async () => {
    setExportOpen(false);
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme === 'dark' ? '#1c1c1e' : '#ffffff',
        logging: false,
      });
      const link = document.createElement('a');
      link.download = 'markdown-export.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  }, [theme]);

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
          <button className="toolbar-btn active" title="TOC" aria-label="Table of Contents">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
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
                <button className="export-option" onClick={exportPDF}>
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
                  {exporting ? 'Exporting...' : 'Export as Image'}
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
            <span>Generating image...</span>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="main">
        {/* Sidebar */}
        <div className="sidebar no-print">
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
          <div className="content-inner" ref={contentRef}>
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
