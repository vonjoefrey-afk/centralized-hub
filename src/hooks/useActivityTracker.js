/**
 * useActivityTracker
 *
 * Runs the client-side utilization engine for the signed-in user. It:
 *   - opens a session (startSession) on mount / when a user appears,
 *   - tracks "active time" = wall-clock time the tab was visible AND the user
 *     was not idle (input within IDLE_MS),
 *   - flushes accumulated active time to Firestore every HEARTBEAT_MS,
 *   - closes the session (endSession) on unmount / page unload.
 *
 * Active time is sampled locally every SAMPLE_MS (cheap, no writes) so idle
 * gaps are accounted accurately, while Firestore writes stay infrequent
 * (once per HEARTBEAT_MS, per the 120s cadence chosen for cost).
 *
 * Tab-view tracking lives elsewhere (logTabView, called from the tab navs) so
 * it fires exactly on user clicks rather than on a timer.
 */

import { useEffect, useRef } from 'react';
import { startSession, heartbeat, endSession } from '../services/activity';

const HEARTBEAT_MS = 120000; // 120s — Firestore flush cadence
const SAMPLE_MS = 15000; // local active-time sampling (no writes)
const IDLE_MS = 120000; // no input for 2 min => idle, stop counting

export default function useActivityTracker(user) {
  // Keep the latest user object without re-running the main effect on every
  // profile snapshot (AuthContext re-emits the user doc in real time).
  const userRef = useRef(user);
  userRef.current = user;

  const uid = user?.uid || null;

  useEffect(() => {
    if (!uid) return undefined;

    const now = Date.now();
    const lastActiveRef = { current: now }; // last user input time
    const lastTickRef = { current: now }; // last local sample time
    const pendingMsRef = { current: 0 }; // active ms not yet flushed
    let inputThrottle = 0;

    const isActive = () =>
      (typeof document === 'undefined' || document.visibilityState === 'visible') &&
      Date.now() - lastActiveRef.current < IDLE_MS;

    // Fold the elapsed slice into the pending accumulator if it was "active".
    const sample = () => {
      const t = Date.now();
      const elapsed = t - lastTickRef.current;
      lastTickRef.current = t;
      if (elapsed > 0 && isActive()) pendingMsRef.current += elapsed;
    };

    const flush = () => {
      sample();
      const delta = pendingMsRef.current;
      pendingMsRef.current = 0;
      if (delta > 0) heartbeat(userRef.current, delta);
    };

    const onInput = () => {
      const t = Date.now();
      lastActiveRef.current = t;
      // Throttle so a burst of mousemove events doesn't spin needlessly.
      if (t - inputThrottle > 1000) inputThrottle = t;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Don't count the hidden gap: restart the tick clock.
        lastTickRef.current = Date.now();
        lastActiveRef.current = Date.now();
      } else {
        flush(); // persist what we have before the tab is backgrounded
      }
    };

    const onUnload = () => {
      endSession(userRef.current);
    };

    startSession(userRef.current);

    const inputEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    inputEvents.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    const sampleTimer = setInterval(sample, SAMPLE_MS);
    const flushTimer = setInterval(flush, HEARTBEAT_MS);

    return () => {
      clearInterval(sampleTimer);
      clearInterval(flushTimer);
      inputEvents.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
      flush(); // persist any tail time
      endSession(userRef.current);
    };
    // Re-run only when the identity changes, not on every profile snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
}
