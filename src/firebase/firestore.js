import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './config';
import { logger } from '../utils/logger';

// Teams collection functions



/**
 * Get all teams (admin only).
 */

/**
 * Admin-only: move a user to a different team instantly.
 * Handles removing from old team members array, adding to new team members array,
 * and updating the user's teamId in one consistent operation.
 *
 * @param {string} userId        - UID of the user to move
 * @param {string|null} newTeamId - Target team ID, or null to remove from all teams
 * @param {string|null} oldTeamId - Current team ID (to remove from), or null if unassigned
 */

/**
 * Unassign a user from their current team.
 * @param {string} userId - UID of the user to remove
 */

// Updates collection functions

/**
 * Update an existing update's title, content, or deadline.
 */


// Delete update and all related data

// Acknowledgments collection functions



// User management functions



// Get all team member users (for Team Leaders and Trainers)

// Get all team leader users (for Operations Managers)

// Get all operations manager users (for Senior Operations Managers)

// Get pending team leaders

// Approve team leader

// Reject team leader

// Check if user exists but is rejected (allows email reuse)
// Check if user exists by either primary email or SSO email (for migration)

// Reactivate a rejected user (for re-signup with same email)

// Team member management functions



// Migration management functions



// Acknowledgment tracking functions



// Get users who received notifications for an update

// Get acknowledgment status breakdown for an update

// Get acknowledgment status breakdown for trainer updates
// OPTIMIZED: Uses allUsers passed from component to avoid N+1 database calls

// Delete user completely (Firestore + Auth + related data)

