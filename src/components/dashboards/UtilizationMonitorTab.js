/**
 * UtilizationMonitorTab (Admin only)
 *
 * Real-time view of how the app is being used, per user:
 *   LDAP · Online status · Active time · Last tab (last click) · Most-used tab ·
 *   Case record count · Last case recorded
 *
 * Plus interactive charts and an append-only audit trail (with CSV export).
 *
 * Data sources (all real-time):
 *   - subscribeAllActivity ...... user_activity/{uid} live state
 *   - subscribeActivityAudit .... activity_audit event log
 *   - subscribeToAnalyticsTrackedCases .. tracked_cases (for case count / last case)
 *   - getAllUsers / getAllTeams .. roster + team names (refreshed on demand)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Badge, Skeleton, CardSkeleton, EmptyState, PremiumSelect, Button, Modal } from '../ui';
import Pagination from '../common/Pagination';
import { AuroraAreaChart, NeonLineChart, NeonGauge, AuroraBarChart, AuroraDonutChart } from '../ui/charts';
import {
  ChartBarIcon, ArrowPathIcon, MagnifyingGlassIcon, SignalIcon,
  ClockIcon, DocumentTextIcon, ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { subscribeAllActivity, subscribeActivityAudit, fetchActivityAudit } from '../../services/activity';
import { subscribeToAnalyticsTrackedCases } from '../../firebase/firestore';
import { getAllUsers } from '../../services/users';
import { getAllTeams } from '../../services/teams';
import { showError } from '../../utils/toast';
import { logger } from '../../utils/logger';
import LiveSessionsPanel from './LiveSessionsPanel';

const ONLINE_WINDOW_MS = 6 * 60 * 1000; // "online" if seen within 6 min

/** Firestore Timestamp | Date | millis -> millis (0 when absent). */
const toMillis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
};

