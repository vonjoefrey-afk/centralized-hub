import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../../utils/logger';

import {
  DocumentDuplicateIcon, Squares2X2Icon, ListBulletIcon,
  MagnifyingGlassIcon, XMarkIcon, ArrowsUpDownIcon, PlusIcon,
  PencilSquareIcon, TrashIcon, ClipboardDocumentIcon,
  CheckIcon, DocumentTextIcon, ArrowDownTrayIcon, PaperAirplaneIcon,
  InboxArrowDownIcon
} from '@heroicons/react/24/outline';
import { Reorder } from 'framer-motion';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getTemplatesByUser, createTemplate, updateTemplate, updateTemplateOrder, deleteTemplate } from '../../firebase/firestore';
import { logActivity } from '../../services/activity';
import { showSuccess, showError, showInfo } from '../../utils/toast';
import { Button, Card, Modal, Input, EmptyState, ConfirmModal } from '../ui';
import TemplateItem from './TemplatesTab/TemplateItem';
import TemplateImportButton from './TemplatesTab/TemplateImportButton';
import ExportTemplatesModal from './TemplatesTab/ExportTemplatesModal';
import ShareTemplatesModal from './TemplatesTab/ShareTemplatesModal';
import IncomingSharesModal from './TemplatesTab/IncomingSharesModal';
import LiveSessionBar, { StartSessionForm } from './TemplatesTab/LiveSessionBar';
import { SESSION_MODES, templateChannel } from '../../services/liveSessionRules';

const EMPTY_FORM = { title: '', description: '', channel: 'both' };

