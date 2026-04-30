import type { Heading } from './markdown';

export interface TocNode {
  level: number;
  text: string;
  id: string;
  children: TocNode[];
}

export function buildTocTree(headings: Heading[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const h of headings) {
    const node: TocNode = { ...h, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

export function filterTocTree(tree: TocNode[], query: string): TocNode[] {
  if (!query) return tree;
  const lower = query.toLowerCase();

  function filterNode(node: TocNode): TocNode | null {
    const childMatches = node.children
      .map(filterNode)
      .filter((n): n is TocNode => n !== null);

    if (node.text.toLowerCase().includes(lower) || childMatches.length > 0) {
      return { ...node, children: childMatches };
    }
    return null;
  }

  return tree.map(filterNode).filter((n): n is TocNode => n !== null);
}