// Template management functions
// Template management functions
export const createTemplate = async (userId, title, description, channel = 'both') => {
  try {
    // Get current templates count to set order
    const templates = await getTemplatesByUser(userId);
    const order = templates.length;

    const templateData = {
      userId,
      title,
      description,
      channel: ['chat', 'email'].includes(channel) ? channel : 'both',
      order,
      createdAt: serverTimestamp()
    };

    logger.log('Creating template with data:', templateData);
    const docRef = await addDoc(collection(db, 'templates'), templateData);
    logger.log('Template created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    logger.error('Error creating template:', error);
    throw error;
  }
};

export const getTemplatesByUser = async (userId) => {
  try {
    const q = query(
      collection(db, 'templates'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const templates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort by order if available, otherwise by createdAt
    return templates.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      const aTime = a.createdAt?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || new Date(0);
      return aTime - bTime;
    });
  } catch (error) {
    throw error;
  }
};

export const updateTemplate = async (templateId, title, description, channel) => {
  try {
    await updateDoc(doc(db, 'templates', templateId), {
      title,
      description,
      ...(channel !== undefined ? { channel: ['chat', 'email'].includes(channel) ? channel : 'both' } : {}),
      updatedAt: serverTimestamp()
    });
    return { success: true, message: 'Template updated successfully' };
  } catch (error) {
    throw error;
  }
};

export const updateTemplateOrder = async (templates) => {
  try {
    const batch = writeBatch(db);
    
    templates.forEach((template, index) => {
      const templateRef = doc(db, 'templates', template.id);
      batch.update(templateRef, {
        order: index,
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    logger.error('Error updating template order:', error);
    throw error;
  }
};

export const deleteTemplate = async (templateId) => {
  try {
    await deleteDoc(doc(db, 'templates', templateId));
    return { success: true, message: 'Template deleted successfully' };
  } catch (error) {
    throw error;
  }
};

// Template sharing — proposal/accept flow. The sender only ever writes a
// proposal doc tagged with the recipient's uid; nothing lands in the
// recipient's own templates collection until they explicitly accept it.
export const createTemplateShare = async ({ fromUid, fromName, fromEmail, toUid, templates }) => {
  try {
    const docRef = await addDoc(collection(db, 'template_shares'), {
      fromUid,
      fromName,
      fromEmail,
      toUid,
      templates,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    logger.error('Error creating template share:', error);
    throw error;
  }
};

export const acceptTemplateShare = async (shareId, userId, selectedTemplates) => {
  try {
    for (const t of selectedTemplates) {
      await createTemplate(userId, t.title, t.description);
    }
    await deleteDoc(doc(db, 'template_shares', shareId));
    return { success: true, imported: selectedTemplates.length };
  } catch (error) {
    logger.error('Error accepting template share:', error);
    throw error;
  }
};

export const declineTemplateShare = async (shareId) => {
  try {
    await deleteDoc(doc(db, 'template_shares', shareId));
    return { success: true };
  } catch (error) {
    logger.error('Error declining template share:', error);
    throw error;
  }
};

// Notification functions
// Bump/nudge users who haven't acknowledged an update

export const createNotification = async (userId, type, title, message, updateId = null) => {
  try {
    const notificationData = {
      userId,
      type,
      title,
      message,
      updateId,
      isRead: false,
      createdAt: serverTimestamp()
    };

    logger.log('Creating notification for user:', userId, 'Type:', type, 'Title:', title);
    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    logger.log('Notification created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};

export const getNotificationsByUser = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const notifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort by createdAt in JavaScript since Firestore index might not be set up
    return notifications.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || new Date(0);
      return bTime - aTime; // Descending order (newest first)
    });
  } catch (error) {
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      readAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const querySnapshot = await getDocs(q);
    const updatePromises = querySnapshot.docs.map(doc =>
      updateDoc(doc.ref, {
        isRead: true,
        readAt: serverTimestamp()
      })
    );
    await Promise.all(updatePromises);
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
    return { success: true };
  } catch (error) {
    throw error;
  }
};

// Check for approaching deadlines and create notifications
// userId is required to scope the query to the user's own team
export const checkApproachingDeadlines = async (userId) => {
  if (!userId) return { success: false, message: 'No userId provided' };
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    // Fetch the user's own team to scope the query
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return { success: false, message: 'User not found' };
    const teamId = userDoc.data().teamId;
    if (!teamId) return { success: false, message: 'User has no team' };

    // Only get updates for the user's own team (single-field index, no composite needed)
    const updatesQuery = query(
      collection(db, 'updates'),
      where('teamId', '==', teamId)
    );
    const updatesSnapshot = await getDocs(updatesQuery);

    // Filter client-side for deadline != null (avoids composite index requirement)
    const updates = updatesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(u => u.deadline != null);

    for (const update of updates) {
      const deadline = update.deadline ? (update.deadline.toDate ? update.deadline.toDate() : new Date(update.deadline)) : null;

      if (deadline && deadline <= threeDaysFromNow && deadline > now) {
        // Check if notification already exists for this update and user
        const existingNotificationQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', userId),
          where('updateId', '==', update.id),
          where('type', '==', 'deadline_warning')
        );
        const existingSnapshot = await getDocs(existingNotificationQuery);

        if (existingSnapshot.empty) {
          const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
          await createNotification(
            userId,
            'deadline_warning',
            'Deadline Approaching',
            `Update "${update.title}" deadline is in ${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'}. Please acknowledge if you haven't already.`,
            update.id
          );
        }
      }
    }

    return { success: true, message: 'Deadline check completed' };
  } catch (error) {
    logger.error('Error checking approaching deadlines:', error);
    throw error;
  }
};

// Note Management Functions
export const createNote = async (userId, title, content, color = '#ffffff') => {
  try {
    const noteData = {
      userId,
      title,
      content,
      color,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, 'notes'), noteData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const getNotesByUser = async (userId) => {
  try {
    const q = query(
      collection(db, 'notes'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};

export const updateNote = async (noteId, title, content, color) => {
  try {
    const updateData = {
      title,
      content,
      updatedAt: serverTimestamp()
    };
    if (color) updateData.color = color;

    await updateDoc(doc(db, 'notes', noteId), updateData);
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const deleteNote = async (noteId) => {
  try {
    await deleteDoc(doc(db, 'notes', noteId));
    return { success: true };
  } catch (error) {
    throw error;
  }
};

// Scratchpad Functions
export const getUserScratchpad = async (userId) => {
  try {
    const docRef = doc(db, 'scratchpads', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    throw error;
  }
};

export const saveUserScratchpad = async (userId, content) => {
  try {
    const docRef = doc(db, 'scratchpads', userId);
    await setDoc(docRef, {
      userId,
      content,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Scratchpad Documents — Google-Docs-style multi-document notes.
// Stored as a per-user subcollection: scratchpads/{userId}/documents/{docId}.
// Each document: { title, content (HTML), createdAt, updatedAt }.
// ---------------------------------------------------------------------------

/** List a user's documents, most recently edited first. */
export const getScratchpadDocuments = async (userId) => {
  const colRef = collection(db, 'scratchpads', userId, 'documents');
  const q = query(colRef, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Create a new document; returns its generated id. `parentId`/`order` place it in the tree. */
export const createScratchpadDocument = async (userId, { title, content, parentId = null, order = 0 } = {}) => {
  const colRef = collection(db, 'scratchpads', userId, 'documents');
  const ref = await addDoc(colRef, {
    title: title || 'Untitled document',
    content: content || '',
    parentId: parentId ?? null,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Patch a document. By default bumps `updatedAt` (a real edit); pass
 * `touch: false` for structural-only changes (move/reorder/collapse) so the
 * "last edited" time isn't disturbed.
 */
export const updateScratchpadDocument = async (userId, docId, data, { touch = true } = {}) => {
  const ref = doc(db, 'scratchpads', userId, 'documents', docId);
  await updateDoc(ref, touch ? { ...data, updatedAt: serverTimestamp() } : { ...data });
};

/** Permanently delete a document. */
export const deleteScratchpadDocument = async (userId, docId) => {
  const ref = doc(db, 'scratchpads', userId, 'documents', docId);
  await deleteDoc(ref);
};

/** Permanently delete several documents in one batch (e.g. a tab and its sub-tabs). */
export const deleteScratchpadDocuments = async (userId, docIds = []) => {
  if (!docIds.length) return;
  const batch = writeBatch(db);
  for (const id of docIds) batch.delete(doc(db, 'scratchpads', userId, 'documents', id));
  await batch.commit();
};

/** Flag the legacy single-scratchpad as migrated so we only import it once. */
export const markScratchpadMigrated = async (userId) => {
  const docRef = doc(db, 'scratchpads', userId);
  await setDoc(docRef, { migratedToDocuments: true }, { merge: true });
};

// Feature Management Functions

/**
 * Update a user's core profile information manually (e.g. for SSO migration tracking).
 * @param {string} userId - Target UID
 * @param {Object} profileData - Data keys to update (e.g., displayName, ssoEmail)
 */

// Modified Breaks and Lunch Functions
export const setModifiedBreak = async (userId, date, type, startTime, endTime, assignedBy) => {
  try {
    // collection: modified_breaks
    // docId: userId_date_type (e.g., vianca_2026-02-08_break1)
    const breakId = `${userId}_${date}_${type}`;
    const breakData = {
      userId,
      date,
      type, // 'break1', 'break2', 'lunch'
      startTime,
      endTime,
      assignedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'modified_breaks', breakId), breakData, { merge: true });
    return { success: true, id: breakId };
  } catch (error) {
    logger.error('Error setting modified break:', error);
    throw error;
  }
};

export const deleteModifiedBreak = async (userId, date, type) => {
  try {
    const breakId = `${userId}_${date}_${type}`;
    await deleteDoc(doc(db, 'modified_breaks', breakId));
    return { success: true };
  } catch (error) {
    logger.error('Error deleting modified break:', error);
    throw error;
  }
};

export const getModifiedBreaks = async (userId, date) => {
  try {
    const q = query(
      collection(db, 'modified_breaks'),
      where('userId', '==', userId),
      where('date', '==', date)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    logger.error('Error getting modified breaks:', error);
    throw error;
  }
};

export const getAllModifiedBreaksForDate = async (date) => {
  try {
    const q = query(
      collection(db, 'modified_breaks'),
      where('date', '==', date)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    logger.error('Error getting all modified breaks for date:', error);
    throw error;
  }
};
// SPII Cases Functions
export const addSpiiCase = async (userId, caseData, teamId = null) => {
  try {
    // Check for duplicates first
    const q = query(
      collection(db, 'spii_cases'),
      where('userId', '==', userId),
      where('caseId', '==', caseData.caseId)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const error = new Error(`Case ID ${caseData.caseId} already exists`);
      error.code = 'duplicate-id';
      throw error;
    }

    const docRef = await addDoc(collection(db, 'spii_cases'), {
      ...caseData,
      userId,
      teamId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, success: true };
  } catch (error) {
    logger.error('Error adding SPII case:', error);
    throw error;
  }
};

export const getSpiiCasesByUser = async (userId) => {
  try {
    const q = query(
      collection(db, 'spii_cases'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    logger.error('Error fetching SPII cases:', error);
    throw error;
  }
};

// ==========================================
// CASE TRACKER FUNCTIONS
// ==========================================

export const addTrackedCase = async (userId, caseData, teamId) => {
    try {
        const casesRef = collection(db, 'tracked_cases');
        // Check for duplicates
        const q = query(casesRef, where('caseId', '==', caseData.caseId.trim()), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const error = new Error('Case ID already exists in your tracked cases');
            error.code = 'duplicate-id';
            throw error;
        }

        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.exists() ? userDoc.data() : {};

        await addDoc(casesRef, {
            userId,
            teamId,
            caseId: caseData.caseId.trim(),
            status: caseData.status,
            origin: caseData.origin,
            survey: caseData.survey,
            isSpii: caseData.isSpii,
            isTransferred: caseData.isTransferred || 'No',
            transferValidation: caseData.transferValidation || '',
            surveyStatus: caseData.surveyStatus || 'N/A',
            isChatContinued: caseData.isChatContinued || null,
            irt: caseData.irt || '', 
            createdAt: (() => {
                if (!caseData.customDate) return serverTimestamp();
                
                const now = new Date();
                const uiToday = now.toISOString().split('T')[0];
                
                // If the selected date is the same as the current UTC-based today (to match UI default), 
                // use serverTimestamp for the most accurate "now"
                if (caseData.customDate === uiToday) {
                    return serverTimestamp();
                }

                // If it's a different date, preserve the current time of day for sorting purposes
                try {
                    const [y, m, d] = caseData.customDate.split('-').map(Number);
                    if (isNaN(y) || isNaN(m) || isNaN(d)) return serverTimestamp();
                    
                    const dateWithTime = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
                    return Timestamp.fromDate(dateWithTime);
                } catch (e) {
                    return serverTimestamp();
                }
            })(),
            userDisplayName: userData.displayName || userData.email || 'Unknown User'
        });
        return true;
    } catch (error) {
        logger.error('Error adding tracked case:', error);
        throw error;
    }
};

export const updateTrackedCase = async (docId, updates) => {
    try {
        const caseRef = doc(db, 'tracked_cases', docId);
        await updateDoc(caseRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        logger.error('Error updating tracked case:', error);
        throw error;
    }
};

export const getTrackedCasesByUser = async (userId) => {
    try {
        const q = query(
            collection(db, 'tracked_cases'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const cases = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Sort explicitly in JS to avoid strict composite index requirements
        return cases.sort((a, b) => {
             const timeA = a.createdAt?.toDate?.() || new Date();
             const timeB = b.createdAt?.toDate?.() || new Date();
             return timeB - timeA;
        });
    } catch (error) {
        logger.error('Error fetching tracked cases:', error);
        throw error;
    }
};

// All SPII-flagged tracked cases, org-wide. Used by the SPII Case POC view so
// authorized people (admin/trainer/TL/POC) can edit any SPII case, not just
// their own. Reads are org-wide by rule; writes are gated server-side.
export const getAllSpiiTrackedCases = async () => {
    try {
        const q = query(collection(db, 'tracked_cases'), where('isSpii', '==', 'Yes'));
        const snapshot = await getDocs(q);
        const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return cases.sort((a, b) => {
            const timeA = a.createdAt?.toDate?.() || new Date(0);
            const timeB = b.createdAt?.toDate?.() || new Date(0);
            return timeB - timeA;
        });
    } catch (error) {
        logger.error('Error fetching SPII tracked cases:', error);
        throw error;
    }
};

export const getAnalyticsTrackedCases = async (role, uid, teamId) => {
    try {
        let q = collection(db, 'tracked_cases');
        
        // Removed role-based query constraints to allow global analytics visibility as requested
        // Previously: if (role === 'team_member') ... else if (role === 'team_leader') ...
        
        const snapshot = await getDocs(q);
        const cases = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        return cases.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
    } catch (error) {
        logger.error('Error fetching analytics tracked cases:', error);
        throw error;
    }
};

export const subscribeToAnalyticsTrackedCases = (role, uid, teamId, onUpdate, onError) => {
    try {
        let q = collection(db, 'tracked_cases');
        
        // Removed role-based query constraints to allow global analytics visibility as requested
        // Previously: if (role === 'team_member') ... else if (role === 'team_leader') ...
        
        return onSnapshot(q, (snapshot) => {
            const cases = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            onUpdate(cases.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
        }, (err) => {
            logger.error('Error fetching analytics tracked cases via snapshot:', err);
            if (onError) onError(err);
        });
    } catch (error) {
        logger.error('Error setting up analytics tracked cases subscription:', error);
        if (onError) onError(error);
        return () => {};
    }
};

export const deleteTrackedCase = async (caseId) => {
    try {
        await deleteDoc(doc(db, 'tracked_cases', caseId));
        return true;
    } catch (error) {
        logger.error('Error deleting tracked case:', error);
        throw error;
    }
};

export const getAllSpiiCases = async (teamId = null) => {
  try {
    let q;
    if (teamId) {
      q = query(
        collection(db, 'spii_cases'),
        where('teamId', '==', teamId)
      );
    } else {
      q = query(
        collection(db, 'spii_cases')
      );
    }
    const querySnapshot = await getDocs(q);
    const cases = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort client-side to avoid needing a composite index
    return cases.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
  } catch (error) {
    logger.error('Error getting all SPII cases:', error);
    throw error;
  }
};

export const updateSpiiCase = async (caseId, updateData) => {
  try {
    const docRef = doc(db, 'spii_cases', caseId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    logger.error('Error updating SPII case:', error);
    throw error;
  }
};

export const deleteSpiiCase = async (caseId) => {
  try {
    await deleteDoc(doc(db, 'spii_cases', caseId));
    return { success: true };
  } catch (error) {
    logger.error('Error deleting SPII case:', error);
    throw error;
  }
};

// One-time sweep that force-syncs every SPII-flagged tracked case against its
// spii_cases mirror right now, fixing any records left stale before real-time
// syncing existed. Going forward, the syncTrackedCaseToSpii trigger keeps them
// current automatically on every create/edit.
export const triggerSpiiCaseBackfill = async () => {
  try {
    const backfillFn = httpsCallable(functions, 'backfillSpiiCaseSync');
    const result = await backfillFn();
    return result.data;
  } catch (error) {
    logger.error('Error running SPII case backfill sync:', error);
    throw error;
  }
};

/**
 * SPII Audit Logs functions
 */
export const logSpiiAudit = async (userId, userDisplayName, teamId, detections, sourceTab) => {
  try {
    const auditData = {
      userId,
      userDisplayName,
      teamId,
      detections, // Array of { type, redacted, value }
      sourceTab,
      timestamp: serverTimestamp(),
      notified: false
    };
    const docRef = await addDoc(collection(db, 'spii_audit_logs'), auditData);
    return docRef.id;
  } catch (error) {
    logger.error('Error logging SPII audit:', error);
    throw error;
  }
};

export const getSpiiAuditLogs = async (teamId = null) => {
  try {
    let q;
    if (teamId) {
      q = query(
        collection(db, 'spii_audit_logs'),
        where('teamId', '==', teamId)
      );
    } else {
      q = query(
        collection(db, 'spii_audit_logs')
      );
    }
    const querySnapshot = await getDocs(q);
    const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort client-side
    return logs.sort((a, b) => {
      const timeA = a.timestamp?.toMillis?.() || 0;
      const timeB = b.timestamp?.toMillis?.() || 0;
      return timeB - timeA;
    });
  } catch (error) {
    logger.error('Error getting SPII audit logs:', error);
    throw error;
  }
};

export const getSpiiDetectionSettings = async () => {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'spii_monitoring'));
    if (settingsDoc.exists()) {
      return settingsDoc.data();
    }
    return { enabled: false, googleChatWebhook: '' };
  } catch (error) {
    logger.error('Error getting SPII detection settings:', error);
    return { enabled: false, googleChatWebhook: '' };
  }
};

export const updateSpiiDetectionSettings = async (settings) => {
  try {
    await setDoc(doc(db, 'settings', 'spii_monitoring'), {
      ...settings,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    logger.error('Error updating SPII detection settings:', error);
    throw error;
  }
};

