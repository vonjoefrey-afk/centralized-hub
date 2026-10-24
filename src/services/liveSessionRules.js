/**
 * Live Session rules — pure, side-effect-free helpers shared by the client
 * (Templates tab) and mirrored by the server sweeper (functions/src/liveSessions.controller.js).
 *
 * A "live session" ties template copies to a case ID while an agent works a
 * chat or email case. Non-live mode copies templates without a case ID.
 *
 * Tune limits here. Keep EXPIRY values in sync with the Cloud Function sweeper.
 */

const MIN = 60 * 1000;

export const CHANNELS = ['chat', 'email'];

export const SESSION_LIMITS = {
  chat: {
    maxOpen: 2, // agents handle at most 2 concurrent chats
    warnAfterMs: 15 * MIN, // show "Still on this case?" after 15 min without a copy
    expireAfterMs: 20 * MIN, // auto-end 5 min after the warning
  },
  email: {
    maxOpen: 5,
    warnAfterMs: 50 * MIN,
    expireAfterMs: 60 * MIN,
  },
};

export const END_REASONS = {
  manual: 'manual', // agent clicked End
  idle: 'idle', // client idle timeout
  logout: 'logout', // agent signed out
  caseTracked: 'case_tracked', // agent recorded the case in Case Tracker
  autoClosed: 'auto_closed', // server sweeper (browser closed / asleep)
};

export const SESSION_MODES = { live: 'live', nonLive: 'non_live' };

export const limitsFor = (channel) => SESSION_LIMITS[channel] || SESSION_LIMITS.chat;

/** Trim and drop inner whitespace so "  12 345 " and "12345" are the same case. */
export const normalizeCaseId = (raw) => String(raw ?? '').replace(/\s+/g, '').trim();

/** Case IDs: 1–64 chars of letters, digits and - _ # . / : */
export const isValidCaseId = (raw) => /^[A-Za-z0-9\-_#./:]{1,64}$/.test(normalizeCaseId(raw));

/** Accepts Firestore Timestamp, Date, millis, or null (pending server write => now). */
export const toMillis = (value, fallback = Date.now()) => {
  if (value == null) return fallback;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return fallback;
};

/** Millis at which a session with this last activity should be auto-closed. */
export const expiresAtMillis = (channel, lastActivityMs) => lastActivityMs + limitsFor(channel).expireAfterMs;

/**
 * 'active' | 'warn' | 'expired' for an open session at `now`.
 */
export const getIdleState = (session, now = Date.now()) => {
  const last = toMillis(session?.lastActivityAt, now);
  const { warnAfterMs, expireAfterMs } = limitsFor(session?.channel);
  const idle = now - last;
  if (idle >= expireAfterMs) return 'expired';
  if (idle >= warnAfterMs) return 'warn';
  return 'active';
};

/**
 * Can the agent open another session on `channel`?
 * Returns { ok, openOnChannel, max } — openOnChannel lists the sessions blocking it.
 */
export const canOpenSession = (openSessions = [], channel) => {
  const openOnChannel = openSessions.filter((s) => s.status !== 'closed' && s.channel === channel);
  const { maxOpen } = limitsFor(channel);
  return { ok: openOnChannel.length < maxOpen, openOnChannel, max: maxOpen };
};

/** Template channel tag: 'chat' | 'email' | 'both' (default). */
export const templateChannel = (template) => (CHANNELS.includes(template?.channel) ? template.channel : 'both');

/**
 * End time to record. Automatic ends use the last real activity so a forgotten
 * session doesn't inflate handle time; a manual end uses "now".
 */
export const endedAtMillisFor = (session, reason, now = Date.now()) => (
  reason === END_REASONS.manual || reason === END_REASONS.caseTracked
    ? now
    : toMillis(session?.lastActivityAt, now)
);

/** Pick the session to focus: the remembered one if still open, else the most recently active. */
export const pickFocusedSession = (openSessions = [], rememberedId = null) => {
  if (!openSessions.length) return null;
  const remembered = openSessions.find((s) => s.id === rememberedId);
  if (remembered) return remembered;
  return [...openSessions].sort((a, b) => toMillis(b.lastActivityAt) - toMillis(a.lastActivityAt))[0];
};

/** Human duration, e.g. "1h 05m" / "12m" / "<1m". */
export const formatDuration = (ms) => {
  if (!Number.isFinite(ms) || ms < 60000) return '<1m';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};
