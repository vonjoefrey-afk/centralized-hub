/**
 * LiveSessionsPanel (Admin — inside the Utilization Monitor)
 *
 * Per-case view of template live sessions: which templates were used on which
 * case, how many times, for how long, and how the session ended. Also shows
 * each agent's live vs non-live share of template copies.
 *
 * Loads on demand (Refresh) instead of a live listener to keep read costs flat
 * as the agent count grows.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Badge, Modal } from '../ui';
import Pagination from '../common/Pagination';
import { fetchLiveSessions } from '../../services/liveSessions';
import { toMillis, formatDuration } from '../../services/liveSessionRules';
import { downloadCsv } from '../../utils/csv';

const PAGE_SIZE = 15;

const END_LABEL = {
  manual: 'Ended by agent',
  case_tracked: 'Case recorded',
  idle: 'Idle timeout',
  logout: 'Signed out',
  auto_closed: 'Auto-closed (server)',
};
const END_VARIANT = { manual: 'success', case_tracked: 'success', idle: 'warning', logout: 'info', auto_closed: 'warning' };

const fmt = (ms) => (ms ? new Date(ms).toLocaleString() : '—');

/** Handle time: accumulated closed stretches + the current open stretch. */
const handleTimeMs = (s, now) => {
  const base = s.handleMs || 0;
  if (s.status !== 'open') return base;
  return base + Math.max(0, now - toMillis(s.segmentStartedAt, now));
};

const templateRows = (s) => Object.entries(s.templateCounts || {})
  .map(([id, count]) => ({ id, count, title: s.templateTitles?.[id] || '(deleted template)' }))
  .sort((a, b) => b.count - a.count);

