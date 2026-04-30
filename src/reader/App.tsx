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
        let md_url: string | undefined;
        try {
          const result = await chrome.storage.session.get('md_url');
          md_url = result.md_url;
        } catch {
          // chrome.storage may not be available in dev mode
        }
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
          <button className="toolbar-btn active" title="TOC">&#9776;</button>
        </div>
        <button className="toolbar-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? '\uD83C\uDF19' : '\u2600\uFE0F'}
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
