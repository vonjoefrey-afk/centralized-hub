import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../../utils/logger';

import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, Skeleton, CardSkeleton, EmptyState, PremiumSelect, Button, Modal } from '../ui';
import {
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  BugAntIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { DASHBOARD_LABELS, ALL_FEATURE_COLUMNS } from '../../constants/dashboardFeatures';
import { downloadCsv } from '../../utils/csv';
import { BUG_STATUSES, BUG_STATUS_LABEL, updateBugFeedbackStatus } from '../../services/feedback';
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
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors duration-200">
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
                          onClick={() => openStatusModal(item)}
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
    </div>
  );
};

export default FeedbackTab;
