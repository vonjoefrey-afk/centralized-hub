import { db } from '../firebase/config';
import { collection, doc, query, getDoc, getDocs, updateDoc, deleteDoc, addDoc, setDoc, where, orderBy, writeBatch, serverTimestamp, runTransaction } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { createNotification } from '../firebase/firestore';

export const createUpdate = async (teamId, title, content, createdBy, deadline, excludedUserIds = []) => {
  try {
    // Convert deadline to Firestore Timestamp if provided
    let deadlineTimestamp = null;
    if (deadline) {
      const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
      if (!isNaN(deadlineDate.getTime())) {
        deadlineTimestamp = Timestamp.fromDate(deadlineDate);
      }
    }

    const updateData = {
      teamId,
      title,
      content,
      createdBy,
      deadline: deadlineTimestamp,
      createdAt: serverTimestamp(),
      status: 'pending'
    };

    const docRef = await addDoc(collection(db, 'updates'), updateData);
    
    // Create notifications for users (Non-blocking as much as possible)
    (async () => {
      try {
        let userIdsToNotify = [];

        if (teamId === 'trainer-updates') {
          const allUsersSnapshot = await getDocs(collection(db, 'users'));
          userIdsToNotify = allUsersSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(u => u.role !== 'admin' && u.role !== 'trainer' && u.role !== 'om' && u.role !== 'som')
            .map(u => u.id);
        } else {
          const teamDoc = await getDoc(doc(db, 'teams', teamId));
          if (teamDoc.exists()) {
            userIdsToNotify = teamDoc.data().members || [];
          }
        }

        if (!userIdsToNotify.includes(createdBy)) {
          userIdsToNotify.push(createdBy);
        }

        const candidateUserIds = userIdsToNotify.filter(id => !excludedUserIds.includes(id));
        const batch = writeBatch(db);
        let count = 0;

        for (const userId of candidateUserIds) {
          if (count >= 490) break;
          const notificationRef = doc(collection(db, 'notifications'));
            batch.set(notificationRef, {
            userId,
            type: 'new_update',
            title: 'New Update Available',
            message: `A new update "${title}" has been created.`,
            updateId: docRef.id,
            updateCreatedBy: createdBy, // Store creator ID for permission checks
            isRead: false,
            createdAt: serverTimestamp()
          });
          count++;
        }

        if (count > 0) {
          await batch.commit();
        }
      } catch (err) {
        logger.error('Error in background notification task:', err);
      }
    })();

    return docRef.id;
  } catch (error) {
    logger.error('Error in createUpdate:', error);
    throw error;
  }
};


export const updateUpdate = async (updateId, title, content, deadline) => {
  try {
    const updateRef = doc(db, 'updates', updateId);
    
    let deadlineTimestamp = null;
    if (deadline) {
      const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
      if (!isNaN(deadlineDate.getTime())) {
        deadlineTimestamp = Timestamp.fromDate(deadlineDate);
      }
    }

    const updateData = {
      title,
      content,
      deadline: deadlineTimestamp,
      updatedAt: serverTimestamp()
    };

    await updateDoc(updateRef, updateData);
    return { success: true };
  } catch (error) {
    logger.error('updateUpdate error:', error);
    throw error;
  }
};


export const getUpdatesByTeam = async (teamId) => {
  try {
    const q = query(
      collection(db, 'updates'),
      where('teamId', '==', teamId)
    );
    const querySnapshot = await getDocs(q);
    const updates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort by createdAt in JavaScript instead of Firestore
    return updates.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt.toDate() - a.createdAt.toDate();
      }
      return 0;
    });
  } catch (error) {
    throw error;
  }
};


