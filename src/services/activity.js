/**
 * Activity / Utilization Tracking Service
 *
 * Records lightweight, per-user app-usage signals into two Firestore collections
 * so the Admin "App Utilization" monitor can surface real-time utilization and an
 * audit trail. Nothing here is role-gated on the client — access is enforced by
 * firestore.rules (each user may only write their own docs; only admins may read
 * the whole collection).
 *
 * Collections:
 *   user_activity/{uid}     - live state, one doc per user (presence, active time,
 *                             current/last tab, per-tab counts).
 *   activity_audit/{autoId} - append-only event log (session_start | tab_view |
 *                             session_end) for the audit trail.
 *
 * Case record count (#5) and last case recorded (#6) are intentionally NOT stored
 * here — the monitor computes them by joining the existing `tracked_cases`
 * collection, avoiding extra writes.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { logger } from '../utils/logger';

const ACTIVITY = 'user_activity';
const AUDIT = 'activity_audit';

/** Local YYYY-MM-DD used to reset "active time today" at day rollover. */
const todayKey = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Derive an LDAP handle from the user's SSO/email address.
 * jdoe@google.com -> "jdoe". Falls back to uid when no email is present.
 */
export const deriveLdap = (user) => {
  if (!user) return '';
  const email = user.ssoEmail || user.email || '';
  const at = email.indexOf('@');
  if (at > 0) return email.slice(0, at).toLowerCase();
  return (email || user.uid || '').toLowerCase();
};

/** Human-readable dashboard name for a role (shown in the forensic trail/CSV). */
export const dashboardForRole = (role) => (
  {
    admin: 'Admin',
    trainer: 'Trainer',
    team_leader: 'Team Leader',
    team_member: 'Team Member',
    om: 'Operations',
  }[role] || 'Unknown'
);

/** Shared identity fields written on every user_activity update. */
const identity = (user) => ({
  uid: user.uid,
  ldap: deriveLdap(user),
  displayName: user.displayName || user.email || 'Unknown User',
  email: user.email || null,
  role: user.role || null,
  teamId: user.teamId || null,
});

// Events that are not "productive" work — used for the compliance signal.
const CATEGORY_BY_EVENT = {
  session_start: 'session',
  session_end: 'session',
  tab_view: 'navigation',
};

/**
 * Best-effort append to the forensic audit trail. Never throws into the caller.
 * `extra` may carry: category, action, tab, tabLabel, caseId, sessionId, mode, channel, isSpii, detail, targetId.
 * NOTE: never pass raw SPII values here — only identifiers/flags.
 */
