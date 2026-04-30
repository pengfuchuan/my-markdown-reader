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
