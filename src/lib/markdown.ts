import { Marked, type Token, type Tokens } from 'marked';
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
      heading({ tokens, depth }: Tokens.Heading) {
        // Extract plain text from inline tokens
        const text = extractText(tokens);
        const id = `heading-${counter++}`;
        headings.push({ level: depth, text, id });
        return `<h${depth} id="${id}">${text}</h${depth}>`;
      },
      code({ text, lang }: Tokens.Code) {
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
