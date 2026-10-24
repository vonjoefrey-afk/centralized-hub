import { db } from '../firebase/config';
import { collection, doc, query, getDoc, getDocs, updateDoc, deleteDoc, addDoc, setDoc, where, orderBy, writeBatch, serverTimestamp, runTransaction } from 'firebase/firestore';
import { logger } from '../utils/logger';

export const updateUserRole = async (userId, newRole) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      role: newRole,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};


export const getAllUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};


export const getAllTeamMemberUsers = async (teamId = null) => {
  try {
    let q;
    if (teamId) {
      q = query(
        collection(db, 'users'),
        where('role', '==', 'team_member'),
        where('teamId', '==', teamId)
      );
    } else {
      q = query(
        collection(db, 'users'),
        where('role', '==', 'team_member')
      );
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};


export const getAllTeamLeaderUsers = async () => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'team_leader')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};


export const getAllOperationsManagerUsers = async () => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'om')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};


export const getPendingTeamLeaders = async () => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'team_leader'),
      where('pendingApproval', '==', true),
      where('isApproved', '==', false)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};


export const approveTeamLeader = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isApproved: true,
      pendingApproval: false,
      approvedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    throw error;
  }
};


export const rejectTeamLeader = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isApproved: false,
      pendingApproval: false,
      rejectedAt: serverTimestamp(),
      status: 'rejected' // Add status field to clearly mark as rejected
    });
    return true;
  } catch (error) {
    throw error;
  }
};


export const getUserByEmail = async (email) => {
  try {
    const { or, where } = require('firebase/firestore');
    const q = query(
      collection(db, 'users'),
      or(
        where('email', '==', email),
        where('ssoEmail', '==', email)
      )
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    // Fallback if 'or' is not supported in the current import context or older versions
    try {
      const q1 = query(collection(db, 'users'), where('email', '==', email));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        const doc = snap1.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      
      const q2 = query(collection(db, 'users'), where('ssoEmail', '==', email));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        const doc = snap2.docs[0];
        return { id: doc.id, ...doc.data() };
      }
    } catch (fallbackError) {
      logger.error('getUserByEmail fallback failed:', fallbackError);
    }
    return null;
  }
};


// ---------------------------------------------------------------------------
// Manual "Add User" provisioning. An admin creates an invite keyed by the
// lowercased email; on first Google SSO login the app consumes it (see
// signInWithGoogle) and creates the real user with the assigned role, already
// approved — no pending-approval step. Invites live in `provisioned_users`.
// ---------------------------------------------------------------------------

const DEFAULT_FEATURES = { updates: true, gcpBilling: true, templates: true, notes: true, metrics: true, spiiCases: false, appsScript: false };

export const createProvisionedUser = async (adminUid, { email, displayName, role, teamId = null, features } = {}) => {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('A valid email is required.');
  if (!displayName || !displayName.trim()) throw new Error('Display name is required.');

  // Don't provision someone who already has a real account.
  const existing = await getUserByEmail(normalized);
  if (existing) throw new Error('A user with this email already exists.');

  const ref = doc(db, 'provisioned_users', normalized);
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error('This email was already added and is awaiting first login.');

  await setDoc(ref, {
    email: normalized,
    ssoEmail: normalized,
    displayName: displayName.trim(),
    role: role || 'team_member',
    teamId: teamId || null,
    features: features || DEFAULT_FEATURES,
    createdBy: adminUid || null,
    createdAt: serverTimestamp(),
  });
  return { success: true, id: normalized };
};

export const getProvisionedUsers = async () => {
  const snap = await getDocs(collection(db, 'provisioned_users'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const deleteProvisionedUser = async (email) => {
  const normalized = (email || '').trim().toLowerCase();
  await deleteDoc(doc(db, 'provisioned_users', normalized));
  return { success: true };
};

export const reactivateRejectedUser = async (userId, newPassword, newDisplayName, newRole) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      displayName: newDisplayName,
      role: newRole,
      isApproved: newRole === 'team_member', // Auto-approve team members
      pendingApproval: newRole === 'team_leader', // Team leaders need approval
      status: 'active', // Mark as active
      reactivatedAt: serverTimestamp(),
      // Clear rejection fields
      rejectedAt: null
    });
    return true;
  } catch (error) {
    throw error;
  }
};


