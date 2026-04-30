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
