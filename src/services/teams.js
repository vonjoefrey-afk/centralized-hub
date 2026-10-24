import { db } from '../firebase/config';
import { collection, doc, query, getDoc, getDocs, updateDoc, deleteDoc, addDoc, setDoc, where, orderBy, writeBatch, serverTimestamp, runTransaction } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { createNotification } from '../firebase/firestore';

export const createTeam = async (teamName, teamLeaderId, description = '') => {
  try {
    logger.debug('Creating team:', teamName);
    const teamData = {
      name: teamName,
      teamLeaderId,
      description,
      createdAt: serverTimestamp(),
      members: [teamLeaderId]
    };

    const docRef = await addDoc(collection(db, 'teams'), teamData);
    logger.debug('Team created successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    logger.error('Error creating team:', error);
    throw error;
  }
};


export const getTeam = async (teamId) => {
  if (!teamId) return null;
  try {
    // 1. Try real teams collection
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    if (teamDoc.exists()) {
      return { id: teamDoc.id, ...teamDoc.data() };
    }
    
    // 2. Fallback to synthetic team check (where teamId is the leader's UID)
    const userDoc = await getDoc(doc(db, 'users', teamId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.role === 'team_leader' || userData.role === 'admin') {
        const displayName = `Team ${userData.displayName || userData.email || teamId}`;
        return { 
          id: teamId, 
          teamLeaderId: teamId, 
          name: displayName, 
          displayName, 
          _isSynthetic: true 
        };
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error in getTeam:', error);
    return null;
  }
};


export const getTeamsByLeader = async (teamLeaderId) => {
  try {
    logger.debug('Getting teams for leader:', teamLeaderId);
    const q = query(
      collection(db, 'teams'),
      where('teamLeaderId', '==', teamLeaderId)
    );
    const querySnapshot = await getDocs(q);
    const teams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logger.debug('Found teams:', teams.length);
    return teams;
  } catch (error) {
    logger.error('Error getting teams by leader:', error);
    throw error;
  }
};


export const getAllTeams = async () => {
    try {
        // 1. Fetch all teams and all users in parallel
        const [teamsSnap, usersSnap] = await Promise.all([
            getDocs(collection(db, 'teams')),
            getDocs(collection(db, 'users'))
        ]);

        const teamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const userMap = new Map(usersData.map(u => [u.id, u]));

        // 2. Process real teams
        // Ensure the leader is actually a team leader (filter out old/stale team docs)
        const collectionTeams = teamsData
            .filter(team => {
                const leader = team.teamLeaderId ? userMap.get(team.teamLeaderId) : null;
                // Only include if leader is still a team leader or admin
                return leader && (leader.role === 'team_leader' || leader.role === 'admin');
            })
            .map(team => {
                let displayName = team.name?.trim() || '';
                const leader = team.teamLeaderId ? userMap.get(team.teamLeaderId) : null;

                if (!displayName && leader) {
                    displayName = `Team ${leader.displayName || leader.email || team.teamLeaderId}`;
                }
                if (!displayName) displayName = `Team (${team.id.slice(0, 8)})`;

                return { ...team, displayName };
            });

        // 3. Scan users for orphans (users with a teamId that doesn't exist in teams collection)
        const teamIds = new Set(teamsData.map(t => t.id));
        const leadersWithRealTeams = new Set(collectionTeams.map(t => t.teamLeaderId).filter(Boolean));
        const orphanTeamIds = new Set();
        const teamLeaderUsers = [];

        usersData.forEach(user => {
            if (user.role === 'team_leader') {
                teamLeaderUsers.push(user);
            }
            if (user.teamId && !teamIds.has(user.teamId)) {
                orphanTeamIds.add(user.teamId);
            }
        });

        // 4. Create synthetic teams for orphans
        const orphanTeams = Array.from(orphanTeamIds).map(orphanId => {
            const leader = userMap.get(orphanId);
            const displayName = leader ? `Team ${leader.displayName || leader.email || orphanId}` : `Orphan Team (${orphanId.slice(0, 8)})`;
            return { id: orphanId, teamLeaderId: orphanId, displayName, name: displayName, _isOrphan: true };
        });

        // 5. Create synthetic teams for leaders who don't have a team doc yet
        const syntheticTeams = teamLeaderUsers
            .filter(user => !leadersWithRealTeams.has(user.id) && !orphanTeamIds.has(user.id))
            .map(user => {
                const displayName = `Team ${user.displayName || user.email || user.id}`;
                return { id: user.id, teamLeaderId: user.id, displayName, name: displayName, _isSynthetic: true };
            });

        // 6. Final filter to ensure no duplicates and only valid leaders
        const seenLeaderIds = new Set();
        const allTeams = [...collectionTeams, ...syntheticTeams, ...orphanTeams].filter(team => {
            if (!team.teamLeaderId) return true; // Keep teams without IDs for now?
            if (seenLeaderIds.has(team.teamLeaderId)) return false;
            seenLeaderIds.add(team.teamLeaderId);
            return true;
        });

        return allTeams.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        logger.error('Error getting all teams:', error);
        throw error;
    }
};


export const adminMoveUserToTeam = async (userId, newTeamId, oldTeamId) => {
  try {
    // 1. Remove user from old team's members array
    if (oldTeamId && oldTeamId !== newTeamId) {
      const oldTeamDoc = await getDoc(doc(db, 'teams', oldTeamId));
      if (oldTeamDoc.exists()) {
        const currentMembers = oldTeamDoc.data().members || [];
        await updateDoc(doc(db, 'teams', oldTeamId), {
          members: currentMembers.filter(id => id !== userId),
          updatedAt: serverTimestamp()
        });
      }
    }

    // 2. Add user to new team's members array
    if (newTeamId) {
      const newTeamDoc = await getDoc(doc(db, 'teams', newTeamId));
      if (!newTeamDoc.exists()) throw new Error('Target team not found');
      const currentMembers = newTeamDoc.data().members || [];
      if (!currentMembers.includes(userId)) {
        await updateDoc(doc(db, 'teams', newTeamId), {
          members: [...currentMembers, userId],
          updatedAt: serverTimestamp()
        });
      }
    }

    // 3. Update user's teamId
    await updateDoc(doc(db, 'users', userId), {
      teamId: newTeamId || null,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    logger.error('adminMoveUserToTeam error:', error);
    throw error;
  }
};


export const removeUserFromTeam = async (userId) => {
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) throw new Error('User not found');
    
    const { teamId } = userSnap.data();
    
    // 1. Update user document
    await updateDoc(doc(db, 'users', userId), {
      teamId: null,
      updatedAt: serverTimestamp()
    });
    
    // 2. Remove from teams collection members array if exists
    if (teamId) {
      const teamRef = doc(db, 'teams', teamId);
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists()) {
        const currentMembers = teamSnap.data().members || [];
        await updateDoc(teamRef, {
          members: currentMembers.filter(id => id !== userId),
          updatedAt: serverTimestamp()
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error removing user from team:', error);
    throw error;
  }
};


export const addUserToTeam = async (userId, teamId) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      teamId,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};


export const addMemberToTeam = async (teamId, userId, requestingLeaderId) => {
  try {
    // Check if user is already in another team
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists() && userDoc.data().teamId) {
      const existingTeamId = userDoc.data().teamId;
      if (existingTeamId !== teamId) {
        // Get the current team leader (owner) of the member
        const existingTeamDoc = await getDoc(doc(db, 'teams', existingTeamId));
        if (existingTeamDoc.exists()) {
          const currentTeamLeaderId = existingTeamDoc.data().teamLeaderId;
          logger.log('addMemberToTeam: Current team leader ID:', currentTeamLeaderId);
          logger.log('addMemberToTeam: Requesting leader ID:', requestingLeaderId);

          // Get team member's display name
          const userData = userDoc.data();
          const memberDisplayName = userData.displayName || userData.email || 'Unknown User';

          // Get team names for better display
          const fromTeamDoc = await getDoc(doc(db, 'teams', existingTeamId));
          const toTeamDoc = await getDoc(doc(db, 'teams', teamId));
          const fromTeamName = fromTeamDoc.exists() ? fromTeamDoc.data().name : 'Unknown Team';
          const toTeamName = toTeamDoc.exists() ? toTeamDoc.data().name : 'Unknown Team';

          // Get requesting leader's name
          const requestingLeaderDoc = await getDoc(doc(db, 'users', requestingLeaderId));
          const requestingLeaderName = requestingLeaderDoc.exists()
            ? (requestingLeaderDoc.data().displayName || requestingLeaderDoc.data().email || 'Unknown Leader')
            : 'Unknown Leader';

          // Create migration request - goes to the CURRENT team leader (owner)
          const migrationData = {
            userId,
            userDisplayName: memberDisplayName,
            userEmail: userData.email,
            fromTeamId: existingTeamId,
            fromTeamName: fromTeamName,
            toTeamId: teamId,
            toTeamName: toTeamName,
            requestingLeaderId, // The leader who wants to add the member
            requestingLeaderName: requestingLeaderName,
            currentTeamLeaderId, // The current owner who needs to approve
            status: 'pending',
            createdAt: serverTimestamp()
          };
          logger.log('addMemberToTeam: Creating migration with data:', migrationData);
          const migrationRef = await addDoc(collection(db, 'migrations'), migrationData);
          logger.log('addMemberToTeam: Migration created with ID:', migrationRef.id);

          // Create notification for the current team leader
          try {
            await createNotification(
              currentTeamLeaderId,
              'migration_request',
              'Team Member Migration Request',
              `${requestingLeaderName} requested to move ${memberDisplayName}${userData.email ? ` (${userData.email})` : ''} from your team to their team.`,
              null // No updateId for migration requests
            );
            logger.log('addMemberToTeam: Notification created for current team leader');
          } catch (notificationError) {
            logger.error('addMemberToTeam: Error creating notification:', notificationError);
            // Don't fail the migration request if notification fails
          }

          return {
            success: false,
            migrationId: migrationRef.id,
            message: `Migration request sent to current team leader`
          };
        }
      }
    }

    // Add user to team directly
    logger.log('addMemberToTeam: Updating user document with teamId:', teamId);
    await updateDoc(doc(db, 'users', userId), {
      teamId,
      updatedAt: serverTimestamp()
    });
    logger.log('addMemberToTeam: User document updated successfully');

    // Add to team members array
    logger.log('addMemberToTeam: Reading team document:', teamId);
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    if (teamDoc.exists()) {
      const currentMembers = teamDoc.data().members || [];
      logger.log('addMemberToTeam: Current members array:', currentMembers);
      logger.log('addMemberToTeam: Adding userId:', userId);

      if (!currentMembers.includes(userId)) {
        const updatedMembers = [...currentMembers, userId];
        logger.log('addMemberToTeam: Updated members array:', updatedMembers);
        await updateDoc(doc(db, 'teams', teamId), {
          members: updatedMembers,
          updatedAt: serverTimestamp()
        });
        logger.log('addMemberToTeam: Team document updated successfully with new members array');
      } else {
        logger.log('addMemberToTeam: User already in members array');
      }
    } else {
      logger.error('addMemberToTeam: Team document does not exist:', teamId);
      throw new Error('Team document does not exist');
    }

    logger.log('addMemberToTeam: Successfully added member to team');
    return { success: true, message: 'Member added successfully' };
  } catch (error) {
    throw error;
  }
};


export const removeMemberFromTeam = async (teamId, userId) => {
  try {
    // Remove teamId from user document
    await updateDoc(doc(db, 'users', userId), {
      teamId: null,
      updatedAt: serverTimestamp()
    });

    // Remove from team members array
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    if (teamDoc.exists()) {
      const currentMembers = teamDoc.data().members || [];
      const updatedMembers = currentMembers.filter(memberId => memberId !== userId);
      await updateDoc(doc(db, 'teams', teamId), {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
    }

    return { success: true, message: 'Member removed successfully' };
  } catch (error) {
    throw error;
  }
};


export const getTeamMembers = async (teamId) => {
  try {
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    if (!teamDoc.exists()) {
      return [];
    }

    const team = teamDoc.data();
    const memberPromises = team.members?.map(async (memberId) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', memberId));
        if (userDoc.exists()) {
          return { id: userDoc.id, ...userDoc.data() };
        }
        return null;
      } catch (error) {
        // If we can't read a specific user (permission denied), skip it
        logger.warn(`Could not read user ${memberId}:`, error.message);
        return null;
      }
    }) || [];

    const members = await Promise.all(memberPromises);
    return members.filter(member => member !== null);
  } catch (error) {
    throw error;
  }
};


export const getMigrationRequests = async (teamLeaderId) => {
  try {
    logger.log('getMigrationRequests: Looking for migrations for teamLeaderId:', teamLeaderId);
    const q = query(
      collection(db, 'migrations'),
      where('currentTeamLeaderId', '==', teamLeaderId)
    );
    const querySnapshot = await getDocs(q);
    const migrations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logger.log('getMigrationRequests: Found migrations:', migrations);
    // Sort by createdAt in JavaScript instead of Firestore
    return migrations.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt.toDate() - a.createdAt.toDate();
      }
      return 0;
    });
  } catch (error) {
    logger.error('getMigrationRequests: Error:', error);
    throw error;
  }
};


export const approveMigration = async (migrationId) => {
  try {
    logger.log('approveMigration: Starting approval for migration:', migrationId);
    const migrationDoc = await getDoc(doc(db, 'migrations', migrationId));
    if (!migrationDoc.exists()) {
      logger.error('approveMigration: Migration document not found');
      throw new Error('Migration request not found');
    }

    const migration = migrationDoc.data();
    logger.log('approveMigration: Migration data:', migration);

    // Update user's team
    logger.log('approveMigration: Updating user document:', migration.userId, 'to team:', migration.toTeamId);
    try {
      await updateDoc(doc(db, 'users', migration.userId), {
        teamId: migration.toTeamId,
        updatedAt: serverTimestamp()
      });
      logger.log('approveMigration: User document updated successfully');
    } catch (userUpdateError) {
      logger.error('approveMigration: Error updating user document:', userUpdateError);
      logger.error('approveMigration: Error code:', userUpdateError.code);
      logger.error('approveMigration: Error message:', userUpdateError.message);
      throw new Error(`Failed to update user: ${userUpdateError.message}`);
    }

    // Remove from old team
    logger.log('approveMigration: Removing user from old team:', migration.fromTeamId);
    try {
      const oldTeamDoc = await getDoc(doc(db, 'teams', migration.fromTeamId));
      if (oldTeamDoc.exists()) {
        const currentMembers = oldTeamDoc.data().members || [];
        const updatedMembers = currentMembers.filter(memberId => memberId !== migration.userId);
        await updateDoc(doc(db, 'teams', migration.fromTeamId), {
          members: updatedMembers,
          updatedAt: serverTimestamp()
        });
        logger.log('approveMigration: User removed from old team successfully');
      } else {
        logger.warn('approveMigration: Old team document does not exist');
      }
    } catch (oldTeamError) {
      logger.error('approveMigration: Error updating old team:', oldTeamError);
      logger.error('approveMigration: Error code:', oldTeamError.code);
      logger.error('approveMigration: Error message:', oldTeamError.message);
      throw new Error(`Failed to update old team: ${oldTeamError.message}`);
    }

    // Add to new team
    logger.log('approveMigration: Adding user to new team:', migration.toTeamId);
    try {
      const newTeamDoc = await getDoc(doc(db, 'teams', migration.toTeamId));
      if (newTeamDoc.exists()) {
        const currentMembers = newTeamDoc.data().members || [];
        if (!currentMembers.includes(migration.userId)) {
          await updateDoc(doc(db, 'teams', migration.toTeamId), {
            members: [...currentMembers, migration.userId],
            updatedAt: serverTimestamp()
          });
          logger.log('approveMigration: User added to new team successfully');
        } else {
          logger.log('approveMigration: User already in new team');
        }
      } else {
        logger.error('approveMigration: New team document does not exist');
        throw new Error('Destination team not found');
      }
    } catch (newTeamError) {
      logger.error('approveMigration: Error updating new team:', newTeamError);
      logger.error('approveMigration: Error code:', newTeamError.code);
      logger.error('approveMigration: Error message:', newTeamError.message);
      throw new Error(`Failed to update new team: ${newTeamError.message}`);
    }

    // Update migration status
    logger.log('approveMigration: Updating migration status to approved');
    try {
      await updateDoc(doc(db, 'migrations', migrationId), {
        status: 'approved',
        approvedAt: serverTimestamp()
      });
      logger.log('approveMigration: Migration status updated successfully');
    } catch (migrationUpdateError) {
      logger.error('approveMigration: Error updating migration status:', migrationUpdateError);
      logger.error('approveMigration: Error code:', migrationUpdateError.code);
      logger.error('approveMigration: Error message:', migrationUpdateError.message);
      throw new Error(`Failed to update migration status: ${migrationUpdateError.message}`);
    }

    // Create notification for the requesting team leader
    try {
      const userDoc = await getDoc(doc(db, 'users', migration.userId));
      const memberDisplayName = userDoc.exists()
        ? (userDoc.data().displayName || userDoc.data().email || 'Team Member')
        : 'Team Member';

      await createNotification(
        migration.requestingLeaderId,
        'migration_approved',
        'Migration Request Approved',
        `The migration request for ${memberDisplayName} to join your team has been approved.`,
        null // No updateId for migration requests
      );
      logger.log('approveMigration: Notification created for requesting team leader');
    } catch (notificationError) {
      logger.error('approveMigration: Error creating notification:', notificationError);
      // Don't fail the migration if notification fails
    }

    return { success: true, message: 'Migration approved successfully' };
  } catch (error) {
    throw error;
  }
};


export const denyMigration = async (migrationId) => {
  try {
    await updateDoc(doc(db, 'migrations', migrationId), {
      status: 'denied',
      deniedAt: serverTimestamp()
    });

    return { success: true, message: 'Migration denied' };
  } catch (error) {
    throw error;
  }
};
