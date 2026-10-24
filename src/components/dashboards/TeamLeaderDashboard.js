import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../services/activity';
import { signOutUser } from '../../firebase/auth';
import { getNotificationsByUser, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, checkApproachingDeadlines } from '../../firebase/firestore';
import { createTeam, getTeamsByLeader, getTeamMembers, addMemberToTeam, removeMemberFromTeam, getMigrationRequests, approveMigration, denyMigration } from '../../services/teams';
import { getAllUsers, getAllTeamMemberUsers } from '../../services/users';
import { createUpdate, getUpdatesByTeam, getPendingAcknowledgmentMembers, getAcknowledgedMembers, acknowledgeUpdate, getUserAcknowledgment, getUpdateAcknowledgmentBreakdown, deleteUpdate, updateUpdate } from '../../services/updates';
import { onSnapshot, query, collection, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import MetricAnalyticsTab from './MetricAnalyticsTab';
import { logger } from '../../utils/logger';
import AcknowledgmentModal from '../AcknowledgmentModal';
import UserMenu from './UserMenu';
import DashboardShell from './DashboardShell';
import ChangePasswordModal from '../ChangePasswordModal';
import SpiiVisualDashboardTab from './SpiiVisualDashboardTab';
import CaseTrackerTab from './CaseTrackerTab';
import { Button, Card, Badge, Modal, Skeleton, CardSkeleton, EmptyState, Alert, Input, DateTimePicker, PremiumSelect } from '../ui';
import TLTeamMembersTab from './TLDashboard/TLTeamMembersTab';
import TLUpdatesTab from './TLDashboard/TLUpdatesTab';
import TLAcknowledgmentsTab from './TLDashboard/TLAcknowledgmentsTab';
import TLMigrationsTab from './TLDashboard/TLMigrationsTab';
import CreateUpdateModal from './CreateUpdateModal';
import { showSuccess, showError } from '../../utils/toast';
import { useNotifications } from '../../hooks/useNotifications';

const TeamLeaderDashboard = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [migrationRequests, setMigrationRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('team-members');
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [acknowledgments, setAcknowledgments] = useState({});
  const [statusBreakdown, setStatusBreakdown] = useState({});
  const [showStatusModal, setShowStatusModal] = useState({ isOpen: false, type: '', update: null, members: [] });
  const [showDeleteUpdateModal, setShowDeleteUpdateModal] = useState({ isOpen: false, update: null });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const isDeletingRef = useRef(false);

  const DEFAULT_FEATURES = {
    updates: true,
    gcpBilling: false,
    templates: true,
    notes: true,
    metrics: true,
    spiiCases: true,
    caseTracker: true
  };

  const features = useMemo(() => {
    if (!user?.features) return DEFAULT_FEATURES;
    return { ...DEFAULT_FEATURES, ...user.features };
  }, [user?.features]);

  // Form states
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  // Debug showCreateTeam state changes
  useEffect(() => {
    logger.log('showCreateTeam state changed to:', showCreateTeam);
  }, [showCreateTeam]);

  // Debug teams state changes
  useEffect(() => {
    logger.log('Teams state changed to:', teams);
    logger.log('Teams length:', teams.length);
  }, [teams]);

  const [showCreateUpdate, setShowCreateUpdate] = useState(false);
  const [updateToEdit, setUpdateToEdit] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', description: '', selectedMembers: [] });
  const [updateForm, setUpdateForm] = useState({ title: '', content: '', deadline: '' });
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');
  const [showAcknowledgmentModal, setShowAcknowledgmentModal] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  // Notifications logic via custom hook
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    loadNotifications
  } = useNotifications(user);

  // Close notification dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotificationDropdown &&
        !event.target.closest('.notification-dropdown') &&
        !event.target.closest('[data-notification-bell]')) {
        setShowNotificationDropdown(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showNotificationDropdown) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotificationDropdown]);

  // Close notification dropdown when clicking outside or pressing Escape

  // Check for approaching deadlines periodically (handled by useNotifications hook)

  useEffect(() => {
    loadData();
  }, [features.modifiedBreaks]);

  // Real-time listener for updates
  useEffect(() => {
    if (teams.length === 0) {
      logger.log('TeamLeaderDashboard: No teams available yet, skipping updates listener');
      setUpdates([]);
      return;
    }

    const teamId = teams[0].id;
    if (!teamId) {
      logger.log('TeamLeaderDashboard: No team ID available, skipping updates listener');
      setUpdates([]);
      return;
    }

    logger.log('TeamLeaderDashboard: Setting up real-time listener for team:', teamId);

    // Start with query without orderBy (doesn't require composite index)
    // This ensures it works even if the index doesn't exist
    const updatesQuery = query(
      collection(db, 'updates'),
      where('teamId', '==', teamId)
    );

    const unsubscribe = onSnapshot(updatesQuery, async (snapshot) => {
      logger.log('TeamLeaderDashboard: Updates snapshot received, size:', snapshot.size);
      logger.log('TeamLeaderDashboard: Snapshot has pending writes:', snapshot.metadata.hasPendingWrites);

      const updatesData = snapshot.docs.map(doc => {
        const data = doc.data();
        logger.log('TeamLeaderDashboard: Update document:', doc.id, {
          title: data.title,
          teamId: data.teamId,
          createdAt: data.createdAt,
          deadline: data.deadline
        });
        return { id: doc.id, ...data };
      });

      // Sort in JavaScript (newest first)
      updatesData.sort((a, b) => {
        // Use current time as fallback for pending server timestamps to ensure instant visibility at top
        const aTime = a.createdAt?.toDate?.() || new Date();
        const bTime = b.createdAt?.toDate?.() || new Date();
        return bTime - aTime;
      });

      logger.log('TeamLeaderDashboard: Setting updates state with', updatesData.length, 'updates');
      setUpdates(updatesData);

      // Load acknowledgment status and status breakdown for each update
      const ackStatus = {};
      const statusBreakdownData = {};

      for (const update of updatesData) {
        try {
          const userAck = await getUserAcknowledgment(update.id, user.uid);
          ackStatus[update.id] = userAck;

          // Load status breakdown for each update
          if (update.deadline) {
            const members = await getTeamMembers(teamId);
            const breakdown = await getUpdateAcknowledgmentBreakdown(update.id, members, update.deadline);
            statusBreakdownData[update.id] = breakdown;
          }
        } catch (error) {
          logger.error('Error loading acknowledgment data for update:', update.id, error);
        }
      }

      setAcknowledgments(ackStatus);
      setStatusBreakdown(statusBreakdownData);
    }, (error) => {
      logger.error('TeamLeaderDashboard: Error in updates listener:', error);
      logger.error('TeamLeaderDashboard: Error code:', error.code);
      logger.error('TeamLeaderDashboard: Error message:', error.message);

      // Show error for permission or connection issues
      if (error.code === 'permission-denied') {
        showError('Permission denied: Cannot read updates. Please check your permissions.');
      } else {
      }
    });

    return () => {
      logger.log('TeamLeaderDashboard: Cleaning up updates listener');
      unsubscribe();
    };
  }, [teams, user.uid]);

  // Real-time listener for acknowledgments to update status breakdown in real-time
  useEffect(() => {
    if (teams.length === 0 || updates.length === 0) {
      return;
    }

    const teamId = teams[0].id;
    if (!teamId) return;

    logger.log('TeamLeaderDashboard: Setting up real-time listener for acknowledgments, teamId:', teamId);

    // Get all update IDs for this team
    const updateIds = updates.map(update => update.id);
    if (updateIds.length === 0) return;

    // Create a query for acknowledgments for all updates in this team
    // Note: Firestore doesn't support 'in' queries with more than 10 items, so we'll need to batch them
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < updateIds.length; i += batchSize) {
      batches.push(updateIds.slice(i, i + batchSize));
    }

    const unsubscribes = batches.map(batch => {
      const acknowledgmentsQuery = query(
        collection(db, 'acknowledgments'),
        where('updateId', 'in', batch)
      );

      return onSnapshot(acknowledgmentsQuery, async (snapshot) => {
        logger.log('TeamLeaderDashboard: Acknowledgments snapshot received, size:', snapshot.size);
        logger.log('TeamLeaderDashboard: Changed acknowledgments:', snapshot.docChanges().map(change => ({
          type: change.type,
          updateId: change.doc.data().updateId,
          userId: change.doc.data().userId
        })));

        // Reload status breakdown for all updates when acknowledgments change
        const statusBreakdownData = {};
        const ackStatus = {};

        for (const update of updates) {
          try {
            // Reload user acknowledgment status
            const userAck = await getUserAcknowledgment(update.id, user.uid);
            ackStatus[update.id] = userAck;

            // Reload status breakdown if update has deadline
            if (update.deadline) {
              const members = await getTeamMembers(teamId);
              const breakdown = await getUpdateAcknowledgmentBreakdown(update.id, members, update.deadline);
              statusBreakdownData[update.id] = breakdown;
            }
          } catch (error) {
            logger.error('Error reloading acknowledgment data for update:', update.id, error);
          }
        }

        logger.log('TeamLeaderDashboard: Updating acknowledgment status and breakdown in real-time');
        setAcknowledgments(prev => ({ ...prev, ...ackStatus }));
        setStatusBreakdown(prev => ({ ...prev, ...statusBreakdownData }));
      }, (error) => {
        logger.error('TeamLeaderDashboard: Error in acknowledgments listener:', error);
        logger.error('TeamLeaderDashboard: Error code:', error.code);
        logger.error('TeamLeaderDashboard: Error message:', error.message);
        // Don't show error to user, just log it
      });
    });

    return () => {
      logger.log('TeamLeaderDashboard: Cleaning up acknowledgments listeners');
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [teams, updates, user.uid]);

  // Real-time listener for team document (to update members list automatically)
  useEffect(() => {
    if (teams.length === 0) return;

    const teamId = teams[0].id;
    if (!teamId) return;

    logger.log('Setting up real-time listener for team document:', teamId);

    const teamDocRef = doc(db, 'teams', teamId);
    const unsubscribe = onSnapshot(teamDocRef, async (teamSnapshot) => {
      if (teamSnapshot.exists()) {
        logger.log('Real-time listener: Team document updated');
        const teamData = teamSnapshot.data();
        const memberIds = teamData.members || [];
        logger.log('Real-time listener: Member IDs from team document:', memberIds);

        // Load member details
        const memberPromises = memberIds.map(async (memberId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', memberId));
            if (userDoc.exists()) {
              const userData = { id: userDoc.id, ...userDoc.data() };
              logger.log('Real-time listener: Loaded member:', userData.displayName || userData.email);
              return userData;
            }
            logger.warn('Real-time listener: User document does not exist:', memberId);
            return null;
          } catch (error) {
            logger.error(`Real-time listener: Could not read user ${memberId}:`, error);
            return null;
          }
        });

        const members = await Promise.all(memberPromises);
        const validMembers = members.filter(member => member !== null);
        logger.log('Real-time listener: Final team members count:', validMembers.length);
        logger.log('Real-time listener: Team members:', validMembers.map(m => m.displayName || m.email));
        setTeamMembers(validMembers);
      } else {
        logger.warn('Real-time listener: Team document does not exist');
      }
    }, (error) => {
      logger.error('Real-time listener: Error in team document listener:', error);
      showError('Failed to load team members in real-time: ' + error.message);
    });

    return () => {
      logger.log('Cleaning up team document listener');
      unsubscribe();
    };
  }, [teams]);

  useEffect(() => {
    if (teams.length > 0) {
      loadTeamData();
    }
  }, [teams]);

  // Real-time listener for migration requests (for current team leader - incoming requests)
  useEffect(() => {
    if (!user?.uid) return;

    logger.log('TeamLeaderDashboard: Setting up real-time migration listener for user:', user.uid);

    const migrationQuery = query(
      collection(db, 'migrations'),
      where('currentTeamLeaderId', '==', user.uid)
    );

    const unsubscribeMigrations = onSnapshot(
      migrationQuery,
      (snapshot) => {
        logger.log('TeamLeaderDashboard: Migration snapshot received, count:', snapshot.docs.length);
        const migrations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort by createdAt in JavaScript
        const sortedMigrations = migrations.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.toDate() - a.createdAt.toDate();
          }
          return 0;
        });

        setMigrationRequests(sortedMigrations);
        logger.log('TeamLeaderDashboard: Migration requests updated:', sortedMigrations);
      },
      (error) => {
        logger.error('TeamLeaderDashboard: Error in migration listener:', error);
        // Fallback to manual load on error
        getMigrationRequests(user.uid).then(migrations => {
          setMigrationRequests(migrations);
        }).catch(err => {
          logger.error('TeamLeaderDashboard: Error loading migrations:', err);
        });
      }
    );

    return () => {
      logger.log('TeamLeaderDashboard: Cleaning up migration listener');
      unsubscribeMigrations();
    };
  }, [user?.uid]);

  // Real-time listener for approved migrations (for requesting team leader - outgoing requests)
  // This shows when a migration request has been approved
  useEffect(() => {
    if (!user?.uid) return;

    logger.log('TeamLeaderDashboard: Setting up real-time listener for approved migrations (requesting leader):', user.uid);

    const approvedMigrationQuery = query(
      collection(db, 'migrations'),
      where('requestingLeaderId', '==', user.uid),
      where('status', '==', 'approved')
    );

    const unsubscribeApprovedMigrations = onSnapshot(
      approvedMigrationQuery,
      (snapshot) => {
        logger.log('TeamLeaderDashboard: Approved migration snapshot received, count:', snapshot.docs.length);
        // When a migration is approved, the team members list will update automatically
        // via the team document listener, so we don't need to do anything here
        // This listener just ensures we're aware of the approval
        snapshot.docs.forEach(doc => {
          const migration = doc.data();
          logger.log('TeamLeaderDashboard: Migration approved:', migration.userDisplayName, 'to team:', migration.toTeamName);
        });
      },
      (error) => {
        logger.error('TeamLeaderDashboard: Error in approved migration listener:', error);
      }
    );

    return () => {
      logger.log('TeamLeaderDashboard: Cleaning up approved migration listener');
      unsubscribeApprovedMigrations();
    };
  }, [user?.uid]);

  const loadData = async () => {
    try {
      setLoading(true);
      logger.log('Loading data for user:', user.uid, 'Role:', user.role);

      if (!user) {
        showError('No user found. Please sign in again.');
        return;
      }

      if (user.role !== 'team_leader') {
        showError(`Access denied. Current role: ${user.role}. Only team leaders can access this dashboard.`);
        return;
      }

      logger.log('User has team_leader role, proceeding to load data...');

      // Load teams and users separately to identify which one fails
      let teamsData = [];
      let usersData = [];

      try {
        logger.log('Loading teams...');
        teamsData = await getTeamsByLeader(user.uid);
        logger.log('Teams loaded successfully:', teamsData);
      } catch (teamsError) {
        logger.error('Error loading teams:', teamsError);
        showError(`Failed to load teams: ${teamsError.message}`);
        return;
      }

      try {
        logger.log('Loading users...');
        usersData = await getAllTeamMemberUsers(user.teamId);
        logger.log('Users loaded successfully:', usersData);
      } catch (usersError) {
        logger.error('Error loading users:', usersError);
        showError(`Failed to load users: ${usersError.message}`);
        return;
      }

      setTeams(teamsData);
      setAllUsers(usersData); // Team members only

      // Load notifications
      await loadNotifications();

      logger.log('Setting teams state to:', teamsData);
      logger.log('Teams length:', teamsData.length);

      // If no team exists for this team leader, create one automatically
      if (teamsData.length === 0) {
        logger.log('No team found for team leader, creating one automatically...');
        try {
          const teamName = `Team ${user.displayName || user.email}`;
          logger.log('Attempting to create team with:', { teamName, teamLeaderId: user.uid, userRole: user.role });
          const teamId = await createTeam(teamName, user.uid, `Team led by ${user.displayName || user.email}`);
          logger.log('Auto-created team with ID:', teamId);

          // Reload data to get the newly created team
          const newTeamsData = await getTeamsByLeader(user.uid);
          logger.log('Reloaded teams after creation:', newTeamsData);
          setTeams(newTeamsData);
          if (newTeamsData.length > 0) {
            setSelectedTeam(newTeamsData[0]);
          }
        } catch (createError) {
          logger.error('Error auto-creating team:', createError);
          // Only show error if it's not a permission issue that might resolve itself
          if (createError.code === 'permission-denied') {
            showError(`Failed to create team: Missing or insufficient permissions. Please ensure your account is properly set up as a team leader.`);
          } else {
            showError(`Failed to create team: ${createError.message}`);
          }
        }
      } else {
        logger.log('Found existing teams:', teamsData);
        setTeams(teamsData);
        if (teamsData.length > 0 && !selectedTeam) {
          logger.log('Setting selected team to:', teamsData[0]);
          setSelectedTeam(teamsData[0]);
        }
      }
    } catch (err) {
      logger.error('Error loading data:', err);
      showError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamData = async () => {
    const teamId = teams.length > 0 ? teams[0].id : null;
    if (!teamId) return;

    try {
      logger.log('loadTeamData: Loading data for teamId:', teamId, 'user.uid:', user.uid);

      // Load members and migrations separately to identify which one fails
      let members = [];
      let migrations = [];

      try {
        members = await getTeamMembers(teamId);
        logger.log('loadTeamData: Loaded members:', members);
      } catch (membersError) {
        logger.error('loadTeamData: Error loading members:', membersError);
        // Don't set error here, just log it - members might be empty
      }

      try {
        migrations = await getMigrationRequests(user.uid);
        logger.log('loadTeamData: Loaded migrations:', migrations);
      } catch (migrationsError) {
        logger.error('loadTeamData: Error loading migrations:', migrationsError);
        // Don't set error here, just log it - migrations might be empty
      }

      setTeamMembers(members);
      setMigrationRequests(migrations);

      // Note: Updates are now handled by real-time listener
    } catch (err) {
      logger.error('loadTeamData: Unexpected error:', err);
      // Only set error if it's a critical failure
      if (err.message && !err.message.includes('permission')) {
        showError('Failed to load team data: ' + err.message);
      }
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    logger.log('Modifying team members with data:', teamForm);
    try {
      // Check if team leader already has a team, if not create one
      let teamId = teams.length > 0 ? teams[0].id : null;

      if (!teamId) {
        // Create team for this team leader
        const teamName = `Team ${user.displayName || user.email}`;
        teamId = await createTeam(teamName, user.uid, `Team led by ${user.displayName || user.email}`);
        logger.log('Team created for team leader with ID:', teamId);
      }

      // Add selected members to the team
      if (teamForm.selectedMembers.length > 0) {
        logger.log('Adding selected members to team:', teamForm.selectedMembers);
        for (const memberId of teamForm.selectedMembers) {
          try {
            await addMemberToTeam(teamId, memberId, user.uid);
            logger.log(`Added member ${memberId} to team ${teamId}`);
          } catch (memberError) {
            logger.error(`Failed to add member ${memberId}:`, memberError);
            // Continue adding other members even if one fails
          }
        }
      }

      // Reset form and close modal
      setTeamForm({ name: '', description: '', selectedMembers: [] });
      setShowCreateTeam(false);

      // Force reload data properly (awaiting loadData instead of setTimeout)
      try {
        await loadData();
        showSuccess('Team members updated successfully');
      } catch (reloadError) {
        logger.error('Error reloading data:', reloadError);
        showError('Team members updated but failed to reload UI data');
      }

    } catch (err) {
      logger.error('Error modifying team:', err);
      showError(`Failed to modify team: ${err.message}`);
    }
  };

  const handleEditUpdate = (update) => {
    setUpdateToEdit({
      id: update.id,
      title: update.title,
      content: update.content,
      deadline: update.deadline?.toDate ? update.deadline.toDate().toISOString().slice(0, 16) : update.deadline || '',
      excludedUserIds: update.excludedUserIds || []
    });
    setShowCreateUpdate(true);
  };

  const handleSubmitUpdate = async (formData) => {
    try {
      if (formData.id) {
        // EDIT MODE
        await updateUpdate(formData.id, formData.title, formData.content, formData.deadline);
        showSuccess('Update updated successfully');
        setShowCreateUpdate(false);
        setUpdateToEdit(null);
        return;
      }

      // CREATE MODE
      const teamId = teams.length > 0 ? teams[0].id : null;
      if (!teamId) {
        showError('No team found. Please refresh the page.');
        return;
      }

      logger.log('handleSubmitUpdate: Creating update for team:', teamId);
      
      showSuccess('Update created and released to team members');

      createUpdate(teamId, formData.title, formData.content, user.uid, formData.deadline)
        .then(updateId => {
          logger.log('handleSubmitUpdate: Update created successfully with ID:', updateId);
          logActivity(user, { eventType: 'update_created', action: 'Created an update', targetId: updateId, detail: formData.title });
        })
        .catch(err => {
          logger.error('handleSubmitUpdate: Error creating update:', err);
          showError(`Failed to create update: ${err.message || 'Unknown error'}`);
        });

      setShowCreateUpdate(false);
      setUpdateToEdit(null);
    } catch (err) {
      logger.error('handleSubmitUpdate: Error:', err);
      showError(`Failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const teamId = teams.length > 0 ? teams[0].id : null;
      if (!teamId) {
        showError('No team found. Please refresh the page.');
        return;
      }

      logger.log('handleAddMember: Calling addMemberToTeam with:', { teamId, userId: selectedMemberToAdd, requestingLeaderId: user.uid });
      const result = await addMemberToTeam(teamId, selectedMemberToAdd, user.uid);
      logger.log('handleAddMember: Result from addMemberToTeam:', result);

      if (result.success) {
        showSuccess(result.message);
        // Wait a bit for the real-time listener to fire, then also manually reload as fallback
        setTimeout(async () => {
          logger.log('handleAddMember: Manually reloading team data as fallback');
          await loadTeamData();
        }, 500);
        // Reload available members list
        await loadData(); // Reload to refresh available members list
      } else {
        showSuccess(`Migration request sent to current team leader. Request ID: ${result.migrationId}`);
        // Still reload to refresh migration requests
        await loadTeamData();
      }

      setShowAddMember(false);
      setSelectedMemberToAdd('');
    } catch (err) {
      showError('Failed to add member');
      logger.error(err);
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      const teamId = teams.length > 0 ? teams[0].id : null;
      if (!teamId) {
        showError('No team found. Please refresh the page.');
        return;
      }

      await removeMemberFromTeam(teamId, memberId);
      await loadTeamData();
      showSuccess('Member removed successfully');
    } catch (err) {
      showError('Failed to remove member');
      logger.error(err);
    }
  };

  const handleApproveMigration = async (migrationId) => {
    try {
      logger.log('handleApproveMigration: Approving migration:', migrationId);
      await approveMigration(migrationId);
      // Migration requests are now updated in real-time, but reload team data to refresh members
      await loadTeamData();
      showSuccess('Migration approved successfully');
    } catch (err) {
      logger.error('handleApproveMigration: Error approving migration:', err);
      logger.error('handleApproveMigration: Error details:', {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      showError(`Failed to approve migration: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDenyMigration = async (migrationId) => {
    try {
      await denyMigration(migrationId);
      await loadTeamData();
      showSuccess('Migration denied');
    } catch (err) {
      showError('Failed to deny migration');
      logger.error(err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      logger.error(err);
    }
  };

  const handleRefresh = async () => {
    try {
      await loadData();
      showSuccess('Data refreshed successfully');
    } catch (err) {
      logger.error('Error refreshing data:', err);
      showError(`Failed to refresh data: ${err.message || 'Unknown error'}`);
    }
  };

  const handleStatusClick = (updateId, statusType) => {
    const breakdown = statusBreakdown[updateId];
    if (!breakdown) return;

    let members = [];
    switch (statusType) {
      case 'acknowledged':
        members = breakdown.acknowledged;
        break;
      case 'pending':
        members = breakdown.pending;
        break;
      case 'failed':
        members = breakdown.failed;
        break;
      default:
        return;
    }

    setShowStatusModal({
      isOpen: true,
      type: statusType,
      update: updates.find(u => u.id === updateId),
      members: members
    });
  };

  const closeStatusModal = () => {
    setShowStatusModal({ isOpen: false, type: '', update: null, members: [] });
  };

  const handleDeleteUpdate = (update) => {
    setShowDeleteUpdateModal({ isOpen: true, update: update });
  };

  const confirmDeleteUpdate = async (e) => {
    // Prevent default and stop propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Prevent multiple simultaneous deletions
    if (isDeletingRef.current) {
      logger.log('confirmDeleteUpdate: Already deleting, ignoring duplicate call');
      return;
    }

    if (!showDeleteUpdateModal.update) {
      logger.log('confirmDeleteUpdate: No update to delete');
      return;
    }

    // Set deleting flag immediately
    isDeletingRef.current = true;

    // Store update info before closing modal to prevent loop
    const updateToDelete = showDeleteUpdateModal.update;

    // Close modal immediately to prevent loop
    setShowDeleteUpdateModal({ isOpen: false, update: null });

    try {
      setLoading(true);

      logger.log('confirmDeleteUpdate: Deleting update:', updateToDelete.id);
      await deleteUpdate(updateToDelete.id);
      logger.log('confirmDeleteUpdate: Update deleted successfully');
      showSuccess(`Update "${updateToDelete.title}" deleted successfully`);

      showSuccess(`Update "${updateToDelete.title}" deleted successfully`);

      // Notifications will be automatically updated via real-time listener
      // Note: Updates will be automatically updated via real-time listener
    } catch (err) {
      logger.error('confirmDeleteUpdate: Error deleting update:', err);
      showError(`Failed to delete update: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      // Reset deleting flag after a short delay to ensure state has updated
      setTimeout(() => {
        isDeletingRef.current = false;
      }, 500);
    }
  };

  const cancelDeleteUpdate = () => {
    setShowDeleteUpdateModal({ isOpen: false, update: null });
  };

  const handleAcknowledge = async (updateId, comment = '') => {
    try {
      await acknowledgeUpdate(updateId, user.uid, comment);
      logActivity(user, { eventType: 'update_acknowledged', action: 'Acknowledged an update', targetId: updateId });
      setAcknowledgments(prev => ({
        ...prev,
        [updateId]: { acknowledgedAt: new Date() }
      }));
      showSuccess('Update acknowledged successfully');
    } catch (err) {
      showError('Failed to acknowledge update');
      logger.error(err);
    }
  };

  const isAcknowledged = (updateId) => !!acknowledgments[updateId];

  // Notification functions
  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    setShowNotificationDropdown(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      logger.error('Failed to mark all as read:', err);
    }
  };

  const handleDeleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      await removeNotification(id);
    } catch (err) {
      showError('Failed to delete notification');
    }
  };

  // Function to render content with clickable links
  const renderContentWithLinks = (content) => {
    if (!content) return content;

    // URL regex pattern to match http/https URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return content.split(urlRegex).map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const getAvailableMembers = () => {
    logger.log('getAvailableMembers called:');
    logger.log('- allUsers:', allUsers);
    logger.log('- teamMembers:', teamMembers);
    const currentMemberIds = teamMembers.map(member => member.id);
    logger.log('- currentMemberIds:', currentMemberIds);
    const available = allUsers.filter(user => !currentMemberIds.includes(user.id));
    logger.log('- available members:', available);
    return available;
  };

  const handleMemberSelection = (memberId, isSelected) => {
    setTeamForm(prev => ({
      ...prev,
      selectedMembers: isSelected
        ? [...prev.selectedMembers, memberId]
        : prev.selectedMembers.filter(id => id !== memberId)
    }));
  };

  const isMemberSelected = (memberId) => {
    return teamForm.selectedMembers.includes(memberId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#050505] p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center">
            <div className="space-y-4">
              <Skeleton width="w-72" height="h-10" />
              <Skeleton width="w-56" height="h-5" />
            </div>
            <Skeleton variant="circular" width="w-14" height="h-14" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CardSkeleton count={3} />
          </div>

          {/* Tabs Skeleton */}
          <div className="flex space-x-6 border-b border-gray-200">
            <Skeleton width="w-36" height="h-10" />
            <Skeleton width="w-36" height="h-10" />
            <Skeleton width="w-36" height="h-10" />
          </div>

          {/* Table/List Skeleton */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <Skeleton width="w-full" height="h-12" />
            <Skeleton width="w-full" height="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (teams.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome, Team Leader!</h2>
          <p className="text-gray-600 mb-4">You are the team leader. Start by adding team members to your team.</p>

          {/* Error and Success Messages */}


          <Button
            onClick={() => {
              logger.log('Modify team members button clicked, setting showCreateTeam to true');
              setShowCreateTeam(true);
            }}
            variant="primary"
          >
            Modify Team Members
          </Button>
          <Button
            onClick={() => setShowChangePasswordModal(true)}
            variant="primary"
            className="ml-4"
          >
            Change Password
          </Button>
          <Button
            onClick={handleSignOut}
            variant="danger"
            className="ml-4"
          >
            Sign Out
          </Button>
        </div>

        {/* Modify Team Members Modal */}
        {showCreateTeam && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4">
            <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-5 border w-full sm:w-96 max-w-md shadow-lg rounded-md bg-white my-4 max-h-[90vh] overflow-y-auto">
              <div className="mt-3">
                {logger.log('Rendering modify team members modal')}
                <h3 className="text-lg font-medium text-gray-900 mb-4">Modify Team Members</h3>
                <p className="text-sm text-gray-600 mb-4">Team: {user.displayName || user.email}</p>
                <form onSubmit={handleCreateTeam}>
                  {/* Team Members Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Team Members
                    </label>
                    <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                      {allUsers.length === 0 ? (
                        <p className="text-gray-500 text-sm">No team members available</p>
                      ) : (
                        allUsers.map(member => (
                          <label key={member.id} className="flex items-center space-x-2 py-1">
                            <input
                              type="checkbox"
                              checked={isMemberSelected(member.id)}
                              onChange={(e) => handleMemberSelection(member.id, e.target.checked)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700">
                              {member.displayName || member.email} ({member.email})
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    {teamForm.selectedMembers.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {teamForm.selectedMembers.length} member(s) selected
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      onClick={() => setShowCreateTeam(false)}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                    >
                      Update Team Members
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const leaderSections = [
    { id: 'team-members', label: 'Team Members' },
    { id: 'updates', label: 'Updates' },
    { id: 'acknowledgments', label: 'My Acknowledgments' },
    { id: 'migrations', label: 'Migration Requests' },
    ...(features.gcpBilling ? [{ id: 'gcp-billing', label: 'GCP Billing' }] : []),
    ...(features.notes ? [{ id: 'notes', label: 'Notes' }] : []),
    ...(features.spiiCases ? [{ id: 'spii-dashboard', label: 'SPII Analytics' }] : []),
    ...(features.caseTracker ? [{ id: 'case-tracker', label: 'Case Tracker' }] : []),
    ...(features.metrics ? [{ id: 'metric-analytics', label: 'Metric Analytics' }] : []),
  ];

  return (
    <>
    <DashboardShell
      user={user}
      sections={leaderSections}
      activeId={activeTab}
      onNavigate={setActiveTab}
      onSignOut={handleSignOut}
      onChangePassword={() => setShowChangePasswordModal(true)}
      onRefresh={handleRefresh}
      topRight={(
        <>
              {/* Notification Bell */}
              <div className="relative">
                <button
                  data-notification-bell
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className="relative p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-full"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <div className="notification-dropdown absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${!notification.isRead ? 'bg-blue-50 border-l-4 border-l-primary-500' : ''
                              }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center mb-1">
                                  <h4 className="text-sm font-medium text-gray-900">{notification.title}</h4>
                                  {!notification.isRead && (
                                    <div className="ml-2 w-2 h-2 bg-primary-500 rounded-full"></div>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                                <p className="text-xs text-gray-400">
                                  {notification.createdAt?.toDate?.()?.toLocaleString() || 'Unknown time'}
                                </p>
                              </div>
                              <button
                                onClick={(e) => handleDeleteNotification(notification.id, e)}
                                className="ml-2 text-gray-400 hover:text-red-500 p-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
          </>
        )}
      >
        <>
          <div>
            {/* Navigation moved to the drawer */}
            <div className="hidden">
              <nav className="-mb-px flex space-x-8 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('team-members')}
                  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'team-members'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                    }`}
                >
                  Team Members
                </button>
                <button
                  onClick={() => setActiveTab('updates')}
                  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'updates'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                    }`}
                >
                  Updates
                </button>
                <button
                  onClick={() => setActiveTab('acknowledgments')}
                  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'acknowledgments'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                    }`}
                >
                  My Acknowledgments ({updates.filter(update => !isAcknowledged(update.id)).length})
                </button>
                <button
                  onClick={() => setActiveTab('migrations')}
                  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'migrations'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                    }`}
                >
                  Migration Requests ({migrationRequests.filter(m => m.status === 'pending').length})
                </button>

                {/* Dynamic Features Tabs */}
                {features.gcpBilling && (
                  <button
                    onClick={() => setActiveTab('gcp-billing')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'gcp-billing'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    GCP Billing
                  </button>
                )}
                {features.notes && (
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'notes'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Notes
                  </button>
                )}
                {features.spiiCases && (
                  <button
                    onClick={() => setActiveTab('spii-dashboard')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'spii-dashboard'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    SPII Analytics
                  </button>
                )}
                {features.caseTracker && (
                  <button
                    onClick={() => setActiveTab('case-tracker')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'case-tracker'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Case Tracker
                  </button>
                )}
                {features.metrics && (
                  <button
                    onClick={() => setActiveTab('metric-analytics')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'metric-analytics'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Metric Analytics
                  </button>
                )}
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'team-members' && (
              <TLTeamMembersTab 
                user={user} 
                teamMembers={teamMembers} 
                setShowAddMember={setShowAddMember} 
                handleRemoveMember={handleRemoveMember} 
              />
            )}

            {activeTab === 'updates' && (
              <TLUpdatesTab 
                user={user} 
                updates={updates} 
                statusBreakdown={statusBreakdown} 
                setShowCreateUpdate={setShowCreateUpdate} 
                handleEditUpdate={handleEditUpdate} 
                handleDeleteUpdate={handleDeleteUpdate} 
                handleStatusClick={handleStatusClick} 
                setSelectedUpdate={setSelectedUpdate} 
                setShowAcknowledgmentModal={setShowAcknowledgmentModal} 
              />
            )}

            {activeTab === 'acknowledgments' && (
              <TLAcknowledgmentsTab 
                user={user} 
                updates={updates} 
                acknowledgments={acknowledgments} 
                handleAcknowledge={handleAcknowledge} 
                handleEditUpdate={handleEditUpdate} 
                handleDeleteUpdate={handleDeleteUpdate} 
                isAcknowledged={isAcknowledged} 
              />
            )}

            {activeTab === 'migrations' && (
              <TLMigrationsTab 
                migrationRequests={migrationRequests} 
                handleApproveMigration={handleApproveMigration} 
                handleDenyMigration={handleDenyMigration} 
              />
            )}

            {activeTab === 'spii-dashboard' && features.spiiCases && (
              <SpiiVisualDashboardTab currentUser={user} />
            )}

            {activeTab === 'case-tracker' && features.caseTracker && (
              <CaseTrackerTab />
            )}

            {activeTab === 'metric-analytics' && features.metrics && (
              <MetricAnalyticsTab />
            )}
          </div>

          {/* Modals */}
          <CreateUpdateModal
            isOpen={showCreateUpdate}
            onClose={() => {
              setShowCreateUpdate(false);
              setUpdateToEdit(null);
            }}
            onSubmit={handleSubmitUpdate}
            initialData={updateToEdit || undefined}
            currentUser={user}
          />

          {/* Add Member Modal */}
          {showAddMember && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4">
              <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-5 border w-full sm:w-96 max-w-md shadow-lg rounded-md bg-white my-4 max-h-[90vh] overflow-y-auto">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add Team Member</h3>
                  <form onSubmit={handleAddMember}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Team Member
                      </label>
                      <PremiumSelect
                        value={selectedMemberToAdd}
                        onChange={(val) => setSelectedMemberToAdd(val)}
                        options={getAvailableMembers().map((member) => ({
                          value: member.id,
                          label: `${member.displayName} (${member.email})`
                        }))}
                        placeholder="Choose a team member..."
                        className="w-full"
                        required
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <Button
                        type="button"
                        onClick={() => setShowAddMember(false)}
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                      >
                        Add Member
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Acknowledgment Modal */}
          <AcknowledgmentModal
            update={selectedUpdate}
            teamMembers={teamMembers}
            isOpen={showAcknowledgmentModal}
            onClose={() => {
              setShowAcknowledgmentModal(false);
              setSelectedUpdate(null);
            }}
          />

          {/* Status Modal */}
          {showStatusModal.isOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-4 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {showStatusModal.type.charAt(0).toUpperCase() + showStatusModal.type.slice(1)} Members
                    </h3>
                    <button
                      onClick={closeStatusModal}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Update: {showStatusModal.update?.title}
                  </p>
                </div>

                {/* Modal Body */}
                <div className="px-6 py-4 max-h-96 overflow-y-auto">
                  {showStatusModal.members.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        {showStatusModal.type === 'acknowledged' && (
                          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {showStatusModal.type === 'pending' && (
                          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {showStatusModal.type === 'failed' && (
                          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        )}
                      </div>
                      <p className="text-gray-500">
                        {showStatusModal.type === 'acknowledged' && 'No members have acknowledged this update yet.'}
                        {showStatusModal.type === 'pending' && 'No members are currently pending acknowledgment.'}
                        {showStatusModal.type === 'failed' && 'No members have failed to acknowledge this update.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {showStatusModal.members.map((member) => (
                        <div key={member.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {member.displayName?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {member.displayName || 'Unknown User'}
                            </p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${showStatusModal.type === 'acknowledged' ? 'bg-green-100 text-green-800' :
                              showStatusModal.type === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                              {showStatusModal.type.charAt(0).toUpperCase() + showStatusModal.type.slice(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex justify-end">
                    <button
                      onClick={closeStatusModal}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add Member Modal */}
          {showAddMember && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4">
              <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-5 border w-full sm:w-96 max-w-md shadow-lg rounded-md bg-white my-4 max-h-[90vh] overflow-y-auto">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add Team Member</h3>
                  <form onSubmit={handleAddMember}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Team Member
                      </label>
                      <PremiumSelect
                        value={selectedMemberToAdd}
                        onChange={(val) => setSelectedMemberToAdd(val)}
                        options={getAvailableMembers().length === 0 ? [] : getAvailableMembers().map(member => ({
                          value: member.id,
                          label: member.displayName || member.email
                        }))}
                        placeholder={getAvailableMembers().length === 0 ? "No available team members" : "Select a team member"}
                        className="w-full"
                        required
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Available members: {getAvailableMembers().length} | All users: {allUsers.length} | Current members: {teamMembers.length}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                      <Button
                        type="button"
                        onClick={() => setShowAddMember(false)}
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                      >
                        Add Member
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Acknowledgment Modal */}
          <AcknowledgmentModal
            update={selectedUpdate}
            teamMembers={teamMembers}
            isOpen={showAcknowledgmentModal}
            onClose={() => {
              setShowAcknowledgmentModal(false);
              setSelectedUpdate(null);
            }}
          />

          {/* Delete Update Confirmation Modal */}
          {showDeleteUpdateModal.isOpen && !isDeletingRef.current && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={(e) => {
              if (e.target === e.currentTarget) {
                cancelDeleteUpdate();
              }
            }}>
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 my-4 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-center p-6 border-b border-gray-200">
                  <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 text-center mb-4">
                    Delete Update
                  </h3>

                  <div className="text-center mb-6">
                    <p className="text-gray-600 mb-3">
                      Are you sure you want to delete{' '}
                      <span className="font-semibold text-gray-900">
                        "{showDeleteUpdateModal.update?.title}"
                      </span>?
                    </p>

                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-800 font-medium">
                        ⚠️ This action cannot be undone
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        All acknowledgments and related data for this update will be permanently deleted.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end space-x-3 px-6 py-4 bg-gray-50 rounded-b-lg">
                  <button
                    onClick={cancelDeleteUpdate}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      confirmDeleteUpdate(e);
                    }}
                    disabled={loading || isDeletingRef.current}
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {loading || isDeletingRef.current ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </span>
                    ) : (
                      'Delete Update'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>

      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </DashboardShell>
    </>
  );
};

export default TeamLeaderDashboard;