export const deleteUpdate = async (updateId) => {
  try {
    logger.log('deleteUpdate: Starting deletion of update:', updateId);

    // First get the update to find the teamId and title
    const updateDoc = await getDoc(doc(db, 'updates', updateId));
    if (!updateDoc.exists()) {
      throw new Error('Update not found');
    }

    const updateData = updateDoc.data();
    const teamId = updateData.teamId;
    const updateTitle = updateData.title;

    logger.log('deleteUpdate: Update found, teamId:', teamId, 'title:', updateTitle);

    // Start a batch for all deletions
    const batch = writeBatch(db);

    // 1. Queue all acknowledgments for deletion
    try {
      const acknowledgmentsQuery = query(
        collection(db, 'acknowledgments'),
        where('updateId', '==', updateId)
      );
      const acknowledgmentsSnapshot = await getDocs(acknowledgmentsQuery);
      acknowledgmentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      logger.log('deleteUpdate: Queued', acknowledgmentsSnapshot.size, 'acknowledgments for deletion');
    } catch (ackError) {
      logger.error('deleteUpdate: Error querying acknowledgments:', ackError);
    }

    // 2. Queue all notifications for deletion
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('updateId', '==', updateId)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      notificationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      logger.log('deleteUpdate: Queued', notificationsSnapshot.size, 'notifications for deletion');
    } catch (notificationQueryError) {
      logger.error('deleteUpdate: Error querying notifications:', notificationQueryError);
    }

    // 3. Queue the update document itself
    batch.delete(doc(db, 'updates', updateId));

    // Commit the batch
    logger.log('deleteUpdate: Committing deletion batch...');
    await batch.commit();
    logger.log('deleteUpdate: Batch committed successfully');

    // 4. Create notifications for all team members about the deleted update
    logger.log('deleteUpdate: Creating deletion notifications...');
    try {
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (teamDoc.exists()) {
        const teamData = teamDoc.data();
        const memberIds = teamData.members || [];
        logger.log('deleteUpdate: Found', memberIds.length, 'team members to notify');

        // Create notification for each team member
        const notificationPromises = memberIds.map(memberId =>
          createNotification(
            memberId,
            'update_deleted',
            'Update Removed',
            `The update "${updateTitle}" has been deleted and is no longer available.`,
            null // No updateId since it's deleted
          )
        );

        await Promise.all(notificationPromises);
        logger.log('deleteUpdate: Deletion notifications created');
      }
    } catch (notificationError) {
      logger.error('deleteUpdate: Error creating notifications for deleted update:', notificationError);
      // Don't throw error here as update was deleted successfully
    }

    logger.log('deleteUpdate: Deletion completed successfully');
    return { success: true, message: 'Update and all related data deleted successfully' };
  } catch (error) {
    logger.error('deleteUpdate: Error deleting update:', error);
    logger.error('deleteUpdate: Error code:', error.code);
    logger.error('deleteUpdate: Error message:', error.message);
    throw error;
  }
};

/**
 * Delete many updates at once (admin cleanup). Each is removed with the full
 * deleteUpdate cascade (acknowledgments + notifications). Failures are isolated
 * so one bad delete doesn't abort the rest.
 * @param {string[]} updateIds
 * @returns {{ total:number, success:number, failed:number }}
 */
