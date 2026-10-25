import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../../utils/logger';

import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, Skeleton, CardSkeleton, EmptyState, PremiumSelect, Button, Modal } from '../ui';
import {
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  BugAntIcon,
  ClipboardDocumentCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { DASHBOARD_LABELS, ALL_FEATURE_COLUMNS } from '../../constants/dashboardFeatures';
import { downloadCsv } from '../../utils/csv';
import { BUG_STATUSES, BUG_STATUS_LABEL, updateBugFeedbackStatus, saveFeedbackAnalysis } from '../../services/feedback';
import { showSuccess, showError } from '../../utils/toast';

const BUG_STATUS_BADGE = {
  checking: 'warning',
  'in-progress': 'info',
  wai: 'gray',
  fixed: 'success',
};

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Dashboards' },
  { value: 'admin', label: DASHBOARD_LABELS.admin },
  { value: 'trainer', label: DASHBOARD_LABELS.trainer },
  { value: 'team_leader', label: DASHBOARD_LABELS.team_leader },
  { value: 'team_member', label: DASHBOARD_LABELS.team_member },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'bug', label: 'Bug Feedback' },
  { value: 'uat', label: 'UAT Feedback' },
];

// Short human-readable summary of a UAT submission's not-working features, or the raw message for bug reports.
const getFeedbackSummary = (item) => {
  if (item.type === 'uat' && item.featureStatuses) {
    const notWorking = Object.values(item.featureStatuses).filter((v) => v.status === 'not_working');
    if (notWorking.length === 0) {
      return item.message ? `All features working. ${item.message}` : 'All features working.';
    }
    return notWorking.map((v) => `${v.label}: ${v.note}`).join(' | ');
  }
  return item.message || '';
};

const Meta = ({ label, value }) => (
  <div>
    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words">{value || '—'}</div>
  </div>
);

