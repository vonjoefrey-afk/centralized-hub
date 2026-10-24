// Pure logic for the Notes document tree (Google-Docs-style nested tabs).
//
// Documents are stored flat in Firestore — each carries `parentId` (null = a
// top-level tab) and `order` (position among its siblings). These helpers turn
// that flat list into a nested tree, flatten it back for rendering, and compute
// the parent/order changes a drag-and-drop move implies. Everything here is pure
// and side-effect-free so it can be unit-tested without React or Firestore.

export const LEVELS = 3;          // tabs can nest up to 3 levels deep…
export const MAX_DEPTH = LEVELS - 1; // …so the deepest allowed depth index is 2

/* -------------------------------- helpers -------------------------------- */

const millis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
};

// Siblings sort by explicit `order`; legacy docs without one fall back to
// most-recently-edited first (their previous behaviour), after any ordered ones.
const sortSiblings = (a, b) => {
  const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY;
  const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  return millis(b.updatedAt) - millis(a.updatedAt);
};

export const arrayMove = (arr, from, to) => {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

/** Map of parentId -> child ids (in no particular order). null key = roots. */
const groupByParent = (docs) => {
  const map = new Map();
  for (const d of docs) {
    const p = d.parentId ?? null;
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(d.id);
  }
  return map;
};

/* ------------------------------ tree shaping ----------------------------- */

/**
 * Build a nested tree (array of root nodes, each with a `children` array) from
 * the flat document list. Orphans — a parentId pointing at a missing/deleted
 * doc — are treated as roots so nothing ever disappears.
 */
export const buildTree = (docs) => {
  const byId = new Map(docs.map((d) => [d.id, { ...d, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parentId != null ? byId.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes) => {
    nodes.sort(sortSiblings);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
};

/**
 * Flatten a nested tree into an ordered list of visible rows. Children of a
 * collapsed node are omitted. Each row: { id, parentId, depth, hasChildren }.
 */
export const flattenTree = (roots, collapsedIds = new Set()) => {
  const out = [];
  const walk = (nodes, depth, parentId) => {
    for (const n of nodes) {
      const hasChildren = n.children.length > 0;
      out.push({ id: n.id, parentId: parentId ?? null, depth, hasChildren });
      if (hasChildren && !collapsedIds.has(n.id)) walk(n.children, depth + 1, n.id);
    }
  };
  walk(roots, 0, null);
  return out;
};

/** Rebuild a tree from a flat [{id, parentId}] list, keeping list order as sibling order. */
export const buildTreeFromFlat = (flatItems) => {
  const root = { id: null, children: [] };
  const nodes = new Map([[null, root]]);
  for (const item of flatItems) nodes.set(item.id, { id: item.id, children: [] });
  for (const item of flatItems) {
    const parent = nodes.get(item.parentId ?? null) || root;
    parent.children.push(nodes.get(item.id));
  }
  return root.children;
};

/** Walk a nested tree, emitting {id, parentId, order} with order = sibling index. */
export const flattenForOrder = (roots) => {
  const out = [];
  const walk = (nodes, parentId) => {
    nodes.forEach((n, idx) => {
      out.push({ id: n.id, parentId: parentId ?? null, order: idx });
      if (n.children?.length) walk(n.children, n.id);
    });
  };
  walk(roots, null);
  return out;
};

/* --------------------------- relationships ------------------------------- */

/** All descendant ids of `id` (children, grandchildren, …). */
export const getDescendantIds = (docs, id) => {
  const children = groupByParent(docs);
  const result = [];
  const stack = [...(children.get(id) || [])];
  while (stack.length) {
    const cur = stack.pop();
    result.push(cur);
    stack.push(...(children.get(cur) || []));
  }
  return result;
};

/** Height of the subtree rooted at `id` (0 when it has no children). */
export const subtreeHeight = (docs, id) => {
  const children = groupByParent(docs);
  const h = (nid) => {
    const kids = children.get(nid) || [];
    return kids.length ? 1 + Math.max(...kids.map(h)) : 0;
  };
  return h(id);
};

/** Can a new child be added under `id` without exceeding MAX_DEPTH? */
export const canHaveChild = (docs, id) => depthOf(docs, id) < MAX_DEPTH;

/** Depth of a node (0 for a root). */
export const depthOf = (docs, id) => {
  const byId = new Map(docs.map((d) => [d.id, d]));
  let depth = 0;
  let cur = byId.get(id);
  const seen = new Set();
  while (cur && cur.parentId != null && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
    depth += 1;
  }
  return depth;
};

/** Remove rows that are descendants of any id in `ids` (collapse during drag). */
export const removeChildrenOf = (items, ids) => {
  const exclude = new Set(ids);
  return items.filter((item) => {
    if (item.parentId && exclude.has(item.parentId)) {
      if (item.hasChildren) exclude.add(item.id);
      return false;
    }
    return true;
  });
};

/* ----------------------------- drag projection --------------------------- */

const getParentId = (depth, newItems, overIndex, previousItem) => {
  if (depth === 0 || !previousItem) return null;
  if (depth === previousItem.depth) return previousItem.parentId;
  if (depth > previousItem.depth) return previousItem.id;
  const match = newItems
    .slice(0, overIndex)
    .reverse()
    .find((item) => item.depth === depth);
  return match ? match.parentId : null;
};

/**
 * Where would the dragged row land? Mirrors dnd-kit's sortable-tree projection,
 * clamped so no node — including the dragged subtree — exceeds MAX_DEPTH.
 * `visibleItems` is the flattened list with the active row's subtree removed.
 */
export const getProjection = (visibleItems, activeId, overId, dragOffset, indentationWidth, docs) => {
  const overIndex = visibleItems.findIndex((i) => i.id === overId);
  const activeIndex = visibleItems.findIndex((i) => i.id === activeId);
  if (overIndex < 0 || activeIndex < 0) return { depth: 0, parentId: null };

  const newItems = arrayMove(visibleItems, activeIndex, overIndex);
  const prevItem = newItems[overIndex - 1];
  const nextItem = newItems[overIndex + 1];

  const projectedDepth = visibleItems[activeIndex].depth + Math.round(dragOffset / indentationWidth);
  const maxDepth = prevItem ? prevItem.depth + 1 : 0;
  const minDepth = nextItem ? nextItem.depth : 0;

  let depth = Math.max(minDepth, Math.min(projectedDepth, maxDepth));
  const height = subtreeHeight(docs, activeId);
  if (depth + height > MAX_DEPTH) depth = Math.max(minDepth, MAX_DEPTH - height);

  return { depth, parentId: getParentId(depth, newItems, overIndex, prevItem) };
};

/**
 * Compute the result of dragging `activeId` onto `overId`. Returns the new flat
 * docs array plus the minimal list of {id, parentId, order} updates to persist.
 */
export const computeMove = (docs, { activeId, overId, dragOffset, indentationWidth, collapsedIds = new Set() }) => {
  const roots = buildTree(docs);
  const visible = removeChildrenOf(flattenTree(roots, collapsedIds), [activeId]);
  const projection = getProjection(visible, activeId, overId, dragOffset, indentationWidth, docs);

  const flatAll = flattenTree(roots, new Set());
  const activeIndex = flatAll.findIndex((i) => i.id === activeId);
  const overIndex = flatAll.findIndex((i) => i.id === overId);
  if (activeIndex < 0 || overIndex < 0) return { docs, updates: [], projection };

  const cloned = flatAll.map((i) => ({ ...i }));
  cloned[activeIndex] = { ...cloned[activeIndex], parentId: projection.parentId };
  const sorted = arrayMove(cloned, activeIndex, overIndex);

  const desired = flattenForOrder(buildTreeFromFlat(sorted));
  const byId = new Map(docs.map((d) => [d.id, d]));
  const updates = desired.filter((d) => {
    const cur = byId.get(d.id);
    const curParent = cur?.parentId ?? null;
    const curOrder = typeof cur?.order === 'number' ? cur.order : null;
    return curParent !== d.parentId || curOrder !== d.order;
  });

  const desiredById = new Map(desired.map((d) => [d.id, d]));
  const newDocs = docs.map((doc) => {
    const u = desiredById.get(doc.id);
    return u ? { ...doc, parentId: u.parentId, order: u.order } : doc;
  });

  return { docs: newDocs, updates, projection };
};