const appendAudit = async (user, eventType, extra = {}) => {
  try {
    await addDoc(collection(db, AUDIT), {
      uid: user.uid,
      ldap: deriveLdap(user),
      displayName: user.displayName || user.email || 'Unknown User',
      teamId: user.teamId || null,
      role: user.role || null,
      dashboard: dashboardForRole(user.role),
      eventType,
      category: extra.category || CATEGORY_BY_EVENT[eventType] || 'productive',
      action: extra.action || null,
      tab: extra.tab || null,
      tabLabel: extra.tabLabel || null,
      caseId: extra.caseId || null,
      // Template live sessions: which session/case a copy belonged to.
      sessionId: extra.sessionId || null,
      mode: extra.mode || null, // 'live' | 'non_live'
      channel: extra.channel || null, // 'chat' | 'email'
      isSpii: typeof extra.isSpii === 'boolean' ? extra.isSpii : null,
      detail: extra.detail || null,
      // Fuller context for the expandable detail view (e.g. template body).
      // Bounded so the audit doc stays small; never used for raw SPII content.
      content: extra.content ? String(extra.content).slice(0, 1000) : null,
      targetId: extra.targetId || null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    logger.warn('activity: failed to append audit event', eventType, err);
  }
};

/**
 * Log a productive/forensic action to the audit trail.
 * @param {Object} user
 * @param {Object} payload - { eventType, action, category?, tab?, caseId?, isSpii?, detail?, targetId? }
 */
export const logActivity = async (user, payload = {}) => {
  if (!user?.uid || !payload.eventType) return;
  await appendAudit(user, payload.eventType, payload);
};

/**
 * One-shot fetch of the audit trail for CSV export (not capped at the live 250).
 * Single-field ordered so no composite index is needed; filter client-side.
 */
export const fetchActivityAudit = async ({ max = 2000 } = {}) => {
  try {
    const q = query(collection(db, AUDIT), orderBy('timestamp', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    logger.error('activity: fetchActivityAudit failed', err);
    return [];
  }
};

/**
 * Mark the start of a session. Resets the daily active-time counter when the
 * calendar day has rolled over since the last write.
 */
export const startSession = async (user) => {
  if (!user?.uid) return;
  const ref = doc(db, ACTIVITY, user.uid);
  const today = todayKey();
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() ? snap.data() : {};
      const sameDay = prev.activeDate === today;
      tx.set(
        ref,
        {
          ...identity(user),
          sessionActive: true,
          sessionStartAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
          activeDate: today,
          activeMs: sameDay ? prev.activeMs || 0 : 0,
          tabCounts: sameDay ? prev.tabCounts || {} : {},
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
    await appendAudit(user, 'session_start', { category: 'session', action: 'Signed in' });
  } catch (err) {
    logger.warn('activity: startSession failed', err);
  }
};

/**
 * Accumulate active time. `deltaMs` is the visible + non-idle time elapsed since
 * the last heartbeat. Handles day rollover by resetting the counter.
 */
export const heartbeat = async (user, deltaMs) => {
  if (!user?.uid || !deltaMs || deltaMs <= 0) return;
  const ref = doc(db, ACTIVITY, user.uid);
  const today = todayKey();
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() ? snap.data() : {};
      const sameDay = prev.activeDate === today;
      tx.set(
        ref,
        {
          ...identity(user),
          sessionActive: true,
          lastActiveAt: serverTimestamp(),
          activeDate: today,
          activeMs: (sameDay ? prev.activeMs || 0 : 0) + deltaMs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (err) {
    logger.warn('activity: heartbeat failed', err);
  }
};

/**
 * Record a tab view: updates current/last tab, bumps that tab's counter, and
 * appends a `tab_view` audit event.
 */
export const logTabView = async (user, tabId, tabLabel) => {
  if (!user?.uid || !tabId) return;
  const ref = doc(db, ACTIVITY, user.uid);
  try {
    await setDoc(
      ref,
      {
        ...identity(user),
        activeTab: tabId,
        activeTabLabel: tabLabel || tabId,
        lastTab: tabId,
        lastTabLabel: tabLabel || tabId,
        lastTabAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        tabCounts: { [tabId]: increment(1) },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await appendAudit(user, 'tab_view', { category: 'navigation', tab: tabId, tabLabel: tabLabel || tabId, action: `Viewed ${tabLabel || tabId}` });
  } catch (err) {
    logger.warn('activity: logTabView failed', err);
  }
};

/**
 * Mark the session as ended. Best-effort — may be invoked during page unload,
 * where the write is not guaranteed to flush.
 */
export const endSession = async (user) => {
  if (!user?.uid) return;
  const ref = doc(db, ACTIVITY, user.uid);
  try {
    await setDoc(
      ref,
      {
        ...identity(user),
        sessionActive: false,
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await appendAudit(user, 'session_end', { category: 'session', action: 'Signed out' });
  } catch (err) {
    logger.warn('activity: endSession failed', err);
  }
};

/**
 * Admin-only real-time subscription to every user's live activity.
 * @returns {() => void} unsubscribe
 */
export const subscribeAllActivity = (onUpdate, onError) => {
  try {
    return onSnapshot(
      collection(db, ACTIVITY),
      (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        logger.error('activity: subscribeAllActivity error', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    logger.error('activity: subscribeAllActivity setup failed', err);
    if (onError) onError(err);
    return () => {};
  }
};

/**
 * Admin-only real-time subscription to the audit trail (newest first).
 * @returns {() => void} unsubscribe
 */
export const subscribeActivityAudit = (onUpdate, { max = 250 } = {}, onError) => {
  try {
    const q = query(collection(db, AUDIT), orderBy('timestamp', 'desc'), limit(max));
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        logger.error('activity: subscribeActivityAudit error', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    logger.error('activity: subscribeActivityAudit setup failed', err);
    if (onError) onError(err);
    return () => {};
  }
};
