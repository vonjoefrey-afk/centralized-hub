import { describe, it, expect } from 'vitest';
import {
  normalizeCaseId, isValidCaseId, getIdleState, canOpenSession, endedAtMillisFor,
  pickFocusedSession, templateChannel, expiresAtMillis, toMillis, formatDuration, SESSION_LIMITS, END_REASONS,
} from './liveSessionRules';

const MIN = 60000;

describe('case IDs', () => {
  it('normalizes whitespace', () => {
    expect(normalizeCaseId('  12 345 ')).toBe('12345');
  });
  it('validates', () => {
    expect(isValidCaseId('8-1234567890')).toBe(true);
    expect(isValidCaseId('')).toBe(false);
    expect(isValidCaseId('   ')).toBe(false);
    expect(isValidCaseId('a'.repeat(65))).toBe(false);
    expect(isValidCaseId('<script>')).toBe(false);
  });
});

describe('idle state', () => {
  const now = 10_000_000;
  it('chat warns at 15 min and expires at 20 min', () => {
    expect(getIdleState({ channel: 'chat', lastActivityAt: now - 14 * MIN }, now)).toBe('active');
    expect(getIdleState({ channel: 'chat', lastActivityAt: now - 15 * MIN }, now)).toBe('warn');
    expect(getIdleState({ channel: 'chat', lastActivityAt: now - 20 * MIN }, now)).toBe('expired');
  });
  it('email allows 60 min', () => {
    expect(getIdleState({ channel: 'email', lastActivityAt: now - 45 * MIN }, now)).toBe('active');
    expect(getIdleState({ channel: 'email', lastActivityAt: now - 55 * MIN }, now)).toBe('warn');
    expect(getIdleState({ channel: 'email', lastActivityAt: now - 60 * MIN }, now)).toBe('expired');
  });
  it('treats a pending server timestamp (null) as just now', () => {
    expect(getIdleState({ channel: 'chat', lastActivityAt: null }, now)).toBe('active');
  });
  it('reads Firestore-like timestamps', () => {
    expect(toMillis({ toMillis: () => 42 })).toBe(42);
    expect(toMillis({ seconds: 2 })).toBe(2000);
  });
  it('expiry matches the limit', () => {
    expect(expiresAtMillis('chat', 0)).toBe(SESSION_LIMITS.chat.expireAfterMs);
  });
});

describe('concurrency', () => {
  const open = [{ id: 'a', channel: 'chat' }, { id: 'b', channel: 'chat' }, { id: 'c', channel: 'email' }];
  it('blocks a third chat', () => {
    const r = canOpenSession(open, 'chat');
    expect(r.ok).toBe(false);
    expect(r.openOnChannel.map((s) => s.id)).toEqual(['a', 'b']);
  });
  it('allows email alongside two chats', () => {
    expect(canOpenSession(open, 'email').ok).toBe(true);
  });
});

describe('end time', () => {
  const s = { lastActivityAt: 1000 };
  it('auto ends use last activity so handle time is not inflated', () => {
    expect(endedAtMillisFor(s, END_REASONS.idle, 9999)).toBe(1000);
    expect(endedAtMillisFor(s, END_REASONS.logout, 9999)).toBe(1000);
  });
  it('manual and case-tracked ends use now', () => {
    expect(endedAtMillisFor(s, END_REASONS.manual, 9999)).toBe(9999);
    expect(endedAtMillisFor(s, END_REASONS.caseTracked, 9999)).toBe(9999);
  });
});

describe('focus + channel', () => {
  const list = [{ id: 'old', lastActivityAt: 1 }, { id: 'new', lastActivityAt: 5 }];
  it('keeps the remembered session, else most recent', () => {
    expect(pickFocusedSession(list, 'old').id).toBe('old');
    expect(pickFocusedSession(list, 'gone').id).toBe('new');
    expect(pickFocusedSession([], 'x')).toBe(null);
  });
  it('defaults template channel to both', () => {
    expect(templateChannel({})).toBe('both');
    expect(templateChannel({ channel: 'email' })).toBe('email');
    expect(templateChannel({ channel: 'fax' })).toBe('both');
  });
  it('formats durations', () => {
    expect(formatDuration(30000)).toBe('<1m');
    expect(formatDuration(12 * MIN)).toBe('12m');
    expect(formatDuration(65 * MIN)).toBe('1h 05m');
  });
});
