import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../../utils/logger';

import { useAuth } from '../../contexts/AuthContext';
import { subscribeToAnalyticsTrackedCases } from '../../firebase/firestore';
import { getAllTeams } from '../../services/teams';
import { getAllUsers } from '../../services/users';
import { Card, EmptyState, Badge, Button, PremiumSelect } from '../ui';
import { AuroraBarChart, AuroraDonutChart } from '../ui/charts';
import { ChartBarIcon, UserGroupIcon, ArrowDownTrayIcon, BoltIcon, InboxStackIcon } from '@heroicons/react/24/outline';
import { showError, showSuccess } from '../../utils/toast';
import { downloadCsv } from '../../utils/csv';
import { formatManilaDateTime } from '../../utils/caseExport';
import { WORK_TYPE_FILTER_OPTIONS, getWorkType, matchesWorkType } from '../../constants/caseFields';
import Pagination from '../common/Pagination';

const ROWS_PER_PAGE = 50;

const BACKLOG_STATUSES = ['Assigned', 'WOCR', 'WOCRE', 'IPTP', 'IPGS', 'IPGE', 'IPGO', 'IPCR'];

const MetricAnalyticsTab = () => {
    const { user } = useAuth();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamsMap, setTeamsMap] = useState({});
    const [usersMapGlobal, setUsersMapGlobal] = useState({});
    const [allUsersRaw, setAllUsersRaw] = useState([]); // Store full user objects for team filtering

    // Filters
    const [filterTeam, setFilterTeam] = useState('All');
    const [filterUser, setFilterUser] = useState('All');
    const [filterDateRange, setFilterDateRange] = useState('All');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    // Case Type (EOD classification: New Case / Backlog / Unclassified legacy)
    const [filterWorkType, setFilterWorkType] = useState('All');

    // Metric focus (Survey deprecated; IRT + Backlogs retained)
    const [metricIndex, setMetricIndex] = useState('IRT');
    const [filterIrtOrigin, setFilterIrtOrigin] = useState('All');
    const [filterIrtBreachType, setFilterIrtBreachType] = useState('All');

    // Backlog Metrics Filter State
    const [filterBacklogStatus, setFilterBacklogStatus] = useState('All');

    useEffect(() => {
        let unsubscribe = () => {};

        const setupSubscription = () => {
            if (!user?.uid) return;
            setLoading(true);
            try {
                // Determine scope based on user role natively
                let scopeRole = 'team_member';
                if (user.role === 'admin' || user.role === 'trainer') scopeRole = 'admin';
                else if (user.role === 'team_leader') scopeRole = 'team_leader';

                unsubscribe = subscribeToAnalyticsTrackedCases(
                    scopeRole, 
                    user.uid, 
                    user.teamId,
                    (data) => {
                        setCases(data);
                        setLoading(false);
                    },
                    (err) => {
                        logger.error("Failed to sync analytics real-time:", err);
                        showError("Failed to fetch live metric analytics tracking");
                        setLoading(false);
                    }
                );
            } catch (err) {
                logger.error("Failed to setup analytics subscription logic:", err);
                showError("Failed to initialize metric analytics dashboard");
                setLoading(false);
            }
        };

        const loadDictionaries = async () => {
            try {
                const [teamsData, usersData] = await Promise.all([
                    getAllTeams(),
                    getAllUsers()
                ]);

                const teamDict = {};
                teamsData.forEach(t => teamDict[t.id] = t.name || t.displayName);
                setTeamsMap(teamDict);

                const userDict = {};
                usersData.forEach(u => userDict[u.id || u.uid] = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.displayName || u.email);
                
                setUsersMapGlobal(userDict);
                setAllUsersRaw(usersData); // Store full user objects for team filtering
            } catch (err) {
                logger.warn("Failed to load entity dictionaries for analytics:", err);
                logger.warn("Analytics: Falling back to case-resident entity mapping.");
            }
        };

        setupSubscription();
        loadDictionaries();

        return () => unsubscribe();
    }, [user]);

    // Utility: Date Range Filtering Logic
    const isWithinDateRange = (createdAt, range) => {
        if (range === 'All') return true;
        if (!createdAt) return false;
        
        // Handle Firestore Timestamp or standard Date
        const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        const now = new Date();
        
        // Reset time for accurate "Today" comparison
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (range === 'Today') {
            return compareDate.getTime() === today.getTime();
        }
        if (range === 'Yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return compareDate.getTime() === yesterday.getTime();
        }
        if (range === 'This Week') {
            // Monday to Sunday logic
            const day = now.getDay(); // 0 is Sunday
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Get Monday
            const startOfWeek = new Date(now.setDate(diff));
            startOfWeek.setHours(0, 0, 0, 0);
            return date >= startOfWeek;
        }
        if (range === 'This Month') {
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }
        if (range === 'This Year') {
            return date.getFullYear() === now.getFullYear();
        }
        if (range === 'Custom' && filterStartDate && filterEndDate) {
            const start = new Date(filterStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(filterEndDate);
            end.setHours(23, 59, 59, 999);
            return date >= start && date <= end;
        }
        return true;
    };

    // Compute dynamic dropdown lists
    const availableTeams = useMemo(() => {
        // Primary: Use global teams dictionary
        if (Object.keys(teamsMap).length > 0) {
            return Object.entries(teamsMap).map(([id, name]) => ({ id, name }))
                .sort((a, b) => a.name.localeCompare(b.name));
        }
        // Fallback: If dictionary failed, derive from current cases
        return [...new Set(cases.map(c => c.teamId).filter(Boolean))].map(id => ({
            id,
            name: id
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [teamsMap, cases]);

    const availableUsers = useMemo(() => {
        // Primary: Use global users list
        if (allUsersRaw.length > 0) {
            let filtered = allUsersRaw;
            if (filterTeam !== 'All') {
                filtered = allUsersRaw.filter(u => u.teamId === filterTeam);
            }
            return filtered.map(u => ({
                id: u.id || u.uid,
                name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.displayName || u.email || u.id || u.uid
            })).sort((a, b) => a.name.localeCompare(b.name));
        }
        // Fallback: If dictionary failed, derive from current cases
        const baseCases = filterTeam !== 'All' ? cases.filter(c => c.teamId === filterTeam) : cases;
        const usersMapLocal = new Map();
        baseCases.forEach(c => {
            if (c.userId) {
                usersMapLocal.set(c.userId, usersMapGlobal[c.userId] || c.userDisplayName || 'Unknown User');
            }
        });
        return Array.from(usersMapLocal.entries()).map(([id, name]) => ({ id, name }));
    }, [allUsersRaw, filterTeam, cases, usersMapGlobal]);

    // Filter Raw Data Log Table
    const filteredRawCases = useMemo(() => {
        return cases.filter(c => {
            // Universal filters
            if (filterTeam !== 'All' && c.teamId !== filterTeam) return false;
            if (filterUser !== 'All' && c.userId !== filterUser) return false;
            if (!isWithinDateRange(c.createdAt, filterDateRange)) return false;
            if (!matchesWorkType(c, filterWorkType)) return false;

            // Metric Index Specific Logic
            if (metricIndex === 'IRT') {
                if (!c.irt) return false;
                if (filterIrtOrigin !== 'All' && c.origin !== filterIrtOrigin) return false;
                if (filterIrtBreachType !== 'All' && c.irt !== filterIrtBreachType) return false;
            } else if (metricIndex === 'Backlogs') {
                if (!BACKLOG_STATUSES.includes(c.status)) return false;
                if (filterBacklogStatus !== 'All' && c.status !== filterBacklogStatus) return false;
            }
            return true;
        });
    }, [cases, filterTeam, filterUser, filterDateRange, filterStartDate, filterEndDate, filterWorkType, metricIndex, filterIrtOrigin, filterIrtBreachType, filterBacklogStatus]);

    // The table renders a page at a time (it showed every row — 776+ — at once); the CSV still exports all rows.
    const [rowsPage, setRowsPage] = useState(1);
    useEffect(() => { setRowsPage(1); }, [filteredRawCases]);
    const pagedRawCases = filteredRawCases.slice((rowsPage - 1) * ROWS_PER_PAGE, rowsPage * ROWS_PER_PAGE);

    // Aggregate IRT Metrics
    const irtStats = useMemo(() => {
        const scopeCases = cases.filter(c => {
            if (filterTeam !== 'All' && c.teamId !== filterTeam) return false;
            if (filterUser !== 'All' && c.userId !== filterUser) return false;
            if (!isWithinDateRange(c.createdAt, filterDateRange)) return false;
            if (!matchesWorkType(c, filterWorkType)) return false;
            return true;
        });

        let totalBreaches = 0;
        let chatBreaches = 0;
        let emailBreaches = 0;
        const reasons = {};

        scopeCases.forEach(c => {
            if (c.irt) {
                totalBreaches++;
                if (c.origin === 'Chat') chatBreaches++;
                if (c.origin === 'Email') emailBreaches++;
                reasons[c.irt] = (reasons[c.irt] || 0) + 1;
            }
        });

        const topReason = Object.keys(reasons).length > 0
            ? Object.entries(reasons).reduce((a, b) => a[1] > b[1] ? a : b)[0]
            : 'None detected';

        // Chart-ready aggregates.
        const reasonList = Object.entries(reasons)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
        const originList = [
            { name: 'Chat', value: chatBreaches },
            { name: 'Email', value: emailBreaches },
        ].filter((o) => o.value > 0);

        return { totalBreaches, chatBreaches, emailBreaches, topReason, reasonList, originList };
    }, [cases, filterTeam, filterUser, filterDateRange, filterStartDate, filterEndDate, filterWorkType]);

    // Aggregate Backlog Metrics
    const backlogStats = useMemo(() => {
        const scopeCases = cases.filter(c => {
            if (filterTeam !== 'All' && c.teamId !== filterTeam) return false;
            if (filterUser !== 'All' && c.userId !== filterUser) return false;
            if (!isWithinDateRange(c.createdAt, filterDateRange)) return false;
            if (!matchesWorkType(c, filterWorkType)) return false;
            return true;
        });

        const openCases = scopeCases.filter(c => {
            if (!BACKLOG_STATUSES.includes(c.status)) return false;
            if (filterBacklogStatus !== 'All' && c.status !== filterBacklogStatus) return false;
            return true;
        });
        
        // Grouping
        const teamData = {};
        const agentData = {};
        let totalAgeMs = 0;
        const now = Date.now();

        openCases.forEach(c => {
            const ageMs = now - (c.createdAt?.toMillis?.() || new Date(c.createdAt).getTime());
            totalAgeMs += ageMs;

            // Team grouping
            const tId = c.teamId || 'Unknown Team';
            if (!teamData[tId]) teamData[tId] = { count: 0, totalAge: 0 };
            teamData[tId].count++;
            teamData[tId].totalAge += ageMs;

            // Agent grouping
            const uId = c.userId || 'Unknown User';
            if (!agentData[uId]) agentData[uId] = { 
                name: usersMapGlobal[uId] || c.userDisplayName || 'Unknown Agent', 
                count: 0, 
                totalAge: 0,
                teamId: tId
            };
            agentData[uId].count++;
            agentData[uId].totalAge += ageMs;
        });

        const avgAgeHours = openCases.length > 0 ? (totalAgeMs / openCases.length) / (1000 * 60 * 60) : 0;

        const teamList = Object.entries(teamData).map(([id, data]) => ({
            id,
            name: teamsMap[id] || id,
            count: data.count,
            avgAge: (data.totalAge / data.count) / (1000 * 60 * 60)
        })).sort((a, b) => b.count - a.count);

        const agentList = Object.entries(agentData).map(([id, data]) => ({
            id,
            ...data,
            avgAge: (data.totalAge / data.count) / (1000 * 60 * 60)
        })).sort((a, b) => b.count - a.count);

        return { 
            totalBacklogs: openCases.length, 
            avgAgeHours, 
            teamList, 
            agentList 
        };
    }, [cases, filterTeam, filterUser, filterDateRange, filterStartDate, filterEndDate, filterWorkType, usersMapGlobal, teamsMap, filterBacklogStatus]);

    const handleExportCSV = () => {
        if (filteredRawCases.length === 0) {
            showError("No data to export.");
            return;
        }
        
        let headers = [];
        let rows = [];

        if (metricIndex === 'Backlogs') {
            headers = ["Case ID", "Case Type", "Origin", "Agent", "Team", "Status", "Aging (Hours)", "Timeline"];
            const now = Date.now();
            rows = filteredRawCases.map(c => {
                const ageMs = now - (c.createdAt?.toMillis?.() || new Date(c.createdAt).getTime());
                const ageHrs = (ageMs / (1000 * 60 * 60)).toFixed(1);
                return [
                    c.caseId || '',
                    getWorkType(c),
                    c.origin || '',
                    usersMapGlobal[c.userId] || c.userDisplayName || 'Anonymous',
                    teamsMap[c.teamId] || c.teamId || '',
                    c.status || '',
                    ageHrs,
                    c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : 'Syncing'
                ];
            });
        } else {
            // IRT
            headers = ["Case ID", "Case Type", "Origin", "Agent", "Team", "IRT Breach Type", "Timeline"];
            rows = filteredRawCases.map(c => [
                c.caseId || '',
                getWorkType(c),
                c.origin || '',
                usersMapGlobal[c.userId] || c.userDisplayName || 'Anonymous',
                teamsMap[c.teamId] || c.teamId || '',
                c.irt || '',
                c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : 'Syncing'
            ]);
        }

        // downloadCsv quotes/escapes every cell (commas, quotes, newlines in names).
        // Manila date in the filename so an early-morning EOD export isn't stamped with yesterday (UTC).
        downloadCsv(`Metric_Analytics_Export_${formatManilaDateTime(new Date()).slice(0, 10)}.csv`, headers, rows);
        showSuccess("Analytics exported successfully!");
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-24 bg-gray-100 rounded-xl"></div>
                <div className="h-64 bg-gray-100 rounded-xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Premium Glassmorphic Container */}
            <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-[#111111]/70 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 border border-white/20 dark:border-white/5 transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-cyan-500 to-pink-500 opacity-80"></div>
                
                <div className="p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center">
                                <ChartBarIcon className="h-7 w-7 text-indigo-500 mr-3" />
                                Analytics
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Real-time performance tracking.</p>
                        </div>
                        
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={handleExportCSV}
                            icon={<ArrowDownTrayIcon className="h-4 w-4 mr-1.5" />}
                            disabled={filteredRawCases.length === 0}
                            className="bg-white/50 dark:bg-white/5 border-white/20 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10 h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-all hover:shadow-lg"
                        >
                            Export CSV
                        </Button>
                    </div>

                    {/* horizontal Modern Filter Toolbar */}
                    <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-5 border border-gray-100 dark:border-white/5 mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            {/* Metric Selection Toggle */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Metric Focus</label>
                                <div className="flex p-1 bg-gray-100 dark:bg-black/20 rounded-xl">
                                    {['IRT', 'Backlogs'].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => setMetricIndex(opt)}
                                            className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase transition-all duration-200 ${
                                                metricIndex === opt 
                                                ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' 
                                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Team Filter */}
                            <div className="space-y-2">
                                <PremiumSelect
                                    label="Team Index"
                                    value={filterTeam}
                                    options={[
                                        { label: 'All Teams', value: 'All' },
                                        ...availableTeams.map(t => ({ label: t.name, value: t.id }))
                                    ]}
                                    onChange={(val) => { setFilterTeam(val); setFilterUser('All'); }}
                                />
                            </div>

                            {/* User Filter */}
                            <div className="space-y-2">
                                <PremiumSelect
                                    label="Agent Index"
                                    value={filterUser}
                                    options={[
                                        { label: 'All Agents', value: 'All' },
                                        ...availableUsers.map(u => ({ label: u.name, value: u.id }))
                                    ]}
                                    onChange={(val) => setFilterUser(val)}
                                />
                            </div>

                            {/* Date Range Filter */}
                            <div className="space-y-2">
                                <PremiumSelect
                                    label="Timeline Range"
                                    value={filterDateRange}
                                    options={[
                                        { label: 'All History', value: 'All' },
                                        { label: 'Today', value: 'Today' },
                                        { label: 'Yesterday', value: 'Yesterday' },
                                        { label: 'This Week', value: 'This Week' },
                                        { label: 'This Month', value: 'This Month' },
                                        { label: 'This Year', value: 'This Year' },
                                        { label: 'Custom Range', value: 'Custom' }
                                    ]}
                                    onChange={(val) => setFilterDateRange(val)}
                                />
                            </div>

                            {/* Case Type Filter (EOD: New Case vs Backlog) */}
                            <div className="space-y-2">
                                <PremiumSelect
                                    label="Case Type"
                                    value={filterWorkType}
                                    options={WORK_TYPE_FILTER_OPTIONS.map(opt => ({ label: opt === 'All' ? 'All Types' : opt, value: opt }))}
                                    onChange={(val) => setFilterWorkType(val)}
                                />
                            </div>

                            {/* Custom Date Pickers */}
                            {filterDateRange === 'Custom' && (
                                <div className="space-y-2 lg:col-span-2 flex items-end space-x-4 animate-slide-up">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 mb-1.5">Start Date</label>
                                        <input 
                                            type="date"
                                            value={filterStartDate}
                                            onChange={(e) => setFilterStartDate(e.target.value)}
                                            className="w-full bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 mb-1.5">End Date</label>
                                        <input 
                                            type="date"
                                            value={filterEndDate}
                                            onChange={(e) => setFilterEndDate(e.target.value)}
                                            className="w-full bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Conditional Metrics Filters */}
                            {metricIndex === 'IRT' && (
                                <>
                                    <div className="space-y-2">
                                        <PremiumSelect
                                            label="Origin"
                                            value={filterIrtOrigin}
                                            options={[
                                                { label: 'All Origins', value: 'All' },
                                                ...['Chat', 'Email'].map(opt => ({ label: opt, value: opt }))
                                            ]}
                                            onChange={(val) => setFilterIrtOrigin(val)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <PremiumSelect
                                            label="Breach"
                                            value={filterIrtBreachType}
                                            options={[
                                                { label: 'All Breaches', value: 'All' },
                                                ...[
                                                    'Past 2 mins upon chat assignment',
                                                    'Close to Resolution SLA upon Case assignment',
                                                    'CT Transfer',
                                                    'Assigned from another team member'
                                                ].map(opt => ({ label: opt, value: opt }))
                                            ]}
                                            onChange={(val) => setFilterIrtBreachType(val)}
                                        />
                                    </div>
                                </>
                            )}

                            {metricIndex === 'Backlogs' && (
                                <div className="space-y-2">
                                    <PremiumSelect
                                        label="Backlog Status"
                                        value={filterBacklogStatus}
                                        options={[
                                            { label: 'All Open', value: 'All' },
                                            ...BACKLOG_STATUSES.map(opt => ({ label: opt, value: opt }))
                                        ]}
                                        onChange={(val) => setFilterBacklogStatus(val)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* KPI Dashboard Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                        {metricIndex === 'Backlogs' && (
                            <>
                                <div className="group relative overflow-hidden bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-6 rounded-3xl shadow-lg animate-slide-up">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-60"></div>
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Total Backlogs</p>
                                    <div className="flex items-baseline space-x-2">
                                        <span className="text-4xl font-black text-gray-900 dark:text-white">{backlogStats.totalBacklogs}</span>
                                        <span className="text-[10px] font-bold text-indigo-500 uppercase">Open Cases</span>
                                    </div>
                                    <div className="mt-4 h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 w-1/2 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                                    </div>
                                </div>

                                <div className="group relative overflow-hidden bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-6 rounded-3xl shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 opacity-60"></div>
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Avg Aging</p>
                                    <div className="flex items-baseline space-x-2">
                                        <span className="text-4xl font-black text-gray-900 dark:text-white">{backlogStats.avgAgeHours.toFixed(1)}</span>
                                        <span className="text-[10px] font-bold text-amber-500 uppercase">Hours</span>
                                    </div>
                                    <div className="mt-4 h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 w-1/4 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                                    </div>
                                </div>

                                <div className="group relative overflow-hidden bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-6 rounded-3xl shadow-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-60"></div>
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Team Spread</p>
                                    <div className="flex items-baseline space-x-2">
                                        <span className="text-4xl font-black text-gray-900 dark:text-white">{backlogStats.teamList.length}</span>
                                        <span className="text-[10px] font-bold text-purple-500 uppercase">Active Teams</span>
                                    </div>
                                </div>

                                <div className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-cyan-600 p-6 rounded-3xl shadow-xl shadow-indigo-500/20 text-white flex flex-col justify-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <UserGroupIcon className="w-16 h-16 text-white" />
                                    </div>
                                    <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1.5 ml-1">Active Backlog Units</p>
                                    <h4 className="text-3xl font-black tracking-tighter drop-shadow-md">{backlogStats.agentList.length}</h4>
                                    <p className="text-[10px] font-bold text-white/50 mt-1 uppercase tracking-tighter transition-all">Agents with Open Items</p>
                                </div>
                            </>
                        )}

                        {metricIndex === 'IRT' && (
                            <>
                                <div className="group relative overflow-hidden bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-6 rounded-3xl shadow-lg animate-slide-up">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 opacity-60"></div>
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Total Breaches</p>
                                    <span className="text-4xl font-black text-gray-900 dark:text-white">{irtStats.totalBreaches}</span>
                                </div>
                                <div className="group relative overflow-hidden bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-6 rounded-3xl shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 opacity-60"></div>
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Chat SLA Fail</p>
                                    <span className="text-4xl font-black text-rose-500">{irtStats.chatBreaches}</span>
                                </div>
                                <div className="group relative overflow-hidden bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-6 rounded-3xl shadow-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 opacity-60"></div>
                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Email SLA Fail</p>
                                    <span className="text-4xl font-black text-rose-500">{irtStats.emailBreaches}</span>
                                </div>
                                <div className="group relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl shadow-xl shadow-slate-900/10 text-white animate-slide-up" style={{ animationDelay: '0.3s' }}>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Top Offense</p>
                                    <p className="text-xs font-black truncate">{irtStats.topReason}</p>
                                </div>
                            </>
                        )}

                    </div>

                    {/* IRT Intelligence charts */}
                    {metricIndex === 'IRT' && (
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8 animate-slide-up">
                            <div className="lg:col-span-3 bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-8 rounded-3xl shadow-lg">
                                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6 uppercase tracking-[0.2em] flex items-center">
                                    <ChartBarIcon className="w-5 h-5 mr-3 text-indigo-500" /> Breach Reasons
                                </h3>
                                {irtStats.reasonList.length === 0 ? (
                                    <div className="py-16 text-center text-gray-400 text-xs font-bold uppercase tracking-widest bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10">No breaches detected</div>
                                ) : (
                                    <AuroraDonutChart data={irtStats.reasonList} height={280} unit="breaches" />
                                )}
                            </div>
                            <div className="lg:col-span-2 bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-8 rounded-3xl shadow-lg">
                                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6 uppercase tracking-[0.2em] flex items-center">
                                    <BoltIcon className="w-5 h-5 mr-3 text-rose-500" /> Breaches by Origin
                                </h3>
                                {irtStats.originList.length === 0 ? (
                                    <div className="py-16 text-center text-gray-400 text-xs font-bold uppercase tracking-widest bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10">No breaches detected</div>
                                ) : (
                                    <AuroraDonutChart data={irtStats.originList} height={280} unit="breaches" colors={{ Chat: '#6366F1', Email: '#22D3EE' }} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Backlog Intelligence Section */}
                    {metricIndex === 'Backlogs' && (
                      <>
                        {/* Premium charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 animate-slide-up">
                            <div className="bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-8 rounded-3xl shadow-lg">
                                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6 uppercase tracking-[0.2em] flex items-center">
                                    <InboxStackIcon className="w-5 h-5 mr-3 text-indigo-500" /> Open Backlogs by Team
                                </h3>
                                {backlogStats.teamList.length === 0 ? (
                                    <div className="py-16 text-center text-gray-400 text-xs font-bold uppercase tracking-widest bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10">No active backlogs</div>
                                ) : (
                                    <AuroraBarChart data={backlogStats.teamList.slice(0, 10).map(t => ({ name: t.name, value: t.count }))} height={280} unit="cases" xTickAngle={-12} />
                                )}
                            </div>
                            <div className="bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-8 rounded-3xl shadow-lg">
                                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6 uppercase tracking-[0.2em] flex items-center">
                                    <ChartBarIcon className="w-5 h-5 mr-3 text-purple-500" /> Top Agents by Backlog
                                </h3>
                                {backlogStats.agentList.length === 0 ? (
                                    <div className="py-16 text-center text-gray-400 text-xs font-bold uppercase tracking-widest bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10">No active backlogs</div>
                                ) : (
                                    <AuroraBarChart data={backlogStats.agentList.slice(0, 8).map(a => ({ name: a.name, value: a.count }))} height={280} unit="cases" xTickAngle={-12} colors={() => '#8B5CF6'} />
                                )}
                            </div>
                        </div>

                        {/* Detailed breakdown lists */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 animate-slide-up">
                            {/* Team Breakdown */}
                            <div className="bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-8 rounded-3xl shadow-lg">
                                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6 uppercase tracking-[0.2em] flex items-center">
                                    <UserGroupIcon className="w-5 h-5 mr-3 text-indigo-500" />
                                    Backlogs by Team
                                </h3>
                                <div className="space-y-4">
                                    {backlogStats.teamList.length === 0 ? (
                                        <div className="py-12 text-center text-gray-400 text-xs font-bold uppercase tracking-widest bg-gray-50/50 dark:bg-white/2 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">No Active Team Backlogs</div>
                                    ) : (
                                        backlogStats.teamList.map((team, idx) => (
                                            <div key={team.id} className="group flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-indigo-500/20 transition-all duration-300">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-xs font-black text-indigo-500 shadow-sm border border-gray-100 dark:border-white/5">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-gray-900 dark:text-white tracking-tight">{team.name}</p>
                                                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Avg Age: {team.avgAge.toFixed(1)}h</p>
                                                    </div>
                                                </div>
                                                <div className="px-4 py-2 bg-indigo-500/10 rounded-xl">
                                                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{team.count}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Agent Breakdown */}
                            <div className="bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-8 rounded-3xl shadow-lg">
                                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6 uppercase tracking-[0.2em] flex items-center">
                                    <ChartBarIcon className="w-5 h-5 mr-3 text-purple-500" />
                                    Backlogs by Agent
                                </h3>
                                <div className="overflow-y-auto max-h-[440px] pr-2 custom-scrollbar">
                                    <div className="space-y-3">
                                        {backlogStats.agentList.length === 0 ? (
                                            <div className="py-12 text-center text-gray-400 text-xs font-bold uppercase tracking-widest bg-gray-50/50 dark:bg-white/2 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">No Active Agent Backlogs</div>
                                        ) : (
                                            backlogStats.agentList.map((agent) => (
                                                <div key={agent.id} className="group flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-purple-500/20 transition-all duration-300">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-indigo-500/10">
                                                            {agent.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-gray-900 dark:text-white tracking-tight">{agent.name}</p>
                                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{teamsMap[agent.teamId] || 'Unit Alpha'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{agent.count} Open</p>
                                                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter">{agent.avgAge.toFixed(1)}h Delay</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                      </>
                    )}
                    {/* Data Visualization & Tables Section */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Overarching Audit Table */}
                        <div className="col-span-1 xl:col-span-3 bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-3xl overflow-hidden shadow-lg animate-slide-up" style={{ animationDelay: '0.5s' }}>
                            <div className="p-5 border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-white/2 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Audit Intel</h3>
                                    <Badge color="indigo" className="text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-lg">
                                        {filteredRawCases.length} Records
                                    </Badge>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                                <table className="min-w-full divide-y divide-gray-100 dark:divide-white/5">
                                    <thead className="bg-gray-50/80 dark:bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Protocol</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Routing Agent</th>
                                            {metricIndex === 'IRT' && (
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">IRT Breach Matrix</th>
                                            )}
                                            {metricIndex === 'Backlogs' && (
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Status</th>
                                            )}
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Timeline</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                        {pagedRawCases.map(c => (
                                            <tr key={c.id} className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors">
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <div className="text-sm font-black text-gray-900 dark:text-white">#{c.caseId}</div>
                                                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Origin: {c.origin} · {getWorkType(c)}</div>
                                                </td>
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <div className="text-sm font-black text-gray-800 dark:text-gray-200">{usersMapGlobal[c.userId] || c.userDisplayName || 'Anonymous'}</div>
                                                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
                                                        {(teamsMap[c.teamId] || c.teamId) === c.teamId ? `Team ${c.teamId}` : teamsMap[c.teamId]}
                                                    </div>
                                                </td>
                                                {metricIndex === 'IRT' && (
                                                    <td className="px-6 py-5">
                                                        <span className="text-[10px] font-black bg-rose-50/50 dark:bg-rose-500/10 text-rose-500 px-3 py-1.5 rounded-xl border border-rose-100/50 dark:border-rose-500/20 shadow-sm block max-w-[200px] leading-relaxed uppercase tracking-widest whitespace-normal">
                                                            {c.irt}
                                                        </span>
                                                    </td>
                                                )}
                                                {metricIndex === 'Backlogs' && (
                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                        <Badge color="indigo" className="text-[9px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-lg">
                                                            {c.status || 'N/A'}
                                                        </Badge>
                                                    </td>
                                                )}
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                                        {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : 'Today'}
                                                    </p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination page={rowsPage} pageSize={ROWS_PER_PAGE} total={filteredRawCases.length} onPageChange={setRowsPage} />

                            {filteredRawCases.length === 0 && (
                                <div className="p-20 text-center">
                                    <EmptyState 
                                        icon={<ChartBarIcon className="h-12 w-12 text-gray-300 dark:text-white/10" />} 
                                        title="No Intelligence Extracted" 
                                        description="Broader filter criteria may yield better mapping results." 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MetricAnalyticsTab;
