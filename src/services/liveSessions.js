/**
 * Live Sessions service — Firestore persistence for template live sessions.
 *
 * Collection: live_sessions/{autoId}
 *   uid, ldap, displayName, teamId, role
 *   caseId            normalized case ID (one doc per agent+case; reopening resumes it)
 *   channel           'chat' | 'email'
 *   status            'open' | 'closed'
 *   startedAt         first time the case was opened
 *   segmentStartedAt  start of the current open stretch (resets on resume)
 *   lastActivityAt    last template copy / keep-alive
 *   expiresAt         when the sweeper may auto-close it (null once closed) —
 *                     single-field range query, so no composite index is needed
 *   endedAt, endReason
 *   handleMs          accumulated open time across all stretches
 *   templateCounts    { [templateId]: n }   templateTitles { [templateId]: title }
 *   totalUses, reopenCount
 *
 * Cost: one write per template copy (+ the existing audit event). Listeners only
 * watch the agent's own open sessions.
 */

import {
  collection, doc, addDoc, updateDoc, query, where, onSnapshot, getDocs,
  orderBy, limit, serverTimestamp, increment, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { logger } from '../utils/logger';
import { logActivity, deriveLdap } from './activity';
import {
  normalizeCaseId, isValidCaseId, expiresAtMillis, endedAtMillisFor, toMillis,
  templateChannel, END_REASONS, SESSION_MODES, CHANNELS,
} from './liveSessionRules';

const COL = 'live_sessions';

const sessionAudit = (user, eventType, action, session, extra = {}) => logActivity(user, {
  eventType,
  category: 'session',
  action,
  caseId: session.caseId,
  sessionId: session.id,
  channel: session.channel,
  mode: SESSION_MODES.live,
  ...extra,
});

/** Live listener on the agent's own open sessions. Returns unsubscribe. */
export const subscribeOpenSessions = (uid, onChange, onError) => {
  const q = query(collection(db, COL), where('uid', '==', uid), where('status', '==', 'open'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { logger.error('liveSessions: listener failed', err); onError?.(err); },
  );
};

/**
 * Start a live session for a case, or resume the agent's earlier session for the
 * same case ID (email cases often come back days later).
 * Resolves { session, resumed, alreadyOpen }.
 */
export const startOrResumeSession = async (user, rawCaseId, channel) => {
  const caseId = normalizeCaseId(rawCaseId);
  if (!isValidCaseId(caseId)) throw new Error('Enter a valid case ID');
  const ch = CHANNELS.includes(channel) ? channel : 'chat';
  const now = Date.now();

  const existing = await getDocs(query(
    collection(db, COL), where('uid', '==', user.uid), where('caseId', '==', caseId),
  ));
  const prior = existing.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.startedAt, 0) - toMillis(a.startedAt, 0))[0];

  if (prior?.status === 'open') return { session: prior, resumed: false, alreadyOpen: true };

  if (prior) {
    const patch = {
      status: 'open',
      channel: ch,
      segmentStartedAt: Timestamp.fromMillis(now),
      lastActivityAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(expiresAtMillis(ch, now)),
      endedAt: null,
      endReason: null,
      reopenCount: increment(1),
    };
    await updateDoc(doc(db, COL, prior.id), patch);
    const session = { ...prior, ...patch, lastActivityAt: Timestamp.fromMillis(now), status: 'open' };
    sessionAudit(user, 'live_session_resumed', 'Resumed a live session', session);
    return { session, resumed: true, alreadyOpen: false };
  }

  const data = {
    uid: user.uid,
    ldap: deriveLdap(user),
    displayName: user.displayName || user.email || 'Unknown User',
    teamId: user.teamId || null,
    role: user.role || null,
    caseId,
    channel: ch,
    status: 'open',
    startedAt: serverTimestamp(),
    segmentStartedAt: Timestamp.fromMillis(now),
    lastActivityAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAtMillis(ch, now)),
    endedAt: null,
    endReason: null,
    handleMs: 0,
    templateCounts: {},
    templateTitles: {},
    totalUses: 0,
    reopenCount: 0,
  };
  const ref = await addDoc(collection(db, COL), data);
  const session = { id: ref.id, ...data, startedAt: Timestamp.fromMillis(now), lastActivityAt: Timestamp.fromMillis(now) };
  sessionAudit(user, 'live_session_started', 'Started a live session', session);
  return { session, resumed: false, alreadyOpen: false };
};

/**
 * Record a template copy against a session (1 write). On the session's first
 * copy, a chat/email-tagged template sets the session channel automatically.
 * Fire-and-forget safe: never throws.
 */
export const recordTemplateUse = async (session, template) => {
  try {
    const now = Date.now();
    const tc = templateChannel(template);
    const channel = (!session.totalUses && tc !== 'both') ? tc : session.channel;
    const patch = {
      [`templateCounts.${template.id}`]: increment(1),
      [`templateTitles.${template.id}`]: template.title || '',
      totalUses: increment(1),
      lastActivityAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(expiresAtMillis(channel, now)),
    };
    if (channel !== session.channel) patch.channel = channel;
    await updateDoc(doc(db, COL, session.id), patch);
    return { channel };
  } catch (err) {
    logger.warn('liveSessions: failed to record template use', err);
    return { channel: session.channel };
  }
};

/** "Still on this case" — refresh activity so the idle timer restarts. */
export const keepSessionAlive = async (session) => {
  const now = Date.now();
  await updateDoc(doc(db, COL, session.id), {
    lastActivityAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAtMillis(session.channel, now)),
  });
};

/** Close one session. Automatic reasons record the last real activity as the end time. */
export const endLiveSession = async (user, session, reason = END_REASONS.manual) => {
  const now = Date.now();
  const endMs = endedAtMillisFor(session, reason, now);
  const segStart = toMillis(session.segmentStartedAt, toMillis(session.startedAt, endMs));
  await updateDoc(doc(db, COL, session.id), {
    status: 'closed',
    endedAt: Timestamp.fromMillis(endMs),
    endReason: reason,
    expiresAt: null,
    handleMs: increment(Math.max(0, endMs - segStart)),
  });
  sessionAudit(user, 'live_session_ended', 'Ended a live session', session, { detail: reason });
};

const endWhere = async (user, filters, reason) => {
  try {
    const snap = await getDocs(query(collection(db, COL), where('uid', '==', user.uid), where('status', '==', 'open'), ...filters));
    await Promise.all(snap.docs.map((d) => endLiveSession(user, { id: d.id, ...d.data() }, reason)));
    return snap.size;
  } catch (err) {
    logger.warn('liveSessions: bulk end failed', err);
    return 0;
  }
};

/** Sign-out: close every open session. */
export const endAllOpenSessions = (user, reason = END_REASONS.logout) => (user?.uid ? endWhere(user, [], reason) : Promise.resolve(0));

/** Case Tracker: recording a case closes its live session (no extra click). */
export const endSessionForCase = (user, rawCaseId, reason = END_REASONS.caseTracked) => {
  const caseId = normalizeCaseId(rawCaseId);
  if (!user?.uid || !caseId) return Promise.resolve(0);
  return endWhere(user, [where('caseId', '==', caseId)], reason);
};

/** Admin monitor: most recent sessions (single-field order, no composite index). */
export const fetchLiveSessions = async ({ max = 500 } = {}) => {
  try {
    const snap = await getDocs(query(collection(db, COL), orderBy('startedAt', 'desc'), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    logger.error('liveSessions: fetchLiveSessions failed', err);
    return [];
  }
};
