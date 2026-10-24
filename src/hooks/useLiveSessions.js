/**
 * useLiveSessions — client state for template live sessions.
 *
 * Mounted once at dashboard level (not inside the Templates tab) so the idle
 * timer keeps running while the agent is on other tabs. The server sweeper
 * covers the case where the browser is closed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  subscribeOpenSessions, startOrResumeSession, endLiveSession, keepSessionAlive, recordTemplateUse,
} from '../services/liveSessions';
import {
  getIdleState, pickFocusedSession, END_REASONS, SESSION_MODES, CHANNELS,
} from '../services/liveSessionRules';
import { showInfo } from '../utils/toast';
import { logger } from '../utils/logger';

const TICK_MS = 30000;

// Per-viewer conveniences only — never the source of truth.
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
  },
  set(key, value) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* ignore */ }
  },
};

export default function useLiveSessions(user) {
  const uid = user?.uid || null;
  const userRef = useRef(user);
  userRef.current = user;

  const [openSessions, setOpenSessions] = useState([]);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [mode, setModeState] = useState(() => (
    store.get('templates.sessionMode', SESSION_MODES.live) === SESSION_MODES.nonLive ? SESSION_MODES.nonLive : SESSION_MODES.live
  ));
  const [focusedId, setFocusedIdState] = useState(() => store.get('templates.focusedSession', null));
  const [lastChannel, setLastChannelState] = useState(() => {
    const c = store.get('templates.lastChannel', 'chat');
    return CHANNELS.includes(c) ? c : 'chat';
  });
  const endingRef = useRef(new Set());

  const setMode = useCallback((m) => { setModeState(m); store.set('templates.sessionMode', m); }, []);
  const setFocusedId = useCallback((id) => { setFocusedIdState(id); store.set('templates.focusedSession', id); }, []);
  const setLastChannel = useCallback((c) => { setLastChannelState(c); store.set('templates.lastChannel', c); }, []);

  useEffect(() => {
    if (!uid) { setOpenSessions([]); return undefined; }
    const unsub = subscribeOpenSessions(uid, (list) => { setOpenSessions(list); setReady(true); }, () => setReady(true));
    return unsub;
  }, [uid]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const end = useCallback(async (session, reason = END_REASONS.manual) => {
    if (!session || endingRef.current.has(session.id)) return;
    endingRef.current.add(session.id);
    try {
      await endLiveSession(userRef.current, session, reason);
    } finally {
      endingRef.current.delete(session.id);
    }
  }, []);

  // Idle auto-end (also catches sessions left open since a previous login).
  useEffect(() => {
    if (!ready) return;
    const expired = openSessions.filter((s) => getIdleState(s, now) === 'expired' && !endingRef.current.has(s.id));
    if (!expired.length) return;
    expired.forEach((s) => end(s, END_REASONS.idle).catch((err) => logger.warn('auto-end failed', err)));
    showInfo(`Auto-ended idle session${expired.length > 1 ? 's' : ''}: ${expired.map((s) => s.caseId).join(', ')}`);
  }, [openSessions, now, ready, end]);

  const liveOpen = useMemo(
    () => openSessions.filter((s) => getIdleState(s, now) !== 'expired'),
    [openSessions, now],
  );
  const focused = useMemo(() => pickFocusedSession(liveOpen, focusedId), [liveOpen, focusedId]);
  const warnIds = useMemo(
    () => new Set(liveOpen.filter((s) => getIdleState(s, now) === 'warn').map((s) => s.id)),
    [liveOpen, now],
  );

  const start = useCallback(async (caseId, channel) => {
    const res = await startOrResumeSession(userRef.current, caseId, channel);
    setFocusedId(res.session.id);
    setLastChannel(res.session.channel);
    return res;
  }, [setFocusedId, setLastChannel]);

  const keepAlive = useCallback((session) => keepSessionAlive(session).catch((err) => logger.warn('keep-alive failed', err)), []);

  const recordUse = useCallback((session, template) => recordTemplateUse(session, template), []);

  return {
    ready, mode, setMode, openSessions: liveOpen, focused, setFocusedId, warnIds,
    lastChannel, setLastChannel, start, end, keepAlive, recordUse, now,
  };
}
