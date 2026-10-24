import React, { useState, useEffect } from 'react';
import { InboxArrowDownIcon, CheckIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Modal } from '../../ui';
import { showError, showSuccess } from '../../../utils/toast';
import { acceptTemplateShare, declineTemplateShare } from '../../../firebase/firestore';

const ShareBundle = ({ share, currentUser, onResolved }) => {
  const [selectedIds, setSelectedIds] = useState(() => new Set(share.templates.map((t) => t.id)));
  const [busy, setBusy] = useState(false);

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAccept = async () => {
    if (selectedIds.size === 0) {
      showError('Select at least one template to accept, or Decline All.');
      return;
    }
    setBusy(true);
    try {
      const chosen = share.templates.filter((t) => selectedIds.has(t.id));
      await acceptTemplateShare(share.id, currentUser.uid, chosen);
      showSuccess(`Added ${chosen.length} template${chosen.length > 1 ? 's' : ''} from ${share.fromName}.`);
      onResolved(share.id);
    } catch (err) {
      showError('Failed to accept templates.');
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await declineTemplateShare(share.id);
      onResolved(share.id);
    } catch (err) {
      showError('Failed to decline share.');
      setBusy(false);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 bg-gray-50/70 dark:bg-white/[0.03] flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{share.fromName}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{share.fromEmail}</p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {share.templates.length} template{share.templates.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {share.templates.map((t) => (
          <label
            key={t.id}
            className="flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(t.id)}
              onChange={() => toggle(t.id)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{t.title}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{t.description || '(empty)'}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 px-5 py-3 bg-gray-50/40 dark:bg-white/[0.02]">
        <button
          type="button"
          disabled={busy}
          onClick={handleDecline}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50"
        >
          <XMarkIcon className="w-4 h-4" /> Decline All
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleAccept}
          className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50"
        >
          {busy ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
          Accept Selected
        </button>
      </div>
    </div>
  );
};

const IncomingSharesModal = ({ isOpen, onClose, shares, currentUser, onTemplatesImported }) => {
  const [localShares, setLocalShares] = useState(shares);

  useEffect(() => {
    setLocalShares(shares);
  }, [shares]);

  const handleResolved = (shareId) => {
    setLocalShares((prev) => prev.filter((s) => s.id !== shareId));
    onTemplatesImported();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header onClose={onClose}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
            <InboxArrowDownIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <Modal.Title>Shared With You</Modal.Title>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">
              Pick which templates to keep from each share — nothing is added until you accept.
            </p>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body className="space-y-4 max-h-[65vh] overflow-y-auto">
        {localShares.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <InboxArrowDownIcon className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Nothing pending — you're all caught up.</p>
          </div>
        ) : (
          localShares.map((share) => (
            <ShareBundle key={share.id} share={share} currentUser={currentUser} onResolved={handleResolved} />
          ))
        )}
      </Modal.Body>
    </Modal>
  );
};

export default IncomingSharesModal;