export const deleteUserCompletely = async (userId) => {
  try {
    // Get user data first to understand what needs to be cleaned up
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // 1. Delete all acknowledgments by this user
    const acknowledgmentsQuery = query(
      collection(db, 'acknowledgments'),
      where('userId', '==', userId)
    );
    const acknowledgmentsSnapshot = await getDocs(acknowledgmentsQuery);
    const acknowledgmentDeletes = acknowledgmentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(acknowledgmentDeletes);

    // 2. Delete all updates created by this user
    const updatesQuery = query(
      collection(db, 'updates'),
      where('createdBy', '==', userId)
    );
    const updatesSnapshot = await getDocs(updatesQuery);
    const updateDeletes = updatesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(updateDeletes);

    // 3. If user is a team leader, handle team deletion
    if (userData.role === 'team_leader') {
      // Get teams led by this user
      const teamsQuery = query(
        collection(db, 'teams'),
        where('teamLeaderId', '==', userId)
      );
      const teamsSnapshot = await getDocs(teamsQuery);

      // For each team, remove all members and delete the team
      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();

        // Remove teamId from all team members
        const memberUpdates = teamData.members?.map(async (memberId) => {
          if (memberId !== userId) { // Don't update the user we're deleting
            await updateDoc(doc(db, 'users', memberId), {
              teamId: null,
              updatedAt: serverTimestamp()
            });
          }
        }) || [];
        await Promise.all(memberUpdates);

        // Delete the team
        await deleteDoc(teamDoc.ref);
      }
    }

    // 4. If user is a team member, remove from team
    if (userData.teamId) {
      const teamDoc = await getDoc(doc(db, 'teams', userData.teamId));
      if (teamDoc.exists()) {
        const currentMembers = teamDoc.data().members || [];
        const updatedMembers = currentMembers.filter(memberId => memberId !== userId);
        await updateDoc(doc(db, 'teams', userData.teamId), {
          members: updatedMembers,
          updatedAt: serverTimestamp()
        });
      }
    }

    // 5. Delete all migration requests involving this user
    const migrationsQuery = query(
      collection(db, 'migrations'),
      where('userId', '==', userId)
    );
    const migrationsSnapshot = await getDocs(migrationsQuery);
    const migrationDeletes = migrationsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(migrationDeletes);

    // 6. Delete user document from Firestore
    await deleteDoc(doc(db, 'users', userId));

    // 7. Best-effort: delete from Firebase Authentication via Cloud Function.
    //    Wrapped in a 13-second race so a slow/unreachable function never blocks
    //    the caller. Firestore data is already gone by this point.
    const authDeleteTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Auth deletion timed out')), 13000)
    );
    Promise.race([
      import('../firebase/auth').then(({ deleteUserFromAuth }) => deleteUserFromAuth(userId)),
      authDeleteTimeout
    ]).catch(authError => {
      logger.warn('Auth deletion failed or timed out (non-critical):', authError.message);
    });

    return { success: true, message: 'User and all related data deleted successfully.' };
  } catch (error) {
    logger.error('Error deleting user completely:', error);
    throw error;
  }
};


export const updateUserProfile = async (userId, profileData) => {
  try {
    const docRef = doc(db, 'users', userId);
    
    const updates = { 
      ...profileData, 
      updatedAt: serverTimestamp() 
    };

    if (profileData.ssoEmail !== undefined) {
      if (profileData.ssoEmail && profileData.ssoEmail.trim() !== '') {
        updates.ssoMigrated = true;
      } else {
        updates.ssoMigrated = false;
      }
    }

    await updateDoc(docRef, updates);
    return true;
  } catch (error) {
    logger.error('Error updating user profile:', error);
    throw error;
  }
};


export const updateUserFeatures = async (userId, features) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      features,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    logger.error('Error updating user features:', error);
    throw error;
  }
};