const FeedbackTab = () => {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dashboardFilter, setDashboardFilter] = useState('all');

  // Bug status modal
  const [statusModal, setStatusModal] = useState({ open: false, item: null });
  const [selStatus, setSelStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Detail + AI analysis modal
  const [detailModal, setDetailModal] = useState({ open: false, item: null });
  const [analyzing, setAnalyzing] = useState(false);

  const openDetailModal = (item) => setDetailModal({ open: true, item });
  const closeDetailModal = () => setDetailModal({ open: false, item: null });

  const runAnalysis = async () => {
    const item = detailModal.item;
    if (!item) return;
    setAnalyzing(true);
    try {
      const analyze = httpsCallable(functions, 'analyzeFeedback');
      const res = await analyze({
        type: item.type, title: item.title, message: item.message,
        featureStatuses: item.featureStatuses, role: item.role, page: item.page,
      });
      const analysis = res.data?.analysis;
      if (!analysis) throw new Error('No analysis returned');
      await saveFeedbackAnalysis(item.id, analysis, user?.uid);
      setFeedback((prev) => prev.map((f) => (f.id === item.id ? { ...f, aiAnalysis: analysis } : f)));
      setDetailModal((m) => ({ ...m, item: { ...m.item, aiAnalysis: analysis } }));
      showSuccess('AI analysis complete');
    } catch (err) {
      logger.error('Feedback analysis failed:', err);
      showError(err.message || 'AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const copyPrompt = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text)
      .then(() => showSuccess('Prompt copied'))
      .catch(() => showError('Could not copy'));
  };

  const openStatusModal = (item) => {
    setSelStatus(item.bugStatus || 'checking');
    setStatusNote(item.bugStatusNote || '');
    setStatusModal({ open: true, item });
  };

  const closeStatusModal = () => {
    if (savingStatus) return;
    setStatusModal({ open: false, item: null });
  };

  const handleSaveStatus = async () => {
    if (!selStatus) {
      showError('Please pick a status.');
      return;
    }
    if (selStatus === 'fixed' && !statusNote.trim()) {
      showError('A fix note is required for Fixed-Bug — it is posted to all users.');
      return;
    }
    setSavingStatus(true);
    try {
      await updateBugFeedbackStatus({
        feedback: statusModal.item,
        status: selStatus,
        note: statusNote.trim(),
        adminUid: user?.uid,
      });
      showSuccess(
        selStatus === 'fixed'
          ? 'Marked Fixed-Bug — reporter notified and update posted to all users.'
          : 'Status updated and reporter notified.'
      );
      setStatusModal({ open: false, item: null });
    } catch (err) {
      logger.error('Failed to update bug status:', err);
      showError('Failed to update status. Please try again.');
    } finally {
      setSavingStatus(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFeedback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        logger.error('Error loading feedback:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const filteredFeedback = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return feedback.filter((item) => {
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const matchesDashboard = dashboardFilter === 'all' || item.role === dashboardFilter;
      if (!matchesType || !matchesDashboard) return false;
      if (!q) return true;
      const haystack = `${item.title || ''} ${getFeedbackSummary(item)} ${item.userName || ''} ${item.userEmail || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [feedback, typeFilter, dashboardFilter, searchQuery]);

  const handleExportCsv = () => {
    const baseHeaders = ['Type', 'Feature / Title', 'Details', 'Submitted By', 'Email', 'Dashboard', 'Page', 'Status', 'Submitted At'];
    const featureHeaders = ALL_FEATURE_COLUMNS.map((f) => f.label);
    const headers = [...baseHeaders, ...featureHeaders];

    const rows = filteredFeedback.map((item) => {
      const base = [
        item.type === 'uat' ? 'UAT Feedback' : 'Bug Feedback',
        item.title || '',
        getFeedbackSummary(item),
        item.userName || '',
        item.userEmail || '',
        DASHBOARD_LABELS[item.role] || item.role || '',
        item.page || '',
        item.type === 'bug' ? BUG_STATUS_LABEL[item.bugStatus] || 'Open' : item.status || '',
        item.createdAt?.toDate?.()?.toLocaleString() || '',
      ];

      // One cell per feature: "Working" if confirmed working on a UAT pass, the
      // reported reason if flagged not working, or blank if not applicable/untested.
      const featureCells = ALL_FEATURE_COLUMNS.map(({ id }) => {
        if (item.type !== 'uat' || !item.featureStatuses || !item.featureStatuses[id]) return '';
        const entry = item.featureStatuses[id];
        return entry.status === 'working' ? 'Working' : entry.note || 'Not working';
      });

      return [...base, ...featureCells];
    });

    downloadCsv(`feedback-export-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton lines={2} className="mb-6" />
        <CardSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-4 pb-12 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500"></div>
        <div className="px-6 py-8 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl">
              <ChatBubbleLeftRightIcon className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">User Feedback</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Bug reports and UAT feedback submitted from every dashboard
              </p>
            </div>
          </div>
          <Button
            onClick={handleExportCsv}
            disabled={filteredFeedback.length === 0}
            className="!rounded-2xl flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by user, title, or details..."
            className="block w-full pl-11 pr-4 py-3 bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div className="w-full md:w-56">
          <PremiumSelect value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} className="!rounded-2xl" />
        </div>
        <div className="w-full md:w-64">
          <PremiumSelect value={dashboardFilter} onChange={setDashboardFilter} options={ROLE_OPTIONS} className="!rounded-2xl" />
        </div>
      </div>

      {/* Feedback Ledger */}
      <div className="bg-white dark:bg-[#111111] rounded-[2.5rem] shadow-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/5">
            <thead className="bg-gray-50/50 dark:bg-white/2">
              <tr>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Feature / Title</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Submitted By</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Dashboard</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Bug Status</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredFeedback.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <EmptyState
                      icon={<ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto" />}
                      title="No feedback yet"
                      description="Bug reports and UAT feedback submitted from the floating feedback button will show up here."
                    />
                  </td>
                </tr>
              ) : (
                filteredFeedback.map((item) => (
                  <tr key={item.id} onClick={() => openDetailModal(item)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors duration-200">
                    <td className="px-8 py-6">
                      <Badge
                        variant={item.type === 'bug' ? 'error' : 'info'}
                        size="sm"
                        className="font-black uppercase tracking-widest flex items-center gap-1.5 w-fit"
                      >
                        {item.type === 'bug' ? (
                          <BugAntIcon className="w-3.5 h-3.5" />
                        ) : (
                          <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
                        )}
                        {item.type === 'bug' ? 'Bug' : 'UAT'}
                      </Badge>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-gray-900 dark:text-white">{item.title || '—'}</span>
                    </td>
                    <td className="px-8 py-6 max-w-md">
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{getFeedbackSummary(item)}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{item.userName || 'Unknown'}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.userEmail}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <Badge
                        variant="gray"
                        size="sm"
                        className="font-black uppercase tracking-widest"
                      >
                        {DASHBOARD_LABELS[item.role] || item.role || 'Unknown'}
                      </Badge>
                    </td>
                    <td className="px-8 py-6">
                      {item.type === 'bug' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); openStatusModal(item); }}
                          className="flex items-center gap-2 group/status"
                          title="Update bug status"
                        >
                          <Badge
                            variant={BUG_STATUS_BADGE[item.bugStatus] || 'gray'}
                            size="sm"
                            className="font-black uppercase tracking-widest"
                          >
                            {BUG_STATUS_LABEL[item.bugStatus] || 'Set status'}
                          </Badge>
                          <span className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover/status:opacity-100 transition-opacity">
                            Edit
                          </span>
                        </button>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {item.createdAt?.toDate?.()?.toLocaleString() || 'Just now'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bug status modal */}
      <Modal isOpen={statusModal.open} onClose={closeStatusModal} size="md">
        <Modal.Header onClose={closeStatusModal}>
          <Modal.Title>Update Bug Status</Modal.Title>
        </Modal.Header>
        <Modal.Body className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bug: <span className="font-bold text-gray-900 dark:text-white">{statusModal.item?.title}</span>
          </p>

          <div className="grid grid-cols-2 gap-2">
            {BUG_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSelStatus(s.value)}
                className={`px-4 py-3 rounded-xl border-2 text-sm font-bold text-left transition-colors ${
                  selStatus === s.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/20'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {selStatus === 'fixed' && (
            <div>
              <label htmlFor="fix-note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Fix note <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="fix-note"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={4}
                required
                placeholder="Describe what was fixed…"
                className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Posted to every user's Updates tab and sent to the reporter.
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeStatusModal} disabled={savingStatus}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveStatus} loading={savingStatus}>
            Save &amp; Notify
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Feedback detail + AI triage modal */}
      <Modal isOpen={detailModal.open} onClose={closeDetailModal} size="xl">
        <Modal.Header onClose={closeDetailModal}>
          <Modal.Title>
            <span className="inline-flex items-center gap-2">
              <Badge variant={detailModal.item?.type === 'bug' ? 'error' : 'info'} size="sm" className="uppercase tracking-widest font-black">
                {detailModal.item?.type === 'bug' ? 'Bug' : 'UAT'}
              </Badge>
              {detailModal.item?.title || 'Feedback'}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="space-y-5">
          {detailModal.item && (() => {
            const d = detailModal.item;
            const a = d.aiAnalysis;
            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Meta label="Submitted by" value={d.userName} />
                  <Meta label="Email" value={d.userEmail} />
                  <Meta label="Dashboard" value={DASHBOARD_LABELS[d.role] || d.role} />
                  <Meta label="Submitted" value={d.createdAt?.toDate?.()?.toLocaleString()} />
                  {d.page && <Meta label="Page" value={d.page} />}
                  {d.type === 'bug' && <Meta label="Bug status" value={BUG_STATUS_LABEL[d.bugStatus] || 'Not set'} />}
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1.5">Details</h4>
                  {d.type === 'uat' && d.featureStatuses ? (
                    <div className="space-y-2">
                      {Object.values(d.featureStatuses).map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Badge variant={f.status === 'not_working' ? 'error' : 'success'} size="sm" className="mt-0.5 flex-shrink-0">
                            {f.status === 'not_working' ? 'Not working' : 'Working'}
                          </Badge>
                          <div>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{f.label}</span>
                            {f.note ? <p className="text-gray-600 dark:text-gray-400">{f.note}</p> : null}
                          </div>
                        </div>
                      ))}
                      {d.message && <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-2">{d.message}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{d.message || '—'}</p>
                  )}
                </div>

                <div className="rounded-xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-500/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <SparklesIcon className="w-4 h-4" /> AI Triage
                    </h4>
                    <button
                      onClick={runAnalysis}
                      disabled={analyzing}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
                    >
                      {analyzing ? 'Analyzing…' : a ? 'Re-analyze' : 'Analyze with AI'}
                    </button>
                  </div>

                  {!a && !analyzing && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Use AI to judge whether this is fixable and generate a plan plus a ready-to-paste prompt for a coding agent.
                    </p>
                  )}

                  {a && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={a.fixable === 'yes' ? 'success' : a.fixable === 'no' ? 'gray' : 'warning'} size="sm">Fixable: {a.fixable}</Badge>
                        <Badge variant={a.severity === 'high' ? 'error' : a.severity === 'low' ? 'gray' : 'warning'} size="sm">Severity: {a.severity}</Badge>
                        <Badge variant="info" size="sm">Area: {a.area}</Badge>
                      </div>
                      {a.summary && <p className="text-sm text-gray-700 dark:text-gray-200">{a.summary}</p>}
                      {a.plan?.length > 0 && (
                        <div>
                          <h5 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Plan</h5>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                            {a.plan.map((step, i) => <li key={i}>{step}</li>)}
                          </ol>
                        </div>
                      )}
                      {a.agentPrompt && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-xs font-black uppercase tracking-widest text-gray-400">Agent prompt</h5>
                            <button onClick={() => copyPrompt(a.agentPrompt)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Copy</button>
                          </div>
                          <pre className="text-xs whitespace-pre-wrap bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-gray-800 dark:text-gray-200 max-h-56 overflow-y-auto">{a.agentPrompt}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default FeedbackTab;
