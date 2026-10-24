import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../services/activity';
import { signOutUser } from '../../firebase/auth';
import { getUserScratchpad, saveUserScratchpad, addSpiiCase, getSpiiCasesByUser, updateSpiiCase, deleteSpiiCase } from '../../firebase/firestore';
import { getTeam } from '../../services/teams';
import { getAllUsers } from '../../services/users';
import { getUpdatesByTeam, acknowledgeUpdate, getUserAcknowledgment, getAcknowledgmentStatus, createUpdate, updateUpdate, deleteUpdate } from '../../services/updates';
import { logger } from '../../utils/logger';
import { playAlarm, previewSound } from '../../utils/audio';
import { onSnapshot, query, collection, where, orderBy, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import UserMenu from './UserMenu';
import ChangePasswordModal from '../ChangePasswordModal';
import { Button, Card, Badge, Modal, Skeleton, CardSkeleton, EmptyState, Alert, ConfirmModal, PremiumSelect, Input, DateTimePicker } from '../ui';
import { UserGroupIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon, Bars3Icon, Cog6ToothIcon, MagnifyingGlassIcon, TrashIcon, BellIcon, XMarkIcon, ArrowsUpDownIcon, PlusIcon, PlusCircleIcon, DocumentDuplicateIcon, PencilSquareIcon, CalculatorIcon, ChartBarIcon, Squares2X2Icon, ListBulletIcon, CheckCircleIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import { showSuccess, showError, showInfo } from '../../utils/toast';
import { Reorder, useDragControls, motion, AnimatePresence } from 'framer-motion';
import FocusTimer from '../common/FocusTimer';
import SpiiVisualDashboardTab from './SpiiVisualDashboardTab';
import SpiiAuditLogsTab from './SpiiAuditLogsTab';
import CaseTrackerTab from './CaseTrackerTab';
import MetricAnalyticsTab from './MetricAnalyticsTab';
import { detectSPII } from '../../utils/spiiDetector';
import { logSpiiAudit, getSpiiDetectionSettings } from '../../firebase/firestore';
import UpdateCard from './UpdateCard';
import CreateUpdateModal from './CreateUpdateModal';
import TemplatesTab from './TemplatesTab';
import FloatingPanel from '../common/FloatingPanel';
import RunawayCalculatorTab from './RunawayCalculatorTab';
import ScratchpadTab from './ScratchpadTab';
import AppsScriptTab from './AppsScriptTab';
import DashboardTabNav from './DashboardTabNav';
import DashboardShell from './DashboardShell';
import CalculatorTab from './CalculatorTab';
import { useNotifications } from '../../hooks/useNotifications';
import useLiveSessions from '../../hooks/useLiveSessions';
import { endAllOpenSessions } from '../../services/liveSessions';

const DEFAULT_FEATURES = {
  updates: true,
  canCreateUpdates: false,
  gcpBilling: true,
  templates: true,
  notes: true,
  metrics: true,
  spiiCases: true,
  caseTracker: true,
  spiiAudit: true
};

const TeamMemberDashboard = () => {
  const { user } = useAuth();
  // Template live sessions — mounted here so the idle timer runs on every tab.
  const live = useLiveSessions(user);
  const [team, setTeam] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgments, setAcknowledgments] = useState({});
  const [activeTab, setActiveTab] = useState('updates');
  const [showCreateUpdate, setShowCreateUpdate] = useState(false);
  const [updateToEdit, setUpdateToEdit] = useState(null);
  const [showDeleteUpdateModal, setShowDeleteUpdateModal] = useState({ isOpen: false, update: null });
  const [updateForm, setUpdateForm] = useState({ title: '', content: '', deadline: '' });
  const [spiiSettings, setSpiiSettings] = useState({ enabled: false });

  // Notifications logic via custom hook
  const {
    notifications,
    unreadCount,
    browserPermission,
    requestBrowserPermission,
    markAsRead,
    markAllAsRead,
    removeNotification,
    loadNotifications
  } = useNotifications(user);

  // Load SPII Settings
  useEffect(() => {
    const q = doc(db, 'settings', 'spii_monitoring');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.exists()) {
        setSpiiSettings(snapshot.data());
      } else {
        setSpiiSettings({ enabled: false });
      }
    }, (error) => {
      logger.error('Error listening to SPII settings:', error);
    });
    return () => unsubscribe();
  }, []);

  // Universal Modified Breaks Management State (Removing)

  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const features = useMemo(() => {
    if (!user?.features) return DEFAULT_FEATURES;
    return { ...DEFAULT_FEATURES, ...user.features };
  }, [user?.features]);

  const visibleTabs = useMemo(() => {
    return [
      { id: 'updates', label: 'Updates', visible: features.updates },
      { id: 'gcp-billing', label: 'GCP Billing Calculation', visible: features.gcpBilling },
      { id: 'templates', label: 'Templates', visible: features.templates },
      { id: 'notes', label: 'Notes', visible: features.notes },
      {
        id: 'case-tracker', label: 'Case Tracker', visible: features.caseTracker
      },
      {
        id: 'spii-cases', label: 'My SPII Cases', visible: features.spiiCases,
        onClick: () => loadSpiiCases()
      },
      {
        id: 'spii-dashboard', label: 'SPII Analytics', visible: features.spiiCases
      },
      {
        id: 'spii-audit',
        label: 'SPII Audit Logs',
        visible: (features.spiiAudit && (user.role === 'admin' || user.role === 'team_leader'))
      },
      {
        id: 'metric-analytics', label: 'Metric Analytics', visible: features.metrics
      },
      {
        id: 'apps-script', label: 'Apps Script', visible: features.appsScript
      }
    ].filter(tab => tab.visible);
  }, [features]);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(tab => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  // Removed break handlers

  // SPII Cases state
  const [spiiCases, setSpiiCases] = useState([]);
  const [spiiLoading, setSpiiLoading] = useState(false);
  const [spiiForm, setSpiiForm] = useState({
    caseId: '',
    status: 'Assigned',
    submittedPrivacy: 'no'
  });
  const [addingSpii, setAddingSpii] = useState(false);
  const [deletingSpiiId, setDeletingSpiiId] = useState(null);
  const [spiiDeleteModalOpen, setSpiiDeleteModalOpen] = useState(false);
  const [spiiCaseToDelete, setSpiiCaseToDelete] = useState(null);
  const [spiiSearchTerm, setSpiiSearchTerm] = useState('');
  const [spiiStatusFilter, setSpiiStatusFilter] = useState('all');
  
  // Exclusions functionality
  const [allUsers, setAllUsers] = useState([]);
  const [exclusionModalOpen, setExclusionModalOpen] = useState(false);
  const [exclusionCase, setExclusionCase] = useState(null);
  const [exclusionReason, setExclusionReason] = useState('');
  const [exclusionTarget, setExclusionTarget] = useState('');
  const [savingExclusion, setSavingExclusion] = useState(false);

  const loadAllUsers = useCallback(async () => {
    try {
      const usersData = await getAllUsers();
      setAllUsers(usersData);
    } catch (err) {
      logger.error("Failed to load users for reassignment dropdown", err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'spii-cases' && allUsers.length === 0) {
      loadAllUsers();
    }
  }, [activeTab, allUsers.length, loadAllUsers]);

  const loadSpiiCases = useCallback(async () => {
    if (!user?.uid) return;
    setSpiiLoading(true);
    try {
      const cases = await getSpiiCasesByUser(user.uid);
      setSpiiCases(cases);
    } catch (error) {
      logger.error('Error loading SPII cases:', error);
      showError('Failed to load SPII cases');
    } finally {
      setSpiiLoading(false);
    }
  }, [user?.uid]);

  const filteredSpiiCases = useMemo(() => {
    return spiiCases.filter(c => {
      const matchesSearch = !spiiSearchTerm || c.caseId?.toLowerCase().includes(spiiSearchTerm.toLowerCase());
      const matchesStatus = spiiStatusFilter === 'all' || c.status === spiiStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [spiiCases, spiiSearchTerm, spiiStatusFilter]);


  const handleAddSpiiCase = async (e) => {
    e.preventDefault();
    if (!spiiForm.caseId.trim()) return;


    if (spiiCases.some(c => c.caseId === spiiForm.caseId.trim())) {
      showError(`Case ID ${spiiForm.caseId.trim()} already exists in your records.`);
      return;
    }

    setAddingSpii(true);
    try {
      const caseData = {
        caseId: spiiForm.caseId.trim(),
        status: spiiForm.status,
        submittedPrivacy: (spiiForm.status === 'SO' || spiiForm.status === 'Closed') ? spiiForm.submittedPrivacy : null
      };

      await addSpiiCase(user.uid, caseData, user.teamId);
      logActivity(user, {
        eventType: 'spii_case_logged',
        action: 'Logged an SPII case',
        caseId: spiiForm.caseId?.trim(),
        isSpii: true,
        detail: spiiForm.status,
      });
      showSuccess('SPII case added successfully');
      setSpiiForm({
        caseId: '',
        status: 'Assigned',
        submittedPrivacy: 'no'
      });
      loadSpiiCases();
    } catch (error) {
      logger.error('Error adding SPII case:', error);
      if (error.code === 'duplicate-id') {
        showError(`Case ID ${spiiForm.caseId.trim()} already exists.`);
      } else {
        showError(`Failed to add SPII case: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setAddingSpii(false);
    }
  };

  const handleUpdateSpiiStatus = async (caseId, newStatus) => {
    try {
      const updateData = { status: newStatus };
      // If closing or SO, we might want to default privacy to 'no' if it was null
      const currentCase = spiiCases.find(c => c.id === caseId);
      if ((newStatus === 'SO' || newStatus === 'Closed') && !currentCase.submittedPrivacy) {
        updateData.submittedPrivacy = 'no';
      }

      await updateSpiiCase(caseId, updateData);
      showSuccess('Status updated successfully');
      loadSpiiCases();
    } catch (error) {
      logger.error('Error updating status:', error);
      showError('Failed to update status');
    }
  };

  const handleUpdateSpiiPrivacy = async (caseId, newPrivacy) => {
    try {
      if (newPrivacy === 'EXCLUDE') {
        const targetCase = spiiCases.find(c => c.id === caseId);
        setExclusionCase(targetCase);
        setExclusionReason(targetCase?.privacyExclusionReason || '');
        setExclusionTarget(targetCase?.privacyExclusionTarget || '');
        setExclusionModalOpen(true);
        return;
      }
      
      await updateSpiiCase(caseId, { 
        submittedPrivacy: newPrivacy,
        privacyExclusionReason: null,
        privacyExclusionTarget: null
      });
      showSuccess('Privacy review updated successfully');
      setSpiiCases(prev => prev.map(c => c.id === caseId ? { ...c, submittedPrivacy: newPrivacy, privacyExclusionReason: null, privacyExclusionTarget: null } : c));
    } catch (error) {
      logger.error('Error updating privacy review:', error);
      showError('Failed to update privacy review');
    }
  };

  const handleSaveExclusion = async () => {
    if (!exclusionCase || !exclusionReason) return;
    if (exclusionReason === 'Transferred' && !exclusionTarget) {
      showError("Please select a transfer destination.");
      return;
    }
    if (exclusionReason === 'Reassigned' && !exclusionTarget) {
      showError("Please select a user to reassign to.");
      return;
    }
    
    setSavingExclusion(true);
    try {
      const updates = {
        submittedPrivacy: 'excluded',
        privacyExclusionReason: exclusionReason,
        privacyExclusionTarget: exclusionReason === 'Not Applicable' ? null : exclusionTarget
      };
      
      await updateSpiiCase(exclusionCase.id, updates);
      
      setSpiiCases(prev => prev.map(c => c.id === exclusionCase.id ? { ...c, ...updates } : c));
      showSuccess(`Privacy review excluded: ${exclusionReason}`);
      setExclusionModalOpen(false);
    } catch (error) {
      logger.error('Error saving exclusion:', error);
      showError('Failed to save exclusion reasoning');
    } finally {
      setSavingExclusion(false);
    }
  };

  const handleDeleteSpiiCaseClick = (e, caseItem) => {
    e.stopPropagation();
    setSpiiCaseToDelete(caseItem);
    setSpiiDeleteModalOpen(true);
  };

  const handleConfirmSpiiDelete = async () => {
    if (!spiiCaseToDelete) return;

    setDeletingSpiiId(spiiCaseToDelete.id);
    try {
      await deleteSpiiCase(spiiCaseToDelete.id);
      showSuccess('SPII case deleted successfully');
      loadSpiiCases();
    } catch (error) {
      logger.error('Error deleting SPII case:', error);
      showError(`Failed to delete SPII case: ${error.message || 'Unknown error'}`);
    } finally {
      setDeletingSpiiId(null);
      setSpiiDeleteModalOpen(false);
      setSpiiCaseToDelete(null);
    }
  };

  // Notification functions - using useCallback for stable references (MUST be before useEffect that uses them)
  // Standardized toast helper (keeping for backward compatibility)
  const showNotification = useCallback((message, type = 'success') => {
    if (type === 'success') showSuccess(message);
    else if (type === 'error') showError(message);
    else showInfo(message);
  }, []);

  useEffect(() => {
    if (user?.teamId) {
      loadTeamData();
    } else {
      setLoading(false);
    }
    if (features.spiiCases) {
      loadSpiiCases();
    }
  }, [user, features.spiiCases, loadSpiiCases]);

  // Real-time listener for updates and notifications
  useEffect(() => {
    if (!user?.uid) return;

    logger.debug('TeamMemberDashboard: Setting up real-time updates listeners');

    let unsubscribeTeam = null;
    let unsubscribeTrainer = null;

    // Helper to process and sort updates
    const processUpdates = (newUpdates, sourceTeamId) => {
      setUpdates(prev => {
        const others = prev.filter(u => u.teamId !== sourceTeamId);
        const combined = [...others, ...newUpdates];
        return combined.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date();
          const bTime = b.createdAt?.toDate?.() || new Date();
          return bTime - aTime;
        });
      });
    };

    // 1. Team Updates Listener
    if (user.teamId) {
      const teamQuery = query(
        collection(db, 'updates'),
        where('teamId', '==', user.teamId)
      );

      unsubscribeTeam = onSnapshot(teamQuery, async (snapshot) => {
        const teamUpdates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Pre-load acknowledgments for these updates
        const acks = { ...acknowledgments };
        await Promise.all(teamUpdates.map(async (update) => {
          if (acks[update.id] === undefined) {
            const status = await getUserAcknowledgment(update.id, user.uid);
            acks[update.id] = status;
          }
        }));
        setAcknowledgments(prev => ({ ...prev, ...acks }));
        
        processUpdates(teamUpdates, user.teamId);
        setLoading(false);
      }, (error) => {
        logger.error('TeamMemberDashboard: Team updates listener error:', error);
        if (error.code === 'permission-denied') {
          showError(`Access denied to team updates for ${user.teamId}`);
        }
      });
    }

    // 2. Trainer Updates Listener
    const trainerQuery = query(
      collection(db, 'updates'),
      where('teamId', '==', 'trainer-updates')
    );

    unsubscribeTrainer = onSnapshot(trainerQuery, async (snapshot) => {
      const trainerUpdates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Pre-load acknowledgments
      const acks = { ...acknowledgments };
      await Promise.all(trainerUpdates.map(async (update) => {
        if (acks[update.id] === undefined) {
          const status = await getUserAcknowledgment(update.id, user.uid);
          acks[update.id] = status;
        }
      }));
      setAcknowledgments(prev => ({ ...prev, ...acks }));

      processUpdates(trainerUpdates, 'trainer-updates');
      setLoading(false);
    }, (error) => {
      logger.error('TeamMemberDashboard: Trainer updates listener error:', error);
    });

    return () => {
      if (unsubscribeTeam) unsubscribeTeam();
      if (unsubscribeTrainer) unsubscribeTrainer();
    };
  }, [user?.teamId, user?.uid]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotificationDropdown &&
        !event.target.closest('[data-notification-bell]') &&
        !event.target.closest('.notification-dropdown')) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationDropdown]);

  // Check for approaching deadlines periodically
  // NOTE: This is disabled for Team Members as it requires cross-user data access 
  // that typically leads to permission errors. Deadlines are better handled via
  // dedicated notifications or server-side checks.
  /*
  useEffect(() => {
    const checkDeadlines = async () => {
      try {
        await checkApproachingDeadlines();
      } catch (err) {
        logger.error('Failed to check approaching deadlines:', err);
      }
    };
    checkDeadlines();
  }, []);
  */

  const loadTeamData = async () => {
    try {
      setLoading(true);
      const teamData = await getTeam(user.teamId);
      setTeam(teamData);

      // Updates are now handled by real-time listener
      // Notifications handled by useNotifications hook

      // Note: Updates are now handled by real-time listener
    } catch (err) {
      showError('Failed to load team data: ' + (err.message || 'Unknown error'));
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  // (Notification/Template loaders removed - replaced by hooks/tabs)

  const handleAcknowledge = async (updateId, comment = '') => {
    try {
      await acknowledgeUpdate(updateId, user.uid, comment);
      logActivity(user, { eventType: 'update_acknowledged', action: 'Acknowledged an update', targetId: updateId });
      setAcknowledgments(prev => ({
        ...prev,
        [updateId]: { acknowledgedAt: new Date() }
      }));

      showSuccess('Update acknowledged successfully!');
    } catch (err) {
      showError('Failed to acknowledge update: ' + (err.message || 'Unknown error'));
      logger.error(err);
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
      const teamId = user.teamId;
      if (!teamId) {
        showError('You must be assigned to a team to create updates.');
        return;
      }

      showSuccess('Update created and released to the team!');
      await createUpdate(
        teamId,
        formData.title,
        formData.content,
        user.uid,
        formData.deadline ? new Date(formData.deadline) : null
      );
      logActivity(user, { eventType: 'update_created', action: 'Created an update', detail: formData.title });

      setShowCreateUpdate(false);
      setUpdateToEdit(null);
    } catch (err) {
      logger.error('Error submitting update:', err);
      showError(`Failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDeleteUpdate = (update) => {
    setShowDeleteUpdateModal({ isOpen: true, update });
  };

  const confirmDeleteUpdate = async () => {
    try {
      const updateId = showDeleteUpdateModal.update.id;
      await deleteUpdate(updateId);
      showSuccess('Update deleted successfully');
      setShowDeleteUpdateModal({ isOpen: false, update: null });
    } catch (err) {
      logger.error('Error deleting update:', err);
      showError(`Failed to delete: ${err.message || 'Unknown error'}`);
    }
  };

  const handleSignOut = async () => {
    try {
      // Don't let a slow/offline write block sign-out; the server sweeper is the backstop.
      await Promise.race([endAllOpenSessions(user), new Promise((r) => setTimeout(r, 3000))]);
      await signOutUser();
    } catch (err) {
      logger.error(err);
    }
  };

  const isAcknowledged = (updateId) => {
    return acknowledgments[updateId] && acknowledgments[updateId].acknowledgedAt;
  };

  // Request browser notification permission
  const requestBrowserNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      logger.log('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      setBrowserNotificationPermission('granted');
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      setBrowserNotificationPermission(permission);
      return permission === 'granted';
    }

    return false;
  }, []);  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // Navigate to updates tab if it's an update notification
    if (notification.updateId) {
      setActiveTab('updates');
      setShowNotificationDropdown(false);
      // Scroll to update after a brief delay
      setTimeout(() => {
        const updateElement = document.querySelector(`[data-update-id="${notification.updateId}"]`);
        if (updateElement) {
          updateElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      setShowNotificationDropdown(false);
    }
  };

  const handleAcknowledgeFromNotification = async (notification, e) => {
    e.stopPropagation(); // Prevent triggering handleNotificationClick

    if (!notification.updateId) {
      showError('This notification is not associated with an update.');
      return;
    }

    // Check if already acknowledged
    try {
      await handleAcknowledge(notification.updateId);
      await markAsRead(notification.id);
      setShowNotificationDropdown(false);
    } catch (err) {
      logger.error('Failed to acknowledge from notification:', err);
      showError('Failed to acknowledge update');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      logger.error('Failed to mark all as read:', err);
      showError('Failed to clear notifications');
    }
  };

  const handleDeleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await removeNotification(notificationId);
    } catch (err) {
      logger.error('Failed to delete notification:', err);
      showError('Failed to delete notification');
    }
  };

  // Function to detect if content has links
  const hasLinks = (content) => {
    if (!content) return false;
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return urlRegex.test(content);
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

  if (loading && !team && updates.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#050505]">
        <div className="max-w-[98%] mx-auto py-6 sm:px-6 lg:px-8">
          <Skeleton lines={2} className="mb-6" />
          <CardSkeleton count={3} />
        </div>
      </div>
    );
  }



  const pendingUpdates = updates.filter(update => !isAcknowledged(update.id));
  const acknowledgedUpdates = updates.filter(update => isAcknowledged(update.id));

  if (user?.teamId) {
    return (

      <>
      <DashboardShell
        user={user}
        sections={user?.teamId ? visibleTabs : []}
        activeId={activeTab}
        onNavigate={setActiveTab}
        onSignOut={handleSignOut}
        onChangePassword={() => setShowChangePasswordModal(true)}
        topCenter={<div className="max-w-2xl mx-auto w-full"><FocusTimer /></div>}
        topRight={(
          <>
                {/* Notification Bell */}
                <div className="relative">
                  <button
                    data-notification-bell
                    onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                    className={`relative p-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95
                      ${showNotificationDropdown ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                  >
                    <BellIcon className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#0a0a0a]">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Container */}
                  <AnimatePresence>
                    {showNotificationDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-3 w-[380px] max-w-[calc(100vw-2rem)] z-50 transform origin-top-right"
                      >
                        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/8 bg-white dark:bg-[#0f0f0f] shadow-2xl backdrop-blur-xl">
                          <div className="px-4 py-3.5 border-b border-gray-100 dark:border-white/6 flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
                            <button onClick={handleMarkAllAsRead} className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest transition-colors">Clear All</button>
                          </div>
                          <div className="max-h-[min(600px,calc(80vh-140px))] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                              <div className="py-10 px-6 text-center">
                                <p className="text-sm text-gray-500">No new notifications</p>
                              </div>
                            ) : (
                              notifications.map((notification, idx) => (
                                <div 
                                  key={notification.id} 
                                  onClick={() => handleNotificationClick(notification)}
                                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors relative group/item ${idx < notifications.length - 1 ? 'border-b border-gray-100 dark:border-white/5' : ''}`}
                                >
                                  {!notification.isRead && (
                                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"></div>
                                  )}
                                  <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-[11px] leading-relaxed ${notification.isRead ? 'text-gray-500 dark:text-gray-400 font-medium' : 'text-gray-900 dark:text-gray-100 font-bold'}`}>
                                        {notification.message}
                                      </p>
                                      <p className="text-[10px] text-gray-400 mt-1 font-medium italic opacity-60">
                                        {notification.createdAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Recently'}
                                      </p>
                                    </div>
                                    <button 
                                      onClick={(e) => handleDeleteNotification(notification.id, e)}
                                      className="p-1.5 text-gray-300 hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-all"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
          </>
        )}
      >
        {!user?.teamId ? (
          <div className="flex flex-col items-center justify-center p-4 h-[calc(100vh-140px)] opacity-75">
            <EmptyState
              icon={<UserGroupIcon className="h-16 w-16 text-gray-400" />}
              title="No Team Assigned"
              description="You haven't been assigned to a team yet. Please contact your administrator."
              actionLabel="Sign Out"
              onAction={handleSignOut}
            />
          </div>
        ) : (
          <>
              {/* Tab Content */}
              {activeTab === 'updates' && (
                <div className="space-y-6">
                  {features.canCreateUpdates && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowCreateUpdate(true)}
                        className="group relative inline-flex items-center gap-2.5 pl-3.5 pr-5 py-2.5 rounded-2xl gradient-accent text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-[1.04] active:scale-[0.98] transition-all overflow-hidden ring-1 ring-white/20"
                      >
                        <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
                        <span className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm">
                          <PlusIcon className="w-4 h-4" strokeWidth={2.5} />
                        </span>
                        <span className="relative">Create Update</span>
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pending Updates */}
                  <div className="relative group/pending">
                    <div className="absolute inset-x-0 -top-10 -bottom-10 bg-gradient-to-br from-indigo-500/10 via-cyan-500/5 to-transparent blur-3xl opacity-50 pointer-events-none rounded-[3rem] transition-opacity duration-500 group-hover/pending:opacity-100"></div>
                    
                    <div className="relative bg-white/60 dark:bg-[#111111]/80 shadow-2xl rounded-[2.5rem] overflow-hidden border border-gray-200/50 dark:border-white/5 backdrop-blur-xl flex flex-col h-full">
                      <div className="px-6 py-6 sm:px-8 border-b border-gray-200/50 dark:border-white/5 relative overflow-hidden flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent dark:from-white/[0.02] dark:to-transparent pointer-events-none"></div>
                        <div className="relative flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex-none w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25 ring-1 ring-white/20">
                              <MegaphoneIcon className="w-5 h-5 text-white" />
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white truncate">Pending Updates</h3>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Awaiting acknowledgment</p>
                            </div>
                          </div>
                          <span className="flex-none text-[10px] whitespace-nowrap font-black uppercase tracking-widest text-amber-600 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-400/10 ring-1 ring-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                              {pendingUpdates.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            {pendingUpdates.length} Pending
                          </span>
                        </div>
                      </div>

                      <div className="p-6 flex-grow custom-scrollbar overflow-y-auto">
                        {pendingUpdates.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/[0.07] dark:to-white/[0.02] border border-gray-200/60 dark:border-white/10 flex items-center justify-center mb-4 shadow-sm">
                              <CheckCircleIcon className="w-8 h-8 text-emerald-400/80" />
                            </div>
                            <p className="text-sm font-black text-gray-600 dark:text-gray-300">All caught up</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">No updates awaiting acknowledgment</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {pendingUpdates.map((update) => (
                              <UpdateCard
                                key={update.id}
                                update={update}
                                isAcknowledged={false}
                                onAcknowledge={handleAcknowledge}
                                onEdit={update.createdBy === user.uid ? handleEditUpdate : null}
                                onDelete={update.createdBy === user.uid ? handleDeleteUpdate : null}
                                onViewDetails={(u) => {
                                  setSelectedUpdate(u);
                                  setShowAcknowledgmentModal(true);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acknowledged Updates */}
                  <div className="relative group/acknowledged">
                    <div className="absolute inset-x-0 -top-10 -bottom-10 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent blur-3xl opacity-50 pointer-events-none rounded-[3rem] transition-opacity duration-500 group-hover/acknowledged:opacity-100"></div>
                    
                    <div className="relative bg-white/60 dark:bg-[#111111]/80 shadow-2xl rounded-[2.5rem] overflow-hidden border border-gray-200/50 dark:border-white/5 backdrop-blur-xl flex flex-col h-full">
                      <div className="px-6 py-6 sm:px-8 border-b border-gray-200/50 dark:border-white/5 relative overflow-hidden flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent dark:from-white/[0.02] dark:to-transparent pointer-events-none"></div>
                        <div className="relative flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex-none w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
                              <CheckCircleIcon className="w-5 h-5 text-white" />
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white truncate">Acknowledged</h3>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Confirmed &amp; done</p>
                            </div>
                          </div>
                          <span className="flex-none text-[10px] whitespace-nowrap font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-400/10 ring-1 ring-emerald-500/20 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                            {acknowledgedUpdates.length} Done
                          </span>
                        </div>
                      </div>

                      <div className="p-6 flex-grow custom-scrollbar overflow-y-auto">
                        {acknowledgedUpdates.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/[0.07] dark:to-white/[0.02] border border-gray-200/60 dark:border-white/10 flex items-center justify-center mb-4 shadow-sm">
                              <DocumentDuplicateIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                            </div>
                            <p className="text-sm font-black text-gray-600 dark:text-gray-300">Nothing here yet</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Acknowledged updates will appear here</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {acknowledgedUpdates.map((update) => (
                              <UpdateCard
                                key={update.id}
                                update={update}
                                isAcknowledged={true}
                                acknowledgmentDate={acknowledgments[update.id]?.acknowledgedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                                onViewDetails={(u) => {
                                  setSelectedUpdate(u);
                                  setShowAcknowledgmentModal(true);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {/* Removed Modified Breaks Tab */}

              {activeTab === 'case-tracker' && features.caseTracker && (
                <CaseTrackerTab />
              )}

              {activeTab === 'metric-analytics' && features.metrics && (
                <MetricAnalyticsTab />
              )}

              {/* SPII Cases Tab */}
              {activeTab === 'spii-cases' && (
                <div className="relative overflow-hidden rounded-[2.5rem] bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 border border-white/20 dark:border-white/10 transition-all duration-500 hover:shadow-indigo-500/20 animate-in fade-in zoom-in duration-500">
                  <ConfirmModal
                    isOpen={spiiDeleteModalOpen}
                    onClose={() => setSpiiDeleteModalOpen(false)}
                    onConfirm={handleConfirmSpiiDelete}
                    title="Delete SPII Case"
                    message={`Are you sure you want to delete ${spiiCaseToDelete?.caseId}? This action cannot be reversed.`}
                    confirmText="Delete SPII Case"
                    type="danger"
                  />

                  {/* Privacy Exclusion Modal */}
                  <Modal isOpen={exclusionModalOpen} onClose={() => setExclusionModalOpen(false)} size="md">
                    <Modal.Header onClose={() => setExclusionModalOpen(false)}>
                      <Modal.Title>Privacy Review Exclusion</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                      <div className="space-y-6">
                        {/* Case identifier */}
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 rounded-2xl p-4 border border-gray-200/50 dark:border-white/10">
                          <div className="p-2 rounded-xl bg-indigo-500/10">
                            <ClipboardDocumentIcon className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Case Identifier</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white font-mono tracking-tight">#{exclusionCase?.caseId}</p>
                          </div>
                        </div>

                        {/* Reason Selector */}
                        <div>
                          <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Exclusion Reason</label>
                          <PremiumSelect
                            value={exclusionReason}
                            onChange={(val) => {
                              setExclusionReason(val);
                              setExclusionTarget('');
                            }}
                            options={[
                              { value: '', label: 'Select a reason...' },
                              { value: 'Transferred', label: 'Transferred' },
                              { value: 'Reassigned', label: 'Reassigned' },
                              { value: 'Not Applicable', label: 'Not Applicable' }
                            ]}
                            className="w-full !rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 !py-3 font-bold"
                          />
                        </div>

                        {/* Dynamic sub-dropdown: Transfer Destination */}
                        {exclusionReason === 'Transferred' && (
                          <div className="animate-in slide-in-from-top duration-300">
                            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Transfer Destination</label>
                            <PremiumSelect
                              value={exclusionTarget}
                              onChange={(val) => setExclusionTarget(val)}
                              options={[
                                { value: '', label: 'Select destination...' },
                                { value: 'Maps', label: 'Maps' },
                                { value: 'A&S', label: 'A&S' },
                                { value: 'Tech', label: 'Tech' },
                                { value: 'GWS', label: 'GWS' }
                              ]}
                              className="w-full !rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 !py-3 font-bold"
                            />
                          </div>
                        )}

                        {/* Dynamic sub-dropdown: Reassign to User */}
                        {exclusionReason === 'Reassigned' && (
                          <div className="animate-in slide-in-from-top duration-300">
                            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Reassign To</label>
                            <PremiumSelect
                              value={exclusionTarget}
                              onChange={(val) => setExclusionTarget(val)}
                              options={[
                                { value: '', label: 'Select user...' },
                                ...allUsers
                                  .filter(u => u.id !== user?.uid)
                                  .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
                                  .map(u => ({
                                    value: u.id,
                                    label: u.displayName || u.email || `User ${u.id.substring(0, 6)}`
                                  }))
                              ]}
                              className="w-full !rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 !py-3 font-bold"
                            />
                          </div>
                        )}

                        {/* Preview Badge */}
                        {exclusionReason && (exclusionReason === 'Not Applicable' || exclusionTarget) && (
                          <div className="animate-in fade-in duration-500 bg-gradient-to-r from-rose-500/5 to-amber-500/5 rounded-2xl p-4 border border-rose-500/10">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Preview</p>
                            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl w-fit">
                              <span className="text-[11px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider">
                                {exclusionReason === 'Not Applicable' 
                                  ? 'Not Applicable' 
                                  : exclusionReason === 'Transferred' 
                                    ? `Invalid as this case is transferred to -> ${exclusionTarget}` 
                                    : `Transferred to -> ${allUsers.find(u => u.id === exclusionTarget)?.displayName || exclusionTarget}`
                                }
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Modal.Body>
                    <Modal.Footer>
                      <button
                        onClick={() => {
                          if (exclusionCase) {
                            // Allow reverting back to standard
                            handleUpdateSpiiPrivacy(exclusionCase.id, 'no');
                            setExclusionModalOpen(false);
                          }
                        }}
                        className="px-5 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-[11px] font-black uppercase tracking-widest transition-all"
                      >
                        Revert to Pending
                      </button>
                      <button
                        onClick={handleSaveExclusion}
                        disabled={savingExclusion || !exclusionReason || (exclusionReason !== 'Not Applicable' && !exclusionTarget)}
                        className="px-6 py-2.5 bg-gradient-to-br from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {savingExclusion ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>Saving...</span>
                          </>
                        ) : 'Confirm Exclusion'}
                      </button>
                    </Modal.Footer>
                  </Modal>
                  
                  {/* Premium Header */}
                  <div className="px-8 py-10 border-b border-gray-200/50 dark:border-white/10 bg-gray-50/90 dark:bg-white/5 backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500 opacity-90"></div>
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="flex items-center space-x-5">
                        <div className="p-4 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl shadow-xl shadow-indigo-500/20 transform hover:rotate-3 transition-transform duration-300">
                          <div className="relative">
                            <ClipboardDocumentIcon className="w-8 h-8 text-white" />
                            <div className="absolute -top-1 -right-1 flex h-3 w-3">
                               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                               <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-none">SPII Intelligence</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium tracking-wide">Log SPII cases</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-10">
                    {/* Simplified Premium Form */}
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[2.5rem] blur-xl opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                      <form onSubmit={handleAddSpiiCase} className="relative bg-white/90 dark:bg-[#202024]/90 p-8 rounded-[2.5rem] border border-gray-200/50 dark:border-white/10 shadow-2xl backdrop-blur-sm">
                        <div className="flex items-center mb-8 ml-1">
                          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/10 mr-3">
                            <PlusCircleIcon className="w-5 h-5 text-indigo-500" />
                          </div>
                          <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.25em]">
                            Track SPII Case
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                          <div className="md:col-span-1">
                            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Identifier (Case ID)</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g., 00012345"
                              className="w-full px-5 py-4 bg-gray-50/90 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-gray-900 dark:text-white placeholder-gray-400/80"
                              value={spiiForm.caseId}
                              onChange={(e) => setSpiiForm({ ...spiiForm, caseId: e.target.value })}
                            />
                          </div>
                          
                          <div className="md:col-span-1">
                            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Current Status</label>
                            <PremiumSelect
                              value={spiiForm.status}
                              onChange={(val) => setSpiiForm({ ...spiiForm, status: val })}
                              options={['Assigned', 'SO', 'WOCR', 'WOCRE', 'IPGS', 'IPGE', 'IPCR', 'IPGO', 'Closed'].map(opt => ({
                                value: opt,
                                label: opt
                              }))}
                              className="!rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/90 dark:bg-white/5 !py-3.5 font-bold"
                            />
                          </div>

                          {(spiiForm.status === 'SO' || spiiForm.status === 'Closed') ? (
                            <div className="md:col-span-1 animate-in slide-in-from-left duration-500">
                              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Privacy Governance</label>
                              <div className="flex bg-gray-100/90 dark:bg-white/10 p-1.5 rounded-2xl border border-gray-200/50 dark:border-white/10 backdrop-blur-sm">
                                {['yes', 'no'].map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setSpiiForm({ ...spiiForm, submittedPrivacy: opt })}
                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${spiiForm.submittedPrivacy === opt
                                      ? 'bg-white dark:bg-indigo-500 text-indigo-600 dark:text-white shadow-lg'
                                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-white/5'
                                      }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="md:col-span-1 opacity-40 grayscale group/na relative">
                              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 italic">Review Locked</label>
                              <div className="h-[54px] flex items-center justify-center bg-gray-100/30 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-300 dark:border-white/10 transition-colors group-hover/na:border-gray-400">
                                <span className="text-[10px] font-bold text-gray-400 tracking-tight">Status must be SO or Closed</span>
                              </div>
                            </div>
                          )}

                          <div className="md:col-span-1">
                            <button
                              type="submit"
                              disabled={addingSpii}
                              className="w-full h-14 bg-gradient-to-br from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 transition-all duration-300 transform active:scale-[0.98] hover:shadow-indigo-500/40 disabled:opacity-50"
                            >
                              {addingSpii ? (
                                <div className="flex items-center justify-center gap-2">
                                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  <span>Archiving...</span>
                                </div>
                              ) : 'Track SPII'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>

                    {/* Integrated Filters & Data Ledger */}
                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
                        <div>
                          <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight italic">Intelligence Ledger</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.2em] mt-2">Audit log of your SPII Cases</p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="relative group min-w-[240px]">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <MagnifyingGlassIcon className={`w-4 h-4 transition-colors duration-300 ${spiiSearchTerm ? 'text-indigo-500' : 'text-gray-400'}`} />
                            </div>
                            <input
                              type="text"
                              placeholder="Search Case Identifier..."
                              value={spiiSearchTerm}
                              onChange={(e) => setSpiiSearchTerm(e.target.value)}
                              className="block w-full pl-11 pr-4 py-3 bg-white/90 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-2xl text-[11px] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-300 font-bold"
                            />
                          </div>
                          
                          <PremiumSelect
                            value={spiiStatusFilter}
                            onChange={(val) => setSpiiStatusFilter(val)}
                            options={[
                              { value: 'all', label: 'All Operation States' },
                              ...['Assigned', 'SO', 'WOCR', 'WOCRE', 'IPGS', 'IPGE', 'IPCR', 'IPGO', 'Closed'].map(opt => ({
                                value: opt, label: opt
                              }))
                            ]}
                            size="md"
                            className="bg-white/90 dark:bg-white/10 border-gray-200 dark:border-white/10 transition-all duration-300 min-w-[180px] font-bold"
                          />
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[2rem] border border-gray-200/50 dark:border-white/10 bg-white/90 dark:bg-[#18181b]/80 backdrop-blur-sm shadow-inner">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200/50 dark:divide-white/5">
                            <thead className="bg-gray-50/95 dark:bg-white/10 uppercase">
                              <tr>
                                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.25em]">Identification</th>
                                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.25em]">Case Status</th>
                                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.25em]">Submitted Privacy Review</th>
                                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.25em]">Log Date</th>
                                <th className="px-8 py-5 text-right text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.25em]">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100/50 dark:divide-white/5">
                              {spiiLoading ? (
                                <tr>
                                  <td colSpan="5" className="px-6 py-24 text-center">
                                    <div className="flex flex-col items-center justify-center gap-4">
                                      <div className="relative">
                                        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                        </div>
                                      </div>
                                      <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-500/60 animate-pulse">Synchronizing Intelligence Ledger</span>
                                    </div>
                                  </td>
                                </tr>
                              ) : filteredSpiiCases.length === 0 ? (
                                <tr>
                                  <td colSpan="5" className="px-6 py-20 text-center">
                                    <EmptyState
                                      icon={<ClipboardDocumentIcon className="h-12 w-12 text-gray-200 dark:text-gray-800" />}
                                      title={spiiSearchTerm ? "No identity matches" : "Ledger is empty"}
                                      description={spiiSearchTerm ? `No log entries for "${spiiSearchTerm}" found.` : "Initiate a governance log to build your history."}
                                    />
                                  </td>
                                </tr>
                              ) : (
                                filteredSpiiCases.map((c) => (
                                  <tr key={c.id} className="group hover:bg-white/60 dark:hover:bg-white/[0.02] transition-all duration-500">
                                    <td className="px-8 py-6 whitespace-nowrap">
                                      <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                        </div>
                                        <span className="text-sm font-black text-gray-900 dark:text-white font-mono tracking-tighter group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                          #{c.caseId}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap">
                                      <PremiumSelect
                                        value={c.status}
                                        onChange={(val) => handleUpdateSpiiStatus(c.id, val)}
                                        options={['Assigned', 'SO', 'WOCR', 'WOCRE', 'IPGS', 'IPGE', 'IPCR', 'IPGO', 'IPTP', 'Closed'].map(status => ({
                                          value: status,
                                          label: status
                                        }))}
                                        size="sm"
                                        className={`font-black uppercase tracking-tighter shadow-sm w-[140px] transition-all
                                           ${c.status === 'Closed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-emerald-500/5' :
                                            c.status === 'Assigned' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 shadow-indigo-500/5' :
                                              'bg-gray-100/95 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10'}`}
                                      />
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap">
                                      {(c.status === 'SO' || c.status === 'Closed') ? (
                                        <div className="flex items-center gap-3">
                                          {c.submittedPrivacy === 'excluded' ? (
                                            <div 
                                              className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-rose-500/20 transition-all justify-between"
                                              onClick={() => {
                                                setExclusionCase(c);
                                                setExclusionReason(c.privacyExclusionReason || '');
                                                setExclusionTarget(c.privacyExclusionTarget || '');
                                                setExclusionModalOpen(true);
                                              }}
                                            >
                                                <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-widest leading-tight">
                                                  {c.privacyExclusionReason === 'Not Applicable' ? 'NA' : c.privacyExclusionReason}
                                                  {c.privacyExclusionTarget ? ` -> ${c.privacyExclusionReason === 'Reassigned' ? (allUsers.find(u => u.id === c.privacyExclusionTarget)?.displayName || c.privacyExclusionTarget) : c.privacyExclusionTarget}` : ''}
                                                </span>
                                                <PencilSquareIcon className="w-3 h-3 text-rose-500 dark:text-rose-400 opacity-60 flex-shrink-0" />
                                            </div>
                                          ) : (
                                            <>
                                              <PremiumSelect
                                                value={c.submittedPrivacy || 'no'}
                                                onChange={(val) => handleUpdateSpiiPrivacy(c.id, val)}
                                                options={[
                                                  { value: 'yes', label: 'APPROVED' },
                                                  { value: 'no', label: 'PENDING' },
                                                  { value: 'EXCLUDE', label: 'CANNOT SUBMIT' }
                                                ]}
                                                size="sm"
                                                className={`font-black uppercase tracking-widest w-[140px] transition-all
                                                  ${c.submittedPrivacy === 'yes' ? '!bg-emerald-500 shadow-lg shadow-emerald-500/30 !text-white !border-emerald-500' : '!bg-gray-100 dark:!bg-white/10 !text-gray-700 dark:!text-gray-300 border-transparent'}`}
                                              />
                                              <div className={`w-1.5 h-1.5 rounded-full ${c.submittedPrivacy === 'yes' ? 'bg-emerald-500 shadow-glow-emerald' : 'bg-gray-400 dark:bg-gray-600'} animate-pulse flex-shrink-0`}></div>
                                            </>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 group/tip">
                                          <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-white/10 transition-colors group-hover/tr:bg-indigo-500/30"></div>
                                          <span className="text-[10px] font-black text-gray-300 dark:text-gray-700 uppercase tracking-widest">Awaiting Phase</span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                          {c.createdAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'Cycle Recorded'}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1 opacity-60">
                                          {c.createdAt?.toDate?.()?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) || ''}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap text-right">
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteSpiiCaseClick(e, c)}
                                        disabled={deletingSpiiId === c.id}
                                        className="p-3 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all duration-300 group/del"
                                      >
                                        {deletingSpiiId === c.id ? (
                                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                          <TrashIcon className="h-5 w-5 group-hover/del:scale-110 transition-transform" />
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* GCP Billing Calculation Tab */}
              {
                activeTab === 'gcp-billing' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CalculatorTab activeTab={activeTab} />

                    {/* Runaway Calculations Section */}
                    <div className="relative group min-h-full">
                      <RunawayCalculatorTab />
                    </div>
                  </div>
                )
              }

              {/* Templates Tab */}
              {activeTab === 'templates' && (
                <FloatingPanel title="Templates" width={520} height={720}>
                  {(floating) => <TemplatesTab user={user} compact={floating} live={live} />}
                </FloatingPanel>
              )}

              {/* SPII Analytics Tab */}
              {activeTab === 'spii-dashboard' && (
                <SpiiVisualDashboardTab currentUser={user} />
              )}
              {activeTab === 'spii-audit' && (
                <SpiiAuditLogsTab currentUser={user} />
              )}

              {/* Notes Tab (Scratchpad) */}
              {
                activeTab === 'notes' && (
                  <ScratchpadTab user={user} spiiSettings={spiiSettings} />
                )
              }

              {/* Apps Script integration (gated by the appsScript feature flag) */}
              {activeTab === 'apps-script' && features.appsScript && (
                <AppsScriptTab user={user} />
              )}




            {/* Redundant Template/Toast Modals Removed */}
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

            <ConfirmModal
              isOpen={showDeleteUpdateModal.isOpen}
              onClose={() => setShowDeleteUpdateModal({ isOpen: false, update: null })}
              onConfirm={confirmDeleteUpdate}
              title="Delete Update"
              message="Are you sure you want to delete this update? This will also remove all acknowledgments and cannot be undone."
              confirmText="Delete"
              variant="danger"
            />
          </>
        )}
      </DashboardShell>
      </>
    );
  } else {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">You do not have a team assigned. Please contact your administrator.</p>
            <Button onClick={handleSignOut}>Sign Out</Button>
          </Card>
        </div>
      );
    }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Skeleton className="h-12 w-12 rounded-full" />
    </div>
  );
};

export default TeamMemberDashboard;
