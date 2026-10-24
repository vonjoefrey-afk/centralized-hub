import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../../utils/logger';

import { Card, Badge, Skeleton, CardSkeleton, EmptyState, Modal, PremiumSelect } from '../ui';
import { getAllSpiiCases, triggerSpiiCaseBackfill } from '../../firebase/firestore';
import { getAllTeams } from '../../services/teams';
import { getAllUsers } from '../../services/users';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { functions } from '../../firebase/config';
import { httpsCallable } from 'firebase/functions';
import { showSuccess, showError } from '../../utils/toast';

const SpiiVisualDashboardTab = ({ currentUser }) => {
    const [allCases, setAllCases] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [usersData, setUsersData] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'open', 'closed', 'so', 'submittedNull', 'submittedYes', 'submittedNo'
    
    // New Filters & UI State
    const [selectedTeam, setSelectedTeam] = useState('all');
    const [selectedMember, setSelectedMember] = useState('all');
    const [dateRange, setDateRange] = useState('30days'); // '30days', '90days', 'ytd', 'all'
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sendingFollowUp, setSendingFollowUp] = useState(false);
    const [backfilling, setBackfilling] = useState(false);

    // Automation Config State
    const [showConfig, setShowConfig] = useState(false);
    const [configData, setConfigData] = useState({
        runHour: 9,
        dailyMessageTemplate: "Owner:\n[CASES]",
        targetStatuses: ["Open", "SO", "Closed"]
    });
    const [savingConfig, setSavingConfig] = useState(false);

    useEffect(() => {
        logger.log("---- DEBUG currentUser ----", currentUser);
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const isTL = currentUser?.role === 'team_leader';
            const [casesData, allUsersData, teamsData, configDoc] = await Promise.all([
                getAllSpiiCases(isTL ? currentUser.teamId : null),
                getAllUsers(),
                getAllTeams(),
                getDoc(doc(db, 'settings', 'spii_chat'))
            ]);

            const caseOwners = {};
            allUsersData.forEach(user => {
                caseOwners[user.id] = user.displayName || user.email || 'Unknown User';
            });

            setUsersMap(caseOwners);
            setUsersData(allUsersData);
            setTeams(teamsData);
            setAllCases(casesData);

            if (configDoc.exists()) {
                const data = configDoc.data();
                setConfigData({
                    runHour: data.runHour ?? 9,
                    dailyMessageTemplate: data.dailyMessageTemplate || "Owner:\n[CASES]",
                    spaceId: data.spaceId || '',
                    targetStatuses: data.targetStatuses || ["Open", "SO", "Closed"]
                });
            }
        } catch (err) {
            logger.error('Error loading SPII cases:', err);
            showError('Failed to load SPII cases data');
        } finally {
            setLoading(false);
        }
    };

    // 1. First layer: filter by hierarchy, date range, and search query
    const baseFilteredCases = useMemo(() => {
        // Strip out Transferred cases — they are no longer the team's responsibility
        let filtered = allCases.filter(c => c.privacyExclusionReason !== 'Transferred');

        // Date Range
        if (dateRange !== 'all') {
            const now = new Date();
            filtered = filtered.filter(c => {
                if (!c.createdAt) return false;
                const caseDate = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
                
                if (dateRange === '30days') {
                    return (now - caseDate) / (1000 * 60 * 60 * 24) <= 30;
                } else if (dateRange === '90days') {
                    return (now - caseDate) / (1000 * 60 * 60 * 24) <= 90;
                } else if (dateRange === 'ytd') {
                    return caseDate.getFullYear() === now.getFullYear();
                }
                return true;
            });
        }

        // Team / Member Hierarchy
        if (selectedMember !== 'all') {
            filtered = filtered.filter(c => c.userId === selectedMember);
        } else if (selectedTeam !== 'all') {
            const team = teams.find(t => t.id === selectedTeam);
            // Include the leader's own cases PLUS their members' cases
            const teamMemberIds = usersData
                .filter(u => u.teamId === selectedTeam || u.id === team?.teamLeaderId)
                .map(u => u.id);
            filtered = filtered.filter(c => teamMemberIds.includes(c.userId));
        }

        // Search Query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(c => 
                (c.caseId && c.caseId.toLowerCase().includes(query)) ||
                (usersMap[c.userId] && usersMap[c.userId].toLowerCase().includes(query)) ||
                (c.customerName && c.customerName.toLowerCase().includes(query))
            );
        }

        // Reset pagination when base data changes
        setCurrentPage(1);
        return filtered;
    }, [allCases, dateRange, selectedTeam, selectedMember, searchQuery, teams, usersData, usersMap]);

    // 2. Second layer: Status/Privacy activeFilter card clicks
    const filteredCases = useMemo(() => {
        switch (activeFilter) {
            case 'all': return baseFilteredCases;
            case 'open': return baseFilteredCases.filter(c => c.status === 'Open');
            case 'closed': return baseFilteredCases.filter(c => c.status === 'Closed');
            case 'so': return baseFilteredCases.filter(c => c.status === 'SO');
            case 'submittedNull': return baseFilteredCases.filter(c => c.submittedPrivacy == null || c.submittedPrivacy === '');
            case 'submittedYes': return baseFilteredCases.filter(c => c.submittedPrivacy?.toLowerCase() === 'yes');
            case 'submittedNo': return baseFilteredCases.filter(c => c.submittedPrivacy?.toLowerCase() === 'no');
            default: return baseFilteredCases;
        }
    }, [activeFilter, baseFilteredCases]);

    // Compile Metrics based on baseFilteredCases (not the activeFilter one, so cards show relative to the main filters)
    const metrics = useMemo(() => {
        const total = baseFilteredCases.length;

        // Status counts
        const statusCounts = baseFilteredCases.reduce((acc, c) => {
            const status = c.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        // Privacy Review Counts
        const privacyReviews = baseFilteredCases.reduce((acc, c) => {
            if (c.submittedPrivacy === undefined || c.submittedPrivacy === null || c.submittedPrivacy === '') {
                acc.none++;
            } else if (c.submittedPrivacy?.toLowerCase() === 'yes') {
                acc.submitted++;
            } else {
                acc.no++;
            }
            return acc;
        }, { none: 0, submitted: 0, no: 0 });

        return { total, statusCounts, privacyReviews };
    }, [baseFilteredCases]);

    // Available members for the second dropdown
    const availableMembers = useMemo(() => {
        if (selectedTeam === 'all') return [];
        const team = teams.find(t => t.id === selectedTeam);
        return usersData
            .filter(u => u.teamId === selectedTeam || u.id === team?.teamLeaderId)
            .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
    }, [selectedTeam, usersData, teams]);

    // Handle team change (reset member)
    const handleTeamChange = (e) => {
        setSelectedTeam(e.target.value);
        setSelectedMember('all');
    };

    // Pagination
    const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
    const paginatedCases = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredCases.slice(start, start + itemsPerPage);
    }, [filteredCases, currentPage, itemsPerPage]);

    // Export to CSV
    const exportToCSV = () => {
        if (filteredCases.length === 0) {
            showError("No data to export");
            return;
        }

        const headers = ["Case ID", "Owner", "Status", "Privacy Review", "Created At", "Customer Name"];
        const rows = filteredCases.map(c => [
            c.caseId || '',
            usersMap[c.userId] || 'Unknown',
            c.status || '',
            c.submittedPrivacy || 'No Data',
            c.createdAt?.toDate?.()?.toLocaleDateString() || '',
            c.customerName || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `spii_analytics_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Trigger Chat Webhook (with applied filters)
    const handleSendFollowUp = async () => {
        try {
            setSendingFollowUp(true);
            const sendFollowUpFunc = httpsCallable(functions, 'manualSpiiChatFollowUp');
            // Provide the current team and member filters so the backend query respects the onscreen view
            const payload = {
                teamId: selectedTeam !== 'all' ? selectedTeam : null,
                memberId: selectedMember !== 'all' ? selectedMember : null
            };
            const result = await sendFollowUpFunc(payload);
            
            if (result.data?.success) {
                showSuccess(result.data.message);
            } else {
                showError("Failed to send follow up");
            }
        } catch (error) {
            logger.error("Error sending chat follow up:", error);
            showError("Failed to trigger Chat alert: " + error.message);
        } finally {
            setSendingFollowUp(false);
        }
    };

    // Force-sync every SPII-flagged tracked case against its spii_cases mirror right
    // now, fixing anything left stale before real-time syncing existed.
    const handleBackfillSync = async () => {
        try {
            setBackfilling(true);
            const result = await triggerSpiiCaseBackfill();
            showSuccess(`Checked ${result.checked} case${result.checked === 1 ? '' : 's'}, synced ${result.synced}.`);
            loadData();
        } catch (error) {
            logger.error("Error running SPII case backfill:", error);
            showError(error.message || "Failed to resync cases.");
        } finally {
            setBackfilling(false);
        }
    };

    // Save Config to Firestore
    const handleSaveConfig = async () => {
        if (!configData.targetStatuses || configData.targetStatuses.length === 0) {
            showError("Please select at least one Target Status to follow up on.");
            return;
        }

        try {
            setSavingConfig(true);
            await setDoc(doc(db, 'settings', 'spii_chat'), {
                ...configData,
                updatedAt: new Date(),
                timezone: "Asia/Manila"
            }, { merge: true });
            showSuccess("Chat automation settings saved!");
            setShowConfig(false);
        } catch (error) {
            logger.error("Error saving chat config:", error);
            showError("Failed to save configuration.");
        } finally {
            setSavingConfig(false);
        }
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
            {/* --- Premium Header Section --- */}
            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 shadow-xl shadow-black/5">
                {/* Accent Gradient */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500"></div>
                
                <div className="px-6 py-8 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">SPII Intelligence</h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Real-time surveillance and privacy review analytics</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex bg-gray-100/50 dark:bg-white/5 p-1 rounded-2xl border border-gray-200/50 dark:border-white/5 backdrop-blur-sm">
                            <button
                                onClick={loadData}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 rounded-xl hover:bg-white dark:hover:bg-white/10 hover:shadow-sm transition-all duration-200"
                            >
                                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Refresh</span>
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 rounded-xl hover:bg-white dark:hover:bg-white/10 hover:shadow-sm transition-all duration-200"
                            >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Export</span>
                            </button>
                        </div>

                        {(['admin', 'team_leader'].includes(currentUser?.role) || currentUser?.features?.spiiCases) && (
                            <>
                                <button
                                    onClick={() => setShowConfig(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#1a1a1a] dark:bg-white/10 hover:bg-black dark:hover:bg-white/20 rounded-2xl shadow-lg shadow-black/10 transition-all duration-300 transform active:scale-95 group"
                                >
                                    <svg className="w-4 h-4 text-indigo-400 group-hover:rotate-45 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>Automation</span>
                                </button>
                                <button
                                    onClick={handleSendFollowUp}
                                    disabled={sendingFollowUp}
                                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {sendingFollowUp ? (
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    )}
                                    <span>{sendingFollowUp ? 'Sending...' : 'Sync Alerts'}</span>
                                </button>
                            </>
                        )}

                        {['admin', 'trainer', 'team_leader'].includes(currentUser?.role) && (
                            <button
                                onClick={handleBackfillSync}
                                disabled={backfilling}
                                title="Force-sync every SPII-flagged tracked case right now, fixing any left stale from before real-time syncing existed"
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 rounded-2xl shadow-sm transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {backfilling ? (
                                    <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                )}
                                <span>{backfilling ? 'Resyncing...' : 'Resync All Cases'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* --- Summary Cards Section --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Total Cases Card */}
                <div 
                    onClick={() => setActiveFilter('all')}
                    className={`relative group cursor-pointer overflow-hidden rounded-3xl p-6 transition-all duration-500 hover:scale-[1.02] active:scale-95 shadow-xl ${
                        activeFilter === 'all' 
                        ? 'bg-indigo-600 text-white border-2 border-indigo-400' 
                        : 'bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5'
                    }`}
                >
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className={`p-2 rounded-xl inline-block mb-4 ${activeFilter === 'all' ? 'bg-white/20' : 'bg-indigo-50 dark:bg-indigo-500/10'}`}>
                                <svg className={`w-5 h-5 ${activeFilter === 'all' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h3 className={`text-sm font-bold uppercase tracking-widest ${activeFilter === 'all' ? 'text-indigo-100' : 'text-gray-500'}`}>Total SPII Volume</h3>
                            <p className="text-4xl font-black mt-2 leading-none tracking-tight">{metrics.total}</p>
                        </div>
                        <p className={`text-xs mt-4 font-medium ${activeFilter === 'all' ? 'text-indigo-200' : 'text-gray-400'}`}>Cumulative surveillance cases</p>
                    </div>
                    {/* Background Glow */}
                    <div className={`absolute -right-4 -bottom-4 w-32 h-32 rounded-full blur-3xl opacity-20 ${activeFilter === 'all' ? 'bg-white' : 'bg-indigo-500'}`}></div>
                </div>

                {/* Status Breakdown Card */}
                <div className="bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="relative z-10">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-5">Velocity & Status</h3>
                        <div className="space-y-3">
                            {[
                                { id: 'open', label: 'Open', count: metrics.statusCounts['Open'] || 0, color: 'bg-blue-500', text: 'text-blue-500' },
                                { id: 'closed', label: 'Closed', count: metrics.statusCounts['Closed'] || 0, color: 'bg-emerald-500', text: 'text-emerald-500' },
                                { id: 'so', label: 'SO', count: metrics.statusCounts['SO'] || 0, color: 'bg-amber-500', text: 'text-amber-500' }
                            ].map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveFilter(s.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95 ${
                                        activeFilter === s.id 
                                        ? 'bg-gray-100 dark:bg-white/10 ring-1 ring-gray-200 dark:ring-white/20' 
                                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${s.color} shadow-lg shadow-${s.id}-500/40`}></div>
                                        <span className={`text-sm font-bold ${activeFilter === s.id ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{s.label}</span>
                                    </div>
                                    <span className={`text-sm font-black ${s.text}`}>{s.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-[0.03] bg-purple-500"></div>
                </div>

                {/* Privacy Review Intensity Card */}
                <div className="lg:col-span-2 bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="relative z-10 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Privacy Review Intensity</h3>
                            <Badge variant="indigo" size="sm" className="font-black uppercase">Engagement</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 flex-1">
                            {[
                                { id: 'submittedYes', label: 'Approved & Submitted', count: metrics.privacyReviews.submitted, color: 'text-emerald-500', icon: 'M5 13l4 4L19 7', bg: 'bg-emerald-500/10' },
                                { id: 'submittedNo', label: 'Not Submitted', count: metrics.privacyReviews.no, color: 'text-rose-500', icon: 'M6 18L18 6M6 6l12 12', bg: 'bg-rose-500/10' },
                                { id: 'submittedNull', label: 'Awaiting Action', count: metrics.privacyReviews.none, color: 'text-gray-400', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', bg: 'bg-gray-400/10' }
                            ].map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setActiveFilter(p.id)}
                                    className={`relative flex flex-col items-center justify-center p-5 rounded-3xl transition-all duration-500 group overflow-hidden ${
                                        activeFilter === p.id 
                                        ? 'bg-gray-50 dark:bg-white/5 ring-1 ring-indigo-500/30' 
                                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <div className={`p-2.5 rounded-xl ${p.bg} ${p.color} mb-3 transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={p.icon} />
                                        </svg>
                                    </div>
                                    <p className={`text-[10px] font-black uppercase text-center tracking-tighter ${activeFilter === p.id ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{p.label}</p>
                                    <p className={`text-2xl font-black mt-1 ${p.color}`}>{p.count}</p>
                                    
                                    {/* Selection Indicator */}
                                    {activeFilter === p.id && (
                                        <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Filters & Data Ledger Section --- */}
            <div className="space-y-6 animate-in slide-in-from-bottom duration-1000 delay-150">
                {/* Unified Premium Filter Bar */}
                <div className="bg-white/80 dark:bg-[#111111]/80 backdrop-blur-xl p-3 rounded-[2.5rem] shadow-2xl shadow-black/5 border border-gray-200/50 dark:border-white/5 relative overflow-hidden">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4 relative z-10">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Team Filter */}
                            <div className="relative group">
                                <PremiumSelect
                                    value={selectedTeam}
                                    onChange={(val) => handleTeamChange({ target: { value: val } })}
                                    options={[
                                        { value: 'all', label: 'All Teams' },
                                        ...teams.map(team => ({
                                            value: team.id,
                                            label: team.displayName || team.name || `Team ${team.id.substring(0, 6)}`
                                        }))
                                    ]}
                                    className="w-full !rounded-2xl border-none bg-gray-100/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all"
                                />
                            </div>

                            {/* Member Filter */}
                            <div className="relative group">
                                <PremiumSelect
                                    value={selectedMember}
                                    onChange={(val) => setSelectedMember(val)}
                                    disabled={selectedTeam === 'all'}
                                    options={[
                                        { value: 'all', label: `Everyone ${selectedTeam !== 'all' ? `(${availableMembers.length})` : ''}` },
                                        ...availableMembers.map(member => ({
                                            value: member.id,
                                            label: member.displayName || member.email
                                        }))
                                    ]}
                                    className="w-full !rounded-2xl border-none bg-gray-100/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all opacity-100 disabled:opacity-40"
                                />
                            </div>

                            {/* Date Range Filter */}
                            <div className="relative group">
                                <PremiumSelect
                                    value={dateRange}
                                    onChange={(val) => setDateRange(val)}
                                    options={[
                                        { value: '30days', label: 'Last 30 Days' },
                                        { value: '90days', label: 'Last 90 Days' },
                                        { value: 'ytd', label: 'Year to Date' },
                                        { value: 'all', label: 'All Time' }
                                    ]}
                                    className="w-full !rounded-2xl border-none bg-gray-100/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all"
                                />
                            </div>

                            {/* Search */}
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-2.5 sm:text-sm bg-gray-100/50 dark:bg-white/5 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder-gray-500 dark:placeholder-gray-600 font-bold"
                                    placeholder="Search Case ID..."
                                />
                            </div>
                        </div>
                    </div>
                    {/* Subtle Gradient Glow */}
                    <div className="absolute -left-10 top-0 bottom-0 w-20 bg-indigo-500/5 blur-3xl"></div>
                </div>

                {/* Premium Ledger Card */}
                <div className="bg-white dark:bg-[#111111] rounded-[2.5rem] shadow-2xl border border-gray-200/50 dark:border-white/5 relative overflow-hidden">
                    <div className="px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-200/50 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white leading-none">Intelligence Ledger</h3>
                                <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-wider">
                                    {activeFilter === 'all' ? 'Universal View' : `${activeFilter} Focus`}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center text-xs font-black uppercase text-gray-500 tracking-wider">
                                <span className="mr-3">Density:</span>
                                <PremiumSelect
                                    value={itemsPerPage}
                                    onChange={(val) => {
                                        setItemsPerPage(Number(val));
                                        setCurrentPage(1);
                                    }}
                                    options={[
                                        { value: 10, label: '10' },
                                        { value: 25, label: '25' },
                                        { value: 50, label: '50' },
                                        { value: 100, label: '100' }
                                    ]}
                                    size="sm"
                                    className="min-w-[80px]"
                                />
                            </div>
                            <div className="h-4 w-px bg-gray-200 dark:bg-white/10"></div>
                            <Badge variant="indigo" size="sm" className="font-black px-4 rounded-full">
                                {filteredCases.length} Records
                            </Badge>
                        </div>
                    </div>

                    <div className="overflow-hidden">
                        {filteredCases.length === 0 ? (
                            <div className="py-20">
                                <EmptyState
                                    icon={<svg className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                                    title="No Cases Detected"
                                    description="Adjust your filters or synchronization settings to find intelligence."
                                />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200/50 dark:divide-white/5">
                                    <thead className="bg-gray-50/50 dark:bg-white/2 backdrop-blur-sm">
                                        <tr>
                                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Identifier</th>
                                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Custodian</th>
                                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Operational Status</th>
                                            <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Privacy Governance</th>
                                            <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Ingestion Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                        {paginatedCases.map((caseItem) => (
                                            <tr key={caseItem.id} className="group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors duration-200">
                                                <td className="px-8 py-5 whitespace-nowrap">
                                                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-tight group-hover:underline underline-offset-4 cursor-pointer">
                                                        {caseItem.caseId}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-indigo-500/10 mr-3">
                                                            {(usersMap[caseItem.userId] || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-900 dark:text-gray-200">
                                                                {usersMap[caseItem.userId] || 'Unknown User'}
                                                            </span>
                                                            {caseItem.customerName && (
                                                                <span className="text-[10px] text-gray-500 dark:text-gray-600 font-black uppercase tracking-wider">{caseItem.customerName}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 whitespace-nowrap">
                                                    <Badge
                                                        variant={caseItem.status === 'Closed' ? 'success' : caseItem.status === 'SO' ? 'warning' : 'info'}
                                                        size="sm"
                                                        className="font-black uppercase tracking-tighter rounded-lg"
                                                    >
                                                        {caseItem.status || 'Unknown'}
                                                    </Badge>
                                                </td>
                                                <td className="px-8 py-5 whitespace-nowrap">
                                                    {caseItem.submittedPrivacy ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${caseItem.submittedPrivacy?.toLowerCase() === 'yes' ? 'bg-emerald-500 shadow-glow-emerald' : 'bg-rose-500 shadow-glow-rose'}`}></div>
                                                            <span className={`text-[11px] font-black uppercase tracking-widest ${caseItem.submittedPrivacy?.toLowerCase() === 'yes' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {caseItem.submittedPrivacy}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-50">Pending Review</span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5 whitespace-nowrap text-right">
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-600">
                                                        {caseItem.createdAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'Unknown'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Premium Pagination Controls */}
                    {filteredCases.length > 0 && totalPages > 1 && (
                        <div className="px-8 py-5 border-t border-gray-200/50 dark:border-white/5 bg-gray-50/30 dark:bg-white/2 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                                    Displaying <span className="text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> — <span className="text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredCases.length)}</span> of <span className="text-gray-900 dark:text-white">{filteredCases.length}</span> results
                                </p>
                            </div>
                            
                            <div className="flex items-center bg-white dark:bg-white/5 p-1 rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-sm">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className={`p-2 rounded-xl transition-all ${currentPage === 1 ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-indigo-500'}`}
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                
                                <div className="flex items-center px-2">
                                    {[...Array(totalPages)].map((_, i) => {
                                        const page = i + 1;
                                        if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-black transition-all duration-300 ${
                                                        currentPage === page 
                                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        }
                                        if (page === 2 || page === totalPages - 1) {
                                            return <span key={page} className="px-1 text-gray-400 dark:text-gray-600 text-[8px] font-black tracking-widest leading-none">•••</span>;
                                        }
                                        return null;
                                    })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className={`p-2 rounded-xl transition-all ${currentPage === totalPages ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-indigo-500'}`}
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Configuration Modal */}
            <Modal isOpen={showConfig} onClose={() => setShowConfig(false)} size="md">
                <Modal.Header onClose={() => setShowConfig(false)}>
                    <Modal.Title>Chat Automation Configuration</Modal.Title>
                </Modal.Header>
                
                <Modal.Body>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Google Chat Space ID
                            </label>
                            <p className="text-xs text-gray-500 mb-2">The unique identifier for the Google Chat room (e.g., spaces/AAAAxxxxxxx).</p>
                            <input
                                type="text"
                                value={configData.spaceId || ''}
                                placeholder="spaces/..."
                                onChange={(e) => setConfigData({ ...configData, spaceId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Daily Automation Hour (24h)
                            </label>
                            <p className="text-xs text-gray-500 mb-2">The time of day the Google Cloud Scheduler will ping the Chat space (uses Manila time).</p>
                            <input
                                type="number"
                                min="0"
                                max="23"
                                value={configData.runHour}
                                onChange={(e) => setConfigData({ ...configData, runHour: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Target Case Statuses
                            </label>
                            <p className="text-xs text-gray-500 mb-2">Select the statuses to include in the chat follow-up. Cases already submitted for privacy review will always be excluded.</p>
                            <div className="flex gap-4">
                                {['Open', 'SO', 'Closed'].map(status => (
                                    <label key={status} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={configData.targetStatuses?.includes(status) ?? true}
                                            onChange={(e) => {
                                                const current = configData.targetStatuses || ['Open', 'SO', 'Closed'];
                                                if (e.target.checked) {
                                                    setConfigData({ ...configData, targetStatuses: [...current, status] });
                                                } else {
                                                    setConfigData({ ...configData, targetStatuses: current.filter(s => s !== status) });
                                                }
                                            }}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700 font-medium">{status}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Message Template
                            </label>
                            <p className="text-xs text-gray-500 mb-2">Insert <strong>[CASES]</strong> anywhere in this template to inject the looping list of pending cases.</p>
                            <textarea
                                rows={6}
                                value={configData.dailyMessageTemplate}
                                placeholder="Type a custom intro here..."
                                onChange={(e) => setConfigData({ ...configData, dailyMessageTemplate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono transition-colors"
                            ></textarea>
                            
                            <div className="mt-3 bg-gray-100 rounded-2xl p-4 shadow-sm border border-gray-200">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview</h4>
                                <div className="bg-white p-3 rounded-xl rounded-tl-none border border-gray-200 shadow-sm inline-block max-w-[90%]">
                                    <pre className="text-sm font-sans text-gray-800 whitespace-pre-wrap leading-relaxed">{configData.dailyMessageTemplate.replace('[CASES]', '1. Case ID: 12345\n- Status: Assigned')}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal.Body>

                <Modal.Footer>
                    <button
                        onClick={() => setShowConfig(false)}
                        className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-all shadow-sm focus:ring-2 focus:ring-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveConfig}
                        disabled={savingConfig}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 transition-all shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center justify-center min-w-[120px]"
                    >
                        {savingConfig ? (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : null}
                        {savingConfig ? 'Saving...' : 'Save Settings'}
                    </button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default SpiiVisualDashboardTab;
