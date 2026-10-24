import React, { useState, useMemo } from 'react';
import { ArrowDownTrayIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { Modal } from '../../ui';
import { showError, showSuccess } from '../../../utils/toast';
import { downloadCsv } from '../../../utils/csv';

const ExportTemplatesModal = ({ isOpen, onClose, templates }) => {
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const allSelected = templates.length > 0 && selectedIds.size === templates.length;

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(templates.map((t) => t.id)));
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    onClose();
  };

  const handleExport = () => {
    const selected = templates.filter((t) => selectedIds.has(t.id));
    if (selected.length === 0) {
      showError('Select at least one template to export.');
      return;
    }

    const headers = ['Template Name', 'Content'];
    const rows = selected.map((t) => [t.title || '', t.description || '']);
    downloadCsv(`templates-export-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showSuccess(`Exported ${selected.length} template${selected.length > 1 ? 's' : ''}.`);
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <Modal.Header onClose={handleClose}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
            <ArrowDownTrayIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <Modal.Title>Export Templates</Modal.Title>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">
              Pick the templates to include in the CSV. The file can be re-imported later via AI Import.
            </p>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body className="p-0">
        <div className="px-6 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/60 dark:bg-white/[0.02]">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
            />
            Select All
          </label>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{selectedIds.size} selected</span>
        </div>

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <DocumentDuplicateIcon className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">You don't have any templates yet.</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
            {templates.map((t) => (
              <label
                key={t.id}
                className="flex items-start gap-3 px-6 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(t.id)}
                  onChange={() => toggleOne(t.id)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{t.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{t.description || '(empty)'}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={handleClose}
          className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={selectedIds.size === 0}
          onClick={handleExport}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Export CSV
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default ExportTemplatesModal;
