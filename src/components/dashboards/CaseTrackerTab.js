import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';

import { useAuth } from '../../contexts/AuthContext';
import { addTrackedCase, getTrackedCasesByUser, deleteTrackedCase, updateTrackedCase, logSpiiAudit, getSpiiDetectionSettings } from '../../firebase/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Button, Card, EmptyState, Badge, ConfirmModal, PremiumSelect } from '../ui';
import { ClipboardDocumentListIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon, MagnifyingGlassIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import { showSuccess, showError, showInfo } from '../../utils/toast';
import { detectSPII } from '../../utils/spiiDetector';
import { logActivity } from '../../services/activity';
import { endSessionForCase } from '../../services/liveSessions';
import clsx from 'clsx';
import { AuroraBarChart, AuroraDonutChart } from '../ui/charts';

import {
    STATUS_OPTIONS, ORIGIN_OPTIONS, SURVEY_OPTIONS, SPII_OPTIONS, TRANSFER_OPTIONS,
    TRANSFER_VALIDATION_OPTIONS, IRT_OPTIONS_EMAIL, IRT_OPTIONS_CHAT, IRT_TYPE_OPTIONS_CHAT,
    WORK_TYPE_OPTIONS,
} from '../../constants/caseFields';

// Compute the current date string in Manila timezone (Asia/Manila, UTC+8)
const getManilaDateString = (dateObj = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(dateObj);
};

const defaultForm = {
    caseId: '',
    status: 'Assigned',
    workType: 'New Case',
    origin: 'Chat',
    survey: 'Not applicable',
    isSpii: 'No',
    isTransferred: 'No',
    transferValidation: '',
    isChatContinued: '',
    irt: '',
    irtType: '',
    comments: '',
    recordDate: getManilaDateString() // Default to today in Manila time (UTC+8)
};

const CaseTrackerTab = () => {
    const { user } = useAuth();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState(defaultForm);
    const [spiiSettings, setSpiiSettings] = useState({ enabled: false });

    // Load SPII Settings
    useEffect(() => {
        const q = doc(db, 'settings', 'spii_monitoring');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.exists()) {
                setSpiiSettings(snapshot.data());
            } else {
                setSpiiSettings({ enabled: false });
            }
        }, (error) => {
            logger.error('Error listening to SPII settings:', error);
        });
        return () => unsubscribe();
    }, []);

    // Inline Editing states
    const [editingCaseId, setEditingCaseId] = useState(null);
    const [editForm, setEditForm] = useState({
        status: '',
        workType: '',
        survey: '',
        surveyStatus: '',
        origin: '',
        isChatContinued: '',
        isSpii: 'No',
        isTransferred: 'No',
        transferValidation: '',
        irt: '',
        irtType: '',
        comments: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // Modal states for native React deletion confirmation
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [caseToDelete, setCaseToDelete] = useState(null);

    // Scalability & Sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [isCompact, setIsCompact] = useState(() => {
        const saved = localStorage.getItem('caseTracker_isCompact');
        return saved !== null ? JSON.parse(saved) : false;
    });

    // Advanced Filtering States
    const [dateFilter, setDateFilter] = useState('Today'); // 'Today', 'Yesterday', 'Last Week', 'Last Month', 'Custom', 'All Time'
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
    const [statusFilter, setStatusFilter] = useState('All');
    const [irtFilter, setIrtFilter] = useState('All'); // 'All', 'Breach', 'No Breach'
    const [surveyFilter, setSurveyFilter] = useState('All');
    const [workTypeFilter, setWorkTypeFilter] = useState('All');

    useEffect(() => {
        localStorage.setItem('caseTracker_isCompact', JSON.stringify(isCompact));
    }, [isCompact]);

    const handleEditClick = (c) => {
        setEditingCaseId(c.id);
        setEditForm({
            status: c.status,
            workType: c.workType || 'New Case',
            survey: c.survey || 'Not applicable',
            surveyStatus: c.surveyStatus || 'N/A',
            origin: c.origin || 'Chat',
            isChatContinued: c.isChatContinued || '',
            isSpii: c.isSpii || 'No',
            isTransferred: c.isTransferred || 'No',
            transferValidation: c.transferValidation || '',
            irt: c.irt || '',
            irtType: c.irtType || '',
            comments: c.comments || ''
        });
    };

    const handleCancelEdit = () => {
        setEditingCaseId(null);
        setEditForm({
            status: '',
            workType: '',
            survey: '',
            surveyStatus: '',
            origin: '',
            isChatContinued: '',
            isSpii: 'No',
            isTransferred: 'No',
            transferValidation: '',
            irt: '',
            irtType: '',
            comments: ''
        });
    };

    const handleSaveEdit = async (docId) => {
        setIsSaving(true);
        try {
            // Re-calculate survey status based on new survey value
            let derivedSurveyStatus = 'Valid';
            if (editForm.survey === 'Not applicable') {
                derivedSurveyStatus = 'Not applicable';
            } else if (editForm.survey === 'CES' && editForm.origin === 'Chat' && editForm.isChatContinued === 'Yes') {
                derivedSurveyStatus = 'Invalid';
            }

            const updatedPayload = {
                ...editForm,
                surveyStatus: derivedSurveyStatus,
                isSpii: editForm.isSpii,
                isTransferred: editForm.isTransferred,
                transferValidation: editForm.transferValidation
            };

            await updateTrackedCase(docId, updatedPayload);

            logActivity(user, {
                eventType: 'case_updated',
                action: 'Edited a case',
                caseId: editForm.caseId,
                isSpii: editForm.isSpii === 'Yes',
                detail: editForm.status,
            });

            // SPII Detection Check
            if (spiiSettings.enabled) {
                // The case ID is a reference, not user content — mark it as such
                // so the detector never flags it; only free-text comments are scanned for SPII.
                const textToScan = `Case ID: ${editForm.caseId}. ${editForm.comments || ''}`;
                const detections = detectSPII(textToScan);
                if (detections.length > 0) {
                    await logSpiiAudit(user.uid, user.displayName, user.teamId, detections, 'Case Tracker (Edit)');
                }
            }

            showSuccess('Case updated successfully');
            setEditingCaseId(null);
            loadCases();
        } catch (err) {
            logger.error('Failed to update case:', err);
            showError('Failed to update case');
        } finally {
            setIsSaving(false);
        }
    };

    const loadCases = useCallback(async () => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            const data = await getTrackedCasesByUser(user.uid);
            setCases(data);
        } catch (err) {
            logger.error('Failed to load tracked cases:', err);
            showError('Failed to load recent cases');
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Filter Logic
    const filteredCases = cases.filter(c => {
        // Search
        const matchesSearch = (c.caseId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (c.origin?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (c.status?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        // Status Filter
        if (statusFilter !== 'All' && c.status !== statusFilter) return false;

        // IRT Filter
        if (irtFilter === 'Breach' && !c.irt) return false;
        if (irtFilter === 'No Breach' && c.irt) return false;

        // Survey Filter
        if (surveyFilter !== 'All' && c.survey !== surveyFilter) return false;

        // Case Type (work type) Filter
        if (workTypeFilter !== 'All' && c.workType !== workTypeFilter) return false;

        // Date Filter
        if (dateFilter !== 'All Time') {
            // The Firestore documents store date in `createdAt` (a Firestore Timestamp)
            const createdAt = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt ? new Date(c.createdAt) : null);
            if (!createdAt) return false;

            const recordDateStr = getManilaDateString(createdAt);
            const today = getManilaDateString();
            const todayObj = new Date(today + 'T00:00:00');
            const dateObj = new Date(recordDateStr + 'T00:00:00');
            
            if (dateFilter === 'Today' && recordDateStr !== today) return false;
            
            if (dateFilter === 'Yesterday') {
                const yesterday = new Date(todayObj);
                yesterday.setDate(yesterday.getDate() - 1);
                const yestStr = yesterday.toISOString().split('T')[0];
                if (recordDateStr !== yestStr) return false;
            }
            
            if (dateFilter === 'Last Week') {
                const lastWeek = new Date(todayObj);
                lastWeek.setDate(lastWeek.getDate() - 7);
                if (dateObj < lastWeek || dateObj > todayObj) return false;
            }
            
            if (dateFilter === 'Last Month') {
                const lastMonth = new Date(todayObj);
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                if (dateObj < lastMonth || dateObj > todayObj) return false;
            }
            
            if (dateFilter === 'Custom' && customDateRange.start && customDateRange.end) {
                const start = new Date(customDateRange.start + 'T00:00:00');
                const end = new Date(customDateRange.end + 'T23:59:59');
                if (createdAt < start || createdAt > end) return false;
            }
        }

        return true;
    });

    useEffect(() => {
        loadCases();
    }, [loadCases]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.caseId.trim()) {
            showError("Case ID is required");
            return;
        }

        if (form.origin === 'Chat' && form.survey === 'CES' && !form.isChatContinued) {
            showError("Please specify if chat was continued to email or transferred.");
            return;
        }

        if (form.isTransferred === 'Yes' && !form.transferValidation) {
            showError("Please select a Transfer Validation option.");
            return;
        }

        setSubmitting(true);
        try {
            // Determine the calculated Survey Status based on user inputs
            let derivedSurveyStatus = 'Valid';
            if (form.survey === 'Not applicable') {
                derivedSurveyStatus = 'Not applicable';
            } else if (form.survey === 'CES' && form.origin === 'Chat' && form.isChatContinued === 'Yes') {
                derivedSurveyStatus = 'Invalid';
            }

            const payloadToSave = {
                ...form,
                surveyStatus: derivedSurveyStatus,
                customDate: form.recordDate // Pass the custom date to firestore helper
            };

            await addTrackedCase(user.uid, payloadToSave, user.teamId);

            logActivity(user, {
                eventType: 'case_tracked',
                action: 'Tracked a case',
                caseId: form.caseId,
                isSpii: form.isSpii === 'Yes',
                detail: [form.status, form.origin].filter(Boolean).join(' · '),
            });

            // Recording the case means the agent is done with it: close its
            // template live session, if any (no extra click needed).
            endSessionForCase(user, form.caseId).then((n) => {
                if (n > 0) showInfo(`Live session for ${form.caseId.trim()} ended`);
            });

            // SPII Detection Check
            if (spiiSettings.enabled) {
                // The case ID is a reference, not user content — mark it as such
                // so the detector never flags it; only free-text comments are scanned for SPII.
                const textToScan = `Case ID: ${form.caseId}. ${form.comments || ''}`;
                const detections = detectSPII(textToScan);
                if (detections.length > 0) {
                    await logSpiiAudit(user.uid, user.displayName, user.teamId, detections, 'Case Tracker (New)');
                }
            }

            // Syncing into 'My SPII Cases' (and keeping it current on every later edit)
            // is handled server-side by the syncTrackedCaseToSpii trigger, so it never
            // goes stale no matter which screen the case gets updated from.
            if (form.isSpii === 'Yes') {
                showInfo("Case synchronized into 'My SPII Cases' automatically.");
            }

            showSuccess("Case record saved!");
            setForm({
                ...defaultForm,
                recordDate: getManilaDateString() // Always reset to current Manila date for next entry
            });
            loadCases();
        } catch (err) {
            if (err.code === 'duplicate-id') {
                showError(`Case ${form.caseId} has already been tracked.`);
            } else {
                showError("Failed to track case");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteClick = (caseItem) => {
        setCaseToDelete(caseItem);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!caseToDelete) return;

        try {
            await deleteTrackedCase(caseToDelete.id);
            logActivity(user, {
                eventType: 'case_deleted',
                action: 'Deleted a case',
                caseId: caseToDelete.caseId,
                isSpii: caseToDelete.isSpii === 'Yes',
            });
            showSuccess('Case removed from your history');
            loadCases();
        } catch (err) {
            showError("Failed to delete record");
        } finally {
            setDeleteModalOpen(false);
            setCaseToDelete(null);
        }
    };

    return (
        <div className="animate-fade-in">
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Tracked Case"
                message={`Are you sure you want to delete ${caseToDelete?.caseId}? This will only delete your tracking log (bridged SPII cases are safe).`}
                confirmText="Delete Tracking Log"
                type="danger"
            />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start mt-8">
                {/* Left Column: Form Container */}
                <div className="xl:col-span-4 relative overflow-hidden rounded-3xl bg-white/70 dark:bg-[#111111]/70 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 border border-white/20 dark:border-white/5 transition-all duration-500 hover:shadow-indigo-500/20">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-cyan-500 to-pink-500 opacity-80"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 p-6 md:p-10">
                    <div className="flex items-center space-x-4 mb-10">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                            <ClipboardDocumentListIcon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Case Logger Station</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Precision tracking for your interaction metrics.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">

                            {/* Case ID */}
                            <div className="relative group">
                                <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-2.5 ml-1">
                                    Case Identifier
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., 00012345"
                                    className="block w-full rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 py-3.5 px-4 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                                    value={form.caseId}
                                    onChange={(e) => setForm({ ...form, caseId: e.target.value })}
                                />
                            </div>

                            {/* Record Date */}
                            <div className="relative group">
                                <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-2.5 ml-1">
                                    Record Date
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="block w-full rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 py-3.5 px-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                                    value={form.recordDate}
                                    onChange={(e) => setForm({ ...form, recordDate: e.target.value })}
                                />
                            </div>

                            {/* Status */}
                            <div className="relative">
                                <PremiumSelect
                                    label="State Matrix"
                                    value={form.status}
                                    options={STATUS_OPTIONS}
                                    onChange={(val) => setForm({ ...form, status: val })}
                                />
                            </div>

                            {/* Case Type — EOD classification (New Case vs Backlog) */}
                            <div className="relative">
                                <PremiumSelect
                                    label="Case Type"
                                    value={form.workType}
                                    options={WORK_TYPE_OPTIONS}
                                    onChange={(val) => setForm({ ...form, workType: val })}
                                />
                            </div>

                            {/* Survey */}
                            <div className="relative">
                                <PremiumSelect
                                    label="Survey Vector"
                                    value={form.survey}
                                    options={SURVEY_OPTIONS}
                                    onChange={(val) => setForm({ ...form, survey: val })}
                                />
                            </div>

                            {/* Origin - Premium Toggle */}
                            <div className="col-span-1">
                                <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-3 ml-1">
                                    Origin
                                </label>
                                <div className="flex bg-gray-50/80 dark:bg-white/5 p-1 rounded-2xl border border-gray-100 dark:border-white/10 w-fit">
                                    {ORIGIN_OPTIONS.map(opt => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setForm({ ...form, origin: opt, irt: '', irtType: '' })}
                                            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${form.origin === opt
                                                ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-md'
                                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* IRT Breach */}
                            <div className="relative">
                                <PremiumSelect
                                    label="IRT Breach"
                                    value={form.irt}
                                    options={[
                                        { label: '-- No Breach --', value: '' },
                                        ...(form.origin === 'Email' ? IRT_OPTIONS_EMAIL : IRT_OPTIONS_CHAT).map(opt => ({ label: opt, value: opt }))
                                    ]}
                                    onChange={(val) => setForm({ ...form, irt: val, irtType: '' })}
                                />
                            </div>

                            {/* IRT Type - Conditional for Chat */}
                            {form.origin === 'Chat' && form.irt && (
                                <div className="relative animate-slide-up">
                                    <PremiumSelect
                                        label="IRT Type"
                                        value={form.irtType}
                                        options={IRT_TYPE_OPTIONS_CHAT.map(opt => ({ label: opt, value: opt }))}
                                        onChange={(val) => setForm({ ...form, irtType: val })}
                                        placeholder="Select IRT type..."
                                    />
                                </div>
                            )}

                            {/* Combined Toggles: SPII & Transferred */}
                            <div className="col-span-1">
                                <div className="flex flex-row items-start space-x-12">
                                    {/* SPII */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-3 ml-1">
                                            Contains SPII?
                                        </label>
                                        <div className="flex bg-gray-50/80 dark:bg-white/5 p-1 rounded-2xl border border-gray-100 dark:border-white/10 w-fit">
                                            {SPII_OPTIONS.map(opt => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, isSpii: opt })}
                                                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${form.isSpii === opt
                                                        ? (opt === 'Yes'
                                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                                            : 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-md')
                                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                                        }`}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Transferred */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-3 ml-1">
                                            Transferred
                                        </label>
                                        <div className="flex bg-gray-50/80 dark:bg-white/5 p-1 rounded-2xl border border-gray-100 dark:border-white/10 w-fit">
                                            {TRANSFER_OPTIONS.map(opt => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => setForm({ 
                                                        ...form, 
                                                        isTransferred: opt,
                                                        transferValidation: opt === 'No' ? '' : form.transferValidation 
                                                    })}
                                                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${form.isTransferred === opt
                                                        ? (opt === 'Yes'
                                                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                                            : 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-md')
                                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                                        }`}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Comments / Important Notes */}
                            <div className="col-span-full">
                                <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-3 ml-1">
                                    Important Notes / Comments
                                </label>
                                <textarea
                                    value={form.comments}
                                    onChange={(e) => setForm({ ...form, comments: e.target.value })}
                                    placeholder="Add any relevant details about this case..."
                                    rows={2}
                                    className="w-full px-5 py-3 bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 resize-none"
                                />
                            </div>

                            {/* Conditional Transfer Validation Message */}
                            {form.isTransferred === 'Yes' && (
                                <div className="col-span-full animate-slide-up">
                                    <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start space-x-4">
                                        <div className="p-2 bg-amber-500 rounded-lg shrink-0 mt-0.5">
                                            <CheckIcon className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                                                Transfer Validation <span className="text-red-500">*</span>
                                            </p>
                                            <div className="flex flex-wrap gap-4">
                                                {TRANSFER_VALIDATION_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setForm({ ...form, transferValidation: opt })}
                                                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${form.transferValidation === opt
                                                            ? 'bg-amber-600 text-white shadow-md'
                                                            : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Conditional Message */}
                            {form.origin === 'Chat' && form.survey === 'CES' && (
                                <div className="col-span-full animate-slide-up">
                                    <div className="bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 flex items-start space-x-4">
                                        <div className="p-2 bg-indigo-500 rounded-lg shrink-0 mt-0.5">
                                            <CheckIcon className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                                                Is chat continued to email or will be transferred? <span className="text-red-500">*</span>
                                            </p>
                                            <div className="flex space-x-4">
                                                {['Yes', 'No'].map(opt => (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setForm({ ...form, isChatContinued: opt })}
                                                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${form.isChatContinued === opt
                                                            ? 'bg-indigo-600 text-white shadow-md'
                                                            : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest hidden md:block">
                                Note: Don't include any SPII in the case notes.
                            </p>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="min-w-[200px] h-14 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                            >
                                {submitting ? 'Processing...' : 'Track Case'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
            {/* Right Column: Premium Ledger Section */}
            <div className="xl:col-span-8 relative overflow-hidden rounded-3xl bg-white/70 dark:bg-[#111111]/70 backdrop-blur-xl shadow-2xl shadow-purple-500/10 border border-white/20 dark:border-white/5 transition-all duration-500 hover:shadow-purple-500/20 flex flex-col h-full">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 opacity-80"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10 p-6 md:p-10 flex flex-col gap-6 h-full">
                    <div className="flex items-center space-x-4 mb-2">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg shadow-purple-500/20">
                            <ListBulletIcon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Timeline Ledger</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Your personal activity stream and history.</p>
                        </div>
                    </div>

                    {/* Advanced Filter Toolbar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 dark:bg-white/[0.02] p-5 rounded-2xl border border-gray-100 dark:border-white/10">
                        
                        {/* Date Filter */}
                        <PremiumSelect
                            label="Date Range"
                            value={dateFilter}
                            options={['Today', 'Yesterday', 'Last Week', 'Last Month', 'Custom', 'All Time']}
                            onChange={(val) => setDateFilter(val)}
                        />

                        {/* Status Filter */}
                        <PremiumSelect
                            label="Status"
                            value={statusFilter}
                            options={['All', ...STATUS_OPTIONS]}
                            onChange={(val) => setStatusFilter(val)}
                        />

                        {/* IRT Filter */}
                        <PremiumSelect
                            label="IRT Breach"
                            value={irtFilter}
                            options={['All', 'Breach', 'No Breach']}
                            onChange={(val) => setIrtFilter(val)}
                        />

                        {/* Survey Filter */}
                        <PremiumSelect
                            label="Survey"
                            value={surveyFilter}
                            options={['All', ...SURVEY_OPTIONS]}
                            onChange={(val) => setSurveyFilter(val)}
                        />

                        {/* Case Type Filter (EOD: New Case vs Backlog) */}
                        <PremiumSelect
                            label="Case Type"
                            value={workTypeFilter}
                            options={['All', ...WORK_TYPE_OPTIONS]}
                            onChange={(val) => setWorkTypeFilter(val)}
                        />

                        {dateFilter === 'Custom' && (
                            <div className="col-span-full flex items-center gap-3 animate-slide-up">
                                <div className="flex-1">
                                    <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-2 ml-1">From</label>
                                    <input
                                        type="date"
                                        value={customDateRange.start}
                                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                                        className="block w-full bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/10 backdrop-blur-md rounded-2xl px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-all duration-300 hover:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <span className="text-gray-400 text-xs font-bold mt-6">→</span>
                                <div className="flex-1">
                                    <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-2 ml-1">To</label>
                                    <input
                                        type="date"
                                        value={customDateRange.end}
                                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                                        className="block w-full bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/10 backdrop-blur-md rounded-2xl px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-all duration-300 hover:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Search & View Toggle */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative group flex-1 min-w-[200px]">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className={`w-4 h-4 transition-colors duration-300 ${searchTerm ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'}`} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search Case ID or Status..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2.5 bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/10 backdrop-blur-md rounded-2xl text-sm font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 hover:border-indigo-500/50"
                            />
                        </div>

                        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl border border-gray-200 dark:border-white/10">
                            <button
                                onClick={() => setIsCompact(false)}
                                className={`p-2 rounded-xl transition-all duration-300 ${!isCompact ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                title="Comfortable Grid"
                            >
                                <Squares2X2Icon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setIsCompact(true)}
                                className={`p-2 rounded-xl transition-all duration-300 ${isCompact ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                title="Compact List"
                            >
                                <ListBulletIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Interactive Analytics Charts */}
                    {filteredCases.length > 0 && (() => {
                        // Compute chart data from filteredCases
                        const statusCounts = {};
                        const originCounts = {};
                        let irtBreachCount = 0;
                        let irtPassCount = 0;
                        const surveyCounts = {};

                        filteredCases.forEach(c => {
                            statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
                            originCounts[c.origin || 'Unknown'] = (originCounts[c.origin || 'Unknown'] || 0) + 1;
                            if (c.irt) irtBreachCount++; else irtPassCount++;
                            surveyCounts[c.survey || 'N/A'] = (surveyCounts[c.survey || 'N/A'] || 0) + 1;
                        });

                        const STATUS_COLORS = {
                            'Assigned': '#6366f1', 'SO': '#f59e0b', 'Closed': '#10b981',
                            'WOCR': '#8b5cf6', 'WOCRE': '#a78bfa', 'IPGS': '#06b6d4',
                            'IPTP': '#14b8a6', 'IPGO': '#0ea5e9', 'IPGE': '#3b82f6', 'IPCR': '#ec4899'
                        };
                        const ORIGIN_COLORS = { 'Chat': '#6366f1', 'Email': '#f59e0b', 'Unknown': '#94a3b8' };

                        const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
                        const originData = Object.entries(originCounts).map(([name, value]) => ({ name, value }));
                        const totalCases = filteredCases.length;
                        const breachRate = totalCases > 0 ? Math.round((irtBreachCount / totalCases) * 100) : 0;

                        return (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Summary Stats Row */}
                                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/5 dark:to-purple-500/5 rounded-2xl p-4 border border-indigo-500/10 dark:border-indigo-500/10 flex flex-col items-center justify-center">
                                    <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{totalCases}</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Total Cases</p>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5 rounded-2xl p-4 border border-emerald-500/10 dark:border-emerald-500/10 flex flex-col items-center justify-center">
                                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{statusCounts['Closed'] || 0}</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Closed</p>
                                </div>
                                <div className={clsx(
                                    'rounded-2xl p-4 border flex flex-col items-center justify-center',
                                    breachRate > 30 ? 'bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/10' :
                                    breachRate > 15 ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/10' :
                                    'bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/10'
                                )}>
                                    <p className={clsx(
                                        'text-3xl font-black',
                                        breachRate > 30 ? 'text-red-500' : breachRate > 15 ? 'text-amber-500' : 'text-emerald-500'
                                    )}>{breachRate}%</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">IRT Breach</p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5 rounded-2xl p-4 border border-blue-500/10 dark:border-blue-500/10 flex flex-col items-center justify-center">
                                    <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{Object.keys(originCounts).length}</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Channels</p>
                                </div>

                                {/* Status Donut Chart — Aurora Signal, semantic status colors preserved */}
                                <div className="col-span-2 bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
                                    <p className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-3">Status Distribution</p>
                                    <AuroraDonutChart
                                        data={statusData}
                                        dataKey="value"
                                        nameKey="name"
                                        colors={STATUS_COLORS}
                                        centerValue={totalCases}
                                        centerLabel="Cases"
                                        unit="cases"
                                        height={180}
                                        innerRadius={45}
                                        outerRadius={72}
                                    />
                                </div>

                                {/* Origin Bar Chart — Aurora Signal, semantic origin colors preserved */}
                                <div className="col-span-2 bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
                                    <p className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-3">Origin Breakdown</p>
                                    <AuroraBarChart
                                        data={originData}
                                        xKey="name"
                                        yKey="value"
                                        colors={ORIGIN_COLORS}
                                        unit="cases"
                                        barSize={32}
                                        height={180}
                                    />
                                </div>
                            </div>
                        );
                    })()}

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                        {[1, 2, 3, 4].map((n) => (
                            <div key={n} className="h-48 bg-gray-100 dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/10"></div>
                        ))}
                    </div>
                ) : filteredCases.length === 0 ? (
                    <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-3xl border border-dashed border-gray-300 dark:border-white/10 p-20 flex flex-center">
                        <EmptyState
                            icon={<ClipboardDocumentListIcon className="h-16 w-16 text-indigo-300 dark:text-indigo-500/50" />}
                            title={searchTerm ? "No matches found" : "No records found"}
                            description={searchTerm ? `No results for "${searchTerm}". Try a different search term.` : "Start tracking cases using the station above to build your ledger."}
                        />
                    </div>
                ) : isCompact ? (
                    /* Compact List View */
                    <div className="space-y-3">
                        {filteredCases.map((c) => (
                            <div
                                key={c.id}
                                className="group relative bg-white dark:bg-[#141414] border border-gray-100 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-300 hover:border-indigo-500/30 animate-slide-up"
                            >
                                <div className="flex items-center space-x-4 flex-1">
                                    <div className={`w-1 h-8 rounded-full ${c.status === 'Closed' ? 'bg-emerald-500' :
                                        c.status === 'SO' ? 'bg-amber-500' :
                                            c.status === 'Assigned' ? 'bg-blue-500' : 'bg-slate-400'
                                        }`}></div>

                                    <div className="min-w-[120px]">
                                        <h4 className="text-sm font-black text-gray-900 dark:text-white">#{c.caseId}</h4>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{c.origin}</p>
                                    </div>

                                    <div className="hidden lg:flex items-center space-x-6 flex-1">
                                        <div className="flex items-center space-x-2">
                                                <div className="flex items-center space-x-2">
                                                    <div className={`w-2 h-2 rounded-full ${c.status === 'Closed' ? 'bg-emerald-500' :
                                                        c.status === 'SO' ? 'bg-amber-500' :
                                                            c.status === 'Assigned' ? 'bg-blue-500' : 'bg-slate-400'
                                                        }`}></div>
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{c.status}</span>
                                                </div>
                                        </div>

                                        {/* Case Type (EOD) */}
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.workType === 'Backlog' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : c.workType === 'New Case' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'}`}>
                                            {c.workType || '—'}
                                        </span>

                                        <div className="flex items-center space-x-4">
                                         <div className="flex items-center space-x-3 flex-1 min-w-0">
                                            {editingCaseId === c.id ? (
                                                <div className="flex flex-wrap items-center gap-1.5 py-1 flex-1 min-w-0">
                                                    <PremiumSelect
                                                        size="sm"
                                                        value={editForm.status}
                                                        icon={<span className="text-[10px] font-bold opacity-70">ST:</span>}
                                                        options={STATUS_OPTIONS}
                                                        onChange={(val) => setEditForm({ ...editForm, status: val })}
                                                        className="w-[100px]"
                                                    />
                                                    <PremiumSelect
                                                        size="sm"
                                                        value={editForm.workType}
                                                        icon={<span className="text-[10px] font-bold opacity-70">WT:</span>}
                                                        options={WORK_TYPE_OPTIONS}
                                                        onChange={(val) => setEditForm({ ...editForm, workType: val })}
                                                        className="w-[120px]"
                                                    />
                                                    <PremiumSelect
                                                        size="sm"
                                                        value={editForm.survey}
                                                        icon={<span className="text-[10px] font-bold opacity-70">SV:</span>}
                                                        options={SURVEY_OPTIONS}
                                                        onChange={(val) => setEditForm({ ...editForm, survey: val })}
                                                        className="w-[100px]"
                                                    />
                                                    <PremiumSelect
                                                        size="sm"
                                                        value={editForm.surveyStatus}
                                                        icon={<span className="text-[10px] font-bold opacity-70">RES:</span>}
                                                        options={['Valid', 'Invalid', 'Not applicable', 'N/A']}
                                                        onChange={(val) => setEditForm({ ...editForm, surveyStatus: val })}
                                                        className="w-[95px]"
                                                    />
                                                    <PremiumSelect
                                                        size="sm"
                                                        value={editForm.isSpii}
                                                        icon={<span className="text-[10px] font-bold opacity-70">SPII:</span>}
                                                        options={SPII_OPTIONS}
                                                        onChange={(val) => setEditForm({ ...editForm, isSpii: val })}
                                                        className="w-[75px]"
                                                    />
                                                    <PremiumSelect
                                                        size="sm"
                                                        value={editForm.irt}
                                                        icon={<span className="text-[10px] font-bold opacity-70">IRT:</span>}
                                                        options={[
                                                            { label: '-- No Breach --', value: '' },
                                                            ...(editForm.origin === 'Email' ? IRT_OPTIONS_EMAIL : IRT_OPTIONS_CHAT).map(opt => ({ label: opt, value: opt }))
                                                        ]}
                                                        onChange={(val) => setEditForm({ ...editForm, irt: val, irtType: '' })}
                                                        className="w-[110px]"
                                                    />
                                                    {editForm.origin === 'Chat' && editForm.irt && (
                                                        <PremiumSelect
                                                            size="sm"
                                                            value={editForm.irtType}
                                                            icon={<span className="text-[10px] font-bold opacity-70">MODE:</span>}
                                                            options={IRT_TYPE_OPTIONS_CHAT.map(opt => ({ label: opt, value: opt }))}
                                                            onChange={(val) => setEditForm({ ...editForm, irtType: val })}
                                                            className="w-[110px] animate-in slide-in-from-left-2 duration-200"
                                                        />
                                                    )}
                                                    <PremiumSelect
                                                        size="sm"
                                                        value={editForm.isTransferred}
                                                        icon={<span className="text-[10px] font-bold opacity-70">TRX:</span>}
                                                        options={TRANSFER_OPTIONS}
                                                        onChange={(val) => setEditForm({ ...editForm, isTransferred: val })}
                                                        className="w-[80px]"
                                                    />
                                                    {editForm.isTransferred === 'Yes' && (
                                                        <PremiumSelect
                                                            size="sm"
                                                            value={editForm.transferValidation}
                                                            icon={<span className="text-[10px] font-bold opacity-70">VAL:</span>}
                                                            options={TRANSFER_VALIDATION_OPTIONS}
                                                            onChange={(val) => setEditForm({ ...editForm, transferValidation: val })}
                                                            className="w-[90px]"
                                                        />
                                                    )}
                                                    {/* Compact Comments Input */}
                                                    <div className="flex items-center bg-gray-50/50 dark:bg-white/[0.03] rounded-lg border border-gray-100 dark:border-white/10 px-2.5 py-1 w-full mt-1">
                                                        <span className="text-[10px] font-bold opacity-70 mr-2 shrink-0 uppercase tracking-wider">Note:</span>
                                                        <input
                                                            type="text"
                                                            value={editForm.comments}
                                                            onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })}
                                                            placeholder="Add important notes..."
                                                            className="bg-transparent border-none text-[11px] text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0 p-0 w-full"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-[10px] bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-md text-gray-500 font-bold">Survey: {c.survey}</span>
                                                    {/* Survey Validity */}
                                                    <span className={clsx(
                                                        'text-[10px] px-2 py-1 rounded-md font-bold',
                                                        c.surveyStatus === 'Valid' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' :
                                                        c.surveyStatus === 'Invalid' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' :
                                                        'bg-gray-50 dark:bg-white/5 text-gray-400'
                                                    )}>
                                                        {c.surveyStatus || 'N/A'}
                                                    </span>
                                                    {/* SPII Badge */}
                                                    {c.isSpii === 'Yes' && (
                                                        <span className="text-[10px] bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-md text-rose-600 dark:text-rose-400 font-black uppercase tracking-wide">
                                                            ⚠ SPII
                                                        </span>
                                                    )}
                                                    {c.irt && (
                                                        <div className="flex flex-col items-start gap-0.5">
                                                            <span className="text-[10px] bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-md text-red-500 font-bold max-w-[150px] truncate">
                                                                IRT: {c.irt}
                                                            </span>
                                                            {c.irtType && (
                                                                <span className="text-[8px] bg-red-100 dark:bg-red-500/20 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-black uppercase ml-1 tracking-tighter">
                                                                    {c.irtType}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {c.isTransferred === 'Yes' && (
                                                        <span className="text-[10px] bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-md text-amber-500 font-bold">
                                                            Transferred: {c.transferValidation}
                                                        </span>
                                                    )}
                                                    {/* Compact Note Snippet */}
                                                    {c.comments && (
                                                        <div className="flex items-center px-2 py-1 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-lg border border-indigo-100/30 dark:border-indigo-500/10 max-w-[150px]" title={c.comments}>
                                                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium italic truncate">
                                                                "{c.comments}"
                                                            </span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-6">
                                    <div className="hidden md:flex flex-col items-end gap-0.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">
                                            {c.createdAt?.toDate
                                                ? c.createdAt.toDate().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })
                                                : 'Today'}
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-500">
                                            {c.createdAt?.toDate
                                                ? c.createdAt.toDate().toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })
                                                : ''}
                                        </p>
                                    </div>

                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {editingCaseId === c.id ? (
                                            <>
                                                <button
                                                    onClick={() => handleSaveEdit(c.id)}
                                                    disabled={isSaving}
                                                    className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                    title="Save"
                                                >
                                                    <CheckIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Cancel"
                                                >
                                                    <XMarkIcon className="h-4 w-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleEditClick(c)}
                                                    className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(c)}
                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Comfortable Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredCases.map((c) => (
                            <div
                                key={c.id}
                                className="group relative overflow-hidden rounded-3xl bg-white dark:bg-[#141414] border border-gray-100 dark:border-white/5 p-6 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 animate-slide-up"
                            >
                                {/* Status Indicator Stripe */}
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${c.status === 'Closed' ? 'bg-emerald-500' :
                                    c.status === 'SO' ? 'bg-amber-500' :
                                        c.status === 'Assigned' ? 'bg-blue-500' : 'bg-slate-400'
                                    } opacity-60`}></div>

                                <div className="flex flex-col h-full space-y-5">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                <h4 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                                                    #{c.caseId}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                                                    {c.origin}
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                            </p>
                                        </div>

                                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gray-50 dark:bg-white/5 rounded-xl p-1">
                                            {editingCaseId === c.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleSaveEdit(c.id)}
                                                        disabled={isSaving}
                                                        className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                        title="Save"
                                                    >
                                                        <CheckIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                        title="Cancel"
                                                    >
                                                        <XMarkIcon className="h-4 w-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleEditClick(c)}
                                                        className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(c)}
                                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Content Grid */}
                                    <div className="flex-1 mt-2">
                                        {editingCaseId === c.id ? (
                                            <div className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/5 p-4 space-y-4">
                                                {/* Header Line */}
                                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3 mb-1">
                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Configuration Console</span>
                                                    <div className="flex items-center space-x-1.5 opacity-60">
                                                        {c.irt ? <XMarkIcon className="w-3 h-3 text-red-500" /> : <CheckIcon className="w-3 h-3 text-emerald-500" />}
                                                        <span className="text-[9px] font-bold uppercase tracking-wider">{c.irt ? 'Breach' : 'SLA Passed'}</span>
                                                    </div>
                                                </div>

                                                {/* Primary Controls Row */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Case Status</label>
                                                        <PremiumSelect
                                                            size="md"
                                                            value={editForm.status}
                                                            options={STATUS_OPTIONS}
                                                            onChange={(val) => setEditForm({ ...editForm, status: val })}
                                                            className="bg-white/50 dark:bg-white/[0.02]"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Case Type</label>
                                                        <PremiumSelect
                                                            size="md"
                                                            value={editForm.workType}
                                                            options={WORK_TYPE_OPTIONS}
                                                            onChange={(val) => setEditForm({ ...editForm, workType: val })}
                                                            className="bg-white/50 dark:bg-white/[0.02]"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Survey Vector</label>
                                                        <PremiumSelect
                                                            size="md"
                                                            value={editForm.survey}
                                                            options={SURVEY_OPTIONS}
                                                            onChange={(val) => setEditForm({ ...editForm, survey: val })}
                                                            className="bg-white/50 dark:bg-white/[0.02]"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Secondary Controls Row */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Survey Validity</label>
                                                        <PremiumSelect
                                                            size="md"
                                                            value={editForm.surveyStatus}
                                                            options={['Valid', 'Invalid', 'Not applicable', 'N/A']}
                                                            onChange={(val) => setEditForm({ ...editForm, surveyStatus: val })}
                                                            className="bg-white/50 dark:bg-white/[0.02]"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">SPII & Transfer</label>
                                                        <div className="flex items-center gap-2 p-1.5 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5 h-[46px]">
                                                            <div className="flex-1 min-w-0">
                                                                <PremiumSelect
                                                                    size="sm"
                                                                    value={editForm.isSpii}
                                                                    icon={<span className="text-[9px] font-bold opacity-60">S:</span>}
                                                                    options={SPII_OPTIONS}
                                                                    onChange={(val) => setEditForm({ ...editForm, isSpii: val })}
                                                                    className="bg-transparent border-none px-1"
                                                                />
                                                            </div>
                                                            <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />
                                                            <div className="flex-1 min-w-0">
                                                                <PremiumSelect
                                                                    size="sm"
                                                                    value={editForm.isTransferred}
                                                                    icon={<span className="text-[9px] font-bold opacity-60">T:</span>}
                                                                    options={TRANSFER_OPTIONS}
                                                                    onChange={(val) => setEditForm({ ...editForm, isTransferred: val })}
                                                                    className="bg-transparent border-none px-1"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* IRT Management Row */}
                                                <div className="pt-2 border-t border-gray-100 dark:border-white/5 grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">IRT Breach</label>
                                                        <PremiumSelect
                                                            size="sm"
                                                            value={editForm.irt}
                                                            options={[
                                                                { label: '-- No Breach --', value: '' },
                                                                ...(editForm.origin === 'Email' ? IRT_OPTIONS_EMAIL : IRT_OPTIONS_CHAT).map(opt => ({ label: opt, value: opt }))
                                                            ]}
                                                            onChange={(val) => setEditForm({ ...editForm, irt: val, irtType: '' })}
                                                            className="bg-white/50 dark:bg-white/[0.02]"
                                                        />
                                                    </div>
                                                    {editForm.origin === 'Chat' && editForm.irt && (
                                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-right-2 duration-300">
                                                            <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">IRT Type</label>
                                                            <PremiumSelect
                                                                size="sm"
                                                                value={editForm.irtType}
                                                                options={IRT_TYPE_OPTIONS_CHAT.map(opt => ({ label: opt, value: opt }))}
                                                                onChange={(val) => setEditForm({ ...editForm, irtType: val })}
                                                                className="bg-white/50 dark:bg-white/[0.02]"
                                                                placeholder="Select type..."
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Conditional Validation Line */}
                                                {editForm.isTransferred === 'Yes' && (
                                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 pt-2 border-t border-gray-100 dark:border-white/5">
                                                        <div className="flex items-center space-x-3">
                                                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Route Validation:</span>
                                                            <PremiumSelect
                                                                size="sm"
                                                                value={editForm.transferValidation}
                                                                options={TRANSFER_VALIDATION_OPTIONS}
                                                                onChange={(val) => setEditForm({ ...editForm, transferValidation: val })}
                                                                className="w-32 bg-amber-500/5 border-amber-500/10 text-amber-600 font-bold"
                                                                placeholder="Select route..."
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Comments Box */}
                                                <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                                                    <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 block mb-2">Important Notes</label>
                                                    <textarea
                                                        value={editForm.comments}
                                                        onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })}
                                                        placeholder="Update notes..."
                                                        rows={2}
                                                        className="w-full px-3 py-2 bg-white/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all duration-300 resize-none"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4 h-full">
                                                <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-3 border border-gray-100/50 dark:border-white/5">
                                                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Current State</p>
                                                    <div className="flex items-center space-x-2">
                                                        <div className={`w-2 h-2 rounded-full ${c.status === 'Closed' ? 'bg-emerald-500' :
                                                            c.status === 'SO' ? 'bg-amber-500' :
                                                                c.status === 'Assigned' ? 'bg-blue-500' : 'bg-slate-400'
                                                            }`}></div>
                                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{c.status}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-3 border border-gray-100/50 dark:border-white/5">
                                                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Case Type</p>
                                                    <span className={`text-sm font-bold ${c.workType === 'Backlog' ? 'text-amber-600 dark:text-amber-300' : c.workType === 'New Case' ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-400'}`}>{c.workType || '—'}</span>
                                                </div>

                                                <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-3 border border-gray-100/50 dark:border-white/5">
                                                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Survey</p>
                                                    <span className={`text-sm font-bold ${c.survey === 'Not applicable' ? 'text-gray-400' : 'text-gray-900 dark:text-white'
                                                        }`}>{c.survey}</span>
                                                </div>

                                                <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-3 border border-gray-100/50 dark:border-white/5">
                                                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                                                        <span>SLA / IRT</span>
                                                        {c.origin && <span className="opacity-60 font-bold tracking-tighter">{c.origin}</span>}
                                                    </p>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center space-x-1.5">
                                                            {c.irt ? (
                                                                <XMarkIcon className="w-4 h-4 text-red-500" />
                                                            ) : (
                                                                <CheckIcon className="w-4 h-4 text-emerald-500" />
                                                            )}
                                                            <span className={`text-sm font-bold ${c.irt ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                {c.irt ? 'Breach' : 'Passed'}
                                                            </span>
                                                        </div>
                                                        {c.irt && (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] text-red-500/80 font-bold leading-tight line-clamp-2">
                                                                    {c.irt}
                                                                </span>
                                                                {c.irtType && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-md font-black uppercase tracking-tighter w-fit">
                                                                        {c.irtType}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-3 border border-gray-100/50 dark:border-white/5">
                                                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Validity</p>
                                                    <span className={clsx(
                                                        'text-sm font-bold',
                                                        c.surveyStatus === 'Valid' ? 'text-emerald-500' :
                                                            c.surveyStatus === 'Invalid' ? 'text-red-500' : 'text-gray-400'
                                                    )}>
                                                        {c.surveyStatus || 'N/A'}
                                                    </span>
                                                </div>

                                                <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-3 border border-gray-100/50 dark:border-white/5 col-span-2">
                                                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">SPII / Transfer</p>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex gap-2">
                                                            <Badge variant={c.isSpii === 'Yes' ? 'danger' : 'neutral'} size="sm">
                                                                SPII: {c.isSpii || 'No'}
                                                            </Badge>
                                                            <Badge variant={c.isTransferred === 'Yes' ? 'warning' : 'neutral'} size="sm">
                                                                Transferred: {c.isTransferred || 'No'}
                                                            </Badge>
                                                        </div>
                                                        {c.transferValidation && (
                                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
                                                                Valid: {c.transferValidation}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Important Notes Display */}
                                                {c.comments && (
                                                    <div className="col-span-full mt-2 bg-indigo-500/[0.03] dark:bg-indigo-500/[0.05] rounded-xl p-3 border border-indigo-500/10 dark:border-indigo-500/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 flex items-center">
                                                            Important Notes
                                                        </p>
                                                        <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed italic">
                                                            "{c.comments}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                         <div className="mt-auto pt-4 border-t border-red-500/10 flex flex-wrap gap-3">
                                            {c.isSpii === 'Yes' && (
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">SPII Sensitive</span>
                                                </div>
                                            )}
                                            {c.isTransferred === 'Yes' && (
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Transferred: {c.transferValidation}</span>
                                                </div>
                                            )}
                                        </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                </div>
            </div>
            </div>
        </div>
    );
};

export default CaseTrackerTab;
