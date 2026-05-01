import { Marked, type Token, type Tokens, type Extension } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface ParseResult {
  html: string;
  headings: Heading[];
}

// ── Alert types ──

const ALERT_TYPES: Record<string, { label: string; icon: string }> = {
  NOTE:     { label: 'Note',     icon: 'ℹ️' },
  TIP:      { label: 'Tip',      icon: '💡' },
  IMPORTANT:{ label: 'Important',icon: '❗' },
  WARNING:  { label: 'Warning',  icon: '⚠️' },
  CAUTION:  { label: 'Caution',  icon: '🔥' },
};

// ── Footnote state (per parse) ──

let footnotes: Record<string, string> = {};
let footnoteOrder: string[] = [];

// ── Helpers ──

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extractText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if ('text' in token) {
        if ('tokens' in token && token.tokens) {
          return extractText(token.tokens);
        }
        return token.text as string;
      }
      return '';
    })
    .join('');
}

// ── Math rendering ──

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      trust: true,
    });
  } catch {
    return `<span class="math-error">${escapeHtml(tex)}</span>`;
  }
}

// ── Mermaid rendering (deferred to App.tsx via mermaid.run()) ──

let mermaidId = 0;

function renderMermaid(code: string): string {
  const id = `mermaid-${mermaidId++}`;
  // Use data-raw to store the unescaped source for mermaid.run()
  const raw = escapeAttr(code);
  return `<div class="mermaid-wrapper" id="${id}"><div class="mermaid" data-raw="${raw}">${escapeHtml(code)}</div></div>`;
}

// ── Inline math extension: $...$ ──

const mathExtension: Extension = {
  name: 'inlineMath',
  level: 'inline',
  start(src) {
    return src.indexOf('$');
  },
  tokenizer(src) {
    // Match $...$ but not $$...$$ (next char must not be $)
    const match = src.match(/^\$([^\$\n]+?)\$(?!\$)/);
    if (match) {
      return {
        type: 'inlineMath',
        raw: match[0],
        text: match[1],
      };
    }
  },
  renderer({ text }) {
    return renderMath(text, false);
  },
};

// ── Highlight mark extension: ==text== ──

const highlightExtension: Extension = {
  name: 'highlightMark',
  level: 'inline',
  start(src) {
    return src.indexOf('==');
  },
  tokenizer(src) {
    const match = src.match(/^==([^=]+)==/);
    if (match) {
      return {
        type: 'highlightMark',
        raw: match[0],
        text: match[1],
      };
    }
  },
  renderer({ text }) {
    return `<mark>${text}</mark>`;
  },
};

// ── Footnote ref extension: [^id] ──

const footnoteRefExtension: Extension = {
  name: 'footnoteRef',
  level: 'inline',
  start(src) {
    return src.indexOf('[^');
  },
  tokenizer(src) {
    const match = src.match(/^\[\^([^\]]+)\]/);
    if (match) {
      return {
        type: 'footnoteRef',
        raw: match[0],
        id: match[1],
      };
    }
  },
  renderer({ id }) {
    const num = footnoteOrder.indexOf(id) + 1;
    if (num === 0) {
      footnoteOrder.push(id);
      return `<sup class="footnote-ref" id="fnref-${escapeAttr(id)}"><a href="#fn-${escapeAttr(id)}">${footnoteOrder.length}</a></sup>`;
    }
    return `<sup class="footnote-ref" id="fnref-${escapeAttr(id)}"><a href="#fn-${escapeAttr(id)}">${num}</a></sup>`;
  },
};

// ── Main parse function ──