const LiveSessionsPanel = ({ audit = [] }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [channel, setChannel] = useState('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setSessions(await fetchLiveSessions({ max: 500 }));
    setNow(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status, channel]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (channel !== 'all' && s.channel !== channel) return false;
      if (!term) return true;
      return [s.caseId, s.ldap, s.displayName].some((v) => String(v || '').toLowerCase().includes(term))
        || Object.values(s.templateTitles || {}).some((t) => String(t).toLowerCase().includes(term));
    });
  }, [sessions, search, status, channel]);

  const stats = useMemo(() => {
    const open = sessions.filter((s) => s.status === 'open').length;
    const closed = sessions.filter((s) => s.status === 'closed');
    const auto = closed.filter((s) => ['idle', 'auto_closed'].includes(s.endReason)).length;
    const handle = closed.map((s) => s.handleMs || 0).filter((v) => v > 0);
    const avg = handle.length ? handle.reduce((a, b) => a + b, 0) / handle.length : 0;
    const uses = sessions.reduce((a, s) => a + (s.totalUses || 0), 0);
    return { open, autoPct: closed.length ? Math.round((auto / closed.length) * 100) : 0, avg, uses };
  }, [sessions]);

  // Live vs non-live share of template copies, per agent (from the recent trail).
  const modeShare = useMemo(() => {
    const byUser = {};
    audit.forEach((e) => {
      if (e.eventType !== 'template_used' || !e.mode) return;
      const key = e.ldap || e.uid;
      if (!byUser[key]) byUser[key] = { ldap: e.ldap || e.displayName || key, live: 0, nonLive: 0 };
      if (e.mode === 'live') byUser[key].live += 1; else byUser[key].nonLive += 1;
    });
    return Object.values(byUser)
      .map((r) => ({ ...r, total: r.live + r.nonLive, nonLivePct: Math.round((r.nonLive / (r.live + r.nonLive)) * 100) }))
      .sort((a, b) => b.nonLivePct - a.nonLivePct || b.total - a.total);
  }, [audit]);

  const exportCsv = () => {
    const headers = ['Case ID', 'LDAP', 'Agent', 'Channel', 'Status', 'End reason', 'Started', 'Ended', 'Handle time (min)', 'Template uses', 'Reopened', 'Templates (title × count)'];
    const rows = filtered.map((s) => [
      s.caseId, s.ldap, s.displayName, s.channel, s.status, s.endReason || '',
      fmt(toMillis(s.startedAt, 0)), fmt(toMillis(s.endedAt, 0)),
      Math.round(handleTimeMs(s, now) / 60000), s.totalUses || 0, s.reopenCount || 0,
      templateRows(s).map((t) => `${t.title} ×${t.count}`).join('; '),
    ]);
    downloadCsv(`live-sessions-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectCls = 'px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200';

  return (
    <div className="bg-white dark:bg-[#111111] rounded-[2.5rem] shadow-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
      <div className="px-6 py-6 sm:px-8 border-b border-gray-200/50 dark:border-white/5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">Template Live Sessions</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Which templates were used on which case, how often, and how each session ended ({filtered.length} shown)</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:text-indigo-600 disabled:opacity-50">
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button type="button" onClick={exportCsv} disabled={!filtered.length} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40">
              <ArrowDownTrayIcon className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Open now', stats.open],
            ['Template uses (live)', stats.uses],
            ['Avg handle time', formatDuration(stats.avg)],
            ['Auto-ended', `${stats.autoPct}%`],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search case ID, agent or template" className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label="Status">
            <option value="all">All statuses</option><option value="open">Open</option><option value="closed">Closed</option>
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectCls} aria-label="Channel">
            <option value="all">All channels</option><option value="chat">Chat</option><option value="email">Email</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-gray-400">
            <tr>
              {['Case ID', 'Agent', 'Channel', 'Status', 'Started', 'Handle time', 'Uses', 'Top templates'].map((h) => (
                <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Loading sessions…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No live sessions yet. They appear here once agents start copying templates in Live mode.</td></tr>
            ) : pageRows.map((s) => {
              const top = templateRows(s);
              return (
                <tr key={s.id} onClick={() => setDetail(s)} className="cursor-pointer hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">{s.caseId}{s.reopenCount ? <span className="ml-1 text-[10px] text-gray-400">↻{s.reopenCount}</span> : null}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className="font-semibold text-gray-800 dark:text-gray-200">{s.ldap || s.displayName}</span></td>
                  <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-300">{s.channel}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s.status === 'open'
                      ? <Badge variant="primary" size="sm">Open</Badge>
                      : <Badge variant={END_VARIANT[s.endReason] || 'gray'} size="sm">{END_LABEL[s.endReason] || 'Closed'}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(toMillis(s.startedAt, 0))}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-200">{formatDuration(handleTimeMs(s, now))}</td>
                  <td className="px-4 py-3 tabular-nums font-bold text-gray-900 dark:text-white">{s.totalUses || 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 max-w-[280px] truncate">
                    {top.length ? top.slice(0, 3).map((t) => `${t.title} ×${t.count}`).join(', ') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      {modeShare.length > 0 && (
        <div className="px-6 py-5 sm:px-8 border-t border-gray-200/50 dark:border-white/5">
          <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Live vs non-live copies (recent activity)</h4>
          <div className="flex flex-wrap gap-2">
            {modeShare.slice(0, 24).map((r) => (
              <div key={r.ldap} className="px-3 py-2 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02] text-xs">
                <span className="font-bold text-gray-800 dark:text-gray-100">{r.ldap}</span>
                <span className="ml-2 text-gray-500">{r.live} live · {r.nonLive} non-live</span>
                <span className={`ml-2 font-black ${r.nonLivePct >= 50 ? 'text-amber-600' : 'text-emerald-600'}`}>{r.nonLivePct}% non-live</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail && (
        <Modal isOpen={true} onClose={() => setDetail(null)}>
          <Modal.Header onClose={() => setDetail(null)}>
            <Modal.Title>Case {detail.caseId}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-5">
              {[
                ['Agent', `${detail.displayName || ''} (${detail.ldap || '—'})`],
                ['Channel', detail.channel],
                ['Status', detail.status === 'open' ? 'Open' : (END_LABEL[detail.endReason] || 'Closed')],
                ['Handle time', formatDuration(handleTimeMs(detail, now))],
                ['Started', fmt(toMillis(detail.startedAt, 0))],
                ['Ended', fmt(toMillis(detail.endedAt, 0))],
                ['Last activity', fmt(toMillis(detail.lastActivityAt, 0))],
                ['Reopened', String(detail.reopenCount || 0)],
              ].map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100">{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Templates used ({detail.totalUses || 0} copies)</h4>
            {templateRows(detail).length ? (
              <ul className="divide-y divide-gray-100 dark:divide-white/5 border border-gray-100 dark:border-white/5 rounded-xl">
                {templateRows(detail).map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-800 dark:text-gray-200 truncate">{t.title}</span>
                    <span className="font-black tabular-nums text-gray-900 dark:text-white">×{t.count}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-400">No templates copied in this session.</p>}
          </Modal.Body>
        </Modal>
      )}
    </div>
  );
};

export default LiveSessionsPanel;
