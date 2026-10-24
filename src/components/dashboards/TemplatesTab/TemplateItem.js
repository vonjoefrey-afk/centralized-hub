import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Bars3Icon, ClipboardDocumentIcon, DocumentDuplicateIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const TemplateItem = ({ template, onApply, onEdit, onDelete }) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={template}
      id={template.id}
      dragListener={false}
      dragControls={dragControls}
      className="relative group/reorder"
    >
      {/* Hover glow ring */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500/15 to-purple-500/15 rounded-xl blur-[2px] opacity-0 group-hover/reorder:opacity-100 transition-opacity duration-300"></div>

      <div className="relative flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-[#141414] border border-gray-200/60 dark:border-white/7 rounded-xl transition-all duration-200 group-hover/reorder:border-transparent">
        
        {/* Drag handle */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-indigo-500/10 rounded-lg transition-colors text-gray-300 hover:text-indigo-500 touch-none"
          title="Drag to reorder"
        >
          <Bars3Icon className="w-4 h-4" />
        </div>

        {/* Icon + Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
            <DocumentDuplicateIcon className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider truncate">{template.title}</h4>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
              {template.description?.substring(0, 60) || '(empty)'}
              {template.description?.length > 60 ? '…' : ''}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onApply(template)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 hover:text-white dark:text-indigo-400 dark:hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 active:scale-[0.97]"
          >
            <ClipboardDocumentIcon className="w-3 h-3" />
            Copy
          </button>
          <div className="flex items-center gap-0.5 ml-1 border-l border-gray-200/50 dark:border-white/7 pl-2">
            <button
              onClick={() => onEdit(template)}
              className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all duration-200"
              title="Edit"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(template)}
              className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all duration-200"
              title="Delete"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
};

export default TemplateItem;
