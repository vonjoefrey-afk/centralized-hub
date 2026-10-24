import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signIn, signUp, signOutUser, onAuthStateChange, resetUserPassword, deleteUserFromAuth, updateAuthEmail } from '../../firebase/auth';
import { getAllTeams, addUserToTeam, getTeam, adminMoveUserToTeam } from '../../services/teams';
import { getAllUsers, updateUserRole, getPendingTeamLeaders, approveTeamLeader, rejectTeamLeader, deleteUserCompletely, updateUserFeatures, updateUserProfile, createProvisionedUser, getProvisionedUsers, deleteProvisionedUser } from '../../services/users';
import { getUpdateAcknowledgmentBreakdown, deleteUpdates } from '../../services/updates';
import { USER_ROLES } from '../../firebase/auth';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import UserMenu from './UserMenu';
import ChangePasswordModal from '../ChangePasswordModal';
import { Button, Card, Badge, Modal, Skeleton, CardSkeleton, EmptyState, Alert, PremiumSelect, ConfirmModal } from '../ui';
import { showSuccess, showError } from '../../utils/toast';
import { logger } from '../../utils/logger';
import SpiiVisualDashboardTab from './SpiiVisualDashboardTab';
import MetricAnalyticsTab from './MetricAnalyticsTab';
import { UserGroupIcon, ShieldCheckIcon, UsersIcon, UserIcon, BriefcaseIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowsRightLeftIcon, TableCellsIcon, PencilSquareIcon, BellIcon, ChevronRightIcon, FunnelIcon, XMarkIcon, UserPlusIcon, ClockIcon, TrashIcon as TrashIconOutline } from '@heroicons/react/24/outline';
import AcknowledgmentModal from '../AcknowledgmentModal';
import UpdateCard from './UpdateCard';
import SpiiAuditLogsTab from './SpiiAuditLogsTab';
import FeedbackTab from './FeedbackTab';
import UtilizationMonitorTab from './UtilizationMonitorTab';
import DashboardShell from './DashboardShell';
import Pagination from '../common/Pagination';
import { logActivity } from '../../services/activity';
import { getAppsScriptApps, saveAppsScriptApps, newAppId, testAppsScriptConnection, isValidExecUrl } from '../../services/appsScriptService';

// Labels for the User-Management drill-down filters the stat cards trigger.
const USER_FILTER_LABELS = {
  all: 'All Users',
  admin: 'Admins',
  team_leader: 'Team Leaders',
  team_member: 'Team Members',
  assigned: 'Assigned to a Team',
};

/**
 * StatCard — a clickable admin metric tile that drills into User Management
 * filtered to that subset. Module-level so it isn't remounted every render.
 */
