import { describe, it, expect } from 'vitest';
import {
  buildTree, flattenTree, getDescendantIds, subtreeHeight,
  depthOf, canHaveChild, removeChildrenOf, getProjection, computeMove,
  MAX_DEPTH,
} from './documentTree';

// Helper: terse doc factory.
const d = (id, parentId = null, order = 0, extra = {}) => ({ id, parentId, order, ...extra });

describe('buildTree', () => {
  it('nests children under parents and sorts siblings by order', () => {
    const docs = [d('b', null, 1), d('a', null, 0), d('a1', 'a', 1), d('a0', 'a', 0)];
    const tree = buildTree(docs);
    expect(tree.map((n) => n.id)).toEqual(['a', 'b']);
    expect(tree[0].children.map((n) => n.id)).toEqual(['a0', 'a1']);
  });

  it('treats a doc whose parent is missing as a root (no data loss)', () => {
    const tree = buildTree([d('orphan', 'ghost', 0)]);
    expect(tree.map((n) => n.id)).toEqual(['orphan']);
  });

  it('falls back to recency when order is absent (legacy docs)', () => {
    const docs = [
      { id: 'old', parentId: null, updatedAt: 1000 },
      { id: 'new', parentId: null, updatedAt: 2000 },
    ];
    expect(buildTree(docs).map((n) => n.id)).toEqual(['new', 'old']);
  });
});

describe('flattenTree', () => {
  it('emits visible rows with depth, hiding collapsed children', () => {
    const roots = buildTree([d('a'), d('a1', 'a'), d('a1a', 'a1')]);
    const all = flattenTree(roots);
    expect(all.map((r) => [r.id, r.depth])).toEqual([['a', 0], ['a1', 1], ['a1a', 2]]);

    const collapsed = flattenTree(roots, new Set(['a1']));
    expect(collapsed.map((r) => r.id)).toEqual(['a', 'a1']); // a1's child hidden
  });
});

describe('relationships', () => {
  const docs = [d('a'), d('a1', 'a'), d('a1a', 'a1'), d('b')];

  it('getDescendantIds returns the whole subtree', () => {
    expect(getDescendantIds(docs, 'a').sort()).toEqual(['a1', 'a1a']);
    expect(getDescendantIds(docs, 'b')).toEqual([]);
  });

  it('subtreeHeight measures depth below a node', () => {
    expect(subtreeHeight(docs, 'a')).toBe(2);
    expect(subtreeHeight(docs, 'a1')).toBe(1);
    expect(subtreeHeight(docs, 'b')).toBe(0);
  });

  it('depthOf / canHaveChild respect the max depth', () => {
    expect(depthOf(docs, 'a')).toBe(0);
    expect(depthOf(docs, 'a1a')).toBe(2);
    expect(canHaveChild(docs, 'a')).toBe(true);
    expect(canHaveChild(docs, 'a1a')).toBe(false); // already at MAX_DEPTH
  });
});

describe('removeChildrenOf', () => {
  it('drops descendants of the dragged node', () => {
    const rows = flattenTree(buildTree([d('a'), d('a1', 'a'), d('a1a', 'a1'), d('b')]));
    const out = removeChildrenOf(rows, ['a']);
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('getProjection depth clamping', () => {
  it('clamps so a dragged subtree never exceeds MAX_DEPTH', () => {
    // a (with child a1) dragged under b's child chain would overflow; clamp it.
    const docs = [d('b'), d('b1', 'b'), d('a'), d('a1', 'a')];
    const roots = buildTree(docs);
    const visible = removeChildrenOf(flattenTree(roots), ['a']); // a's subtree removed
    // Drag 'a' far right (deep) onto 'b1'; a has height 1, so max depth for a is MAX_DEPTH-1.
    const proj = getProjection(visible, 'a', 'b1', 999, 24, docs);
    expect(proj.depth + subtreeHeight(docs, 'a')).toBeLessThanOrEqual(MAX_DEPTH);
  });
});

describe('computeMove', () => {
  it('re-parents a node and emits minimal updates', () => {
    const docs = [d('a', null, 0), d('b', null, 1)];
    // Drag 'b' and nudge it one step right (indent in place) => nest under 'a'.
    const { docs: next, updates } = computeMove(docs, {
      activeId: 'b', overId: 'b', dragOffset: 24, indentationWidth: 24,
    });
    const b = next.find((x) => x.id === 'b');
    expect(b.parentId).toBe('a');
    expect(updates.some((u) => u.id === 'b' && u.parentId === 'a')).toBe(true);
  });

  it('reorders siblings without changing parentage', () => {
    const docs = [d('a', null, 0), d('b', null, 1), d('c', null, 2)];
    // Drag 'c' up onto 'a' at the same (root) depth => c becomes first.
    const { docs: next } = computeMove(docs, {
      activeId: 'c', overId: 'a', dragOffset: 0, indentationWidth: 24,
    });
    const ordered = next
      .filter((x) => x.parentId == null)
      .sort((x, y) => x.order - y.order)
      .map((x) => x.id);
    expect(ordered[0]).toBe('c');
    expect(next.every((x) => x.parentId == null)).toBe(true);
  });
});