const formatDuration = (ms) => {
  if (!ms || ms < 1000) return '0m';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(ms / 1000)}s`;
};

const formatDateTime = (ms) => (ms ? new Date(ms).toLocaleString() : '—');

const prettifyTab = (tabId) =>
  (tabId || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const mostUsedTab = (tabCounts) => {
  if (!tabCounts) return null;
  let best = null;
  let bestCount = 0;
  Object.entries(tabCounts).forEach(([id, count]) => {
    if (count > bestCount) {
      bestCount = count;
      best = id;
    }
  });
  return best ? { id: best, count: bestCount } : null;
};

const EVENT_VARIANT = {
  session_start: 'success',
  session_end: 'gray',
  tab_view: 'info',
};

// Category → badge variant (drives trail row color). Productive = real work.
const CATEGORY_VARIANT = { productive: 'primary', navigation: 'info', session: 'gray' };
const prettyEvent = (t) => (t || '').replace(/_/g, ' ');
// Parse a YYYY-MM-DD filter bound into millis (start or end of that day).
const dateBound = (str, end = false) => {
  if (!str) return null;
  const d = new Date(`${str}T${end ? '23:59:59' : '00:00:00'}`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};
const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const buildCsv = (header, rows) => [header.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
const downloadCsv = (csv, name) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const UtilizationMonitorTab = () => {
  const [activity, setActivity] = useState([]);
  const [audit, setAudit] = useState([]);
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nowTs, setNowTs] = useState(Date.now());

  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  // Forensic audit filters + per-user drill-down
  const [auditCategory, setAuditCategory] = useState('all'); // all | productive | navigation | session
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [drilldownUid, setDrilldownUid] = useState(null);
  const [eventDetail, setEventDetail] = useState(null); // clicked trail event → detail modal
  const [exporting, setExporting] = useState(false);
  // Active shift length (the denominator for the utilization rate).
  const [shiftOption, setShiftOption] = useState('9');
  const [customShift, setCustomShift] = useState('9');
  const shiftHours = shiftOption === 'custom' ? Math.max(0, parseFloat(customShift) || 0) : parseFloat(shiftOption);
  // Scope the utilization gauge to one user, or the whole (filtered) team.
  const [utilUser, setUtilUser] = useState('all');

  // Pagination for the two large tables.
  const USERS_PER_PAGE = 10;
  const AUDIT_PER_PAGE = 15;
  const [usersPage, setUsersPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  // One-shot roster/team load (also used by the Refresh button).
  const loadRoster = useCallback(async () => {
    try {
      const [usersData, teamsData] = await Promise.all([getAllUsers(), getAllTeams()]);
      setUsers(usersData);
      setTeams(teamsData);
    } catch (err) {
      logger.error('UtilizationMonitor: failed to load roster', err);
      showError('Failed to load users/teams');
    }
  }, []);

  // Real-time subscriptions.
  useEffect(() => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };

    const unsubActivity = subscribeAllActivity((data) => {
      setActivity(data);
      done();
    }, done);

    const unsubAudit = subscribeActivityAudit((data) => setAudit(data), { max: 250 });

    const unsubCases = subscribeToAnalyticsTrackedCases(
      'admin',
      null,
      null,
      (data) => setCases(data),
      (err) => logger.error('UtilizationMonitor: cases subscription error', err)
    );

    loadRoster();

    // Tick every 30s so "online" / relative times refresh without a snapshot.
    const clock = setInterval(() => setNowTs(Date.now()), 30000);

    return () => {
      unsubActivity && unsubActivity();
      unsubAudit && unsubAudit();
      unsubCases && unsubCases();
      clearInterval(clock);
    };
  }, [loadRoster]);

  // uid -> live activity doc
  const activityByUid = useMemo(() => {
    const map = {};
    activity.forEach((a) => { map[a.uid || a.id] = a; });
    return map;
  }, [activity]);

  // userId -> { count, lastAt, lastCaseId }
  const caseAggByUid = useMemo(() => {
    const map = {};
    cases.forEach((c) => {
      const uid = c.userId;
      if (!uid) return;
      const at = toMillis(c.createdAt);
      if (!map[uid]) map[uid] = { count: 0, lastAt: 0, lastCaseId: null };
      map[uid].count += 1;
      if (at >= map[uid].lastAt) {
        map[uid].lastAt = at;
        map[uid].lastCaseId = c.caseId || null;
      }
    });
    return map;
  }, [cases]);

  const teamNameById = useMemo(() => {
    const map = {};
    teams.forEach((t) => { map[t.id] = t.displayName || t.name || t.id; });
    return map;
  }, [teams]);

  // Merge roster + activity + cases into monitor rows.
  const rows = useMemo(() => {
    return users
      .map((u) => {
        const a = activityByUid[u.id] || {};
        const cAgg = caseAggByUid[u.id] || { count: 0, lastAt: 0, lastCaseId: null };
        const lastActiveMs = toMillis(a.lastActiveAt);
        const ldap = a.ldap || (u.ssoEmail || u.email || '').split('@')[0]?.toLowerCase() || u.id;
        const most = mostUsedTab(a.tabCounts);
        return {
          uid: u.id,
          ldap,
          displayName: u.displayName || u.email || 'Unknown User',
          role: u.role || '—',
          teamId: u.teamId || null,
          online: !!lastActiveMs && nowTs - lastActiveMs < ONLINE_WINDOW_MS,
          lastActiveMs,
          activeMs: a.activeMs || 0,
          lastTabLabel: a.lastTabLabel || (a.lastTab ? prettifyTab(a.lastTab) : null),
          lastTabAtMs: toMillis(a.lastTabAt),
          mostTabLabel: most ? prettifyTab(most.id) : null,
          mostTabCount: most ? most.count : 0,
          caseCount: cAgg.count,
          lastCaseId: cAgg.lastCaseId,
          lastCaseMs: cAgg.lastAt,
        };
      })
      .filter((r) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q || r.ldap.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q);
        const matchesTeam = teamFilter === 'all' || r.teamId === teamFilter;
        return matchesSearch && matchesTeam;
      })
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1; // online first
        return b.activeMs - a.activeMs;
      });
  }, [users, activityByUid, caseAggByUid, search, teamFilter, nowTs]);

  // ---- Summary metrics ----
  const summary = useMemo(() => {
    const onlineCount = rows.filter((r) => r.online).length;
    const totalActiveMs = rows.reduce((s, r) => s + r.activeMs, 0);
    const withTime = rows.filter((r) => r.activeMs > 0);
    const avgActiveMs = withTime.length ? totalActiveMs / withTime.length : 0;
    const totalCases = rows.reduce((s, r) => s + r.caseCount, 0);
    return { onlineCount, totalActiveMs, avgActiveMs, totalCases };
  }, [rows]);

  // ---- Chart data ----
  const activeTimeChart = useMemo(
    () =>
      [...rows]
        .filter((r) => r.activeMs > 0)
        .sort((a, b) => b.activeMs - a.activeMs)
        .slice(0, 10)
        .map((r) => ({ name: r.ldap, minutes: Math.round(r.activeMs / 60000) })),
    [rows]
  );

  const tabUsageChart = useMemo(() => {
    const totals = {};
    rows.forEach((r) => {
      const a = activityByUid[r.uid];
      if (!a?.tabCounts) return;
      Object.entries(a.tabCounts).forEach(([id, count]) => {
        totals[id] = (totals[id] || 0) + count;
      });
    });
    return Object.entries(totals)
      .map(([id, value]) => ({ name: prettifyTab(id), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [rows, activityByUid]);

  const casesOverTimeChart = useMemo(() => {
    const byDay = {};
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    cases.forEach((c) => {
      const at = toMillis(c.createdAt);
      if (!at || at < cutoff) return;
      const d = new Date(at);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      byDay[key] = (byDay[key] || 0) + 1;
    });
    // Build an ordered 14-day axis so gaps render as zero.
    const out = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      out.push({ date: key, cases: byDay[key] || 0 });
    }
    return out;
  }, [cases]);

  // Activity events per day over the last 14 days (from the audit trail).
  const activityTrendChart = useMemo(() => {
    const byDay = {};
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    audit.forEach((e) => {
      const at = toMillis(e.timestamp);
      if (!at || at < cutoff) return;
      const d = new Date(at);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      byDay[key] = (byDay[key] || 0) + 1;
    });
    const out = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      out.push({ date: key, events: byDay[key] || 0 });
    }
    return out;
  }, [audit]);

  // Share of users active today — drives the gauge.
  const activeRate = useMemo(() => {
    const total = rows.length;
    if (!total) return 0;
    const active = rows.filter((r) => r.activeMs > 0).length;
    return Math.round((active / total) * 100);
  }, [rows]);

  // Per-user utilization: active time today as a share of the shift (0–100).
  const userUtil = useCallback(
    (activeMs) => {
      if (!shiftHours) return 0;
      return Math.round(Math.min(activeMs / (shiftHours * 60 * 60 * 1000), 1) * 100);
    },
    [shiftHours]
  );

  // App utilization rate for the gauge. A specific user → their own rate;
  // otherwise the average across users who were active today. (Averaging over
  // active users answers "how much of their shift are people actually in the
  // app", instead of being dragged to ~0 by everyone offline.)
  const utilizationRate = useMemo(() => {
    if (!shiftHours) return 0;
    if (utilUser !== 'all') {
      const r = rows.find((x) => x.uid === utilUser);
      return r ? userUtil(r.activeMs) : 0;
    }
    const active = rows.filter((r) => r.activeMs > 0);
    if (!active.length) return 0;
    const shiftMs = shiftHours * 60 * 60 * 1000;
    const sum = active.reduce((s, r) => s + Math.min(r.activeMs / shiftMs, 1), 0);
    return Math.round((sum / active.length) * 100);
  }, [rows, shiftHours, utilUser, userUtil]);

  // Options for the per-user utilization filter (respects the team/search filter).
  const utilUserOptions = useMemo(
    () => [
      { value: 'all', label: 'Team average' },
      ...rows.map((r) => ({ value: r.uid, label: r.ldap })),
    ],
    [rows]
  );

  // uid -> productive-action count (compliance) + cases-tracked count, from the trail.
  const auditStatsByUid = useMemo(() => {
    const map = {};
    audit.forEach((e) => {
      const uid = e.uid;
      if (!uid) return;
      if (!map[uid]) map[uid] = { productive: 0, casesTracked: 0 };
      if (e.category === 'productive') map[uid].productive += 1;
      if (e.eventType === 'case_tracked') map[uid].casesTracked += 1;
    });
    return map;
  }, [audit]);

  // Shared predicate for the trail table + both CSV exports.
  const auditPredicate = useCallback(
    (e) => {
      if (auditCategory !== 'all' && (e.category || 'navigation') !== auditCategory) return false;
      const at = toMillis(e.timestamp);
      const fromMs = dateBound(auditFrom);
      const toMs = dateBound(auditTo, true);
      if (fromMs && at < fromMs) return false;
      if (toMs && at > toMs) return false;
      const q = auditSearch.trim().toLowerCase();
      if (!q) return true;
      return [e.ldap, e.displayName, e.eventType, e.action, e.caseId, e.tabLabel || e.tab, e.dashboard]
        .some((v) => (v || '').toString().toLowerCase().includes(q));
    },
    [auditCategory, auditFrom, auditTo, auditSearch]
  );

  // ---- Audit trail ----
  const filteredAudit = useMemo(() => audit.filter(auditPredicate), [audit, auditPredicate]);

  // Paginated slices (reset to page 1 when the underlying filters change).
  useEffect(() => { setUsersPage(1); }, [search, teamFilter]);
  useEffect(() => { setAuditPage(1); }, [auditCategory, auditFrom, auditTo, auditSearch]);
  const pagedRows = useMemo(
    () => rows.slice((usersPage - 1) * USERS_PER_PAGE, usersPage * USERS_PER_PAGE),
    [rows, usersPage]
  );
  const pagedAudit = useMemo(
    () => filteredAudit.slice((auditPage - 1) * AUDIT_PER_PAGE, auditPage * AUDIT_PER_PAGE),
    [filteredAudit, auditPage]
  );

  // Per-user drill-down: that user's events (newest first) from the live trail.
  const drilldownTrail = useMemo(
    () => (drilldownUid ? audit.filter((e) => e.uid === drilldownUid) : []),
    [drilldownUid, audit]
  );
  const drilldownUser = useMemo(
    () => rows.find((r) => r.uid === drilldownUid) || drilldownTrail[0] || null,
    [rows, drilldownUid, drilldownTrail]
  );

  // Template usage counts (from the recent trail): targetId -> { total, byUser }.
  const templateUsage = useMemo(() => {
    const byTarget = {};
    audit.forEach((e) => {
      if (e.eventType !== 'template_used' || !e.targetId) return;
      const t = byTarget[e.targetId] || (byTarget[e.targetId] = { total: 0, byUser: {}, title: e.detail });
      t.total += 1;
      t.byUser[e.uid] = (t.byUser[e.uid] || 0) + 1;
    });
    return byTarget;
  }, [audit]);

  // Detailed forensic dump — pulls the full trail (not the live 250 cap), same filters.
  const exportDetailedCsv = useCallback(async () => {
    setExporting(true);
    try {
      const all = await fetchActivityAudit({ max: 5000 });
      const data = all.filter(auditPredicate);
      const header = ['Timestamp', 'LDAP', 'Name', 'Role', 'Dashboard', 'Team', 'Category', 'Event', 'Action', 'Case ID', 'SPII', 'Detail'];
      const csvRows = data.map((e) => [
        formatDateTime(toMillis(e.timestamp)),
        e.ldap || '',
        e.displayName || '',
        e.role || '',
        e.dashboard || '',
        teamNameById[e.teamId] || e.teamId || '',
        e.category || '',
        e.eventType || '',
        e.action || '',
        e.caseId || '',
        e.isSpii === true ? 'YES' : (e.isSpii === false ? 'no' : ''),
        e.detail || '',
      ]);
      downloadCsv(buildCsv(header, csvRows), `activity-forensic-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setExporting(false);
    }
  }, [auditPredicate, teamNameById]);

  // Pivot — rows = users, columns = action types, cells = counts + compliance.
  const exportPivotCsv = useCallback(async () => {
    setExporting(true);
    try {
      const all = await fetchActivityAudit({ max: 5000 });
      const data = all.filter(auditPredicate);
      const types = [...new Set(data.map((e) => e.eventType))].sort();
      const byUser = {};
      data.forEach((e) => {
        const key = e.ldap || e.uid || 'unknown';
        if (!byUser[key]) byUser[key] = { name: e.displayName, dashboard: e.dashboard, types: {}, productive: 0 };
        byUser[key].types[e.eventType] = (byUser[key].types[e.eventType] || 0) + 1;
        if (e.category === 'productive') byUser[key].productive += 1;
      });
      const header = ['LDAP', 'Name', 'Dashboard', ...types.map(prettyEvent), 'Productive total', 'Access only?'];
      const csvRows = Object.entries(byUser).map(([ldap, u]) => [
        ldap, u.name || '', u.dashboard || '',
        ...types.map((t) => u.types[t] || 0),
        u.productive,
        u.productive === 0 ? 'YES' : 'no',
      ]);
      downloadCsv(buildCsv(header, csvRows), `activity-pivot-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setExporting(false);
    }
  }, [auditPredicate]);

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton lines={2} className="mb-6" />
        <CardSkeleton count={4} />
      </div>
    );
  }

  const statCards = [
    { label: 'Online Now', value: summary.onlineCount, icon: SignalIcon, grad: 'from-emerald-500 to-teal-600' },
    { label: 'Active Time (Today)', value: formatDuration(summary.totalActiveMs), icon: ClockIcon, grad: 'from-indigo-500 to-cyan-500' },
    { label: 'Avg Active / User', value: formatDuration(summary.avgActiveMs), icon: ChartBarIcon, grad: 'from-blue-500 to-cyan-600' },
    { label: 'Cases Recorded', value: summary.totalCases, icon: DocumentTextIcon, grad: 'from-amber-500 to-orange-600' },
  ];

  return (
    // Laid out for wide screens (the admin shell renders this tab full-width):
    // charts flow 2 → 3 → 6 per row and, on very wide screens, the user table
    // and audit trail sit side by side — so less vertical scrolling.
    <div className="space-y-6 pt-2 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-cyan-500 to-pink-500"></div>
        <div className="px-6 py-5 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl">
              <ChartBarIcon className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">App Utilization Monitor</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Real-time per-user usage, activity & audit trail</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live
            </div>
            <Button onClick={loadRoster} variant="secondary" className="!rounded-2xl">
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-white/90 dark:bg-[#111111]/80 border border-gray-200/50 dark:border-white/10 rounded-[2rem] p-1">
            <div className="flex items-center p-3">
              <div className={`flex-shrink-0 p-3.5 bg-gradient-to-br ${s.grad} shadow-lg rounded-2xl`}>
                <s.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{s.label}</p>
                <p className="text-2xl 2xl:text-3xl font-black text-gray-900 dark:text-white tracking-tighter mt-1 whitespace-nowrap">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts — one grid: 1 → 2 (lg) → 3 (xl) → all 6 in a row (≥2200px) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 min-[2200px]:grid-cols-6 gap-6 [&>*]:min-w-0">
        <Card className="bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 rounded-3xl p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Active Time — Top Users (min)</h3>
          {activeTimeChart.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No activity yet</div>
          ) : (
            <AuroraBarChart data={activeTimeChart} xKey="name" yKey="minutes" unit="min" xTickAngle={-25} height={220} />
          )}
        </Card>

        <Card className="bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 rounded-3xl p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Tab Usage Distribution</h3>
          {tabUsageChart.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No tab activity yet</div>
          ) : (
            <AuroraDonutChart
              data={tabUsageChart}
              dataKey="value"
              nameKey="name"
              neon
              centerValue={tabUsageChart.reduce((s, d) => s + d.value, 0)}
              centerLabel="Tab views"
              unit="views"
              height={220}
            />
          )}
        </Card>

        <Card className="bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 rounded-3xl p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Cases Recorded (14 days)</h3>
          <AuroraAreaChart data={casesOverTimeChart} xKey="date" yKey="cases" unit="cases" height={220} />
        </Card>

        <Card className="bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 rounded-3xl p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Activity — Events (14 days)</h3>
          <NeonLineChart data={activityTrendChart} xKey="date" yKey="events" unit="events" height={220} />
        </Card>

        <Card className="bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 rounded-3xl p-6 flex flex-col">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Active Rate (Today)</h3>
          <div className="flex-1 flex items-center justify-center">
            <NeonGauge value={activeRate} label="Active rate" height={220} />
          </div>
        </Card>

        <Card className="bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 rounded-3xl p-6 flex flex-col">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Utilization Rate</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PremiumSelect
                value={utilUser}
                onChange={setUtilUser}
                options={utilUserOptions}
                className="!rounded-xl min-w-[150px] flex-1"
              />
              <PremiumSelect
                value={shiftOption}
                onChange={setShiftOption}
                options={[
                  { value: '9', label: '9 hrs' },
                  { value: '9.5', label: '9.5 hrs' },
                  { value: '10.5', label: '10.5 hrs' },
                  { value: '11', label: '11 hrs' },
                  { value: 'custom', label: 'Custom' },
                ]}
                className="!rounded-xl min-w-[100px]"
              />
              {shiftOption === 'custom' && (
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={customShift}
                  onChange={(e) => setCustomShift(e.target.value)}
                  aria-label="Custom shift hours"
                  placeholder="hrs"
                  className="w-20 px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm focus:ring-2 focus:ring-indigo-500/20"
                />
              )}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <NeonGauge
              value={utilizationRate}
              label={!shiftHours ? 'set shift' : utilUser === 'all' ? `team · ${shiftHours}h shift` : `${(utilUserOptions.find((o) => o.value === utilUser) || {}).label || ''} · ${shiftHours}h`}
              height={220}
            />
          </div>
        </Card>
      </div>

      {/* Tables: stacked, or side by side on very wide screens (the 9-column
          user table gets the larger share so it doesn't scroll sideways) */}
      <div className="grid grid-cols-1 min-[2400px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start [&>*]:min-w-0">
      <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by LDAP or name..."
            className="block w-full pl-11 pr-4 py-3 bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div className="w-full md:w-64">
          <PremiumSelect
            value={teamFilter}
            onChange={setTeamFilter}
            options={[
              { value: 'all', label: 'All Teams' },
              ...teams.map((t) => ({ value: t.id, label: t.displayName || t.name })),
            ]}
            className="!rounded-2xl"
          />
        </div>
      </div>

      {/* Live user table */}
      <div className="bg-white dark:bg-[#111111] rounded-[2.5rem] shadow-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/5">
            <thead className="bg-gray-50/50 dark:bg-white/[0.02]">
              <tr>
                {['LDAP', 'Status', 'Compliance', 'Active Time', 'Utilization', 'Last Tab (Last Click)', 'Most Used Tab', 'Cases', 'Last Case Recorded'].map((h) => (
                  <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center">
                    <EmptyState
                      icon={<ChartBarIcon className="w-14 h-14 text-gray-300 dark:text-gray-700 mx-auto" />}
                      title="No users to display"
                      description="Utilization data appears as users sign in and use the app."
                    />
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.uid} className="group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-black">
                          {r.ldap?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-black text-gray-900 dark:text-white font-mono">{r.ldap}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{r.displayName}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={r.online ? 'success' : 'gray'} size="sm" className="font-black uppercase tracking-widest">
                        {r.online ? 'Online' : 'Offline'}
                      </Badge>
                      {r.lastActiveMs > 0 && (
                        <div className="text-[10px] text-gray-400 mt-1">{formatDateTime(r.lastActiveMs)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const productive = auditStatsByUid[r.uid]?.productive || 0;
                        if (productive > 0) {
                          return <Badge variant="success" size="sm" className="font-black uppercase tracking-widest">Active</Badge>;
                        }
                        if (r.activeMs > 0 || r.online) {
                          return <Badge variant="warning" size="sm" className="font-black uppercase tracking-widest" title="Had a session but no productive actions">Access only</Badge>;
                        }
                        return <span className="text-gray-400">—</span>;
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-200">{formatDuration(r.activeMs)}</span>
                    </td>
                    <td className="px-6 py-4">
                      {r.activeMs > 0 && shiftHours ? (
                        <div className="flex items-center gap-2 min-w-[90px]">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full gradient-accent" style={{ width: `${userUtil(r.activeMs)}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums w-9 text-right">{userUtil(r.activeMs)}%</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {r.lastTabLabel ? (
                        <div className="flex flex-col">
                          <Badge variant="info" size="sm" className="font-bold w-fit">{r.lastTabLabel}</Badge>
                          {r.lastTabAtMs > 0 && <span className="text-[10px] text-gray-400 mt-1">{formatDateTime(r.lastTabAtMs)}</span>}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {r.mostTabLabel ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-200">{r.mostTabLabel}</span>
                          <span className="text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">{r.mostTabCount}×</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-gray-900 dark:text-white">{r.caseCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      {r.lastCaseMs > 0 ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-200">{formatDateTime(r.lastCaseMs)}</span>
                          {r.lastCaseId && (
                            <span className="text-[10px] font-mono text-gray-400">Case {r.lastCaseId}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={usersPage} pageSize={USERS_PER_PAGE} total={rows.length} onPageChange={setUsersPage} />
      </div>

      {/* Template live sessions (per case) */}
      <LiveSessionsPanel audit={audit} />
      </div>

      {/* Forensic audit trail */}
      <div className="bg-white dark:bg-[#111111] rounded-[2.5rem] shadow-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
        <div className="px-6 py-6 sm:px-8 border-b border-gray-200/50 dark:border-white/5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">Forensic Audit Trail</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Every action — with case IDs, SPII flags &amp; dashboard ({filteredAudit.length} shown, click a name for the full trail)</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={exportDetailedCsv} loading={exporting} variant="secondary" className="!rounded-2xl whitespace-nowrap">
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" /> Detailed CSV
              </Button>
              <Button onClick={exportPivotCsv} loading={exporting} variant="secondary" className="!rounded-2xl whitespace-nowrap">
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" /> Pivot CSV
              </Button>
            </div>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-44">
              <PremiumSelect
                value={auditCategory}
                onChange={setAuditCategory}
                options={[
                  { value: 'all', label: 'All events' },
                  { value: 'productive', label: 'Productive only' },
                  { value: 'navigation', label: 'Navigation' },
                  { value: 'session', label: 'Sessions' },
                ]}
                className="!rounded-xl"
              />
            </div>
            <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} aria-label="From date" className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} aria-label="To date" className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
            <div className="relative flex-1 min-w-[180px]">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search LDAP, case ID, action…"
                className="block w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/5">
            <thead className="bg-gray-100 dark:bg-[#161821] sticky top-0 z-10 shadow-sm">
              <tr>
                {['Time', 'LDAP', 'Dashboard', 'Event', 'Action', 'Case ID'].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredAudit.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-sm text-gray-400">No matching audit events.</td>
                </tr>
              ) : (
                pagedAudit.map((e) => (
                  <tr key={e.id} onClick={() => setEventDetail(e)} className="hover:bg-indigo-50/40 dark:hover:bg-white/[0.03] transition-colors cursor-pointer" title="Click for full detail">
                    <td className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(toMillis(e.timestamp))}</td>
                    <td className="px-6 py-3">
                      <button onClick={(ev) => { ev.stopPropagation(); setDrilldownUid(e.uid); }} className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline" title="View this user's full trail">{e.ldap || '—'}</button>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400">{e.dashboard || '—'}</td>
                    <td className="px-6 py-3">
                      <Badge variant={CATEGORY_VARIANT[e.category] || EVENT_VARIANT[e.eventType] || 'gray'} size="sm" className="font-black uppercase tracking-widest">
                        {prettyEvent(e.eventType)}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{e.action || e.tabLabel || '—'}</td>
                    <td className="px-6 py-3 text-sm whitespace-nowrap">
                      {e.caseId ? (
                        <span className="font-mono text-gray-900 dark:text-gray-200">
                          {e.caseId}
                          {e.isSpii ? <Badge variant="error" size="sm" className="ml-2 font-black">SPII</Badge> : null}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={auditPage} pageSize={AUDIT_PER_PAGE} total={filteredAudit.length} onPageChange={setAuditPage} />
      </div>
      </div>

      {/* Per-user forensic drill-down */}
      <Modal isOpen={!!drilldownUid} onClose={() => setDrilldownUid(null)} size="lg">
        {drilldownUid && (
          <>
            <Modal.Header onClose={() => setDrilldownUid(null)}>
              <Modal.Title>
                Trail — <span className="font-mono">{drilldownUser?.ldap || drilldownUser?.displayName || 'user'}</span>
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-wrap gap-3 mb-4">
                <Badge variant="primary" className="font-bold">{(auditStatsByUid[drilldownUid]?.productive || 0)} productive actions</Badge>
                <Badge variant="info" className="font-bold">{(auditStatsByUid[drilldownUid]?.casesTracked || 0)} cases tracked</Badge>
                <Badge variant={(auditStatsByUid[drilldownUid]?.productive || 0) > 0 ? 'success' : 'warning'} className="font-bold">
                  {(auditStatsByUid[drilldownUid]?.productive || 0) > 0 ? 'Active user' : 'Access only'}
                </Badge>
                <span className="text-xs text-gray-400 self-center">{drilldownTrail.length} recent events</span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2">
                {drilldownTrail.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">No recent events for this user.</p>
                ) : (
                  <ol className="relative border-l border-gray-200 dark:border-white/10 ml-2">
                    {drilldownTrail.map((e) => (
                      <li key={e.id} className="mb-4 ml-4">
                        <div className={`absolute -left-1.5 w-3 h-3 rounded-full ${String(e.eventType).includes('deleted') ? 'bg-rose-500' : e.category === 'productive' ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'}`}></div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={CATEGORY_VARIANT[e.category] || 'gray'} size="sm" className="font-black uppercase tracking-widest">{prettyEvent(e.eventType)}</Badge>
                          <span className="text-sm text-gray-800 dark:text-gray-200">{e.action || e.tabLabel || ''}</span>
                          {e.caseId && <span className="text-xs font-mono text-gray-500">· {e.caseId}{e.isSpii ? ' (SPII)' : ''}</span>}
                        </div>
                        <span className="text-[11px] text-gray-400">{formatDateTime(toMillis(e.timestamp))} · {e.dashboard || ''}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Modal.Body>
          </>
        )}
      </Modal>

      {/* Single-event detail (click a trail row) */}
      <Modal isOpen={!!eventDetail} onClose={() => setEventDetail(null)} size="lg">
        {eventDetail && (
          <>
            <Modal.Header onClose={() => setEventDetail(null)}>
              <Modal.Title>Action Detail</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={CATEGORY_VARIANT[eventDetail.category] || EVENT_VARIANT[eventDetail.eventType] || 'gray'} className="font-black uppercase tracking-widest">{prettyEvent(eventDetail.eventType)}</Badge>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{eventDetail.action || ''}</span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-gray-400">User</dt>
                    <dd className="text-gray-900 dark:text-gray-100"><span className="font-mono font-bold">{eventDetail.ldap}</span> · {eventDetail.displayName}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-gray-400">When</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{formatDateTime(toMillis(eventDetail.timestamp))}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dashboard / Role</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{eventDetail.dashboard || '—'} · {eventDetail.role || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest text-gray-400">Team</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{teamNameById[eventDetail.teamId] || eventDetail.teamId || '—'}</dd>
                  </div>
                  {eventDetail.caseId && (
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-widest text-gray-400">Case ID</dt>
                      <dd className="font-mono text-gray-900 dark:text-gray-100">{eventDetail.caseId}{eventDetail.isSpii ? <Badge variant="error" size="sm" className="ml-2 font-black">SPII</Badge> : null}</dd>
                    </div>
                  )}
                  {eventDetail.detail && (
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] font-black uppercase tracking-widest text-gray-400">Detail</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{eventDetail.detail}</dd>
                    </div>
                  )}
                </dl>

                {/* Template usage quantification */}
                {eventDetail.eventType === 'template_used' && eventDetail.targetId && (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="primary" className="font-bold">Copied {templateUsage[eventDetail.targetId]?.total || 0}× total</Badge>
                    <Badge variant="info" className="font-bold">{templateUsage[eventDetail.targetId]?.byUser?.[eventDetail.uid] || 0}× by {eventDetail.ldap}</Badge>
                    <span className="text-[11px] text-gray-400 self-center">(from recent activity)</span>
                  </div>
                )}

                {/* Full captured content (e.g. the template body) */}
                {eventDetail.content && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Content</p>
                    <pre className="whitespace-pre-wrap break-words text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 max-h-72 overflow-y-auto text-gray-800 dark:text-gray-200 font-sans">{eventDetail.content}</pre>
                  </div>
                )}
              </div>
            </Modal.Body>
          </>
        )}
      </Modal>
    </div>
  );
};

export default UtilizationMonitorTab;
