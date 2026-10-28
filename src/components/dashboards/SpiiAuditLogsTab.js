import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../../utils/logger';

import { Card, Badge, Skeleton, CardSkeleton, EmptyState, PremiumSelect, Button } from '../ui';
import { getSpiiAuditLogs, getSpiiDetectionSettings, updateSpiiDetectionSettings } from '../../firebase/firestore';
import { getAllTeams } from '../../services/teams';
import { getAllUsers } from '../../services/users';
import { ShieldExclamationIcon, BellIcon, Cog6ToothIcon, MagnifyingGlassIcon, TrashIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { showSuccess, showError, showInfo } from '../../utils/toast';
import { sendSpiiChatAlert } from '../../utils/chatWebhook';
import { detectSPII } from '../../utils/spiiDetector';
import { logSpiiAudit } from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import Pagination from '../common/Pagination';

// Rendering every log at once (3,900+ rows ≈ 106k DOM nodes) froze the page; show a page at a time.
const LOGS_PER_PAGE = 50;

const SpiiAuditLogsTab = ({ currentUser }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({ enabled: false, googleChatWebhook: '' });
    const [showSettings, setShowSettings] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [usersData, setUsersData] = useState([]);
    const [teams, setTeams] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('all');
    const [showFullInfo, setShowFullInfo] = useState({}); // Tracking which logs show unredacted info
    const [testText, setTestText] = useState('');
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const isTL = currentUser?.role === 'team_leader';
            const [logsData, settingsData, allUsersData, teamsData] = await Promise.all([
                getSpiiAuditLogs(isTL ? currentUser.teamId : null),
                getSpiiDetectionSettings(),
                getAllUsers(),
                getAllTeams()
            ]);

            setLogs(logsData);
            setSettings(settingsData);
            setUsersData(allUsersData);
            setTeams(teamsData);
        } catch (err) {
            logger.error('Error loading SPII audit logs:', err);
            showError('Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    };

    const handleRunTest = async () => {
        if (!testText.trim()) return;
        setTesting(true);
        try {
            const detections = detectSPII(testText);
            if (detections.length > 0) {
                await logSpiiAudit(currentUser.uid, currentUser.displayName || currentUser.email, currentUser.teamId || 'admin-diagnostic', detections, 'Diagnostic Tester');
                showSuccess(`Detected ${detections.length} sensitive items! Audit log created.`);
                setTestText('');
                loadData(); // Refresh the list
            } else {
                showInfo("No sensitive information detected in the test text.");
            }
        } catch (err) {
            logger.error('Test failed:', err);
            showError('Diagnostic test failed to log.');
        } finally {
            setTesting(false);
        }
    };

    const handleToggleSettings = async () => {
        try {
            setSavingSettings(true);
            await updateSpiiDetectionSettings(settings);
            showSuccess(`SPII Monitoring ${settings.enabled ? 'Enabled' : 'Disabled'}`);
            setShowSettings(false);
        } catch (err) {
            showError('Failed to save settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const handleNotifyChat = async (log) => {
        try {
            if (!settings.googleChatWebhook) {
                showError('Google Chat Webhook URL is not configured in settings.');
                setShowSettings(true);
                return;
            }

            await sendSpiiChatAlert(settings.googleChatWebhook, log);
            
            // Mark as notified in Firestore
            await updateDoc(doc(db, 'spii_audit_logs', log.id), {
                notified: true,
                notifiedAt: new Date()
            });

            showSuccess('Notification pulse sent to Google Chat');
            loadData();
        } catch (err) {
            logger.error('Error sending chat alert:', err);
            showError('Failed to send notification: ' + err.message);
        }
    };

    const toggleFullInfo = (logId) => {
        setShowFullInfo(prev => ({
            ...prev,
            [logId]: !prev[logId]
        }));
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesQuery = (log.userDisplayName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                                (log.sourceTab?.toLowerCase() || '').includes(searchQuery.toLowerCase());
            const matchesTeam = selectedTeam === 'all' || log.teamId === selectedTeam;
            return matchesQuery && matchesTeam;
        });
    }, [logs, searchQuery, selectedTeam]);

    const [logsPage, setLogsPage] = useState(1);
    useEffect(() => { setLogsPage(1); }, [searchQuery, selectedTeam]);
    const pagedLogs = filteredLogs.slice((logsPage - 1) * LOGS_PER_PAGE, logsPage * LOGS_PER_PAGE);

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
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500"></div>
                <div className="px-6 py-8 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-500/10 rounded-2xl">
                            <ShieldExclamationIcon className="w-8 h-8 text-rose-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">SPII Audit Center</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Automatic detection pulses and violation logs</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-gray-700 dark:text-white bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-2xl transition-all duration-300"
                        >
                            <Cog6ToothIcon className={`w-5 h-5 ${showSettings ? 'rotate-90' : ''} transition-transform duration-500`} />
                            <span>Control Panel</span>
                        </button>
                        <Button
                            onClick={loadData}
                            variant="secondary"
                            className="!rounded-2xl"
                        >
                            Refresh Pulse
                        </Button>
                    </div>
                </div>

                {/* Settings Panel */}
                {showSettings && (
                    <div className="px-6 py-8 sm:px-8 border-t border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 animate-slide-down">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${settings.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-white/10'}`}>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={settings.enabled}
                                            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                                        />
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </div>
                                    <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Enable AI Detection Pulse</span>
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400">When enabled, the system will automatically scan all recorded notes and case trackers for sensitive PII/SPII data patterns.</p>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Google Chat Webhook Pulse</label>
                                <input
                                    type="text"
                                    value={settings.googleChatWebhook}
                                    onChange={(e) => setSettings({ ...settings, googleChatWebhook: e.target.value })}
                                    className="block w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="https://chat.googleapis.com/v1/spaces/..."
                                />
                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleToggleSettings}
                                        loading={savingSettings}
                                        className="!rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        Seal Configuration
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Diagnostic Tester Panel */}
                        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-white/5 bg-amber-50/30 dark:bg-amber-500/5 rounded-2xl p-6">
                            <div className="flex flex-col sm:flex-row gap-4 items-end">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">Diagnostic SPII Detection Pulse Tester</label>
                                    <textarea
                                        value={testText}
                                        onChange={(e) => setTestText(e.target.value)}
                                        className="block w-full px-4 py-3 bg-white dark:bg-white/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl text-sm focus:ring-2 focus:ring-amber-500/20"
                                        placeholder="Paste text here to test AI detection pulse (e.g. Account 1234567890)..."
                                        rows="2"
                                    />
                                </div>
                                <Button
                                    onClick={handleRunTest}
                                    loading={testing}
                                    disabled={!testText.trim()}
                                    className="!rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/10"
                                >
                                    Pulse Test
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by User or Source..."
                        className="block w-full pl-11 pr-4 py-3 bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <div className="w-full md:w-64">
                    <PremiumSelect
                        value={selectedTeam}
                        onChange={setSelectedTeam}
                        options={[
                            { value: 'all', label: 'All Teams' },
                            ...teams.map(t => ({ value: t.id, label: t.displayName || t.name }))
                        ]}
                        className="!rounded-2xl"
                    />
                </div>
            </div>

            {/* Logs Ledger */}
            <div className="bg-white dark:bg-[#111111] rounded-[2.5rem] shadow-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-white/5">
                        <thead className="bg-gray-50/50 dark:bg-white/2">
                            <tr>
                                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Incident Details</th>
                                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Sensitive Data Found</th>
                                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Source Tab</th>
                                <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center">
                                        <EmptyState
                                            icon={<ShieldExclamationIcon className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto" />}
                                            title="No Threats Detected"
                                            description="No SPII/PII violations have been logged for this period."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                pagedLogs.map((log) => (
                                    <tr key={log.id} className="group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors duration-200">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-rose-500/10">
                                                    {log.userDisplayName?.[0].toUpperCase() || 'U'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-gray-900 dark:text-white">{log.userDisplayName}</span>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                        {log.timestamp?.toDate?.()?.toLocaleString() || 'Recent'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-wrap gap-2 max-w-sm">
                                                {log.detections?.map((d, i) => (
                                                    <div key={i} className="flex flex-col bg-rose-50 dark:bg-rose-500/10 border border-rose-200/50 dark:border-rose-500/20 rounded-xl p-2 min-w-[120px]">
                                                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">{d.type}</span>
                                                        <span className="text-xs font-mono font-bold text-gray-900 dark:text-gray-200 mt-1">
                                                            {showFullInfo[log.id] ? d.value : d.redacted}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <Badge variant="neutral" size="sm" className="font-black uppercase tracking-widest bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                                                {log.sourceTab}
                                            </Badge>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <Badge variant={log.notified ? 'success' : 'warning'} size="sm" className="font-black uppercase tracking-widest">
                                                {log.notified ? 'NOTIFIED' : 'PENDING ALERT'}
                                            </Badge>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <button
                                                    onClick={() => toggleFullInfo(log.id)}
                                                    className="p-2 text-gray-400 hover:text-indigo-500 bg-gray-50 dark:bg-white/5 rounded-xl transition-all"
                                                    title={showFullInfo[log.id] ? "Hide Sensitive Info" : "Reveal Sensitive Info"}
                                                >
                                                    {showFullInfo[log.id] ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                                </button>
                                                <button
                                                    onClick={() => handleNotifyChat(log)}
                                                    className={`p-2 rounded-xl transition-all ${log.notified ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-amber-500 bg-gray-50 dark:bg-white/5'}`}
                                                    disabled={log.notified}
                                                    title="Send Alert Pulse"
                                                >
                                                    <BellIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination page={logsPage} pageSize={LOGS_PER_PAGE} total={filteredLogs.length} onPageChange={setLogsPage} />
            </div>
        </div>
    );
};

export default SpiiAuditLogsTab;
