import React, { useEffect, useRef, useState } from 'react';
import {
  XMarkIcon, PlusIcon, ChatBubbleLeftRightIcon, EnvelopeIcon, SignalIcon, SignalSlashIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import {
  canOpenSession, isValidCaseId, normalizeCaseId, formatDuration, toMillis, SESSION_MODES,
} from '../../../services/liveSessionRules';
import { showError } from '../../../utils/toast';

const ChannelIcon = ({ channel, className }) => (
  channel === 'email' ? <EnvelopeIcon className={className} /> : <ChatBubbleLeftRightIcon className={className} />
);

const ChannelToggle = ({ value, onChange }) => (
  <div className="flex bg-gray-100/70 dark:bg-white/5 p-0.5 rounded-lg border border-gray-200/50 dark:border-white/10" role="radiogroup" aria-label="Channel">
    {['chat', 'email'].map((c) => (
      <button
        key={c}
        type="button"
        role="radio"
        aria-checked={value === c}
        onClick={() => onChange(c)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
          value === c ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <ChannelIcon channel={c} className="w-3.5 h-3.5" />
        {c === 'chat' ? 'Chat' : 'Email'}
      </button>
    ))}
  </div>
);

/**
 * Case ID entry + channel + concurrency guard. Used inline in the bar and in the
 * "case ID needed" prompt when an agent copies with no live session.
 * onSubmit(caseId, channel) may be async; it should throw on failure.
 */
export const StartSessionForm = ({
  live, defaultChannel, onSubmit, submitLabel = 'Start', autoFocus = false, onCancel,
}) => {
  const [caseId, setCaseId] = useState('');
  const [channel, setChannel] = useState(defaultChannel || 'chat');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setChannel(defaultChannel || 'chat'); }, [defaultChannel]);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const normalized = normalizeCaseId(caseId);
  const alreadyOpen = live.openSessions.find((s) => s.caseId === normalized);
  const guard = canOpenSession(live.openSessions, channel);
  const blocked = !alreadyOpen && !guard.ok;
  const valid = isValidCaseId(caseId);

  const submit = async (e) => {
    e?.preventDefault();
    if (!valid || blocked || busy) return;
    setBusy(true);
    try {
      await onSubmit(normalized, channel);
      setCaseId('');
    } catch (err) {
      showError(err?.message || 'Could not start the session');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value.replace(/\D/g, '').slice(0, 8))}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel?.(); }}
          placeholder="8-digit case ID"
          aria-label="Case ID"
          maxLength={8}
          className="flex-1 min-w-[140px] px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-mono text-gray-900 dark:text-white placeholder-gray-400/70 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
        />
        <ChannelToggle value={channel} onChange={setChannel} />
        <button
          type="submit"
          disabled={!valid || blocked || busy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          {alreadyOpen ? 'Switch' : submitLabel}
        </button>
      </div>
      {caseId && !valid && (
        <p className="text-[11px] text-rose-500">Case ID must be exactly 8 digits.</p>
      )}
      {blocked && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {guard.max} {channel} sessions open. End one to start another:
          </span>
          {guard.openOnChannel.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => live.end(s)}
              className="px-2 py-1 rounded-md text-[10px] font-bold font-mono bg-white dark:bg-white/10 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-200 hover:bg-amber-100"
            >
              End {s.caseId}
            </button>
          ))}
        </div>
      )}
    </form>
  );
};

const SessionChip = ({ session, index, focused, warn, now, onFocus, onEnd, onKeep }) => {
  const started = toMillis(session.segmentStartedAt, now);
  const uses = session.totalUses || 0;
  return (
    <div
      className={`flex items-center gap-1 rounded-xl border pl-1 pr-1 ${
        warn
          ? 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
          : focused
            ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-400/50 dark:bg-indigo-500/15'
            : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/5'
      }`}
    >
      <button
        type="button"
        onClick={() => onFocus(session.id)}
        aria-pressed={focused}
        title={`${focused ? 'Copies go to this case' : 'Click to send copies here'}${index < 9 ? ` (Alt+${index + 1})` : ''}`}
        className="flex items-center gap-1.5 px-2 py-1.5 text-left"
      >
        <ChannelIcon channel={session.channel} className={`w-3.5 h-3.5 ${focused ? 'text-indigo-500' : 'text-gray-400'}`} />
        <span className={`text-xs font-bold font-mono ${focused ? 'text-indigo-700 dark:text-indigo-200' : 'text-gray-700 dark:text-gray-200'}`}>{session.caseId}</span>
        <span className="text-[10px] text-gray-400 tabular-nums">{uses} use{uses !== 1 ? 's' : ''} · {formatDuration(now - started)}</span>
      </button>
      {warn && (
        <span className="flex items-center gap-1 pl-1">
          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Still on it?</span>
          <button type="button" onClick={() => onKeep(session)} className="px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-200/60 dark:hover:bg-amber-500/20">Yes</button>
        </span>
      )}
      <button
        type="button"
        onClick={() => onEnd(session)}
        className="p-1 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10"
        title={`End session ${session.caseId}`}
        aria-label={`End session ${session.caseId}`}
      >
        <XMarkIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/** Top-of-tab bar: Live / Non-live mode, open sessions, start a case. */
const LiveSessionBar = ({ live, compact = false }) => {
  const [adding, setAdding] = useState(false);
  const isLive = live.mode === SESSION_MODES.live;
  const showForm = isLive && (adding || live.openSessions.length === 0);

  return (
    <div className={`rounded-2xl border border-gray-200/60 dark:border-white/8 bg-gray-50/60 dark:bg-white/[0.03] ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-white dark:bg-white/5 p-0.5 rounded-lg border border-gray-200/60 dark:border-white/10" role="radiogroup" aria-label="Session mode">
          <button
            type="button" role="radio" aria-checked={isLive}
            onClick={() => live.setMode(SESSION_MODES.live)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${isLive ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <SignalIcon className="w-3.5 h-3.5" /> Live
          </button>
          <button
            type="button" role="radio" aria-checked={!isLive}
            onClick={() => live.setMode(SESSION_MODES.nonLive)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${!isLive ? 'bg-gray-700 dark:bg-white/15 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <SignalSlashIcon className="w-3.5 h-3.5" /> Non-live
          </button>
        </div>

        {isLive ? (
          <>
            {live.openSessions.map((s, i) => (
              <SessionChip
                key={s.id}
                session={s}
                index={i}
                focused={live.focused?.id === s.id}
                warn={live.warnIds.has(s.id)}
                now={live.now}
                onFocus={live.setFocusedId}
                onEnd={(sess) => live.end(sess)}
                onKeep={live.keepAlive}
              />
            ))}
            {live.openSessions.length > 0 && !adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-dashed border-gray-300 dark:border-white/15 text-gray-500 hover:text-indigo-600 hover:border-indigo-300"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Case
              </button>
            )}
          </>
        ) : (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Copies are logged without a case ID.</span>
        )}

        {isLive && live.openSessions.length > 1 && !compact && (
          <span className="ml-auto hidden md:flex items-center gap-1 text-[10px] text-gray-400"><ClockIcon className="w-3 h-3" /> Alt+1–{Math.min(live.openSessions.length, 9)} to switch</span>
        )}
      </div>

      {showForm && (
        <StartSessionForm
          live={live}
          defaultChannel={live.lastChannel}
          autoFocus={adding}
          onCancel={() => setAdding(false)}
          onSubmit={async (caseId, channel) => {
            await live.start(caseId, channel);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
};

export default LiveSessionBar;
