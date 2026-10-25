import { db } from '../firebase/config';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { createNotification } from '../firebase/firestore';
import { createUpdate } from './updates';

export const submitFeedback = async ({
  userId,
  userEmail,
  userName,
  role,
  type,
  title,
  message,
  featureStatuses,
  page,
}) => {
  return addDoc(collection(db, 'feedback'), {
    userId,
    userEmail,
    userName,
    role,
    type,
    title,
    message: message || null,
    featureStatuses: featureStatuses || null,
    page,
    status: 'open',
    createdAt: serverTimestamp(),
  });
};

// Bug-report workflow statuses an admin can set from the User Feedback tab.
export const BUG_STATUSES = [
  { value: 'checking', label: 'Checking' },
  { value: 'in-progress', label: 'In-progress' },
  { value: 'wai', label: 'Working as Intended (WAI)' },
  { value: 'fixed', label: 'Fixed-Bug' },
];

export const BUG_STATUS_LABEL = Object.fromEntries(BUG_STATUSES.map((s) => [s.value, s.label]));

/** Cache an AI triage result on the feedback doc so it persists and is re-runnable. */
export const saveFeedbackAnalysis = async (feedbackId, analysis, adminUid) => {
  await updateDoc(doc(db, 'feedback', feedbackId), {
    aiAnalysis: analysis,
    aiAnalyzedAt: serverTimestamp(),
    aiAnalyzedBy: adminUid || null,
  });
};

/**
 * Admin action from the User Feedback tab: set a bug report's workflow status,
 * always notify the person who submitted it, and — when marked Fixed-Bug —
 * broadcast the admin's note to every user's Updates tab (via the shared
 * 'trainer-updates' channel, which also fans out notifications).
 */
export const updateBugFeedbackStatus = async ({ feedback, status, note, adminUid }) => {
  const label = BUG_STATUS_LABEL[status] || status;

  await updateDoc(doc(db, 'feedback', feedback.id), {
    bugStatus: status,
    bugStatusNote: status === 'fixed' ? note || '' : null,
    bugStatusUpdatedAt: serverTimestamp(),
    bugStatusBy: adminUid || null,
  });

  // Always notify the reporter of the new status.
  if (feedback.userId) {
    let message;
    if (status === 'fixed') {
      message = `Your bug report "${feedback.title}" has been fixed. ${note}`;
    } else if (status === 'wai') {
      message = `Your bug report "${feedback.title}" was reviewed and marked Working as Intended.`;
    } else {
      message = `Your bug report "${feedback.title}" is now marked "${label}".`;
    }
    await createNotification(feedback.userId, 'bug_status', `Bug status: ${label}`, message);
  }

  // Fixed-Bug: post the note to everyone's Updates tab.
  if (status === 'fixed') {
    await createUpdate('trainer-updates', `Bug Fixed — ${feedback.title}`, note, adminUid, null, []);
  }
};
