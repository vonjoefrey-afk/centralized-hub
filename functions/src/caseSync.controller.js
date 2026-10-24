const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Keeps a tracked case's mirrored `spii_cases` doc current. This is the
 * single place that creates or updates the mirror, so it doesn't matter
 * which client code path touched the tracked case (create, edit, or a
 * later change of the "Is SPII" flag) — the SPII Chat notification always
 * reads a live, current status.
 */
const syncTrackedCaseToSpii = async (db, trackedCaseRef, trackedCaseData) => {
  if (trackedCaseData.isSpii !== "Yes") return;
  if (!trackedCaseData.userId || !trackedCaseData.caseId) return;

  if (trackedCaseData.linkedSpiiCaseId) {
    const spiiRef = db.collection("spii_cases").doc(trackedCaseData.linkedSpiiCaseId);
    const spiiSnap = await spiiRef.get();
    if (spiiSnap.exists) {
      if (spiiSnap.data().status !== trackedCaseData.status) {
        await spiiRef.update({
          status: trackedCaseData.status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return;
    }
    // Linked doc was deleted out from under us — fall through and recreate the link below.
  }

  // Not linked yet. Look for a pre-existing mirror (from before this sync existed,
  // or created by the old client-side bridge) before creating a new one.
  const existingSnap = await db
      .collection("spii_cases")
      .where("userId", "==", trackedCaseData.userId)
      .where("caseId", "==", trackedCaseData.caseId)
      .limit(1)
      .get();

  let spiiCaseId;
  if (!existingSnap.empty) {
    spiiCaseId = existingSnap.docs[0].id;
    if (existingSnap.docs[0].data().status !== trackedCaseData.status) {
      await existingSnap.docs[0].ref.update({
        status: trackedCaseData.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } else {
    const newRef = await db.collection("spii_cases").add({
      userId: trackedCaseData.userId,
      teamId: trackedCaseData.teamId || null,
      caseId: trackedCaseData.caseId,
      status: trackedCaseData.status,
      customerName: "N/A",
      submittedPrivacy: "no",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    spiiCaseId = newRef.id;
  }

  await trackedCaseRef.update({linkedSpiiCaseId: spiiCaseId});
};

/**
 * Firestore trigger: fires on every create/update/delete of a tracked case
 * and keeps its `spii_cases` mirror in step in real time.
 */
exports.onTrackedCaseWrite = async (change, context) => {
  const after = change.after.exists ? change.after.data() : null;
  if (!after) return null; // Tracked case was deleted; leave its SPII mirror as historical record.

  try {
    await syncTrackedCaseToSpii(admin.firestore(), change.after.ref, after);
  } catch (err) {
    console.error("[onTrackedCaseWrite] Failed to sync tracked case to SPII cases:", err);
  }
  return null;
};

/**
 * One-time (admin-triggered) sweep that force-syncs every SPII-flagged tracked
 * case right now, so records that went stale before this fix existed get
 * corrected immediately instead of waiting for their next edit.
 */
exports.backfillSpiiCaseSync = async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const db = admin.firestore();

  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  const callerRole = callerDoc.exists ? callerDoc.data().role : null;
  if (!["admin", "trainer", "team_leader"].includes(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "Only admins, trainers, or team leaders can run this.");
  }

  try {
    const trackedSnap = await db.collection("tracked_cases").where("isSpii", "==", "Yes").get();

    let synced = 0;
    let failed = 0;
    for (const trackedDoc of trackedSnap.docs) {
      try {
        await syncTrackedCaseToSpii(db, trackedDoc.ref, trackedDoc.data());
        synced++;
      } catch (err) {
        console.error(`[backfillSpiiCaseSync] Failed for tracked case ${trackedDoc.id}:`, err);
        failed++;
      }
    }

    return {success: true, checked: trackedSnap.size, synced, failed};
  } catch (error) {
    console.error("[backfillSpiiCaseSync] Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
};
