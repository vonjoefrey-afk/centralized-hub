import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllSpiiTrackedCases, updateTrackedCase } from '../../firebase/firestore';
import { logActivity } from '../../services/activity';
import { showSuccess, showError } from '../../utils/toast';
import { Badge, PremiumSelect } from '../ui';
import {
  PencilIcon, MagnifyingGlassIcon, ShieldExclamationIcon, XMarkIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import {
  STATUS_OPTIONS, ORIGIN_OPTIONS, SURVEY_OPTIONS, SPII_OPTIONS, TRANSFER_OPTIONS,
  TRANSFER_VALIDATION_OPTIONS, IRT_OPTIONS_EMAIL, IRT_OPTIONS_CHAT, IRT_TYPE_OPTIONS_CHAT,
  RESOLVED_STATUSES, deriveSurveyStatus,
} from '../../constants/caseFields';
import { logger } from '../../utils/logger';

/** Who may edit any SPII case: admins/trainers/TLs by role, plus per-user POCs. */
export const canManageSpiiCases = (user) =>
  ['admin', 'trainer', 'team_leader'].includes(user?.role) || !!user?.features?.spiiCasePoc;

const EDIT_FIELDS = ['status', 'origin', 'survey', 'isChatContinued', 'isSpii', 'isTransferred', 'transferValidation', 'irt', 'irtType', 'comments'];

const fromCase = (c) => EDIT_FIELDS.reduce((acc, k) => {
  acc[k] = c[k] ?? (k === 'isSpii' || k === 'isTransferred' ? 'No' : '');
  return acc;
}, {});

const SpiiCaseManagementTab = () => {
  const { user } = useAuth();
  const canManage = canManageSpiiCases(user);

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState(null); // the case being edited
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCases(await getAllSpiiTrackedCases());
    } catch (err) {
      logger.error('Failed to load SPII cases:', err);
      showError('Failed to load SPII cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) load();
    else setLoading(false);
  }, [canManage, load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (!showClosed && RESOLVED_STATUSES.includes(c.status)) return false;
      if (!q) return true;
      return [c.caseId, c.userDisplayName, c.status].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [cases, showClosed, search]);

  const openEdit = (c) => { setEditing(c); setForm(fromCase(c)); };
  const closeEdit = () => { setEditing(null); setForm(null); };

  const save = async () => {
    if (!editing || !form) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        surveyStatus: deriveSurveyStatus(form.survey, form.origin, form.isChatContinued),
        lastEditedBy: user.uid,
        lastEditedByName: user.displayName || user.email || 'Unknown',
        lastEditedAt: Date.now(),
      };
      await updateTrackedCase(editing.id, payload);
      setCases((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...payload } : x)));
      logActivity(user, {
        eventType: 'spii_case_edited',
        action: `Edited SPII case ${editing.caseId} (owner: ${editing.userDisplayName || 'Unknown'})`,
        detail: `status → ${form.status}`,
        targetId: editing.id,
      });
      showSuccess(`Case ${editing.caseId} updated`);
      closeEdit();
    } catch (err) {
      logger.error('Failed to update SPII case:', err);
      showError('Could not update the case — you may not have permission.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <ShieldExclamationIcon className="w-14 h-14 text-gray-300 dark:text-gray-700 mb-4" />
        <h3 className="text-lg font-black text-gray-900 dark:text-white">SPII Case Management</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
          You don't have permission to manage SPII cases. An admin can grant you the “SPII Case POC” role.
        </p>
      </div>
    );
  }

  const openCount = cases.filter((c) => !RESOLVED_STATUSES.includes(c.status)).length;

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/20">
            <ShieldExclamationIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">SPII Case Management</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Edit any SPII case — close stale ones whose owners are unavailable. {openCount} open.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="text-xs font-bold px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case ID, owner, or status"
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300 select-none cursor-pointer">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="rounded accent-indigo-500" />
          Show closed
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/10">
            <tr className="text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              <th className="px-4 py-3">Case ID</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Origin</th>
              <th className="px-4 py-3">Last edited by</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Loading SPII cases…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No SPII cases{showClosed ? '' : ' open'}.</td></tr>
            ) : (
              visible.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-white">{c.caseId}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 truncate max-w-[160px]" title={c.userDisplayName}>{c.userDisplayName || 'Unknown'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={RESOLVED_STATUSES.includes(c.status) ? 'gray' : 'success'} size="sm">{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.origin || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{c.lastEditedByName || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(c)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                      <PencilIcon className="w-3.5 h-3.5" /> Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeEdit}>
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#14161f] border border-gray-200 dark:border-white/10 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <div>
                <h4 className="text-lg font-black text-gray-900 dark:text-white">Edit case {editing.caseId}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Owner: {editing.userDisplayName || 'Unknown'}</p>
              </div>
              <button onClick={closeEdit} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <PremiumSelect label="Status" value={form.status} options={STATUS_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, status: v }))} />
              <PremiumSelect label="Origin" value={form.origin || 'Chat'} options={ORIGIN_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, origin: v }))} />
              <PremiumSelect label="Survey" value={form.survey || 'Not applicable'} options={SURVEY_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, survey: v }))} />
              <PremiumSelect label="Chat continued?" value={form.isChatContinued || 'No'} options={['Yes', 'No']} onChange={(v) => setForm((f) => ({ ...f, isChatContinued: v }))} />
              <PremiumSelect label="Is SPII" value={form.isSpii || 'No'} options={SPII_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, isSpii: v }))} />
              <PremiumSelect label="Transferred" value={form.isTransferred || 'No'} options={TRANSFER_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, isTransferred: v }))} />
              {form.isTransferred === 'Yes' && (
                <PremiumSelect label="Transfer validation" value={form.transferValidation || ''} options={TRANSFER_VALIDATION_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, transferValidation: v }))} />
              )}
              <PremiumSelect
                label="IRT"
                value={form.irt || ''}
                options={['', ...(form.origin === 'Email' ? IRT_OPTIONS_EMAIL : IRT_OPTIONS_CHAT)]}
                onChange={(v) => setForm((f) => ({ ...f, irt: v }))}
              />
              <PremiumSelect label="IRT type" value={form.irtType || ''} options={['', ...IRT_TYPE_OPTIONS_CHAT]} onChange={(v) => setForm((f) => ({ ...f, irtType: v }))} />
            </div>

            <div className="mt-4">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Comments</label>
              <textarea
                value={form.comments || ''}
                onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={closeEdit} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">Cancel</button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
              >
                <CheckIcon className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpiiCaseManagementTab;
