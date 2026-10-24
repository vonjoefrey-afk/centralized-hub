const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Server backstop for template live sessions.
 *
 * The client auto-ends idle sessions while the app is open. If the browser is
 * closed or the laptop sleeps, nothing on the client can run — this sweeper
 * closes those sessions instead.
 *
 * Cost: the query is a single-field range on `expiresAt` (no composite index),
 * and closed sessions have `expiresAt: null`, so each run reads only the
 * sessions that are actually overdue. An empty run costs one read.
 *
 * The end time is the session's last real activity, not "now", so a forgotten
 * session doesn't inflate handle time.
 */

const BATCH_LIMIT = 400; // < 500 writes per batch (session update + audit event each = 2 writes)

const toMillis = (ts, fallback) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : fallback);

const closeStaleLiveSessions = async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  let closed = 0;

  // Loop in pages so a backlog (e.g. after an outage) is fully cleared.
  for (let page = 0; page < 10; page++) {
    const snap = await db.collection("live_sessions")
        .where("expiresAt", "<=", now)
        .limit(BATCH_LIMIT / 2)
        .get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((d) => {
      const data = d.data();
      const endMs = toMillis(data.lastActivityAt, now.toMillis());
      const segStart = toMillis(data.segmentStartedAt, toMillis(data.startedAt, endMs));
      batch.update(d.ref, {
        status: "closed",
        endedAt: admin.firestore.Timestamp.fromMillis(endMs),
        endReason: "auto_closed",
        expiresAt: null,
        handleMs: admin.firestore.FieldValue.increment(Math.max(0, endMs - segStart)),
      });
      batch.set(db.collection("activity_audit").doc(), {
        uid: data.uid || null,
        ldap: data.ldap || null,
        displayName: data.displayName || null,
        teamId: data.teamId || null,
        role: data.role || null,
        dashboard: "System",
        eventType: "live_session_ended",
        category: "session",
        action: "Live session auto-closed",
        caseId: data.caseId || null,
        sessionId: d.id,
        mode: "live",
        channel: data.channel || null,
        detail: "auto_closed",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    closed += snap.size;
    if (snap.size < BATCH_LIMIT / 2) break;
  }

  if (closed > 0) functions.logger.info(`closeStaleLiveSessions: closed ${closed} session(s)`);
  return null;
};

module.exports = {closeStaleLiveSessions};
