import React, { useState, useEffect, useMemo } from 'react';
import { PaperAirplaneIcon, DocumentDuplicateIcon, MagnifyingGlassIcon, UserCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Modal } from '../../ui';
import { showError, showSuccess } from '../../../utils/toast';
import { createTemplateShare } from '../../../firebase/firestore';
import { getAllUsers } from '../../../services/users';

const ShareTemplatesModal = ({ isOpen, onClose, templates, currentUser }) => {
  const [selectedTemplateIds, setSelectedTemplateIds] = useState(() => new Set());
  const [selectedRecipientIds, setSelectedRecipientIds] = useState(() => new Set());
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingUsers(true);
    getAllUsers()
      .then((all) => setUsers(all.filter((u) => u.id !== currentUser.uid)))
      .catch(() => showError('Failed to load users to share with.'))
      .finally(() => setLoadingUsers(false));
  }, [isOpen, currentUser.uid]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const term = userSearch.toLowerCase();
    return users.filter(
      (u) => u.displayName?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)
    );
  }, [users, userSearch]);

  const toggleTemplate = (id) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRecipient = (id) => {
    setSelectedRecipientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetForm = () => {
    setSelectedTemplateIds(new Set());
    setSelectedRecipientIds(new Set());
    setUserSearch('');
  };

  const handleClose = () => {
    if (sharing) return;
    resetForm();
    onClose();
  };

  const handleShare = async () => {
    if (selectedTemplateIds.size === 0) {
      showError('Select at least one template to share.');
      return;
    }
    if (selectedRecipientIds.size === 0) {
      showError('Select at least one person to share with.');
      return;
    }

    const selected = templates
      .filter((t) => selectedTemplateIds.has(t.id))
      .map((t) => ({ id: t.id, title: t.title, description: t.description }));

    setSharing(true);
    try {
      await Promise.all(
        Array.from(selectedRecipientIds).map((toUid) =>
          createTemplateShare({
            fromUid: currentUser.uid,
            fromName: currentUser.displayName || currentUser.email,
            fromEmail: currentUser.email,
            toUid,
            templates: selected,
          })
        )
      );
      showSuccess(
        `Sent ${selected.length} template${selected.length > 1 ? 's' : ''} to ${selectedRecipientIds.size} ${selectedRecipientIds.size > 1 ? 'people' : 'person'} for approval.`
      );
      handleClose();
    } catch (err) {
      showError(err.message || 'Failed to share templates.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <Modal.Header onClose={handleClose}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
            <PaperAirplaneIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <Modal.Title>Share Templates</Modal.Title>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">
              Recipients get to review and pick which templates to accept — nothing is added automatically.
            </p>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body className="p-0 max-h-[65vh] overflow-y-auto">
        {/* Step 1: Templates */}
        <div className="px-6 pt-5 pb-2">
          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            1. Select Templates ({selectedTemplateIds.size} selected)
          </h4>
        </div>
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <DocumentDuplicateIcon className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">You don't have any templates yet.</p>
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 border-y border-gray-100 dark:border-white/5">
            {templates.map((t) => (
              <label
                key={t.id}
                className="flex items-start gap-3 px-6 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                <input
                  type="checkbox"
                  checked={selectedTemplateIds.has(t.id)}
                  onChange={() => toggleTemplate(t.id)}
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

        {/* Step 2: Recipients */}
        <div className="px-6 pt-5 pb-3">
          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            2. Share With ({selectedRecipientIds.size} selected)
          </h4>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400/60 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
            />
          </div>
        </div>

        {loadingUsers ? (
          <div className="flex items-center justify-center py-8">
            <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <UserCircleIcon className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No matching users.</p>
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 border-t border-gray-100 dark:border-white/5">
            {filteredUsers.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                <input
                  type="checkbox"
                  checked={selectedRecipientIds.has(u.id)}
                  onChange={() => toggleRecipient(u.id)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    {u.displayName?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.displayName || u.email}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.email}</p>
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
          disabled={sharing}
          className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={sharing || selectedTemplateIds.size === 0 || selectedRecipientIds.size === 0}
          onClick={handleShare}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sharing ? (
            <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Sharing...</>
          ) : (
            <><PaperAirplaneIcon className="w-4 h-4" /> Share</>
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default ShareTemplatesModal;
