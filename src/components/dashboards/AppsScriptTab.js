import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BoltIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { getAppsScriptApps, testAppsScriptConnection, getAllowedAppsForUser } from '../../services/appsScriptService';

/**
 * AppsScriptTab — gated entry point for the Google Apps Script integration.
 *
 * Supports MULTIPLE named Apps Scripts (admin-managed). A picker switches between
 * them; the header shows the selected script's name. Each script has two view
 * modes with auto-fallback:
 *   - 'embed': the Apps Script's own UI in an iframe (needs "Anyone" access +
 *     XFrameOptionsMode.ALLOWALL). Falls back to Data view only if the frame
 *     never loads.
 *   - 'data' : consume it as an API (concrete rendering wired once the
 *     doGet/doPost contract is known; for now it confirms connectivity).
 */
const EMBED_TIMEOUT_MS = 9000;

const AppsScriptTab = ({ user }) => {
  const [apps, setApps] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('embed');
  const [embedState, setEmbedState] = useState('loading'); // loading | ok | blocked
  const [status, setStatus] = useState({ state: 'idle', msg: '' });
  const timerRef = useRef(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    getAppsScriptApps({ force: true })
      .then((list) => {
        // Only apps with a URL AND that this user is allowed to access.
        const usable = getAllowedAppsForUser(user, (list || []).filter((a) => a.url));
        setApps(usable);
        setSelectedId(usable[0] ? usable[0].id : null);
      })
      .catch(() => setApps([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectedApp = (apps || []).find((a) => a.id === selectedId) || null;

  // Reset to embed mode when switching apps.
  useEffect(() => {
    setMode('embed');
    setStatus({ state: 'idle', msg: '' });
  }, [selectedId]);

  // Treat iframe `load` or the optional handshake as success; only fall back if
  // the frame never loads within the timeout.
  useEffect(() => {
    if (mode !== 'embed' || !selectedApp) return undefined;
    loadedRef.current = false;
    setEmbedState('loading');
    const onMessage = (e) => {
      if (e.data === 'appsscript-loaded' || (e.data && e.data.type === 'appsscript-loaded')) {
        loadedRef.current = true;
        setEmbedState('ok');
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };
    window.addEventListener('message', onMessage);
    timerRef.current = setTimeout(() => {
      if (!loadedRef.current) { setEmbedState('blocked'); setMode('data'); }
    }, EMBED_TIMEOUT_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mode, selectedApp]);

  const handleIframeLoad = useCallback(() => {
    loadedRef.current = true;
    setEmbedState('ok');
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const runTest = useCallback(async () => {
    if (!selectedApp) return;
    setStatus({ state: 'testing', msg: 'Checking connection…' });
    const result = await testAppsScriptConnection(selectedApp);
    setStatus(result.ok
      ? { state: 'ok', msg: `Connected (HTTP ${result.status}).` }
      : { state: 'error', msg: result.error || `Failed (HTTP ${result.status || '—'}).` });
  }, [selectedApp]);

  return (
    <div className="relative">
      <div className="relative bg-white/70 dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-200/60 dark:border-white/10 shadow-xl rounded-[2rem] overflow-hidden">
        <div className="px-6 py-5 sm:px-8 border-b border-gray-200/50 dark:border-white/5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex-none w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
              <BoltIcon className="w-5 h-5 text-white" />
            </span>
            <div>
              <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">{selectedApp ? selectedApp.name : 'Apps Script'}</h3>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Google Workspace integration</p>
            </div>
          </div>
          {selectedApp && (
            <div className="inline-flex bg-gray-100/70 dark:bg-white/5 p-1 rounded-xl border border-gray-200/60 dark:border-white/10">
              {[['embed', 'Embedded UI'], ['data', 'Data view']].map(([id, label]) => (
                <button key={id} onClick={() => setMode(id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${mode === id ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{label}</button>
              ))}
            </div>
          )}
        </div>

        {/* App picker (only when more than one) */}
        {apps && apps.length > 1 && (
          <div className="px-6 sm:px-8 py-3 border-b border-gray-200/50 dark:border-white/5 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex-none">Scripts</span>
            {apps.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`flex-none px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${a.id === selectedId ? 'tab-pill-active' : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10'}`}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        <div className="p-6 sm:p-8">
          {apps === null ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : !selectedApp ? (
            <div className="flex items-start gap-3 text-sm">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-none mt-0.5" />
              <p className="text-gray-500 dark:text-gray-400">No Apps Script is configured yet. An admin can add one in <span className="font-bold">Admin → System Settings</span>.</p>
            </div>
          ) : mode === 'embed' ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white" style={{ height: '70vh', minHeight: 420 }}>
                {embedState === 'loading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-black/40 z-10">
                    <ArrowPathIcon className="w-6 h-6 text-indigo-500 animate-spin" />
                  </div>
                )}
                <iframe key={selectedApp.id} title={selectedApp.name} src={selectedApp.url} className="w-full h-full" onLoad={handleIframeLoad} />
              </div>
              <p className="text-[11px] text-gray-400">
                If the frame stays blank, Google is blocking embedding — the view switches to <span className="font-bold">Data view</span> automatically, or switch it yourself. To keep the embed, deploy the Apps Script as <span className="font-mono">Anyone</span> and set <span className="font-mono">XFrameOptionsMode.ALLOWALL</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {embedState === 'blocked' && (
                <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-xl px-3 py-2 inline-flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4" /> The embedded view didn’t load (framing blocked) — showing the data view instead.
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircleIcon className="w-5 h-5" /> “{selectedApp.name}” configured
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl">
                This talks to the Apps Script over its API. Specific data views appear here once the script’s actions are wired. Confirm connectivity below.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={runTest} disabled={status.state === 'testing'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-bold shadow-lg shadow-indigo-500/25 hover:brightness-105 active:scale-95 transition disabled:opacity-60">
                  <ArrowPathIcon className={`w-4 h-4 ${status.state === 'testing' ? 'animate-spin' : ''}`} /> Test connection
                </button>
                <a href={selectedApp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" /> Open in new tab
                </a>
              </div>
              {status.state !== 'idle' && (
                <div className={`text-sm font-semibold inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${
                  status.state === 'ok' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                  : status.state === 'error' ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                  : 'text-gray-500 bg-gray-500/10'}`}>
                  {status.msg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppsScriptTab;