export function parseMarkdown(md: string): ParseResult {
  const headings: Heading[] = [];
  let counter = 0;
  footnotes = {};
  footnoteOrder = [];
  mermaidId = 0;

  const markedInstance = new Marked();

  // Collect footnote definitions: [^id]: content
  const footnoteDefRegex = /^\[\^([^\]]+)\]:\s+(.+)$/gm;
  let fnMatch;
  while ((fnMatch = footnoteDefRegex.exec(md)) !== null) {
    footnotes[fnMatch[1]] = fnMatch[2];
  }

  markedInstance.use({
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const text = extractText(tokens);
        const id = `heading-${counter++}`;
        headings.push({ level: depth, text, id });
        return `<h${depth} id="${id}"><a class="heading-anchor" href="#${id}" aria-hidden="true"><span class="anchor-icon">#</span></a>${text}</h${depth}>`;
      },
      code({ text, lang }: Tokens.Code) {
        // Mermaid diagrams
        if (lang === 'mermaid') {
          return renderMermaid(text);
        }

        // Block math: $$...$$
        if (lang === 'math' || lang === 'latex' || lang === 'tex') {
          return `<div class="math-block">${renderMath(text, true)}</div>`;
        }

        // Normal code
        let highlighted: string;
        let language = lang || '';
        if (language && hljs.getLanguage(language)) {
          highlighted = hljs.highlight(text, { language }).value;
        } else {
          highlighted = hljs.highlightAuto(text).value;
        }
        const langLabel = language ? `<span class="code-lang">${escapeHtml(language)}</span>` : '';
        return `<div class="code-block"><div class="code-header">${langLabel}<button class="code-copy-btn" data-code="${escapeAttr(text)}" title="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div><pre><code class="hljs">${highlighted}</code></pre></div>`;
      },
      blockquote({ text }: Tokens.Blockquote) {
        // GitHub alert/callout: > [!NOTE]\n> content
        const alertMatch = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?([\s\S]*)/i);
        if (alertMatch) {
          const type = alertMatch[1].toUpperCase();
          const alert = ALERT_TYPES[type];
          const content = alertMatch[2].replace(/^>\s?/gm, '').trim();
          if (alert) {
            return `<div class="alert alert-${type.toLowerCase()}"><p class="alert-title">${alert.icon} ${alert.label}</p>${content}</div>`;
          }
        }
        return `<blockquote>${text}</blockquote>`;
      },
      link({ href, text }: Tokens.Link) {
        const isExternal = href.startsWith('http://') || href.startsWith('https://');
        if (isExternal) {
          return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return `<a href="${escapeAttr(href)}">${text}</a>`;
      },
      listitem(token: Tokens.ListItem) {
        // Use this.parser.parse() on the full tokens array — same as marked default.
        // This correctly handles nested lists, paragraphs, and inline tokens.
        const body = this.parser.parse(token.tokens);
        if (token.task) {
          // Remove the default checkbox that this.parser.parse() generates
          const cleanedBody = body.replace(/<input[^>]*type="checkbox"[^>]*>\s?/i, '');
          const checkbox = `<input type="checkbox" class="task-checkbox" ${token.checked ? 'checked' : ''} disabled />`;
          return `<li class="task-item">${checkbox}${cleanedBody}</li>`;
        }
        return `<li>${body}</li>`;
      },
    },
    extensions: [mathExtension, highlightExtension, footnoteRefExtension],
  });

  // Remove footnote definition lines before parsing
  let processed = md.replace(/^\[\^([^\]]+)\]:\s+.+$/gm, '').trim();

  // Handle block math: $$...$$ (not inside backtick code spans)
  // Step 1: Temporarily replace backtick code spans with placeholders
  const placeholders: string[] = [];
  processed = processed.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    return `\x00MATHCODE${idx}\x00`;
  });

  // Step 2: Replace $$...$$ with fenced math code blocks
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_match, tex) => {
    return `\`\`\`math\n${tex.trim()}\n\`\`\``;
  });

  // Step 3: Restore backtick code spans
  processed = processed.replace(/\x00MATHCODE(\d+)\x00/g, (_match, idx) => {
    return placeholders[parseInt(idx)];
  });

  const html = markedInstance.parse(processed) as string;

  // Append footnote section if any
  let footnoteHtml = '';
  if (footnoteOrder.length > 0) {
    footnoteHtml = '<section class="footnotes"><ol>';
    for (const id of footnoteOrder) {
      const content = footnotes[id] || '';
      footnoteHtml += `<li id="fn-${escapeAttr(id)}"><p>${content}<a href="#fnref-${escapeAttr(id)}" class="footnote-backref">↩</a></p></li>`;
    }
    footnoteHtml += '</ol></section>';
  }

  return { html: html + footnoteHtml, headings };
}
