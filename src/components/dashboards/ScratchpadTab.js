import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PlusIcon, DocumentTextIcon, Bars3Icon, XMarkIcon,
  LinkIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon,
  ArrowUpTrayIcon, ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';
import {
  getUserScratchpad, logSpiiAudit,
  getScratchpadDocuments, createScratchpadDocument,
  updateScratchpadDocument, deleteScratchpadDocument, deleteScratchpadDocuments,
  markScratchpadMigrated,
} from '../../firebase/firestore';
import { detectSPII } from '../../utils/spiiDetector';
import { logActivity } from '../../services/activity';
import { showError, showSuccess } from '../../utils/toast';
import { ConfirmModal } from '../ui';
import { fileToDocument, sanitizeRichHtml, ACCEPTED_IMPORT_TYPES } from '../../utils/importDoc';
import { isDrivePickerConfigured, pickAndImportGoogleDoc } from '../../utils/googleDrivePicker';
import DocumentTree from './scratchpad/DocumentTreeView';
import { getDescendantIds } from './scratchpad/documentTree';

const SAVE_DEBOUNCE_MS = 900;

// Data layer, injectable so the component can be driven by an in-memory store
// in tests/previews without touching Firestore. Defaults to the real backend.
const defaultApi = {
  list: getScratchpadDocuments,
  create: createScratchpadDocument,
  update: updateScratchpadDocument,
  remove: deleteScratchpadDocument,
  removeMany: deleteScratchpadDocuments,
  legacy: getUserScratchpad,
  markMigrated: markScratchpadMigrated,
};

/* ----------------------------- small helpers ----------------------------- */

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const textToHtml = (text) => {
  if (!text) return '';
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
};

const htmlToText = (html) => {
  if (!html) return '';
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || '').replace(/ /g, ' ');
};

const wordCount = (text) => {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
};

const tsMillis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
};