const ChannelBadge = ({ template }) => {
  const c = templateChannel(template);
  if (c === 'both') return null;
  return (
    <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
      c === 'chat' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
    }`}>{c}</span>
  );
};

const copyLabel = (isCopied, copyTarget, copiedText) => {
  if (isCopied) return copiedText;
  return copyTarget ? <>Copy <span className="normal-case font-mono truncate max-w-[110px]">→ {copyTarget}</span></> : 'Copy';
};

const TemplatesTab = ({ user, compact = false, live = null }) => {
  const [templates, setTemplates] = useState([]);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateViewMode, setTemplateViewMode] = useState('comfortable'); // 'comfortable' or 'compact'
  const [templatePage, setTemplatePage] = useState(1);
  const [isReordering, setIsReordering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  // Form states
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showEditTemplate, setShowEditTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState(EMPTY_FORM);
  const [pendingCopy, setPendingCopy] = useState(null); // template awaiting a case ID
  const [showDeleteConfirm, setShowDeleteConfirm] = useState({ show: false, template: null });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showIncomingShares, setShowIncomingShares] = useState(false);
  const [incomingShares, setIncomingShares] = useState([]);

  useEffect(() => {
    loadTemplates();
  }, [user.uid]);

  // Real-time listener for template shares awaiting this user's decision
  useEffect(() => {
    const q = query(collection(db, 'template_shares'), where('toUid', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setIncomingShares(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        logger.error('Error listening to template shares:', error);
      }
    );
    return () => unsubscribe();
  }, [user.uid]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const templatesData = await getTemplatesByUser(user.uid);
      setTemplates(templatesData);
    } catch (err) {
      logger.error('Failed to load templates:', err);
      showError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  // Instant search — no minimum character threshold
  const filteredTemplates = useMemo(() => {
    if (!templateSearchTerm.trim()) return templates;
    const term = templateSearchTerm.toLowerCase();
    return templates.filter(t => 
      t.title?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term)
    );
  }, [templates, templateSearchTerm]);

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      if (!templateForm.title || !templateForm.description) {
        showError('Please fill in all fields');
        return;
      }
      await createTemplate(user.uid, templateForm.title, templateForm.description, templateForm.channel);
      logActivity(user, { eventType: 'template_created', action: 'Created a template', detail: templateForm.title, content: templateForm.description });
      showSuccess('Template created successfully');
      setTemplateForm(EMPTY_FORM);
      setShowCreateTemplate(false);
      loadTemplates();
    } catch (err) {
      showError('Failed to create template');
    }
  };

  const handleImportTemplates = async (selectedTemplates) => {
    try {
      // Import sequentially to ensure they are all saved properly
      for (const t of selectedTemplates) {
        await createTemplate(user.uid, t.title, t.description);
      }
      loadTemplates();
    } catch (err) {
      logger.error('Failed to import templates:', err);
      throw err;
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      title: template.title,
      description: template.description,
      channel: templateChannel(template),
    });
    setShowEditTemplate(true);
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    try {
      await updateTemplate(editingTemplate.id, templateForm.title, templateForm.description, templateForm.channel);
      showSuccess('Template updated successfully');
      setShowEditTemplate(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (err) {
      showError('Failed to update template');
    }
  };

  const handleDeleteTemplate = async () => {
    const template = showDeleteConfirm.template;
    try {
      await deleteTemplate(template.id);
      logActivity(user, { eventType: 'template_deleted', action: 'Deleted a template', detail: template.title, targetId: template.id });
      showSuccess('Template deleted successfully');
      setShowDeleteConfirm({ show: false, template: null });
      loadTemplates();
    } catch (err) {
      showError('Failed to delete template');
    }
  };

  const isLiveMode = !!live && live.mode === SESSION_MODES.live;

  const flashCopied = (templateId) => {
    setCopiedId(templateId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Log a copy. Live copies carry the case/session; non-live copies don't.
  const logTemplateUse = (template, session) => {
    const base = { eventType: 'template_used', action: 'Copied a template', detail: template.title, content: template.description, targetId: template.id };
    if (!session) {
      logActivity(user, { ...base, mode: live ? SESSION_MODES.nonLive : null });
      return;
    }
    const tc = templateChannel(template);
    const channel = (!session.totalUses && tc !== 'both') ? tc : session.channel;
    if (session.id) live.recordUse(session, template);
    logActivity(user, { ...base, mode: SESSION_MODES.live, caseId: session.caseId, sessionId: session.id || null, channel });
  };

  const handleApplyTemplate = async (template) => {
    // Live mode with no open case: ask for the case ID once, then copy.
    if (isLiveMode && !live.focused) {
      setPendingCopy(template);
      return;
    }
    try {
      await navigator.clipboard.writeText(template.description);
    } catch (err) {
      showError('Failed to copy template');
      return;
    }
    flashCopied(template.id);
    if (isLiveMode) {
      logTemplateUse(template, live.focused);
      showInfo(`Copied · case ${live.focused.caseId}`);
    } else {
      logTemplateUse(template, null);
      showInfo('Copied to clipboard');
    }
  };

  // "Start & copy" from the case-ID prompt. Copy first, while the click still
  // counts as a user gesture, then open the session.
  const handleStartAndCopy = async (caseId, channel) => {
    const template = pendingCopy;
    if (!template) return;
    try {
      await navigator.clipboard.writeText(template.description);
    } catch (err) {
      throw new Error('Failed to copy template');
    }
    flashCopied(template.id);
    try {
      const { session } = await live.start(caseId, channel);
      logTemplateUse(template, session);
      showInfo(`Copied · case ${session.caseId}`);
      setPendingCopy(null);
    } catch (err) {
      // Keep the audit trail even if the session couldn't be saved.
      logTemplateUse(template, { caseId, channel, totalUses: 1 });
      setPendingCopy(null);
      throw new Error('Copied, but the live session could not be saved. Check your connection.');
    }
  };

  // Alt+1..9 switches the focused live session.
  useEffect(() => {
    if (!isLiveMode) return undefined;
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const m = /^Digit([1-9])$/.exec(e.code || '');
      if (!m) return;
      const target = live.openSessions[Number(m[1]) - 1];
      if (target) {
        e.preventDefault();
        live.setFocusedId(target.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLiveMode, live]);

  const copyTarget = isLiveMode ? (live.focused?.caseId || null) : null;

  const handleReorder = (newOrder) => {
    setTemplates(newOrder);
  };

  const saveReorder = async () => {
    try {
      await updateTemplateOrder(templates);
      showSuccess('Order saved');
      setIsReordering(false);
    } catch (err) {
      showError('Failed to save new order');
    }
  };

  const activeItemsPerPage = templateViewMode === 'comfortable' ? 9 : 12;
  const paginatedTemplates = isReordering ? filteredTemplates : filteredTemplates.slice(
    (templatePage - 1) * activeItemsPerPage,
    templatePage * activeItemsPerPage
  );
  const totalTemplatePages = Math.max(1, Math.ceil(filteredTemplates.length / activeItemsPerPage));

  // Reset page when search changes
  useEffect(() => {
    setTemplatePage(1);
  }, [templateSearchTerm]);

  // ── Gradient accent colors (cycles per card) ──
  const gradients = [
    'from-indigo-500/20 to-blue-500/20',
    'from-violet-500/20 to-purple-500/20',
    'from-cyan-500/20 to-teal-500/20',
    'from-rose-500/20 to-pink-500/20',
    'from-amber-500/20 to-orange-500/20',
    'from-emerald-500/20 to-green-500/20',
  ];
  const iconColors = [
    'text-indigo-500', 'text-violet-500', 'text-cyan-500',
    'text-rose-500', 'text-amber-500', 'text-emerald-500',
  ];
  const iconBgs = [
    'bg-indigo-500/10', 'bg-violet-500/10', 'bg-cyan-500/10',
    'bg-rose-500/10', 'bg-amber-500/10', 'bg-emerald-500/10',
  ];

  return (
    <div className={`relative group ${compact ? 'p-0' : 'p-4 sm:p-8'}`}>
      {/* Ambient glow */}
      {!compact && (
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-[2.5rem] blur-2xl opacity-20"></div>
      )}

      <div className={`relative ${compact
        ? 'bg-transparent p-0'
        : 'bg-white/50 dark:bg-[#111111] p-6 sm:p-10 rounded-[2.5rem] border border-gray-200/50 dark:border-white/5 shadow-2xl backdrop-blur-sm'}`}>

        {/* ═══════════════════════════════════════════
            HEADER
            ═══════════════════════════════════════════ */}
        <div className={`flex flex-col gap-6 ${compact ? 'mb-5' : 'mb-10'}`}>
          {/* Top row: Title + Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`relative bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl shadow-lg shadow-indigo-500/25 ${compact ? 'p-2.5' : 'p-3.5'}`}>
                <DocumentDuplicateIcon className={compact ? 'w-5 h-5 text-white' : 'w-6 h-6 text-white'} />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-[#111111]"></div>
              </div>
              <div>
                <h3 className={`font-extrabold text-gray-900 dark:text-white tracking-tight ${compact ? 'text-lg' : 'text-2xl'}`}>Templates</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">Quick-access communication snippets</p>
              </div>
            </div>

            {/* Stats pill */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-white/5 rounded-full border border-gray-200/50 dark:border-white/5">
              <DocumentTextIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Toolbar row — every item wraps independently so it never overlaps
              or clips, no matter how many action buttons get added later. */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-gray-100/60 dark:bg-white/5 p-1 rounded-xl border border-gray-200/50 dark:border-white/8 self-start">
              <button
                onClick={() => setTemplateViewMode('comfortable')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  templateViewMode === 'comfortable' 
                    ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <Squares2X2Icon className="w-4 h-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setTemplateViewMode('compact')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  templateViewMode === 'compact' 
                    ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <ListBulletIcon className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className={`h-4 w-4 transition-colors duration-200 ${templateSearchTerm ? 'text-indigo-500' : 'text-gray-400'}`} />
              </div>
              <input
                type="text"
                value={templateSearchTerm}
                onChange={(e) => setTemplateSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-9 py-2.5 bg-gray-50/60 dark:bg-white/5 border border-gray-200/50 dark:border-white/8 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400/60 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                placeholder="Search templates..."
                disabled={isReordering}
              />
              {templateSearchTerm && (
                <button onClick={() => setTemplateSearchTerm('')} className="absolute inset-y-0 right-0 pr-3.5 flex items-center group/clear">
                  <XMarkIcon className="h-4 w-4 text-gray-300 group-hover/clear:text-indigo-500 transition-colors" />
                </button>
              )}
            </div>

            {/* Right actions — wraps onto additional lines as more buttons are added */}
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <button
                onClick={() => isReordering ? saveReorder() : setIsReordering(true)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${
                  isReordering 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600' 
                    : 'bg-white/60 dark:bg-white/5 border-gray-200/50 dark:border-white/8 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-500/30'
                }`}
                title={isReordering ? 'Save order' : 'Reorder templates'}
              >
                <ArrowsUpDownIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{isReordering ? 'Save Order' : 'Reorder'}</span>
              </button>

              <TemplateImportButton onImportSuccess={handleImportTemplates} />

              <button
                onClick={() => setShowExportModal(true)}
                disabled={templates.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border bg-white/60 dark:bg-white/5 border-gray-200/50 dark:border-white/8 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Export templates to CSV"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                disabled={templates.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border bg-white/60 dark:bg-white/5 border-gray-200/50 dark:border-white/8 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Share templates with other users"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {incomingShares.length > 0 && (
                <button
                  onClick={() => setShowIncomingShares(true)}
                  className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
                  title="Review templates shared with you"
                >
                  <InboxArrowDownIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Shared With You</span>
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full">
                    {incomingShares.length}
                  </span>
                </button>
              )}

              <button
                onClick={() => setShowCreateTemplate(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.97]"
              >
                <PlusIcon className="w-4 h-4" />
                <span>New Template</span>
              </button>
            </div>
          </div>
        </div>

        {live && (
          <div className={compact ? 'mb-5' : 'mb-8 -mt-4'}>
            <LiveSessionBar live={live} compact={compact} />
          </div>
        )}

        {/* ═══════════════════════════════════════════
            CONTENT AREA
            ═══════════════════════════════════════════ */}
        {loading ? (
          <LoadingSkeleton viewMode={templateViewMode} />
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-3xl mb-6">
              <DocumentDuplicateIcon className="w-12 h-12 text-indigo-400" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No templates yet</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
              Create your first template to save time with frequently used messages.
            </p>
            <button
              onClick={() => setShowCreateTemplate(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-[0.97]"
            >
              <PlusIcon className="w-4 h-4" />
              Create Template
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Filter status bar */}
            {templateSearchTerm && (
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span>{filteredTemplates.length} result{filteredTemplates.length !== 1 ? 's' : ''} for "<span className="text-indigo-500">{templateSearchTerm}</span>"</span>
                {filteredTemplates.length === 0 && (
                  <button onClick={() => setTemplateSearchTerm('')} className="ml-2 text-indigo-500 hover:text-indigo-600 font-bold uppercase text-[10px] tracking-wider">
                    Clear search
                  </button>
                )}
              </div>
            )}

            {/* Reorder banner */}
            {isReordering && (
              <div 
                className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl"
              >
                <ArrowsUpDownIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Drag to reorder — click "Save Order" when done</span>
              </div>
            )}

            {/* ── Reorder mode ── */}
            {isReordering ? (
              <Reorder.Group axis="y" values={templates} onReorder={handleReorder} className="space-y-2">
                {templates.map(template => (
                  <TemplateItem 
                    key={template.id} 
                    template={template} 
                    onApply={handleApplyTemplate}
                    onEdit={handleEditTemplate}
                    onDelete={() => setShowDeleteConfirm({ show: true, template })}
                  />
                ))}
              </Reorder.Group>
            ) : (
              <>
                {/* ── Grid View ── */}
                {templateViewMode === 'comfortable' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedTemplates.filter(t => t.title).map((template, idx) => (
                      <TemplateGridCard
                        key={template.id}
                        template={template}
                        index={idx}
                        gradient={gradients[idx % gradients.length]}
                        iconColor={iconColors[idx % iconColors.length]}
                        iconBg={iconBgs[idx % iconBgs.length]}
                        copiedId={copiedId}
                        copyTarget={copyTarget}
                        onApply={handleApplyTemplate}
                        onEdit={handleEditTemplate}
                        onDelete={() => setShowDeleteConfirm({ show: true, template })}
                      />
                    ))}
                  </div>
                ) : (
                  /* ── Compact List View ── */
                  <div className="border border-gray-200/50 dark:border-white/5 rounded-2xl overflow-hidden">
                    {paginatedTemplates.filter(t => t.title).map((template, idx) => (
                      <TemplateListRow
                        key={template.id}
                        template={template}
                        index={idx}
                        iconColor={iconColors[idx % iconColors.length]}
                        iconBg={iconBgs[idx % iconBgs.length]}
                        copiedId={copiedId}
                        copyTarget={copyTarget}
                        onApply={handleApplyTemplate}
                        onEdit={handleEditTemplate}
                        onDelete={() => setShowDeleteConfirm({ show: true, template })}
                        isLast={idx === paginatedTemplates.filter(t => t.title).length - 1}
                      />
                    ))}
                  </div>
                )}

                {/* ── Pagination ── */}
                {totalTemplatePages > 1 && (
                  <div className="flex justify-center items-center gap-3 pt-6">
                    <button 
                      disabled={templatePage === 1}
                      onClick={() => setTemplatePage(p => p - 1)}
                      className="p-2 bg-white dark:bg-white/5 border border-gray-200/50 dark:border-white/8 rounded-lg hover:bg-gray-50 dark:hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: totalTemplatePages }, (_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => setTemplatePage(i + 1)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold ${
                            templatePage === i + 1
                              ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button 
                      disabled={templatePage === totalTemplatePages}
                      onClick={() => setTemplatePage(p => p + 1)}
                      className="p-2 bg-white dark:bg-white/5 border border-gray-200/50 dark:border-white/8 rounded-lg hover:bg-gray-50 dark:hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          CREATE / EDIT MODAL
          ═══════════════════════════════════════════ */}
      {(showCreateTemplate || showEditTemplate) && (
        <Modal 
          isOpen={true} 
          onClose={() => { setShowCreateTemplate(false); setShowEditTemplate(false); setEditingTemplate(null); setTemplateForm(EMPTY_FORM); }}
        >
          <Modal.Header onClose={() => { setShowCreateTemplate(false); setShowEditTemplate(false); setEditingTemplate(null); setTemplateForm(EMPTY_FORM); }}>
            <Modal.Title>{showCreateTemplate ? "New Template" : "Edit Template"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <form onSubmit={showCreateTemplate ? handleCreateTemplate : handleUpdateTemplate} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g., Welcome Message, Escalation Note"
                  value={templateForm.title}
                  onChange={(e) => setTemplateForm({...templateForm, title: e.target.value})}
                  className="block w-full px-4 py-3 bg-gray-50/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400/60 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Used for</label>
                <div className="flex gap-2" role="radiogroup" aria-label="Template channel">
                  {[['both', 'Chat & Email'], ['chat', 'Chat'], ['email', 'Email']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={templateForm.channel === value}
                      onClick={() => setTemplateForm({ ...templateForm, channel: value })}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold border ${
                        templateForm.channel === value
                          ? 'bg-indigo-500 border-indigo-500 text-white'
                          : 'bg-gray-50/60 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 hover:text-indigo-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400">Sets a live session's channel automatically on its first copy.</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Content</label>
                  <span className={`text-[10px] font-bold tracking-wider ${templateForm.description.length > 500 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {templateForm.description.length} chars
                  </span>
                </div>
                <textarea 
                  rows={6}
                  className="block w-full px-4 py-3 bg-gray-50/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400/60 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 resize-y"
                  placeholder="Enter the template message content..."
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateTemplate(false); setShowEditTemplate(false); setTemplateForm(EMPTY_FORM); }}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-[0.97]"
                >
                  {showCreateTemplate ? (
                    <><PlusIcon className="w-4 h-4" /> Create</>
                  ) : (
                    <><CheckIcon className="w-4 h-4" /> Save Changes</>
                  )}
                </button>
              </div>
            </form>
          </Modal.Body>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════
          CASE ID PROMPT (live mode, no open session)
          ═══════════════════════════════════════════ */}
      {pendingCopy && live && (
        <Modal isOpen={true} onClose={() => setPendingCopy(null)}>
          <Modal.Header onClose={() => setPendingCopy(null)}>
            <Modal.Title>Which case is this for?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                You're in <span className="font-bold text-emerald-600">Live</span> mode. Enter the case ID once — every copy
                after this is tagged to it automatically until you end the session.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Copying: <span className="font-semibold text-gray-700 dark:text-gray-200">{pendingCopy.title}</span></p>
              <StartSessionForm
                live={live}
                defaultChannel={templateChannel(pendingCopy) !== 'both' ? templateChannel(pendingCopy) : live.lastChannel}
                submitLabel="Start & copy"
                autoFocus
                onCancel={() => setPendingCopy(null)}
                onSubmit={handleStartAndCopy}
              />
              <button
                type="button"
                onClick={() => { live.setMode(SESSION_MODES.nonLive); setPendingCopy(null); }}
                className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Not working a case? Switch to Non-live
              </button>
            </div>
          </Modal.Body>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════
          EXPORT / SHARE
          ═══════════════════════════════════════════ */}
      <ExportTemplatesModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        templates={templates}
      />
      <ShareTemplatesModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        templates={templates}
        currentUser={user}
      />
      <IncomingSharesModal
        isOpen={showIncomingShares}
        onClose={() => setShowIncomingShares(false)}
        shares={incomingShares}
        currentUser={user}
        onTemplatesImported={loadTemplates}
      />

      {/* ═══════════════════════════════════════════
          DELETE CONFIRMATION
          ═══════════════════════════════════════════ */}
      <ConfirmModal
        isOpen={showDeleteConfirm.show}
        onClose={() => setShowDeleteConfirm({ show: false, template: null })}
        onConfirm={handleDeleteTemplate}
        title="Delete Template?"
        message={`This will permanently delete "${showDeleteConfirm.template?.title}". This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};


/* ═══════════════════════════════════════════════════
   GRID CARD  —  Comfortable View
   ═══════════════════════════════════════════════════ */
const TemplateGridCard = ({ template, index, gradient, iconColor, iconBg, copiedId, copyTarget, onApply, onEdit, onDelete }) => {
  const isCopied = copiedId === template.id;

  return (
    <div className="group/card relative">
      {/* Gradient border glow on hover */}
      <div className={`absolute -inset-[1px] bg-gradient-to-br ${gradient} rounded-2xl opacity-0 group-hover/card:opacity-100 blur-[2px] transition-opacity duration-300`}></div>

      <div className="relative flex flex-col h-full bg-white dark:bg-[#141414] border border-gray-200/60 dark:border-white/7 rounded-2xl overflow-hidden group-hover/card:shadow-lg group-hover/card:shadow-black/5 dark:group-hover/card:shadow-none group-hover/card:border-transparent">
        
        {/* Header */}
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className={`p-2.5 ${iconBg} rounded-xl shrink-0`}>
            <DocumentDuplicateIcon className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate leading-snug">{template.title}</h4>
              <ChannelBadge template={template} />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-medium">
              {template.description?.length || 0} chars
              {template.createdAt?.toDate && (
                <> · {template.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
              )}
            </p>
          </div>
        </div>

        {/* Content preview */}
        <div className="px-5 pb-4 flex-1">
          <div className="px-3 py-2.5 bg-gray-50/70 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed font-mono whitespace-pre-wrap break-words">{template.description || '(empty)'}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 pb-5 mt-auto">
          <button
            onClick={() => onApply(template)}
            className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider active:scale-[0.97] ${
              isCopied 
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 hover:text-white dark:text-indigo-400 dark:hover:text-white'
            }`}
          >
            {isCopied ? <CheckIcon className="w-3.5 h-3.5 shrink-0" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5 shrink-0" />}
            {copyLabel(isCopied, copyTarget, 'Copied!')}
          </button>
          <button 
            onClick={() => onEdit(template)} 
            className="p-2.5 text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg opacity-0 group-hover/card:opacity-100"
            title="Edit"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onDelete(template)} 
            className="p-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover/card:opacity-100"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};


/* ═══════════════════════════════════════════════════
   LIST ROW  —  Compact View
   ═══════════════════════════════════════════════════ */
const TemplateListRow = ({ template, index, iconColor, iconBg, copiedId, copyTarget, onApply, onEdit, onDelete, isLast }) => {
  const isCopied = copiedId === template.id;

  return (
    <div 
      className={`group/row flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] ${
        !isLast ? 'border-b border-gray-100 dark:border-white/5' : ''
      } ${index % 2 === 1 ? 'bg-gray-50/30 dark:bg-white/[0.01]' : ''}`}
    >
      {/* Icon */}
      <div className={`p-2 ${iconBg} rounded-lg shrink-0`}>
        <DocumentDuplicateIcon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>

      {/* Title + Description */}
      <div className="flex-1 min-w-0 flex items-center gap-4">
        <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider shrink-0 max-w-[180px] truncate">{template.title}</h4>
        <ChannelBadge template={template} />
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate hidden sm:block">{template.description || '—'}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onApply(template)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider active:scale-[0.97] ${
            isCopied 
              ? 'bg-emerald-500 text-white'
              : 'bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 hover:text-white dark:text-indigo-400 dark:hover:text-white'
          }`}
        >
          {isCopied ? <CheckIcon className="w-3 h-3 shrink-0" /> : <ClipboardDocumentIcon className="w-3 h-3 shrink-0" />}
          {copyLabel(isCopied, copyTarget, 'Copied')}
        </button>
        <button 
          onClick={() => onEdit(template)} 
          className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg opacity-0 group-hover/row:opacity-100"
          title="Edit"
        >
          <PencilSquareIcon className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={() => onDelete(template)} 
          className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover/row:opacity-100"
          title="Delete"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};


/* ═══════════════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════════════ */
const LoadingSkeleton = ({ viewMode }) => {
  if (viewMode === 'compact') {
    return (
      <div className="border border-gray-200/50 dark:border-white/5 rounded-2xl overflow-hidden">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`flex items-center gap-4 px-5 py-4 ${i < 5 ? 'border-b border-gray-100 dark:border-white/5' : ''}`}>
            <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse"></div>
            <div className="flex-1 flex items-center gap-4">
              <div className="h-3 w-28 bg-gray-100 dark:bg-white/5 rounded animate-pulse"></div>
              <div className="h-3 flex-1 bg-gray-100 dark:bg-white/5 rounded animate-pulse max-w-xs"></div>
            </div>
            <div className="h-8 w-20 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="bg-white dark:bg-[#141414] border border-gray-200/60 dark:border-white/7 rounded-2xl overflow-hidden">
          <div className="p-5 pb-3 flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
            <div className="flex-1">
              <div className="h-4 w-2/3 bg-gray-100 dark:bg-white/5 rounded animate-pulse"></div>
              <div className="h-2 w-1/3 bg-gray-100 dark:bg-white/5 rounded animate-pulse mt-2"></div>
            </div>
          </div>
          <div className="px-5 pb-4">
            <div className="h-16 bg-gray-50 dark:bg-white/[0.03] rounded-lg animate-pulse"></div>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <div className="h-10 flex-1 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  );
};


export default TemplatesTab;