const StatCard = ({ icon: Icon, label, value, gradient, glow, active, onClick, title }) => (
  <Card
    hover
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    title={title}
    className={`cursor-pointer bg-white/90 dark:bg-[#111111]/80 backdrop-blur-xl border shadow-xl dark:shadow-black/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 rounded-[2rem] overflow-hidden relative group p-1 ${
      active ? 'border-indigo-400/70 dark:border-indigo-400/50 ring-2 ring-indigo-500/40' : 'border-gray-200/50 dark:border-white/10'
    }`}
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${glow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
    <div className="relative flex items-center p-3">
      <div className={`flex-shrink-0 p-3.5 bg-gradient-to-br ${gradient} shadow-lg rounded-2xl transform group-hover:scale-105 transition-transform duration-300`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="ml-4 min-w-0">
        {/* Fixed-height label area keeps the value aligned across all cards,
            whether the label fits on one line or wraps to two. */}
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 leading-tight h-7 flex items-end">{label}</p>
        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none mt-1">{value}</p>
      </div>
      <ChevronRightIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto self-center opacity-0 group-hover:opacity-100 transition-opacity flex-none" />
    </div>
  </Card>
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [pendingTeamLeaders, setPendingTeamLeaders] = useState([]);
  const [teamNames, setTeamNames] = useState({}); // Cache team names by teamId
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const USERS_PER_PAGE = 10;
  const [usersPage, setUsersPage] = useState(1);
  // User-Management drill-down filter, driven by the stat cards.
  const [userFilter, setUserFilter] = useState('all');
  // Manual "Add User" provisioning.
  const [provisionedUsers, setProvisionedUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ displayName: '', email: '', role: USER_ROLES.TEAM_MEMBER, teamId: '' });
  const [addUserLoading, setAddUserLoading] = useState(false);
  // Apps Script Web App integration settings.
  const [appsScriptApps, setAppsScriptApps] = useState([]); // [{id,name,url,transport}]
  const [appsScriptSaving, setAppsScriptSaving] = useState(false);
  const [appsScriptTests, setAppsScriptTests] = useState({}); // id -> { ok, msg }
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, user: null });
  const [passwordResetModal, setPasswordResetModal] = useState({ isOpen: false, user: null, tempPassword: null, loading: false, passwordResetInAuth: false });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [featuresModal, setFeaturesModal] = useState({ isOpen: false, user: null, loading: false });
  const [changeTeamModal, setChangeTeamModal] = useState({ isOpen: false, user: null, selectedTeamId: '', loading: false });
  const [editProfileModal, setEditProfileModal] = useState({ isOpen: false, user: null, displayName: '', ssoEmail: '', isCoAdmin: false, loading: false });
  const [allTeams, setAllTeams] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState({});
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [showAcknowledgmentModal, setShowAcknowledgmentModal] = useState(false);
  // Updates cleanup: multi-select + bulk delete
  const [selectedUpdateIds, setSelectedUpdateIds] = useState(() => new Set());
  const [updateDeleteModal, setUpdateDeleteModal] = useState({ isOpen: false, mode: null, target: null }); // mode: 'single' | 'selected' | 'all'
  const [deletingUpdates, setDeletingUpdates] = useState(false);

  const ALL_FEATURES = [
    { id: 'updates',           label: 'Updates (View)' },
    { id: 'canCreateUpdates',  label: 'Create & Send Updates' },
    { id: 'gcpBilling',        label: 'GCP Billing Calculation' },
    { id: 'templates',         label: 'Templates' },
    { id: 'notes',             label: 'Notes' },
    { id: 'metric-analytics',  label: 'Metric Analytics' },
    { id: 'caseTracker',       label: 'Case Tracker' },
    { id: 'spiiCases',         label: 'SPII Cases & Analytics' },
    { id: 'spiiAudit',         label: 'SPII Audit Logs' },
    { id: 'appsScript',        label: 'Apps Script Integration' },
  ];

  const DEFAULT_FEATURES = {
    updates: true,
    canCreateUpdates: false,
    gcpBilling: true,
    templates: true,
    notes: true,
    'metric-analytics': true,
    caseTracker: true,
    spiiCases: false,
    spiiAudit: true, // Default enabled for admins to see initially
    appsScript: false, // Off by default — admin enables per user
  };

  const loadProvisioned = () => {
    getProvisionedUsers().then(setProvisionedUsers).catch(err => logger.error('Failed to load provisioned users:', err));
  };

  useEffect(() => {
    loadPendingTeamLeaders();
    // Load all teams for the Change Team dropdown
    getAllTeams().then(setAllTeams).catch(err => logger.error('Failed to load teams:', err));
    loadProvisioned();
    getAppsScriptApps({ force: true }).then((a) => setAppsScriptApps(a || [])).catch((err) => logger.error('Failed to load Apps Scripts:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateAppField = (id, field, value) => {
    setAppsScriptApps((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
    setAppsScriptTests((prev) => ({ ...prev, [id]: undefined }));
  };
  const addAppsScript = () => {
    setAppsScriptApps((prev) => [...prev, { id: newAppId(), name: '', url: '', transport: 'direct' }]);
  };
  const removeAppsScript = (id) => {
    setAppsScriptApps((prev) => prev.filter((a) => a.id !== id));
  };
  const handleSaveAppsScriptApps = async () => {
    setAppsScriptSaving(true);
    try {
      await saveAppsScriptApps(appsScriptApps);
      logActivity(user, { eventType: 'settings_updated', action: `Saved Apps Script integrations (${appsScriptApps.length})`, tab: 'settings' });
      showSuccess('Apps Scripts saved.');
    } catch (err) {
      logger.error('Failed to save Apps Scripts:', err);
      showError(err.message || 'Could not save');
    } finally {
      setAppsScriptSaving(false);
    }
  };
  const handleTestApp = async (app) => {
    setAppsScriptTests((prev) => ({ ...prev, [app.id]: { ok: null, msg: 'Testing…' } }));
    const result = await testAppsScriptConnection(app);
    setAppsScriptTests((prev) => ({
      ...prev,
      [app.id]: result.ok ? { ok: true, msg: `Reachable (HTTP ${result.status}).` } : { ok: false, msg: result.error || `Failed (HTTP ${result.status || '—'}).` },
    }));
  };

  const handleAddUser = async () => {
    setAddUserLoading(true);
    try {
      await createProvisionedUser(user.uid, {
        email: addUserForm.email,
        displayName: addUserForm.displayName,
        role: addUserForm.role,
        teamId: addUserForm.role === USER_ROLES.TEAM_MEMBER ? (addUserForm.teamId || null) : null,
      });
      logActivity(user, { eventType: 'user_provisioned', action: `Manually added ${addUserForm.email} as ${addUserForm.role}`, targetId: addUserForm.email.trim().toLowerCase() });
      showSuccess(`${addUserForm.displayName} added. They’ll sign in automatically as ${addUserForm.role.replace(/_/g, ' ')} — no approval needed.`);
      setShowAddUserModal(false);
      setAddUserForm({ displayName: '', email: '', role: USER_ROLES.TEAM_MEMBER, teamId: '' });
      loadProvisioned();
    } catch (err) {
      logger.error('Failed to add user:', err);
      showError(err.message || 'Could not add user');
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleRevokeProvisioned = async (email) => {
    try {
      await deleteProvisionedUser(email);
      showSuccess('Invite revoked.');
      loadProvisioned();
    } catch (err) {
      logger.error('Failed to revoke invite:', err);
      showError('Could not revoke invite');
    }
  };

  // Load team names for users with teamId
  const loadTeamNames = async (usersData) => {
    try {
      const teamIds = [...new Set(usersData.filter(u => u.teamId).map(u => u.teamId))];
      const teamNamesMap = { ...teamNames };

      for (const teamId of teamIds) {
        if (!teamNamesMap[teamId] && teamId) {
          try {
            const team = await getTeam(teamId);
            if (team) {
              teamNamesMap[teamId] = team.name || teamId;
            }
          } catch (error) {
            // Silently handle permission errors - just use teamId as fallback
            logger.warn(`Could not load team ${teamId}:`, error.message);
            teamNamesMap[teamId] = teamId; // Fallback to teamId if can't load
          }
        }
      }

      setTeamNames(teamNamesMap);
    } catch (error) {
      // Don't show error for team name loading - it's not critical
      logger.warn('Error loading team names:', error);
    }
  };

  // Set up real-time listeners for users and pending team leaders
  useEffect(() => {
    logger.debug('AdminDashboard: Setting up real-time listeners');

    // Single real-time listener for all users — pending approvals are derived
    // from the same snapshot (previously a second, redundant listener on the
    // same collection, which doubled the read cost).
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQuery, async (snapshot) => {
      logger.debug('AdminDashboard: Users snapshot received, count:', snapshot.docs.length);
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      setPendingTeamLeaders(usersData.filter(u =>
        [USER_ROLES.TEAM_LEADER, USER_ROLES.TRAINER].includes(u.role) &&
        u.pendingApproval === true &&
        u.isApproved === false
      ));
      setLoading(false); // Data arrived — clear any loading indicator
      // Load team names for users with teamId
      await loadTeamNames(usersData);
    }, (error) => {
      logger.error('AdminDashboard: Error in users listener:', error);
      // Fallback to manual refresh on error
      loadUsers();
      loadPendingTeamLeaders();
    });

    // Real-time listener for ALL updates (Admin view)
    const updatesQuery = query(collection(db, 'updates'), orderBy('createdAt', 'desc'));
    const unsubscribeUpdates = onSnapshot(updatesQuery, (snapshot) => {
      const updatesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUpdates(updatesData);

      // Load acknowledgment breakdowns for all updates
      const fetchBreakdowns = async () => {
        const newBreakdown = { ...statusBreakdown };
        for (const update of updatesData) {
          try {
            // For admin, we use all users as the potential pool
            const breakdown = await getUpdateAcknowledgmentBreakdown(update.id, users, update.deadline);
            newBreakdown[update.id] = breakdown;
          } catch (err) {
            logger.error(`Failed to load breakdown for update ${update.id}:`, err);
          }
        }
        setStatusBreakdown(newBreakdown);
      };

      if (users.length > 0) {
        fetchBreakdowns();
      }
    }, (error) => {
      logger.error('AdminDashboard: Error in updates listener:', error);
    });

    return () => {
      logger.debug('AdminDashboard: Cleaning up real-time listeners');
      unsubscribeUsers();
      unsubscribeUpdates();
    };
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await getAllUsers();
      setUsers(usersData);
      // Load team names for users with teamId (non-blocking)
      loadTeamNames(usersData).catch(err => {
        logger.warn('AdminDashboard: Error loading team names:', err);
      });
    } catch (err) {
      showError('Failed to load users: ' + (err.message || 'Unknown error'));
      logger.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingTeamLeaders = async () => {
    try {
      const pendingData = await getPendingTeamLeaders();
      setPendingTeamLeaders(pendingData);
    } catch (err) {
      logger.error('Failed to load pending team leaders:', err);
    }
  };

  const handleRoleChange = async (userId, newRole, currentUser) => {
    try {
      // Don't allow changing your own role
      if (userId === user.uid) {
        showError('You cannot change your own role');
        return;
      }

      await updateUserRole(userId, newRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showSuccess(`Successfully updated ${currentUser.displayName}'s role to ${newRole.replace('_', ' ')}`);
    } catch (err) {
      showError('Failed to update user role');
      logger.error(err);
    }
  };

  const handleRefresh = async () => {
    try {
      await Promise.all([
        loadUsers(),
        loadPendingTeamLeaders()
      ]);
      showSuccess('Data refreshed successfully');
    } catch (err) {
      logger.error('Error refreshing data:', err);
      showError('Failed to refresh data: ' + (err.message || 'Unknown error'));
    }
  };

  const handleApproveTeamLeader = async (userId) => {
    try {
      await approveTeamLeader(userId);
      showSuccess('Team leader approved successfully');
      loadPendingTeamLeaders();
      loadUsers();
    } catch (err) {
      showError('Failed to approve team leader');
      logger.error(err);
    }
  };

  const handleRejectTeamLeader = async (userId) => {
    try {
      await rejectTeamLeader(userId);
      showSuccess('Team leader rejected');
      loadPendingTeamLeaders();
      loadUsers();
    } catch (err) {
      showError('Failed to reject team leader');
      logger.error(err);
    }
  };

  const handleOpenChangeTeamModal = async (targetUser) => {
    // Always refresh team list when opening modal
    try {
      const teams = await getAllTeams();
      setAllTeams(teams);
    } catch (err) {
      logger.error('Failed to refresh teams:', err);
    }
    setChangeTeamModal({
      isOpen: true,
      user: targetUser,
      selectedTeamId: targetUser.teamId || '',
      loading: false
    });
  };

  const handleConfirmChangeTeam = async () => {
    const { user: targetUser, selectedTeamId } = changeTeamModal;
    if (!targetUser) return;

    setChangeTeamModal(prev => ({ ...prev, loading: true }));
    try {
      const newTeamId = selectedTeamId || null;
      await adminMoveUserToTeam(targetUser.id, newTeamId, targetUser.teamId || null);

      const teamName = newTeamId
        ? (allTeams.find(t => t.id === newTeamId)?.name || newTeamId)
        : 'no team';
      showSuccess(`${targetUser.displayName || targetUser.email} moved to ${teamName}`);
      setChangeTeamModal({ isOpen: false, user: null, selectedTeamId: '', loading: false });
    } catch (err) {
      showError('Failed to change team: ' + (err.message || 'Unknown error'));
      logger.error('Change team error:', err);
      setChangeTeamModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteUser = (userToDelete) => {
    setDeleteModal({ isOpen: true, user: userToDelete });
  };

  const confirmDeleteUser = async () => {
    if (!deleteModal.user) return;

    const userToDelete = deleteModal.user;

    // Close modal immediately
    setDeleteModal({ isOpen: false, user: null });

    try {
      setLoading(true);

      // Don't allow deleting yourself
      if (userToDelete.id === user.uid) {
        showError('You cannot delete your own account');
        return;
      }

      await deleteUserCompletely(userToDelete.id);
      showSuccess(`User ${userToDelete.displayName || userToDelete.email} deleted successfully`);
    } catch (err) {
      showError('Failed to delete user: ' + (err.message || 'Unknown error'));
      logger.error('Delete user error:', err);
    } finally {
      // Always clear loading — real-time listeners will update the user list
      setLoading(false);
    }
  };

  const cancelDeleteUser = () => {
    setDeleteModal({ isOpen: false, user: null });
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      logger.error(err);
    }
  };

  const handleResetPassword = async (userToReset) => {
    setPasswordResetModal({ isOpen: true, user: userToReset, tempPassword: null, loading: true, passwordResetInAuth: false });

    try {
      const result = await resetUserPassword(userToReset.id);

      setPasswordResetModal({
        isOpen: true,
        user: userToReset,
        tempPassword: result.temporaryPassword,
        loading: false,
        passwordResetInAuth: result.passwordResetInAuth || false
      });

      showSuccess(`Password reset successful for ${result.userName || result.userEmail}`);
    } catch (err) {
      showError('Failed to reset password: ' + (err.message || 'Unknown error'));
      setPasswordResetModal({ isOpen: false, user: null, tempPassword: null, loading: false, passwordResetInAuth: false });
      logger.error(err);
    }
  };

  const handleToggleFeature = async (userId, featureId, currentFeatures, userData) => {
    try {
      const updatedFeatures = {
        ...(currentFeatures || DEFAULT_FEATURES),
        [featureId]: !(currentFeatures || DEFAULT_FEATURES)[featureId]
      };

      await updateUserFeatures(userId, updatedFeatures);

      // Update local state is handled by real-time listener, 
      // but we need to update the featuresModal.user if it's the one being edited
      if (featuresModal.user?.id === userId) {
        setFeaturesModal(prev => ({
          ...prev,
          user: { ...prev.user, features: updatedFeatures }
        }));
      }

      showSuccess(`Updated features for ${userData.displayName || userData.email}`);
    } catch (err) {
      showError('Failed to update features');
      logger.error(err);
    }
  };

  // Toggle a single Apps Script's access for a user (per-script allow-list).
  const handleToggleAppScriptId = async (userId, appId, currentFeatures, userData) => {
    try {
      const base = currentFeatures || DEFAULT_FEATURES;
      const allIds = appsScriptApps.map((a) => a.id);
      const current = Array.isArray(base.appsScriptIds) ? base.appsScriptIds : allIds; // undefined = all
      const next = current.includes(appId) ? current.filter((id) => id !== appId) : [...current, appId];
      const updatedFeatures = { ...base, appsScriptIds: next };
      await updateUserFeatures(userId, updatedFeatures);
      if (featuresModal.user?.id === userId) {
        setFeaturesModal((prev) => ({ ...prev, user: { ...prev.user, features: updatedFeatures } }));
      }
    } catch (err) {
      showError('Failed to update Apps Script access');
      logger.error(err);
    }
  };

  const handleOpenFeaturesModal = (user) => {
    setFeaturesModal({ isOpen: true, user, loading: false });
  };

  const handleOpenEditProfileModal = (user) => {
    setEditProfileModal({
      isOpen: true,
      user,
      displayName: user.displayName || '',
      email: user.email || '',
      ssoEmail: user.ssoEmail || '',
      isCoAdmin: user.isCoAdmin || false,
      loading: false
    });
  };

  const handleEditProfileSubmit = async (e) => {
    e.preventDefault();
    setEditProfileModal(prev => ({ ...prev, loading: true }));
    try {
      const { user: targetUser, displayName, email, ssoEmail, isCoAdmin } = editProfileModal;
      
      // 1. Update Firestore profile first
      await updateUserProfile(targetUser.id, {
        displayName,
        email,
        ssoEmail,
        isCoAdmin
      });

      // 2. If email or ssoEmail is @google.com and has changed, sync to Auth
      const needsAuthSync = (email !== targetUser.email) || (ssoEmail !== targetUser.ssoEmail);
      const targetAuthEmail = ssoEmail || email;

      if (needsAuthSync && targetAuthEmail && targetAuthEmail.endsWith('@google.com')) {
        try {
          await updateAuthEmail(targetUser.id, targetAuthEmail);
          logger.info(`Successfully synced ${targetAuthEmail} into Firebase Auth for migration.`);
        } catch (authError) {
          logger.warn("Auth sync failed. Email might already be bound or service is unavailable.", authError);
          showError(`Profile saved, but Auth sync failed: ${authError.message}`);
        }
      }

      showSuccess(`Profile for ${displayName} updated successfully`);
      setEditProfileModal(prev => ({ ...prev, isOpen: false, loading: false }));
    } catch (error) {
      showError('Failed to update profile: ' + (error.message || 'Unknown error'));
      setEditProfileModal(prev => ({ ...prev, loading: false }));
    }
  };

  const closePasswordResetModal = () => {
    setPasswordResetModal({ isOpen: false, user: null, tempPassword: null, loading: false, passwordResetInAuth: false });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('Password copied to clipboard!');
    }).catch((err) => {
      showError('Failed to copy password');
      logger.error('Failed to copy:', err);
    });
  };

  // ---- Updates cleanup handlers ----
  const toggleUpdateSelect = (id) => {
    setSelectedUpdateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allUpdatesSelected = updates.length > 0 && selectedUpdateIds.size === updates.length;

  const toggleSelectAllUpdates = () => {
    setSelectedUpdateIds(prev => (prev.size === updates.length ? new Set() : new Set(updates.map(u => u.id))));
  };

  const openDeleteUpdates = (mode, target = null) => setUpdateDeleteModal({ isOpen: true, mode, target });
  const closeDeleteUpdates = () => { if (!deletingUpdates) setUpdateDeleteModal({ isOpen: false, mode: null, target: null }); };

  const confirmDeleteUpdates = async () => {
    const { mode, target } = updateDeleteModal;
    let ids = [];
    if (mode === 'single' && target) ids = [target.id];
    else if (mode === 'selected') ids = Array.from(selectedUpdateIds);
    else if (mode === 'all') ids = updates.map(u => u.id);
    if (ids.length === 0) { closeDeleteUpdates(); return; }

    setDeletingUpdates(true);
    try {
      const res = await deleteUpdates(ids);
      logActivity(user, {
        eventType: 'update_deleted',
        action: mode === 'all' ? 'Deleted all updates' : mode === 'selected' ? 'Deleted selected updates' : 'Deleted an update',
        detail: `${res.success} removed`,
        targetId: mode === 'single' ? target?.id : null,
      });
      if (res.failed > 0) {
        showError(`Deleted ${res.success} of ${res.total} updates — ${res.failed} failed`);
      } else {
        showSuccess(`Deleted ${res.success} update${res.success === 1 ? '' : 's'}`);
      }
      setSelectedUpdateIds(new Set());
    } catch (err) {
      showError('Failed to delete updates: ' + (err.message || 'Unknown error'));
      logger.error('Bulk delete updates error:', err);
    } finally {
      setDeletingUpdates(false);
      setUpdateDeleteModal({ isOpen: false, mode: null, target: null });
    }
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case USER_ROLES.ADMIN:        return 'error';
      case USER_ROLES.TRAINER:      return 'primary';
      case USER_ROLES.TEAM_LEADER:  return 'info';
      case USER_ROLES.TEAM_MEMBER:  return 'success';
      default:                      return 'gray';
    }
  };

  // Calculate user statistics
  const getUserStats = () => {
    const totalUsers = users.length;
    const admins = users.filter(u => u.role === USER_ROLES.ADMIN).length;
    const teamLeaders = users.filter(u => u.role === USER_ROLES.TEAM_LEADER).length;
    const teamMembers = users.filter(u => u.role === USER_ROLES.TEAM_MEMBER).length;
    const usersWithTeams = users.filter(u => u.teamId).length;

    // Team leaders count as teams (1 team leader = 1 team)
    const totalTeams = teamLeaders;

    return { totalUsers, admins, teamLeaders, teamMembers, usersWithTeams, totalTeams };
  };

  const stats = getUserStats();

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#050505]">
        <div className="max-w-[98%] mx-auto py-6 sm:px-6 lg:px-8">
          <Skeleton lines={3} className="mb-6" />
          <CardSkeleton count={5} />
        </div>
      </div>
    );
  }

  const ADMIN_SECTIONS = [
    { id: 'users', label: 'User Management', group: 'People' },
    { id: 'pending', label: 'Pending Approvals', group: 'People', badge: pendingTeamLeaders.length > 0 ? pendingTeamLeaders.length : null },
    { id: 'spii-analytics', label: 'SPII Analytics', group: 'SPII & Compliance' },
    { id: 'spii-audit', label: 'SPII Audit Logs', group: 'SPII & Compliance' },
    { id: 'utilization', label: 'App Utilization', group: 'Insights' },
    { id: 'metric-analytics', label: 'Metric Analytics', group: 'Insights' },
    { id: 'analytics', label: 'Analytics', group: 'Insights' },
    { id: 'updates', label: 'Updates', group: 'Communication', badge: updates.length > 0 ? updates.length : null },
    { id: 'feedback', label: 'User Feedback', group: 'Communication' },
    { id: 'settings', label: 'System Settings', group: 'System' },
  ];

  // Apply the active stat-card drill-down filter to the roster.
  const filteredUsers = users.filter((u) => {
    switch (userFilter) {
      case 'admin': return u.role === USER_ROLES.ADMIN;
      case 'team_leader': return u.role === USER_ROLES.TEAM_LEADER;
      case 'team_member': return u.role === USER_ROLES.TEAM_MEMBER;
      case 'assigned': return !!u.teamId;
      default: return true;
    }
  });

  // User Management pagination (clamp the page if the filtered set shrinks).
  const usersPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const usersPageSafe = Math.min(usersPage, usersPageCount);
  const pagedUsers = filteredUsers.slice((usersPageSafe - 1) * USERS_PER_PAGE, usersPageSafe * USERS_PER_PAGE);

  // Stat-card click → open User Management filtered to that subset.
  const goToUsers = (filter) => {
    setUserFilter(filter);
    setUsersPage(1);
    setActiveTab('users');
    logActivity(user, { eventType: 'tab_view', action: `Opened User Management — ${USER_FILTER_LABELS[filter]}`, tab: 'users' });
  };

  return (
    <>
      <DashboardShell
        user={user}
        sections={ADMIN_SECTIONS}
        activeId={activeTab}
        onNavigate={setActiveTab}
        onSignOut={handleSignOut}
        onChangePassword={() => setShowChangePasswordModal(true)}
        onRefresh={handleRefresh}
      >
        {/* Statistics Cards — click to drill into User Management, filtered */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
          <StatCard icon={UserGroupIcon} label="Total Users" value={stats.totalUsers}
            gradient="from-indigo-500 to-cyan-500 shadow-indigo-500/20"
            glow="from-indigo-50/50 to-purple-50/50 dark:from-indigo-500/10 dark:to-purple-500/10"
            active={activeTab === 'users' && userFilter === 'all'} onClick={() => goToUsers('all')} title="View all users" />
          <StatCard icon={ShieldCheckIcon} label="Admins" value={stats.admins}
            gradient="from-rose-500 to-red-600 shadow-rose-500/20"
            glow="from-rose-50/50 to-red-50/50 dark:from-rose-500/10 dark:to-red-500/10"
            active={activeTab === 'users' && userFilter === 'admin'} onClick={() => goToUsers('admin')} title="View admins" />
          <StatCard icon={BriefcaseIcon} label="Teams" value={stats.totalTeams}
            gradient="from-blue-500 to-cyan-600 shadow-blue-500/20"
            glow="from-blue-50/50 to-cyan-50/50 dark:from-blue-500/10 dark:to-cyan-500/10"
            active={activeTab === 'users' && userFilter === 'team_leader'} onClick={() => goToUsers('team_leader')} title="View team leaders (one per team)" />
          <StatCard icon={UserIcon} label="Members" value={stats.teamMembers}
            gradient="from-emerald-500 to-teal-600 shadow-emerald-500/20"
            glow="from-emerald-50/50 to-teal-50/50 dark:from-emerald-500/10 dark:to-teal-500/10"
            active={activeTab === 'users' && userFilter === 'team_member'} onClick={() => goToUsers('team_member')} title="View team members" />
          <StatCard icon={UsersIcon} label="Assigned" value={stats.usersWithTeams}
            gradient="from-amber-500 to-orange-600 shadow-amber-500/20"
            glow="from-amber-50/50 to-orange-50/50 dark:from-amber-500/10 dark:to-orange-500/10"
            active={activeTab === 'users' && userFilter === 'assigned'} onClick={() => goToUsers('assigned')} title="View users assigned to a team" />
        </div>

        {/* Tab Content */}
        {activeTab === 'users' && (
          <div className="relative group/users">
            <div className="absolute inset-x-0 -top-10 -bottom-10 bg-gradient-to-br from-indigo-500/10 via-cyan-500/5 to-transparent blur-3xl opacity-50 pointer-events-none rounded-[3rem] transition-opacity duration-500 group-hover/users:opacity-100"></div>
            
            <div className="relative bg-white/60 dark:bg-[#111111]/80 shadow-2xl overflow-hidden rounded-[2.5rem] border border-gray-200/50 dark:border-white/5 backdrop-blur-xl">
              <div className="px-6 py-6 sm:px-8 border-b border-gray-200/50 dark:border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent dark:from-white/[0.02] dark:to-transparent pointer-events-none"></div>
                <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                      User Management
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500 dark:text-gray-400">
                      Manage user roles and permissions. All new users will appear here automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="group inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-2xl gradient-accent text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-[1.04] active:scale-[0.98] transition-all ring-1 ring-white/20"
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-white/20"><UserPlusIcon className="w-3.5 h-3.5" strokeWidth={2.5} /></span>
                      Add User
                    </button>
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      Live Updates
                    </div>
                  </div>
                </div>
              </div>

              {/* Provisioned users awaiting first login */}
              {provisionedUsers.length > 0 && (
                <div className="px-6 sm:px-8 py-4 bg-amber-500/[0.05] dark:bg-amber-500/[0.08] border-b border-amber-500/15">
                  <div className="flex items-center gap-2 mb-3">
                    <ClockIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Awaiting first login ({provisionedUsers.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {provisionedUsers.map((p) => (
                      <div key={p.id} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-amber-500/20 backdrop-blur-sm">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{p.displayName}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{(p.role || 'team_member').replace(/_/g, ' ')}</span>
                        <span className="text-[11px] text-gray-400 hidden sm:inline">{p.email}</span>
                        <button onClick={() => handleRevokeProvisioned(p.id)} title="Revoke invite" className="p-1 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                          <TrashIconOutline className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active drill-down filter banner (from a stat card) */}
              {userFilter !== 'all' && (
                <div className="px-6 sm:px-8 py-3 bg-indigo-500/[0.06] dark:bg-indigo-500/10 border-b border-indigo-500/15 flex items-center justify-between gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    <FunnelIcon className="w-4 h-4" />
                    Filtered: {USER_FILTER_LABELS[userFilter]}
                    <span className="text-xs font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">{filteredUsers.length}</span>
                  </span>
                  <button
                    onClick={() => { setUserFilter('all'); setUsersPage(1); }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-white/60 dark:hover:bg-white/5 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" /> Clear filter
                  </button>
                </div>
              )}

              {filteredUsers.length === 0 ? (
                <EmptyState
                  icon={<UserGroupIcon className="h-12 w-12 text-gray-400" />}
                  title={users.length === 0 ? 'No users yet' : `No ${USER_FILTER_LABELS[userFilter].toLowerCase()}`}
                  description={users.length === 0 ? 'Users will appear here once they sign up.' : 'Nothing matches this filter — clear it to see everyone.'}
                />
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block">
                    <table className="w-full divide-y divide-gray-200/50 dark:divide-white/5 table-fixed">
                      <colgroup>
                        <col style={{width:'15%'}} />
                        <col style={{width:'18%'}} />
                        <col style={{width:'10%'}} />
                        <col style={{width:'10%'}} />
                        <col style={{width:'12%'}} />
                        <col style={{width:'12%'}} />
                        <col style={{width:'9%'}} />
                        <col style={{width:'14%'}} />
                      </colgroup>
                      <thead className="bg-gray-50/50 dark:bg-[#0a0a0a]/50 backdrop-blur-md border-b border-gray-200/50 dark:border-white/5">
                        <tr>
                          <th className="px-5 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">User</th>
                          <th className="px-3 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Email</th>
                          <th className="px-2 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">SSO Status</th>
                          <th className="px-2 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Role</th>
                          <th className="px-2 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Change Role</th>
                          <th className="px-2 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Team</th>
                          <th className="px-2 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Joined</th>
                          <th className="px-2 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200/50 dark:divide-white/5 bg-transparent">
                        {pagedUsers.map((userData) => (
                          <tr key={userData.id} className={`transition-all duration-300 ${userData.id === user.uid ? 'bg-indigo-50/50 dark:bg-indigo-500/5 hover:bg-indigo-100/50 dark:hover:bg-indigo-500/10' : 'hover:bg-white dark:hover:bg-white/[0.02]'}`}>
                          {/* User */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center min-w-0">
                              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                                  {userData.displayName?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div className="ml-2 min-w-0">
                                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {userData.displayName}
                                  {userData.id === user.uid && (
                                    <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">You</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          {/* Email */}
                          <td className="px-3 py-3">
                            <div className="text-xs text-gray-500 truncate" title={userData.email}>{userData.email}</div>
                          </td>
                          {/* SSO Migrated */}
                          <td className="px-2 py-3">
                            {(() => {
                              const isMigrated = userData.ssoMigrated || (userData.email && userData.email.endsWith('@google.com')) || (userData.providerData && userData.providerData.some(p => p.providerId === 'google.com'));
                              return (
                                <Badge variant={isMigrated ? 'success' : 'gray'} size="sm" className="shadow-sm">
                                  {isMigrated ? 'Migrated' : 'Pending'}
                                </Badge>
                              );
                            })()}
                          </td>
                          {/* Role badge */}
                          <td className="px-2 py-3">
                            <Badge variant={getRoleBadgeVariant(userData.role)} size="sm" className="shadow-sm font-semibold">
                              {userData.role.replace(/_/g, ' ').toUpperCase()}
                            </Badge>
                          </td>
                          {/* Role change select */}
                          <td className="px-2 py-2.5">
                            <PremiumSelect
                                size="sm"
                                value={userData.role}
                                options={[
                                  { label: 'Admin', value: USER_ROLES.ADMIN },
                                  { label: 'Trainer', value: USER_ROLES.TRAINER },
                                  { label: 'Team Leader', value: USER_ROLES.TEAM_LEADER },
                                  { label: 'Team Member', value: USER_ROLES.TEAM_MEMBER }
                                ]}
                                onChange={(val) => handleRoleChange(userData.id, val, userData)}
                                disabled={userData.id === user.uid}
                                className={userData.id === user.uid ? 'bg-gray-100 dark:bg-white/8 cursor-not-allowed opacity-60' : ''}
                            />
                          </td>
                          {/* Team */}
                          <td className="px-2 py-2.5">
                            <div className="text-xs truncate" title={
                              userData.role === USER_ROLES.TEAM_LEADER
                                ? `Team ${userData.displayName || userData.email}`
                                : userData.teamId ? (teamNames[userData.teamId] || userData.teamId) : 'No team'
                            }>
                              {userData.role === USER_ROLES.TEAM_LEADER ? (
                                <span className="text-blue-600 font-medium truncate">Team {userData.displayName || userData.email}</span>
                              ) : userData.teamId ? (
                                <span className="text-gray-600">{teamNames[userData.teamId] || userData.teamId}</span>
                              ) : (
                                <span className="text-gray-400 italic">None</span>
                              )}
                            </div>
                          </td>
                          {/* Joined */}
                          <td className="px-2 py-2.5">
                            <div className="text-xs text-gray-500">
                              {userData.createdAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || '—'}
                            </div>
                          </td>
                          {/* Actions — icon-only buttons */}
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-1.5 opacity-90 transition-opacity hover:opacity-100">
                              <button
                                onClick={() => handleOpenEditProfileModal(userData)}
                                title="Edit Profile Details"
                                aria-label="Edit user profile"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm transition-all duration-200"
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleResetPassword(userData)}
                                disabled={userData.id === user.uid}
                                title={userData.id === user.uid ? 'Cannot reset your own password' : 'Reset password'}
                                aria-label="Reset password"
                                className={`p-1.5 rounded-lg transition-all duration-200 ${
                                  userData.id === user.uid ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 hover:shadow-sm'
                                }`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleOpenFeaturesModal(userData)}
                                title="Manage features"
                                aria-label="Manage features"
                                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                              </button>
                              {/* Phase 62: Enable Migration (Move User) for all roles */}
                              <button
                                onClick={() => handleOpenChangeTeamModal(userData)}
                                title="Change team assignment"
                                aria-label="Change team"
                                className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <ArrowsRightLeftIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(userData)}
                                disabled={userData.id === user.uid}
                                title={userData.id === user.uid ? 'Cannot delete your own account' : 'Delete user'}
                                aria-label="Delete user"
                                className={`p-1.5 rounded-md transition-colors ${
                                  userData.id === user.uid
                                    ? 'opacity-30 cursor-not-allowed text-gray-400'
                                    : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                }`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4 p-4">
                  {pagedUsers.map((userData) => (
                    <Card key={userData.id} className={userData.id === user.uid ? 'border-blue-300 bg-blue-50' : ''}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                            <span className="text-sm font-medium text-gray-700">
                              {userData.displayName?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {userData.displayName}
                              {userData.id === user.uid && (
                                <Badge variant="primary" size="sm" className="ml-2">You</Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{userData.email}</div>
                          </div>
                        </div>
                        <Badge variant={getRoleBadgeVariant(userData.role)} size="sm">
                          {userData.role.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-500">Team: </span>
                          <span className="text-gray-900">
                            {userData.role === USER_ROLES.TEAM_LEADER
                              ? `Team ${userData.displayName || userData.email}`
                              : userData.teamId
                                ? (teamNames[userData.teamId] || userData.teamId)
                                : 'None'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Joined: </span>
                          <span className="text-gray-900">
                            {userData.createdAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-2">SSO Migrated: </span>
                          {userData.ssoMigrated || (userData.email && userData.email.endsWith('@google.com')) || (userData.providerData && userData.providerData.some(p => p.providerId === 'google.com')) ? (
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>

                        <div className="pt-2 border-t border-gray-200">
                          <PremiumSelect
                            size="sm"
                            value={userData.role}
                            options={[
                              { label: 'Admin', value: USER_ROLES.ADMIN },
                              { label: 'Trainer', value: USER_ROLES.TRAINER },
                              { label: 'Team Leader', value: USER_ROLES.TEAM_LEADER },
                              { label: 'Team Member', value: USER_ROLES.TEAM_MEMBER }
                            ]}
                            onChange={(val) => handleRoleChange(userData.id, val, userData)}
                            disabled={userData.id === user.uid}
                            className="w-full mb-3"
                          />

                          <div className="flex gap-1 justify-between">
                            <Button
                              onClick={() => handleResetPassword(userData)}
                              disabled={userData.id === user.uid}
                              variant="ghost"
                              size="sm"
                              className="px-2"
                            >
                              Reset
                            </Button>
                            <Button
                              onClick={() => handleOpenFeaturesModal(userData)}
                              variant="ghost"
                              size="sm"
                              className="px-2"
                            >
                              Features
                            </Button>
                            <Button
                              onClick={() => handleDeleteUser(userData)}
                              disabled={userData.id === user.uid}
                              variant="danger"
                              size="sm"
                              className="px-2"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <Pagination page={usersPageSafe} pageSize={USERS_PER_PAGE} total={filteredUsers.length} onPageChange={setUsersPage} />
              </>
            )}
            </div>
          </div>
        )}


        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Apps Script Web App integration */}
            <div className="relative bg-white/70 dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-200/60 dark:border-white/10 shadow-xl rounded-[2rem] overflow-hidden">
              <div className="px-6 py-6 sm:px-8 border-b border-gray-200/50 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <span className="flex-none w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </span>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Apps Script Web Apps</h3>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">External integration endpoints</p>
                  </div>
                </div>
              </div>
              <div className="p-6 sm:p-8 space-y-5">
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                  Add one or more Apps Script Web Apps by their deployed <span className="font-mono font-bold">/exec</span> URL and give each a name (shown as its tab label). This feature is <span className="font-bold text-gray-700 dark:text-gray-200">off for everyone by default</span> — enable it per user with the <span className="font-bold">Apps Script Integration</span> toggle in a user’s <span className="font-bold">Manage features</span>.
                </p>

                {appsScriptApps.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No Apps Scripts added yet.</p>
                )}

                <div className="space-y-4">
                  {appsScriptApps.map((app) => {
                    const test = appsScriptTests[app.id];
                    const urlInvalid = app.url.trim() && !isValidExecUrl(app.url);
                    return (
                      <div key={app.id} className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.03] p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="sm:w-56 flex-none">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Name (tab label)</label>
                            <input
                              value={app.name}
                              onChange={(e) => updateAppField(app.id, 'name', e.target.value)}
                              placeholder="e.g. Payroll Tool"
                              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                            {!app.name.trim() && <p className="text-[11px] text-rose-500 mt-1">Name is required.</p>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Web App URL (/exec)</label>
                            <input
                              type="url"
                              value={app.url}
                              onChange={(e) => updateAppField(app.id, 'url', e.target.value)}
                              placeholder="https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
                              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                            {urlInvalid && <p className="text-[11px] text-rose-500 mt-1">Must be an Apps Script URL ending in /exec.</p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="w-full sm:w-64">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Connection method</label>
                            <PremiumSelect
                              value={app.transport}
                              onChange={(val) => updateAppField(app.id, 'transport', val)}
                              options={[
                                { label: 'Direct (browser → Apps Script)', value: 'direct' },
                                { label: 'Secure proxy (Cloud Function)', value: 'proxy' },
                              ]}
                            />
                          </div>
                          <Button variant="secondary" size="sm" onClick={() => handleTestApp(app)} disabled={!app.url.trim() || urlInvalid}>Test</Button>
                          <button onClick={() => removeAppsScript(app.id)} className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 px-2.5 py-2 rounded-lg transition-colors">
                            <TrashIconOutline className="w-4 h-4" /> Remove
                          </button>
                          {test && (
                            <span className={`text-xs font-semibold inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
                              test.ok === true ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                              : test.ok === false ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                              : 'text-gray-500 bg-gray-500/10'}`}>{test.msg}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button variant="secondary" onClick={addAppsScript}>+ Add Apps Script</Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveAppsScriptApps}
                    loading={appsScriptSaving}
                    disabled={appsScriptSaving || appsScriptApps.some((a) => !a.name.trim() || !a.url.trim() || !isValidExecUrl(a.url))}
                  >
                    Save changes
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400">
                  Use <span className="font-bold">Direct</span> first; if it shows “Failed to fetch” (browser CORS) switch that app to <span className="font-bold">Secure proxy</span> (needs the <span className="font-mono">appsScriptProxy</span> function deployed). Either way the Apps Script must be deployed with access = <span className="font-bold">Anyone</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="relative group/pending">
            <div className="absolute inset-x-0 -top-10 -bottom-10 bg-gradient-to-br from-indigo-500/10 via-rose-500/5 to-transparent blur-3xl opacity-50 pointer-events-none rounded-[3rem] transition-opacity duration-500 group-hover/pending:opacity-100"></div>
            
            <div className="relative bg-white/60 dark:bg-[#111111]/80 shadow-2xl overflow-hidden rounded-[2.5rem] border border-gray-200/50 dark:border-white/5 backdrop-blur-xl">
              <div className="px-6 py-6 sm:px-8 border-b border-gray-200/50 dark:border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent dark:from-white/[0.02] dark:to-transparent pointer-events-none"></div>
                <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                      Pending Approvals
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500 dark:text-gray-400">
                      Review and approve account requests (Team Leaders, Trainers, Operations Managers)
                    </p>
                  </div>
                </div>
              </div>

              {pendingTeamLeaders.length === 0 ? (
                <EmptyState
                  icon={<CheckCircleIcon className="h-12 w-12 text-gray-400" />}
                  title="No pending approvals"
                  description="All team leader requests have been processed."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200/50 dark:divide-white/5">
                    <thead className="bg-gray-50/50 dark:bg-[#0a0a0a]/50 backdrop-blur-md">
                      <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                          Name
                        </th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                          Email
                        </th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                          Requested Date
                        </th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-transparent divide-y divide-gray-200/50 dark:divide-white/5">
                      {pendingTeamLeaders.map((pendingUser) => (
                        <tr key={pendingUser.id} className="transition-colors duration-200 hover:bg-white/60 dark:hover:bg-white/[0.04]">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {pendingUser.displayName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">{pendingUser.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {pendingUser.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <Button
                                onClick={() => handleApproveTeamLeader(pendingUser.id)}
                                variant="success"
                                size="sm"
                              >
                                Approve
                              </Button>
                              <Button
                                onClick={() => handleRejectTeamLeader(pendingUser.id)}
                                variant="danger"
                                size="sm"
                              >
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Updates View Tab */}
        {activeTab === 'updates' && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-white/10 shadow dark:shadow-none rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">System Updates</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">View, and clean up, all updates sent across every dashboard.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="primary" className="font-bold">{updates.length} Total</Badge>
                {selectedUpdateIds.size > 0 && (
                  <Badge variant="error" className="font-bold">{selectedUpdateIds.size} selected</Badge>
                )}
                {updates.length > 0 && (
                  <>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer select-none px-2">
                      <input type="checkbox" checked={allUpdatesSelected} onChange={toggleSelectAllUpdates} className="rounded accent-indigo-600" />
                      Select all
                    </label>
                    <Button variant="danger" size="sm" disabled={selectedUpdateIds.size === 0} onClick={() => openDeleteUpdates('selected')}>
                      Delete Selected
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => openDeleteUpdates('all')}>
                      Delete All
                    </Button>
                  </>
                )}
              </div>
            </div>

            {updates.length === 0 ? (
              <EmptyState
                title="No updates found"
                description="There are currently no updates in the system."
                icon={<BellIcon className="w-12 h-12 text-gray-300" />}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {updates.map((update) => {
                  const selected = selectedUpdateIds.has(update.id);
                  return (
                    <div
                      key={update.id}
                      className={`relative rounded-2xl transition-all ${selected ? 'ring-2 ring-rose-500/70 ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0a]' : ''}`}
                    >
                      <label
                        className="absolute top-3 left-3 z-20 flex items-center justify-center w-7 h-7 rounded-lg bg-white/90 dark:bg-black/70 border border-gray-200 dark:border-white/15 shadow-sm cursor-pointer backdrop-blur"
                        title="Select this update"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleUpdateSelect(update.id)}
                          aria-label={`Select update: ${update.title || 'untitled'}`}
                          className="accent-rose-600 w-4 h-4"
                        />
                      </label>
                      <UpdateCard
                        update={update}
                        isManagerView={true}
                        statusBreakdown={statusBreakdown}
                        onViewDetails={(u) => {
                          setSelectedUpdate(u);
                          setShowAcknowledgmentModal(true);
                        }}
                        onDelete={(u) => openDeleteUpdates('single', u)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-white/10 shadow dark:shadow-none rounded-2xl p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Analytics</h3>
            <p className="text-gray-500 dark:text-gray-500">Analytics dashboard will be available in future updates.</p>
          </div>
        )}

        {/* SPII Analytics Tab */}
        {activeTab === 'spii-analytics' && (
          <SpiiVisualDashboardTab currentUser={user} />
        )}

        {activeTab === 'spii-audit' && (
          <SpiiAuditLogsTab currentUser={user} />
        )}

        {activeTab === 'metric-analytics' && (
          <MetricAnalyticsTab />
        )}

        {activeTab === 'utilization' && (
          <UtilizationMonitorTab />
        )}

        {/* User Feedback Tab */}
        {activeTab === 'feedback' && (
          <FeedbackTab />
        )}
      </DashboardShell>

      {/* Add User (manual provisioning) Modal */}
      <Modal isOpen={showAddUserModal} onClose={() => setShowAddUserModal(false)} size="md">
        <Modal.Header onClose={() => setShowAddUserModal(false)}>
          <Modal.Title>Add User Manually</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Pre-authorize a teammate. When they first sign in with their Google account, they’re created with the role below and <span className="font-bold text-gray-700 dark:text-gray-200">skip the approval step</span>.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Display name</label>
              <input
                value={addUserForm.displayName}
                onChange={(e) => setAddUserForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Jane Doe"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400/50"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Google email (SSO)</label>
              <input
                type="email"
                value={addUserForm.email}
                onChange={(e) => setAddUserForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane@google.com"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400/50"
              />
              <p className="text-[11px] text-gray-400 mt-1">Must be the exact Google account they’ll sign in with.</p>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Role</label>
              <PremiumSelect
                value={addUserForm.role}
                onChange={(val) => setAddUserForm((f) => ({ ...f, role: val }))}
                options={[
                  { label: 'Team Member', value: USER_ROLES.TEAM_MEMBER },
                  { label: 'Team Leader', value: USER_ROLES.TEAM_LEADER },
                  { label: 'Trainer', value: USER_ROLES.TRAINER },
                  { label: 'Admin', value: USER_ROLES.ADMIN },
                ]}
              />
            </div>
            {addUserForm.role === USER_ROLES.TEAM_MEMBER && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Team (optional)</label>
                <PremiumSelect
                  value={addUserForm.teamId}
                  onChange={(val) => setAddUserForm((f) => ({ ...f, teamId: val }))}
                  options={[{ label: 'No team', value: '' }, ...allTeams.map((t) => ({ label: t.displayName || t.name || t.id, value: t.id }))]}
                />
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddUserModal(false)} disabled={addUserLoading}>Cancel</Button>
          <Button variant="primary" onClick={handleAddUser} loading={addUserLoading} disabled={addUserLoading || !addUserForm.displayName.trim() || !addUserForm.email.trim()}>Add User</Button>
        </Modal.Footer>
      </Modal>

      {/* Acknowledgment Modal */}
      <AcknowledgmentModal
        update={selectedUpdate}
        teamMembers={users} // Admin has all users in 'users' state
        isOpen={showAcknowledgmentModal}
        onClose={() => {
          setShowAcknowledgmentModal(false);
          setSelectedUpdate(null);
        }}
      />

      {/* Password Reset Modal */}
      <Modal isOpen={passwordResetModal.isOpen} onClose={closePasswordResetModal} size="md">
        <Modal.Header onClose={closePasswordResetModal}>
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <Modal.Title>Reset Password</Modal.Title>
          </div>
        </Modal.Header>

        <Modal.Body>
          {passwordResetModal.loading ? (
            <div className="text-center py-8">
              <Skeleton variant="circular" width="w-12" height="h-12" className="mx-auto mb-4" />
              <Skeleton width="w-32" height="h-4" className="mx-auto" />
            </div>
          ) : passwordResetModal.tempPassword ? (
            <div>
              <div className="mb-4">
                <p className="text-gray-600 mb-2">
                  Password has been reset for{' '}
                  <span className="font-semibold text-gray-900">
                    {passwordResetModal.user?.displayName || passwordResetModal.user?.email}
                  </span>
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Please provide this temporary password to the user. They should change it after logging in.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Temporary Password
                    </label>
                    <div className="font-mono text-lg font-semibold text-gray-900 break-all">
                      {passwordResetModal.tempPassword}
                    </div>
                  </div>
                  <Button
                    onClick={() => copyToClipboard(passwordResetModal.tempPassword)}
                    variant="ghost"
                    size="sm"
                    title="Copy to clipboard"
                    aria-label="Copy password to clipboard"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                <p className="text-xs text-yellow-800">
                  <strong>Important:</strong> This password is temporary. The user must change it after their first login for security purposes.
                </p>
              </div>

              {!passwordResetModal.passwordResetInAuth && (
                <Alert variant="warning" className="mt-4">
                  <strong>Note:</strong> Cloud Function not deployed. The password in Firebase Auth has not been changed.
                  Deploy the Cloud Function to enable automatic password reset.
                </Alert>
              )}
            </div>
          ) : null}
        </Modal.Body>

        <Modal.Footer>
          <Button
            onClick={closePasswordResetModal}
            variant="secondary"
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={cancelDeleteUser}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        type="danger"
        confirmText="Delete User"
        loading={loading}
        message={
          <div className="flex flex-col items-center">
            <span className="mb-4 text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white tracking-wide">{deleteModal.user?.displayName || deleteModal.user?.email}</span>?
            </span>
            <Alert variant="error" className="text-left w-full mt-1 mb-2">
              <strong className="text-rose-600 dark:text-rose-400">⚠️ This action cannot be undone</strong>
              <p className="mt-1 text-xs opacity-90 text-rose-500/80 dark:text-rose-400/80">
                All user data, including teams, updates, and acknowledgments will be permanently deleted.
              </p>
            </Alert>
          </div>
        }
      />

      {/* Delete Updates Confirmation (single / selected / all) */}
      <ConfirmModal
        isOpen={updateDeleteModal.isOpen}
        onClose={closeDeleteUpdates}
        onConfirm={confirmDeleteUpdates}
        type="danger"
        loading={deletingUpdates}
        title={
          updateDeleteModal.mode === 'all' ? 'Delete ALL updates'
          : updateDeleteModal.mode === 'selected' ? 'Delete selected updates'
          : 'Delete update'
        }
        confirmText={
          updateDeleteModal.mode === 'all' ? `Delete all ${updates.length}`
          : updateDeleteModal.mode === 'selected' ? `Delete ${selectedUpdateIds.size}`
          : 'Delete'
        }
        message={
          <div className="flex flex-col items-center">
            <span className="mb-4 text-gray-600 dark:text-gray-400 text-center">
              {updateDeleteModal.mode === 'all' && (
                <>You're about to delete <span className="font-bold text-gray-900 dark:text-white">all {updates.length} update{updates.length === 1 ? '' : 's'}</span> across every dashboard.</>
              )}
              {updateDeleteModal.mode === 'selected' && (
                <>Delete the <span className="font-bold text-gray-900 dark:text-white">{selectedUpdateIds.size} selected update{selectedUpdateIds.size === 1 ? '' : 's'}</span>?</>
              )}
              {updateDeleteModal.mode === 'single' && (
                <>Delete <span className="font-bold text-gray-900 dark:text-white">"{updateDeleteModal.target?.title || 'this update'}"</span>?</>
              )}
            </span>
            <Alert variant="error" className="text-left w-full mt-1 mb-2">
              <strong className="text-rose-600 dark:text-rose-400">⚠️ This action cannot be undone</strong>
              <p className="mt-1 text-xs opacity-90 text-rose-500/80 dark:text-rose-400/80">
                Each update's acknowledgments and notifications are removed too, and affected members are notified.
              </p>
            </Alert>
          </div>
        }
      />

      {/* Change Team Modal */}
      <Modal isOpen={changeTeamModal.isOpen} onClose={() => setChangeTeamModal({ isOpen: false, user: null, selectedTeamId: '', loading: false })} size="md">
        <Modal.Header onClose={() => setChangeTeamModal({ isOpen: false, user: null, selectedTeamId: '', loading: false })}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
              <ArrowsRightLeftIcon className="w-5 h-5 text-blue-600" />
            </div>
            <Modal.Title>Change Team Assignment</Modal.Title>
          </div>
        </Modal.Header>

        <Modal.Body>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Moving user:</p>
              <p className="font-semibold text-gray-900">
                {changeTeamModal.user?.displayName || changeTeamModal.user?.email}
              </p>
              <p className="text-xs text-gray-500">{changeTeamModal.user?.email}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">
                Current team:{' '}
                <span className="font-medium text-gray-700">
                  {changeTeamModal.user?.teamId
                    ? (teamNames[changeTeamModal.user.teamId] || changeTeamModal.user.teamId)
                    : 'None'}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign to team
              </label>
              <PremiumSelect
                value={changeTeamModal.selectedTeamId}
                options={[
                  { label: '— Unassign (no team) —', value: '' },
                  ...allTeams.map(team => ({
                    label: `${team.displayName}${team.id === changeTeamModal.user?.teamId ? ' (current)' : ''}`,
                    value: team.id
                  }))
                ]}
                onChange={(val) => setChangeTeamModal(prev => ({ ...prev, selectedTeamId: val }))}
                disabled={changeTeamModal.loading}
              />
              {allTeams.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No teams found. Create a team first via a Team Leader account.</p>
              )}
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button
            onClick={() => setChangeTeamModal({ isOpen: false, user: null, selectedTeamId: '', loading: false })}
            disabled={changeTeamModal.loading}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmChangeTeam}
            disabled={changeTeamModal.loading || changeTeamModal.selectedTeamId === (changeTeamModal.user?.teamId || '')}
            variant="primary"
            loading={changeTeamModal.loading}
          >
            Move User
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal isOpen={editProfileModal.isOpen} onClose={() => setEditProfileModal({ ...editProfileModal, isOpen: false, loading: false })} size="md">
        <Modal.Header onClose={() => setEditProfileModal({ ...editProfileModal, isOpen: false, loading: false })}>
          <div className="flex items-center gap-3">
             <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-full shadow-inner">
               <PencilSquareIcon className="w-5 h-5 text-indigo-600" />
             </div>
             <Modal.Title>Edit User Profile</Modal.Title>
          </div>
        </Modal.Header>

        <form onSubmit={handleEditProfileSubmit}>
          <Modal.Body>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editProfileModal.displayName}
                  onChange={(e) => setEditProfileModal(prev => ({ ...prev, displayName: e.target.value }))}
                  className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-shadow transition-colors"
                  placeholder="E.g., John Doe"
                  disabled={editProfileModal.loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Email
                </label>
                <input
                  type="email"
                  required
                  value={editProfileModal.email}
                  onChange={(e) => setEditProfileModal(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-shadow transition-colors"
                  placeholder="user@google.com"
                  disabled={editProfileModal.loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSO Email (@google.com)
                </label>
                <input
                  type="email"
                  value={editProfileModal.ssoEmail}
                  onChange={(e) => setEditProfileModal(prev => ({ ...prev, ssoEmail: e.target.value }))}
                  className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-shadow transition-colors"
                  placeholder="Optional. Will mark user as SSO Migrated."
                  disabled={editProfileModal.loading}
                />
                <p className="text-xs text-gray-500 mt-2">
                   This email will be hard-linked to the user's Google SSO identity during migration.
                </p>
              </div>

              {/* Co-Admin Role Assigner Toggle */}
              {editProfileModal.user?.role !== USER_ROLES.ADMIN && (
                <div className="flex bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2">
                  <div className="flex items-center h-5">
                    <input
                      id="coAdminToggle"
                      type="checkbox"
                      checked={editProfileModal.isCoAdmin}
                      onChange={(e) => setEditProfileModal(prev => ({ ...prev, isCoAdmin: e.target.checked }))}
                      disabled={editProfileModal.loading}
                      className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer transition-colors"
                    />
                  </div>
                  <div className="ms-3 text-sm flex flex-col justify-center">
                    <label htmlFor="coAdminToggle" className="font-semibold text-gray-900 cursor-pointer">
                      Grant Co-Admin Privileges
                    </label>
                    <span className="text-xs font-normal text-gray-500 mt-0.5">Allow this user to switch into the Admin Dashboard safely without losing their primary role.</span>
                  </div>
                </div>
              )}
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              onClick={() => setEditProfileModal({ ...editProfileModal, isOpen: false, loading: false })}
              disabled={editProfileModal.loading}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={editProfileModal.loading}
              variant="primary"
              loading={editProfileModal.loading}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200"
            >
              Save Profile
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />

      {/* Manage Features Modal */}
      <Modal isOpen={featuresModal.isOpen} onClose={() => setFeaturesModal({ ...featuresModal, isOpen: false })} size="lg">
        <Modal.Header onClose={() => setFeaturesModal({ ...featuresModal, isOpen: false })}>
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-primary-100 rounded-full mr-3">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <Modal.Title>Manage Features: {featuresModal.user?.displayName || featuresModal.user?.email}</Modal.Title>
          </div>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-4">
            <p className="text-sm text-gray-500">
              Enable or disable specific features for this user's dashboard. Disabled features will not be visible to the user.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ALL_FEATURES.map((feature) => {
              const features = featuresModal.user?.features || DEFAULT_FEATURES;
              const isEnabled = features[feature.id] !== undefined ? features[feature.id] : DEFAULT_FEATURES[feature.id];

              return (
                <div key={feature.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="mr-4">
                    <p className="font-medium text-gray-900">{feature.label}</p>
                    <p className="text-xs text-gray-500">{isEnabled ? 'Currently enabled' : 'Currently disabled'}</p>
                  </div>
                  <button
                    onClick={() => handleToggleFeature(featuresModal.user.id, feature.id, features, featuresModal.user)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${isEnabled ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Per-script Apps Script access (shown when the feature is on) */}
          {(featuresModal.user?.features?.appsScript ?? DEFAULT_FEATURES.appsScript) && (
            <div className="mt-6 border-t border-gray-200 dark:border-white/10 pt-5">
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Apps Script access</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Choose which Apps Scripts this user can open.
                {appsScriptApps.length === 0 && ' No Apps Scripts are configured yet — add them in System Settings.'}
              </p>
              <div className="space-y-2">
                {appsScriptApps.map((app) => {
                  const feats = featuresModal.user?.features || DEFAULT_FEATURES;
                  const allIds = appsScriptApps.map((a) => a.id);
                  const allowed = Array.isArray(feats.appsScriptIds) ? feats.appsScriptIds : allIds;
                  const checked = allowed.includes(app.id);
                  return (
                    <label key={app.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-white/10 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleAppScriptId(featuresModal.user.id, app.id, feats, featuresModal.user)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{app.name || 'Untitled'}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            onClick={() => setFeaturesModal({ ...featuresModal, isOpen: false })}
            variant="primary"
          >
            Done
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AdminDashboard;