const relativeTime = (ms) => {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ------------------------------ toolbar btn ------------------------------ */

const ToolbarButton = ({ onClick, title, children, wide = false }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onMouseDown={(e) => e.preventDefault()} /* keep the editor selection */
    onClick={onClick}
    className={`h-8 ${wide ? 'px-2.5' : 'w-8'} flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-sm font-bold`}
  >
    {children}
  </button>
);

const Divider = () => <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-0.5" />;

/* ================================ component =============================== */

const ScratchpadTab = ({ user, spiiSettings, api = defaultApi }) => {
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved'); // saved | saving | error
  const [sidebarOpen, setSidebarOpen] = useState(false);  // mobile drawer
  const [menuOpenId, setMenuOpenId] = useState(null);      // per-item kebab menu
  const [renamingId, setRenamingId] = useState(null);      // inline rename
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [collapsedIds, setCollapsedIds] = useState(() => new Set()); // tabs whose sub-tabs are hidden
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const driveConfigured = isDrivePickerConfigured();

  const activeIdRef = useRef(null);
  const documentsRef = useRef([]);
  activeIdRef.current = activeId;
  documentsRef.current = documents;

  const activeDoc = documents.find((d) => d.id === activeId) || null;

  /* ----------------------------- initial load ---------------------------- */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let docs = await api.list(user.uid);
        if (docs.length === 0) {
          const legacy = await api.legacy(user.uid);
          if (legacy?.content && legacy.content.trim() && !legacy.migratedToDocuments) {
            const html = textToHtml(legacy.content);
            const id = await api.create(user.uid, { title: 'My Notes', content: html });
            await api.markMigrated(user.uid);
            docs = [{ id, title: 'My Notes', content: html, createdAt: Date.now(), updatedAt: Date.now() }];
          }
        }
        setDocuments(docs);
        setCollapsedIds(new Set(docs.filter((d) => d.collapsed).map((d) => d.id)));
        setActiveId(docs[0]?.id || null);
      } catch (err) {
        logger.error('Failed to load documents:', err);
        showError('Failed to load documents');
      } finally {
        setLoading(false);
      }
    };
    if (user?.uid) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /* ------------------- load active doc into the editor ------------------- */
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = activeDoc?.content || '';
      const text = htmlToText(activeDoc?.content || '');
      setCounts({ words: wordCount(text), chars: text.length });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  /* ------------------------------- saving -------------------------------- */
  const persist = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id || !editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const src = documentsRef.current.find((d) => d.id === id);
    const title = (src?.title || 'Untitled document').trim() || 'Untitled document';
    try {
      await api.update(user.uid, id, { title, content });
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, title, content, updatedAt: Date.now() } : d))
      );
      const text = htmlToText(content);
      const preview = text.replace(/\s+/g, ' ').trim().slice(0, 80);
      logActivity(user, {
        eventType: 'note_saved',
        action: `Edited "${title}"`,
        detail: `${text.length} chars — "${preview}${text.length > 80 ? '…' : ''}"`,
        targetId: id,
      });
      if (spiiSettings?.enabled) {
        const detections = detectSPII(text);
        if (detections.length > 0) {
          await logSpiiAudit(user.uid, user.displayName || user.email, user.teamId, detections, 'Scratchpad (Documents)');
        }
      }
      setSaveStatus('saved');
    } catch (err) {
      logger.error('Error saving document:', err);
      setSaveStatus('error');
    }
  }, [api, user, spiiSettings]);

  const scheduleSave = useCallback(() => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { persist(); }, SAVE_DEBOUNCE_MS);
  }, [persist]);

  const flushNow = useCallback(() => {
    if (saveTimeoutRef.current) { clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null; }
    persist();
  }, [persist]);

  useEffect(() => () => { if (saveTimeoutRef.current) { clearTimeout(saveTimeoutRef.current); persist(); } },
    [persist]);

  useEffect(() => {
    if (!menuOpenId && !importMenuOpen) return undefined;
    const close = () => { setMenuOpenId(null); setImportMenuOpen(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpenId, importMenuOpen]);

  /* ------------------------------ editing -------------------------------- */
  const handleInput = () => {
    const text = htmlToText(editorRef.current?.innerHTML || '');
    setCounts({ words: wordCount(text), chars: text.length });
    scheduleSave();
  };

  const exec = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    handleInput();
  };

  const addLink = () => {
    const url = window.prompt('Enter link URL:');
    if (url) exec('createLink', /^https?:\/\//i.test(url) ? url : `https://${url}`);
  };

  // Smart paste: keep the source formatting (colors, alignment, tables, images,
  // etc.) while stripping anything unsafe. Falls back to plain text.
  const handlePaste = (e) => {
    const html = e.clipboardData?.getData('text/html');
    if (!html) return; // let the browser handle plain-text pastes natively
    e.preventDefault();
    const clean = sanitizeRichHtml(html);
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, clean || e.clipboardData.getData('text/plain'));
    handleInput();
  };

  const setTitle = (id, title) =>
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)));

  /* --------------------------- document actions -------------------------- */
  const selectDoc = (id) => {
    if (id === activeId) { setSidebarOpen(false); return; }
    flushNow();
    setActiveId(id);
    setSidebarOpen(false);
    setMenuOpenId(null);
  };

  // An order value that sorts a new doc first among its siblings.
  const firstOrder = (parentId) => {
    const sibs = documentsRef.current.filter((d) => (d.parentId ?? null) === (parentId ?? null));
    const min = sibs.reduce((m, d) => Math.min(m, typeof d.order === 'number' ? d.order : 0), 0);
    return min - 1;
  };

  // Persist a drag-and-drop move: re-parent / reorder without bumping edit times.
  const handleMove = async (updates, newDocs) => {
    setDocuments(newDocs);
    try {
      await Promise.all(
        updates.map((u) => api.update(user.uid, u.id, { parentId: u.parentId, order: u.order }, { touch: false }))
      );
    } catch (err) {
      logger.error('Failed to save tab arrangement:', err);
      showError('Could not save the new arrangement');
    }
  };

  const toggleCollapse = (id) => {
    const next = new Set(collapsedIds);
    const collapsed = !next.has(id);
    if (collapsed) next.add(id); else next.delete(id);
    setCollapsedIds(next);
    api.update(user.uid, id, { collapsed }, { touch: false }).catch((err) => logger.error('Failed to save collapse state:', err));
  };

  const handleAddSubtab = async (parentId) => {
    setMenuOpenId(null);
    try {
      flushNow();
      const order = firstOrder(parentId);
      const id = await api.create(user.uid, { title: 'Untitled document', content: '', parentId, order });
      setDocuments((prev) => [{ id, title: 'Untitled document', content: '', parentId, order, createdAt: Date.now(), updatedAt: Date.now() }, ...prev]);
      // make sure the parent is expanded so the new sub-tab is visible
      if (collapsedIds.has(parentId)) toggleCollapse(parentId);
      setActiveId(id);
      setSidebarOpen(false);
      logActivity(user, { eventType: 'note_created', action: 'Created a sub-tab', targetId: id });
      setTimeout(() => { setRenamingId(id); }, 60);
    } catch (err) {
      logger.error('Failed to create sub-tab:', err);
      showError('Could not create sub-tab');
    }
  };

  const handleNew = async () => {
    try {
      flushNow();
      const order = firstOrder(null);
      const id = await api.create(user.uid, { title: 'Untitled document', content: '', parentId: null, order });
      setDocuments((prev) => [{ id, title: 'Untitled document', content: '', parentId: null, order, createdAt: Date.now(), updatedAt: Date.now() }, ...prev]);
      setActiveId(id);
      setSidebarOpen(false);
      logActivity(user, { eventType: 'note_created', action: 'Created a document', targetId: id });
      setTimeout(() => { setRenamingId(id); }, 60);
    } catch (err) {
      logger.error('Failed to create document:', err);
      showError('Could not create document');
    }
  };

  // Create a new document from imported { title, content } and open it.
  const addImportedDoc = async ({ title, content }, source) => {
    flushNow();
    const order = firstOrder(null);
    const id = await api.create(user.uid, { title: title || 'Imported document', content: content || '', parentId: null, order });
    setDocuments((prev) => [{ id, title: title || 'Imported document', content: content || '', parentId: null, order, createdAt: Date.now(), updatedAt: Date.now() }, ...prev]);
    setActiveId(id);
    setSidebarOpen(false);
    logActivity(user, { eventType: 'note_imported', action: `Imported "${title}" (${source})`, targetId: id });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    setImportMenuOpen(false);
    setImporting(true);
    try {
      const doc = await fileToDocument(file);
      await addImportedDoc(doc, 'file');
      showSuccess(`Imported “${doc.title}”`);
    } catch (err) {
      logger.error('File import failed:', err);
      showError(err.message || 'Could not import that file');
    } finally {
      setImporting(false);
    }
  };

  const handleDriveImport = async () => {
    setImportMenuOpen(false);
    setImporting(true);
    try {
      const doc = await pickAndImportGoogleDoc();
      if (!doc) return; // cancelled
      await addImportedDoc(doc, 'google-drive');
      showSuccess(`Imported “${doc.title}” from Google Drive`);
    } catch (err) {
      logger.error('Drive import failed:', err);
      showError(err.message || 'Could not import from Google Drive');
    } finally {
      setImporting(false);
    }
  };

  const handleDuplicate = async (id0) => {
    setMenuOpenId(null);
    const src = documentsRef.current.find((d) => d.id === id0);
    if (!src) return;
    try {
      const title = `Copy of ${src.title}`;
      const parentId = src.parentId ?? null;
      const order = (typeof src.order === 'number' ? src.order : 0) + 0.5; // place right after the original
      const id = await api.create(user.uid, { title, content: src.content, parentId, order });
      setDocuments((prev) => [{ id, title, content: src.content, parentId, order, createdAt: Date.now(), updatedAt: Date.now() }, ...prev]);
      setActiveId(id);
      logActivity(user, { eventType: 'note_created', action: `Duplicated "${src.title}"`, targetId: id });
    } catch (err) {
      logger.error('Failed to duplicate document:', err);
      showError('Could not duplicate document');
    }
  };

  const handleDelete = async () => {
    const target = confirmDelete;
    if (!target) return;
    try {
      const descendantIds = getDescendantIds(documentsRef.current, target.id);
      const idsToDelete = new Set([target.id, ...descendantIds]);
      if (idsToDelete.size > 1 && api.removeMany) {
        await api.removeMany(user.uid, [...idsToDelete]);
      } else {
        await api.remove(user.uid, target.id);
      }
      const remaining = documentsRef.current.filter((d) => !idsToDelete.has(d.id));
      setDocuments(remaining);
      if (idsToDelete.has(activeIdRef.current)) setActiveId(remaining[0]?.id || null);
      logActivity(user, {
        eventType: 'note_deleted',
        action: `Deleted "${target.title}"${idsToDelete.size > 1 ? ` and ${idsToDelete.size - 1} sub-tab(s)` : ''}`,
        targetId: target.id,
      });
    } catch (err) {
      logger.error('Failed to delete document:', err);
      showError('Could not delete document');
    } finally {
      setConfirmDelete(null);
    }
  };

  const commitRename = () => { setRenamingId(null); flushNow(); };

  /* -------------------------------- render ------------------------------- */
  const renderSaveBadge = () => {
    if (saveStatus === 'saving') return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        Saving…
      </span>
    );
    if (saveStatus === 'error') return <span className="text-[11px] font-semibold text-red-500">Sync failed</span>;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        Saved
      </span>
    );
  };

  const renderTabList = () => (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Document tabs</h3>
        <div className="flex items-center gap-0.5">
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setImportMenuOpen((v) => !v); }}
              title="Import a document"
              aria-label="Import a document"
              disabled={importing}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {importing
                ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                : <ArrowDownTrayIcon className="w-[18px] h-[18px]" />}
            </button>
            {importMenuOpen && (
              <div className="absolute right-0 top-9 z-30 w-56 rounded-xl bg-white dark:bg-[#1c1f2a] border border-gray-200 dark:border-white/10 shadow-xl py-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setImportMenuOpen(false); fileInputRef.current?.click(); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">
                  <ArrowUpTrayIcon className="w-4 h-4 flex-none" /> Upload file (.docx, .html)
                </button>
                {driveConfigured && (
                  <button onClick={handleDriveImport} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">
                    <DocumentTextIcon className="w-4 h-4 flex-none" /> Import from Google Drive
                  </button>
                )}
                <p className="px-3 pt-1.5 pb-1 text-[10px] leading-snug text-gray-400">Tip: you can also paste directly from Google Docs.</p>
              </div>
            )}
          </div>
          <button
            onClick={handleNew}
            title="Add document"
            aria-label="Add document"
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 custom-scrollbar">
        {documents.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8 px-3">No documents yet.</p>
        ) : (
          <DocumentTree
            documents={documents}
            activeId={activeId}
            collapsedIds={collapsedIds}
            renamingId={renamingId}
            menuOpenId={menuOpenId}
            titles={Object.fromEntries(documents.map((d) => [d.id, d.title]))}
            onSelect={selectDoc}
            onToggleCollapse={toggleCollapse}
            onMenuToggle={(id) => setMenuOpenId(menuOpenId === id ? null : id)}
            onMove={handleMove}
            onRename={(id) => { setMenuOpenId(null); setActiveId(id); setRenamingId(id); }}
            onDuplicate={handleDuplicate}
            onDelete={(id) => { setMenuOpenId(null); setConfirmDelete(documentsRef.current.find((d) => d.id === id) || null); }}
            onAddSubtab={handleAddSubtab}
            onTitleChange={setTitle}
            onCommitRename={commitRename}
          />
        )}
      </div>
    </>
  );

  return (
    <div className="relative h-[calc(100vh-190px)] min-h-[520px] animate-in fade-in duration-300">
      <div className="relative bg-white dark:bg-[#0f1117] shadow-xl rounded-2xl border border-gray-200 dark:border-white/10 flex h-full overflow-hidden">

        {/* Document tabs panel (desktop) */}
        <aside className="hidden md:flex w-72 flex-col border-r border-gray-200 dark:border-white/10 flex-shrink-0 bg-gray-50/40 dark:bg-white/[0.02]">
          {renderTabList()}
        </aside>

        {/* Document tabs panel (mobile drawer) */}
        {sidebarOpen && (
          <div className="md:hidden absolute inset-0 z-30 flex">
            <div className="w-72 max-w-[80%] bg-white dark:bg-[#14161f] flex flex-col shadow-2xl border-r border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-end px-2 pt-2">
                <button onClick={() => setSidebarOpen(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
                  <XMarkIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              {renderTabList()}
            </div>
            <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
          </div>
        )}

        {/* Editor */}
        <section className="flex-1 flex flex-col min-w-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading documents…</div>
          ) : !activeDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <DocumentTextIcon className="w-14 h-14 text-gray-300 dark:text-gray-700 mb-4" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white">No document open</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5 max-w-xs">Create a document tab to start writing. Everything auto-saves as you type.</p>
              <button onClick={handleNew} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-colors">
                <PlusIcon className="w-4 h-4" /> New document
              </button>
            </div>
          ) : (
            <>
              {/* Title row */}
              <div className="flex items-center gap-2 px-4 sm:px-8 pt-4 pb-2 flex-shrink-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open document tabs"
                  className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 flex-shrink-0"
                >
                  <Bars3Icon className="w-5 h-5" />
                </button>
                <input
                  value={activeDoc.title}
                  onChange={(e) => setTitle(activeDoc.id, e.target.value)}
                  onBlur={flushNow}
                  placeholder="Untitled document"
                  className="flex-1 min-w-0 bg-transparent text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white focus:outline-none placeholder-gray-300 dark:placeholder-gray-600"
                />
                {renderSaveBadge()}
              </div>

              {/* Formatting toolbar */}
              <div className="flex items-center flex-wrap gap-0.5 px-3 sm:px-6 py-1.5 border-y border-gray-200 dark:border-white/10 flex-shrink-0 bg-gray-50/60 dark:bg-white/[0.02]">
                <ToolbarButton title="Undo" onClick={() => exec('undo')}><ArrowUturnLeftIcon className="w-4 h-4" /></ToolbarButton>
                <ToolbarButton title="Redo" onClick={() => exec('redo')}><ArrowUturnRightIcon className="w-4 h-4" /></ToolbarButton>
                <Divider />
                <ToolbarButton title="Heading 1" wide onClick={() => exec('formatBlock', '<h1>')}>H1</ToolbarButton>
                <ToolbarButton title="Heading 2" wide onClick={() => exec('formatBlock', '<h2>')}>H2</ToolbarButton>
                <ToolbarButton title="Normal text" wide onClick={() => exec('formatBlock', '<p>')}>¶</ToolbarButton>
                <Divider />
                <ToolbarButton title="Bold" onClick={() => exec('bold')}><span className="font-black">B</span></ToolbarButton>
                <ToolbarButton title="Italic" onClick={() => exec('italic')}><span className="italic font-serif">I</span></ToolbarButton>
                <ToolbarButton title="Underline" onClick={() => exec('underline')}><span className="underline">U</span></ToolbarButton>
                <ToolbarButton title="Strikethrough" onClick={() => exec('strikeThrough')}><span className="line-through">S</span></ToolbarButton>
                <Divider />
                <ToolbarButton title="Bulleted list" onClick={() => exec('insertUnorderedList')}>•</ToolbarButton>
                <ToolbarButton title="Numbered list" onClick={() => exec('insertOrderedList')} wide>1.</ToolbarButton>
                <ToolbarButton title="Quote" onClick={() => exec('formatBlock', '<blockquote>')}>❝</ToolbarButton>
                <ToolbarButton title="Code block" onClick={() => exec('formatBlock', '<pre>')} wide>{'</>'}</ToolbarButton>
                <ToolbarButton title="Insert link" onClick={addLink}><LinkIcon className="w-4 h-4" /></ToolbarButton>
                <Divider />
                <ToolbarButton title="Clear formatting" onClick={() => exec('removeFormat')} wide>Clear</ToolbarButton>
              </div>

              {/* Editable body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0f1117]">
                <div
                  ref={editorRef}
                  className="doceditor w-full px-6 sm:px-10 py-8 min-h-full text-gray-800 dark:text-gray-100 text-[15px] leading-relaxed"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onPaste={handlePaste}
                  data-placeholder="Start writing…"
                  spellCheck
                />
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between px-6 py-2 border-t border-gray-200 dark:border-white/10 flex-shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                <span>{counts.words} words · {counts.chars} characters</span>
                <span>Edited {relativeTime(tsMillis(activeDoc.updatedAt))}</span>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Hidden file input for uploads (single instance for the whole tab). */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMPORT_TYPES}
        onChange={handleFileChange}
        className="hidden"
      />

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete document"
        message={confirmDelete
          ? (() => {
              const subCount = getDescendantIds(documentsRef.current, confirmDelete.id).length;
              const base = `"${confirmDelete.title || 'Untitled document'}" will be permanently deleted.`;
              const subs = subCount > 0 ? ` Its ${subCount} sub-tab${subCount > 1 ? 's' : ''} will also be deleted.` : '';
              return `${base}${subs} This cannot be undone.`;
            })()
          : ''}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default ScratchpadTab;
