import React, { useMemo, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DocumentTextIcon, EllipsisVerticalIcon, TrashIcon,
  DocumentDuplicateIcon, PencilIcon, ChevronRightIcon, PlusIcon,
} from '@heroicons/react/24/outline';
import {
  buildTree, flattenTree, removeChildrenOf, getProjection, computeMove, canHaveChild,
} from './documentTree';

const INDENT = 20; // px of indentation per nesting level

/* ------------------------------- one row -------------------------------- */

const TreeRow = ({
  item, depth, active, renaming, menuOpen,
  title, onSelect, onToggleCollapse, onMenuToggle, collapsed,
  onRename, onDuplicate, onDelete, onAddSubtab, canNest,
  onTitleChange, onCommitRename,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    paddingLeft: depth * INDENT,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative ${isDragging ? 'opacity-50' : ''}`}>
      <div
        onClick={() => onSelect(item.id)}
        className={`group relative flex items-center gap-1.5 pr-2 py-2.5 rounded-full cursor-pointer mb-0.5 transition-colors ${
          active ? 'bg-[#d3e3fd] dark:bg-indigo-500/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'
        }`}
      >
        {/* caret (only when it has children) */}
        {item.hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(item.id); }}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {/* drag handle wraps the icon so dragging doesn't fight selection */}
        <span
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
          title="Drag to reorder or nest"
        >
          <DocumentTextIcon className={`w-5 h-5 ${active ? 'text-blue-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`} />
        </span>

        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => onTitleChange(item.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            onBlur={onCommitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitRename(); }}
            className="flex-1 min-w-0 bg-white dark:bg-black/30 rounded-md px-1.5 py-0.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        ) : (
          <span className={`flex-1 min-w-0 truncate text-sm font-semibold ${active ? 'text-blue-800 dark:text-indigo-200' : 'text-gray-800 dark:text-gray-200'}`}>
            {title || 'Untitled document'}
          </span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(item.id); }}
          aria-label="Document options"
          className={`p-1 rounded-full text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 transition-opacity ${active || menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <EllipsisVerticalIcon className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div
            className="absolute right-2 top-11 z-20 w-48 rounded-xl bg-white dark:bg-[#1c1f2a] border border-gray-200 dark:border-white/10 shadow-xl py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onAddSubtab(item.id)}
              disabled={!canNest}
              title={canNest ? '' : 'Maximum nesting depth reached'}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlusIcon className="w-4 h-4" /> Add sub-tab
            </button>
            <button onClick={() => onRename(item.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">
              <PencilIcon className="w-4 h-4" /> Rename
            </button>
            <button onClick={() => onDuplicate(item.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">
              <DocumentDuplicateIcon className="w-4 h-4" /> Duplicate
            </button>
            <button onClick={() => onDelete(item.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
              <TrashIcon className="w-4 h-4" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------- the tree ------------------------------- */

const DocumentTree = ({
  documents, activeId, collapsedIds, renamingId, menuOpenId, titles,
  onSelect, onToggleCollapse, onMenuToggle, onMove,
  onRename, onDuplicate, onDelete, onAddSubtab, onTitleChange, onCommitRename,
}) => {
  const [activeDragId, setActiveDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const roots = useMemo(() => buildTree(documents), [documents]);
  const flattened = useMemo(() => {
    const rows = flattenTree(roots, collapsedIds);
    return activeDragId ? removeChildrenOf(rows, [activeDragId]) : rows;
  }, [roots, collapsedIds, activeDragId]);

  const projected = (activeDragId && overId)
    ? getProjection(flattened, activeDragId, overId, offsetLeft, INDENT, documents)
    : null;

  const ids = useMemo(() => flattened.map((i) => i.id), [flattened]);

  const resetDrag = () => { setActiveDragId(null); setOverId(null); setOffsetLeft(0); };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => { setActiveDragId(active.id); setOverId(active.id); }}
      onDragMove={({ delta }) => setOffsetLeft(delta.x)}
      onDragOver={({ over }) => setOverId(over?.id ?? null)}
      onDragEnd={({ active, over }) => {
        if (over && active) {
          const { updates, docs } = computeMove(documents, {
            activeId: active.id, overId: over.id,
            dragOffset: offsetLeft, indentationWidth: INDENT, collapsedIds,
          });
          if (updates.length) onMove(updates, docs);
        }
        resetDrag();
      }}
      onDragCancel={resetDrag}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {flattened.map((item) => {
          const depth = item.id === activeDragId && projected ? projected.depth : item.depth;
          return (
            <TreeRow
              key={item.id}
              item={item}
              depth={depth}
              active={item.id === activeId}
              renaming={renamingId === item.id}
              menuOpen={menuOpenId === item.id}
              collapsed={collapsedIds.has(item.id)}
              canNest={canHaveChild(documents, item.id)}
              title={titles[item.id]}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
              onMenuToggle={onMenuToggle}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onAddSubtab={onAddSubtab}
              onTitleChange={onTitleChange}
              onCommitRename={onCommitRename}
            />
          );
        })}
      </SortableContext>
    </DndContext>
  );
};

export default DocumentTree;