export const deleteUpdates = async (updateIds = []) => {
  const results = await Promise.allSettled(updateIds.map((id) => deleteUpdate(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { total: updateIds.length, success: updateIds.length - failed, failed };
};


export const acknowledgeUpdate = async (updateId, userId, comment = '') => {
  try {
    // Get update details to find creator and team leader
    const updateDoc = await getDoc(doc(db, 'updates', updateId));
    if (!updateDoc.exists()) {
      throw new Error('Update not found');
    }
    const updateData = updateDoc.data();
    const updateCreatedBy = updateData.createdBy;

    const ackData = {
      updateId,
      updateCreatedBy, // Store creator ID for permission checks
      userId,
      comment,
      acknowledgedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'acknowledgments'), ackData);

    // Create notification for team leader about the acknowledgment
    try {
      const teamId = updateData.teamId;

        // Get team details to find team leader
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (teamDoc.exists()) {
          const teamData = teamDoc.data();
          const teamLeaderId = teamData.teamLeaderId;

          // Get user details for the person who acknowledged
          const userDoc = await getDoc(doc(db, 'users', userId));
          const userName = userDoc.exists() ? userDoc.data().displayName || 'A team member' : 'A team member';

          // Create notification for team leader
          await createNotification(
            teamLeaderId,
            'update_acknowledged',
            'Update Acknowledged',
            `${userName} has acknowledged the update "${updateData.title}".`,
            updateId
          );
        }
    } catch (notificationError) {
      logger.error('Error creating acknowledgment notification:', notificationError);
      // Don't throw error here as acknowledgment was successful
    }

    return docRef.id;
  } catch (error) {
    throw error;
  }
};


export const getAcknowledgmentStatus = async (updateId) => {
  try {
    const q = query(
      collection(db, 'acknowledgments'),
      where('updateId', '==', updateId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};


export const getUserAcknowledgment = async (updateId, userId) => {
  try {
    const q = query(
      collection(db, 'acknowledgments'),
      where('updateId', '==', updateId),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    throw error;
  }
};


export const getUpdateAcknowledgmentStatus = async (updateId) => {
  try {
    const q = query(
      collection(db, 'acknowledgments'),
      where('updateId', '==', updateId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};


export const getPendingAcknowledgmentMembers = async (updateId, teamMembers) => {
  try {
    const acknowledgments = await getUpdateAcknowledgmentStatus(updateId);
    const acknowledgedUserIds = acknowledgments.map(ack => ack.userId);

    return teamMembers.filter(member => !acknowledgedUserIds.includes(member.id));
  } catch (error) {
    throw error;
  }
};


export const getAcknowledgedMembers = async (updateId, teamMembers) => {
  try {
    const acknowledgments = await getUpdateAcknowledgmentStatus(updateId);
    const acknowledgedUserIds = acknowledgments.map(ack => ack.userId);

    return teamMembers.filter(member => acknowledgedUserIds.includes(member.id));
  } catch (error) {
    throw error;
  }
};


export const getNotifiedUserIdsForUpdate = async (updateId) => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('updateId', '==', updateId),
      where('type', '==', 'new_update')
    );
    const notificationsSnapshot = await getDocs(notificationsQuery);
    return notificationsSnapshot.docs.map(doc => doc.data().userId);
  } catch (error) {
    logger.error('Error getting notified user IDs for update:', error);
    throw error;
  }
};


export const getUpdateAcknowledgmentBreakdown = async (updateId, teamMembers, deadline) => {
  try {
    const acknowledgments = await getUpdateAcknowledgmentStatus(updateId);
    const acknowledgedUserIds = acknowledgments.map(ack => ack.userId);
    const now = new Date();
    const deadlineDate = deadline ? (deadline.toDate ? deadline.toDate() : new Date(deadline)) : null;

    const acknowledged = [];
    const pending = [];
    const failed = [];

    teamMembers.forEach(member => {
      if (acknowledgedUserIds.includes(member.id)) {
        acknowledged.push(member);
      } else if (deadlineDate && now > deadlineDate) {
        failed.push(member);
      } else {
        pending.push(member);
      }
    });

    return {
      acknowledged,
      pending,
      failed,
      total: teamMembers.length,
      acknowledgedCount: acknowledged.length,
      pendingCount: pending.length,
      failedCount: failed.length
    };
  } catch (error) {
    throw error;
  }
};


export const getUpdateAcknowledgmentBreakdownForTrainer = async (updateId, deadline, allUsers = []) => {
  try {
    // Get IDs of users who actually received notifications for this update
    const notifiedUserIds = await getNotifiedUserIdsForUpdate(updateId);

    // Filter the provided allUsers list to get the user objects
    // This avoids fetching each user individually from Firestore
    const notifiedUsers = allUsers.filter(user => notifiedUserIds.includes(user.id));

    const acknowledgments = await getUpdateAcknowledgmentStatus(updateId);
    const acknowledgedUserIds = acknowledgments.map(ack => ack.userId);
    const now = new Date();
    const deadlineDate = deadline ? (deadline.toDate ? deadline.toDate() : new Date(deadline)) : null;

    const acknowledged = [];
    const pending = [];
    const failed = [];

    notifiedUsers.forEach(user => {
      if (acknowledgedUserIds.includes(user.id)) {
        acknowledged.push(user);
      } else if (deadlineDate && now > deadlineDate) {
        failed.push(user);
      } else {
        pending.push(user);
      }
    });

    return {
      acknowledged,
      pending,
      failed,
      total: notifiedUsers.length,
      acknowledgedCount: acknowledged.length,
      pendingCount: pending.length,
      failedCount: failed.length
    };
  } catch (error) {
    throw error;
  }
};


export const bumpUsersForUpdate = async (updateId, userIds) => {
  try {
    // Get update details
    const updateDoc = await getDoc(doc(db, 'updates', updateId));
    if (!updateDoc.exists()) {
      throw new Error('Update not found');
    }

    const updateData = updateDoc.data();
    const updateTitle = updateData.title;

    // Get acknowledgments for this update
    const acknowledgments = await getUpdateAcknowledgmentStatus(updateId);
    const acknowledgedUserIds = acknowledgments.map(ack => ack.userId);

    // Filter to only bump users who haven't acknowledged
    const usersToBump = userIds.filter(userId => !acknowledgedUserIds.includes(userId));

    if (usersToBump.length === 0) {
      return { success: true, message: 'All selected users have already acknowledged this update', bumpedCount: 0 };
    }

    // Create bump notifications for each user
    const notificationPromises = usersToBump.map(userId =>
      createNotification(
        userId,
        'update_reminder',
        'Update Reminder',
        `Please acknowledge the update "${updateTitle}" if you haven't already.`,
        updateId
      )
    );

    await Promise.all(notificationPromises);

    return { success: true, message: `Reminder sent to ${usersToBump.length} user(s)`, bumpedCount: usersToBump.length };
  } catch (error) {
    logger.error('Error bumping users for update:', error);
    throw error;
  }
};
