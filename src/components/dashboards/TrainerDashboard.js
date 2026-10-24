import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../services/activity';
import { signOutUser } from '../../firebase/auth';
import { getAllUsers, getAllTeamMemberUsers } from '../../services/users';
import { createUpdate, getUpdateAcknowledgmentBreakdownForTrainer, deleteUpdate, updateUpdate, bumpUsersForUpdate } from '../../services/updates';
import { onSnapshot, query, collection, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { logger } from '../../utils/logger';
import ChangePasswordModal from '../ChangePasswordModal';
import UserMenu from './UserMenu';
import AcknowledgmentModal from '../AcknowledgmentModal';
import UpdateCard from './UpdateCard';
import CreateUpdateModal from './CreateUpdateModal';
import NotificationCenter from '../common/NotificationCenter';
import DashboardShell from './DashboardShell';
import { renderContentWithLinks } from '../../utils/text';
import { Button, Card, Badge, Modal, Skeleton, CardSkeleton, EmptyState, Alert, Input, DateTimePicker } from '../ui';
import { showSuccess, showError } from '../../utils/toast';

const TrainerDashboard = () => {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState([]); // All users except admin
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusBreakdown, setStatusBreakdown] = useState({});
  const [showDeleteUpdateModal, setShowDeleteUpdateModal] = useState({ isOpen: false, update: null });
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [showAcknowledgmentModal, setShowAcknowledgmentModal] = useState(false);

  // Form states
  const [showCreateUpdate, setShowCreateUpdate] = useState(false);
  const [updateToEdit, setUpdateToEdit] = useState(null);
  const [updateForm, setUpdateForm] = useState({ title: '', content: '', deadline: '', excludedUserIds: [] });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [activeTab, setActiveTab] = useState('updates');

  const DEFAULT_FEATURES = {
    updates: true,
    gcpBilling: true,
    templates: true,
    notes: true,
    metrics: true,
    spiiCases: true
  };

  const features = React.useMemo(() => {
    if (!user?.features) return DEFAULT_FEATURES;
    return { ...DEFAULT_FEATURES, ...user.features };
  }, [user?.features]);



  const fetchTeamMembers = async () => {
    try {
      const members = await getAllTeamMemberUsers();
      setAllTeamMembers(members);
    } catch (error) {
      logger.error('Error fetching team members:', error);
    }
  };

  // Real-time listener for all updates created by this trainer
  useEffect(() => {
    logger.log('TrainerDashboard: Setting up real-time listener for updates created by:', user.uid);

    // Use query to get all updates created by this trainer
    const updatesQuery = query(
      collection(db, 'updates'),
      where('createdBy', '==', user.uid)
    );

    const unsubscribe = onSnapshot(updatesQuery, (snapshot) => {
      logger.log('TrainerDashboard: Updates snapshot received, size:', snapshot.size);
      logger.log('TrainerDashboard: Snapshot metadata:', {
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites
      });

      // Clear any previous errors on successful load
      showError('');

      const updatesData = snapshot.docs.map(doc => {
        const data = doc.data();
        logger.log('TrainerDashboard: Update document:', doc.id, {
          title: data.title,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || 'No date'
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

      logger.log('TrainerDashboard: Setting updates state with', updatesData.length, 'updates');
      logger.log('TrainerDashboard: Update titles:', updatesData.map(u => u.title));
      setUpdates(updatesData);

      // Load acknowledgment status for each update (async, but don't block)
      (async () => {
        const breakdownPromises = updatesData.map(async (update) => {
          try {
            // For trainer updates, use the function that gets notified users from notifications
            // Pass allUsers to avoid N+1 N+1 database calls
            const breakdown = await getUpdateAcknowledgmentBreakdownForTrainer(update.id, update.deadline, allUsers);
            logger.log('TrainerDashboard: Breakdown for update', update.id, ':', breakdown);
            return { updateId: update.id, breakdown };
          } catch (err) {
            logger.error('Failed to load acknowledgment breakdown for update:', update.id, err);
            return { updateId: update.id, breakdown: null };
          }
        });

        const breakdowns = await Promise.all(breakdownPromises);
        breakdowns.forEach(({ updateId, breakdown }) => {
          if (breakdown) {
            setStatusBreakdown(prev => ({ ...prev, [updateId]: breakdown }));
          }
        });
      })();
    }, (error) => {
      logger.error('TrainerDashboard: Error in updates listener:', error);
      logger.error('TrainerDashboard: Error code:', error.code);
      logger.error('TrainerDashboard: Error message:', error.message);

      if (error.code === 'permission-denied') {
        showError('Permission denied: Cannot read updates. Please check your permissions.');
      } else {
        showError('Failed to load updates in real-time: ' + (error.message || 'Unknown error'));
      }
    });

    return () => {
      logger.log('TrainerDashboard: Cleaning up updates listener');
      unsubscribe();
    };
  }, [user.uid, allUsers]);

  // Real-time listener for acknowledgments to update status breakdown in real-time
  useEffect(() => {
    if (updates.length === 0) {
      return;
    }

    logger.log('TrainerDashboard: Setting up real-time listener for acknowledgments');

    // Get all update IDs
    const updateIds = updates.map(update => update.id);
    if (updateIds.length === 0) return;

    // Create a query for acknowledgments for all updates
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
        logger.log('TrainerDashboard: Acknowledgments snapshot received, size:', snapshot.size);
        logger.log('TrainerDashboard: Changed acknowledgments:', snapshot.docChanges().map(change => ({
          type: change.type,
          updateId: change.doc.data().updateId,
          userId: change.doc.data().userId
        })));

        // Reload status breakdown for all updates when acknowledgments change
        const breakdownPromises = updates.map(async (update) => {
          try {
            // For trainer updates, use the function that gets notified users from notifications
            // Pass allUsers to avoid N+1 database calls
            const breakdown = await getUpdateAcknowledgmentBreakdownForTrainer(update.id, update.deadline, allUsers);
            logger.log('TrainerDashboard: Breakdown for update', update.id, ':', {
              total: breakdown.total,
              acknowledged: breakdown.acknowledgedCount,
              pending: breakdown.pendingCount,
              failed: breakdown.failedCount
            });
            return { updateId: update.id, breakdown };
          } catch (error) {
            logger.error('Error reloading acknowledgment data for update:', update.id, error);
            return { updateId: update.id, breakdown: null };
          }
        });

        const breakdowns = await Promise.all(breakdownPromises);
        const statusBreakdownData = {};
        breakdowns.forEach(({ updateId, breakdown }) => {
          if (breakdown) {
            statusBreakdownData[updateId] = breakdown;
          }
        });

        logger.log('TrainerDashboard: Updating status breakdown in real-time with data:', statusBreakdownData);
        setStatusBreakdown(prev => {
          const newBreakdown = { ...prev, ...statusBreakdownData };
          logger.log('TrainerDashboard: New breakdown state:', newBreakdown);
          return newBreakdown;
        });
      }, (error) => {
        logger.error('TrainerDashboard: Error in acknowledgments listener:', error);
        logger.error('TrainerDashboard: Error code:', error.code);
        logger.error('TrainerDashboard: Error message:', error.message);
        // Don't show error to user, just log it
      });
    });

    return () => {
      logger.log('TrainerDashboard: Cleaning up acknowledgments listeners');
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [updates]);

  const loadData = async () => {
    try {
      setLoading(true);
      logger.log('Loading data for Trainer user:', user.uid);

      // Load all users except admin
      try {
        const allUsersData = await getAllUsers();
        logger.log('getAllUsers returned:', allUsersData.length, 'users');
        logger.log('Sample users:', allUsersData.slice(0, 3).map(u => ({ id: u.id, email: u.email, role: u.role })));

        // Filter out admin, trainer, om, and som - only team_member and team_leader should receive updates
        const eligibleUsers = allUsersData.filter(u =>
          u.role !== 'admin' &&
          u.role !== 'trainer' &&
          u.role !== 'om' &&
          u.role !== 'som'
        );
        logger.log('Filtered eligible users (excluding admin, trainer, om, som):', eligibleUsers.length);
        setAllUsers(eligibleUsers);

        if (eligibleUsers.length === 0) {
          logger.warn('No eligible users found. This might be a permission issue.');
        }
      } catch (userLoadError) {
        logger.error('Error loading users:', userLoadError);
        showError(`Failed to load users: ${userLoadError.message || 'Unknown error'}`);
        // Set empty array so UI doesn't break
        setAllUsers([]);
      }

    } catch (err) {
      showError('Failed to load data: ' + (err.message || 'Unknown error'));
      logger.error('Error in loadData:', err);
    } finally {
      setLoading(false);
    }
  };



  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      logger.error('Sign out error:', err);
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
      const dummyTeamId = 'trainer-updates';

      await createUpdate(
        dummyTeamId,
        formData.title,
        formData.content,
        user.uid,
        formData.deadline ? new Date(formData.deadline) : null,
        formData.excludedUserIds || []
      );
      logActivity(user, { eventType: 'update_created', action: 'Created a broadcast update', detail: formData.title });

      showSuccess('Update created and released to all eligible users');
      setShowCreateUpdate(false);
      setUpdateToEdit(null);
    } catch (err) {
      logger.error('Error submitting update:', err);
      showError(`Failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleBumpUsers = async (updateId) => {
    try {
      showError('');
      showSuccess('');

      // Get all eligible users (already filtered to exclude admin, trainer, om, som)
      const userIds = allUsers.map(u => u.id);

      const result = await bumpUsersForUpdate(updateId, userIds);
      showSuccess(result.message || 'Reminder sent successfully');


    } catch (err) {
      showError(`Failed to send reminder: ${err.message || 'Unknown error'}`);
      logger.error('Error bumping users:', err);
    }
  };





  const handleDeleteUpdate = async () => {
    try {
      await deleteUpdate(showDeleteUpdateModal.update.id);
      showSuccess(`Update "${showDeleteUpdateModal.update.title}" deleted successfully`);
      setShowDeleteUpdateModal({ isOpen: false, update: null });

      setShowDeleteUpdateModal({ isOpen: false, update: null });
    } catch (err) {
      showError('Failed to delete update');
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cancelDeleteUpdate = () => {
    setShowDeleteUpdateModal({ isOpen: false, update: null });
  };




  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading Trainer Dashboard...</p>
        </div>
      </div>
    );
  }

  const trainerSections = [
    ...(features.updates ? [{ id: 'updates', label: 'Updates' }] : []),
    ...(features.gcpBilling ? [{ id: 'gcp-billing', label: 'GCP Billing' }] : []),
    ...(features.notes ? [{ id: 'notes', label: 'Notes' }] : []),
  ];

  return (
    <>
    <DashboardShell
      user={user}
      sections={trainerSections}
      activeId={activeTab}
      onNavigate={setActiveTab}
      onSignOut={handleSignOut}
      onChangePassword={() => setShowChangePasswordModal(true)}
      topRight={<NotificationCenter user={user} />}
    >
          <div className="hidden">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              {features.updates && (
                <button
                  onClick={() => setActiveTab('updates')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'updates'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                    }`}
                >
                  Updates
                </button>
              )}
              {features.gcpBilling && (
                <button
                  onClick={() => setActiveTab('gcp-billing')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'gcp-billing'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                    }`}
                >
                  GCP Billing
                </button>
              )}
              {features.notes && (
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'notes'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                    }`}
                >
                  Notes
                </button>
              )}
            </nav>
          </div>
        {/* Updates Tab */}
        {activeTab === 'updates' && features.updates && (
          <div className="bg-white dark:bg-[#0a0a0a] shadow dark:shadow-none rounded-2xl border border-gray-100 dark:border-white/10">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Updates
                </h3>
                <button
                  onClick={() => setShowCreateUpdate(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Create Update
                </button>
              </div>

              {updates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No updates yet. Create your first update to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {updates.map(update => (
                    <UpdateCard
                      key={update.id}
                      update={update}
                      statusBreakdown={statusBreakdown}
                      isManagerView={true}
                      onEdit={handleEditUpdate}
                      onViewDetails={(u) => {
                        setSelectedUpdate(u);
                        setShowAcknowledgmentModal(true);
                      }}
                      onBumpUsers={handleBumpUsers}
                      onDelete={(update) => setShowDeleteUpdateModal({ isOpen: true, update })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes Tab Placeholder */}
        {activeTab === 'notes' && features.notes && (
          <div className="bg-white dark:bg-[#0a0a0a] shadow dark:shadow-none rounded-2xl border border-gray-100 dark:border-white/10 p-6 text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Notes</h3>
            <p className="text-gray-500">Scratchpad and persistent notes will be available here.</p>
          </div>
        )}


          <CreateUpdateModal
            isOpen={showCreateUpdate}
            onClose={() => {
              setShowCreateUpdate(false);
              setUpdateToEdit(null);
            }}
            onSubmit={handleSubmitUpdate}
            initialData={updateToEdit || undefined}
            currentUser={user}
            allUsers={allUsers}
          />

        {/* Delete Update Confirmation Modal */}
        {showDeleteUpdateModal.isOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4">
            <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-5 border w-full sm:w-96 max-w-md shadow-lg rounded-md bg-white my-4 max-h-[90vh] overflow-y-auto">
              <div className="mt-3">
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
                    <p className="text-sm text-gray-500">
                      This action cannot be undone.
                    </p>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex justify-center space-x-3">
                    <button
                      onClick={cancelDeleteUpdate}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteUpdate}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                    >
                      Delete Update
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Notification Toast */}
      {notification.show && (
        <div className={`fixed bottom-4 left-4 z-50 transform transition-all duration-500 ease-in-out ${notification.fading ? 'opacity-0 translate-x-[-100%]' : 'opacity-100 translate-x-0'
          }`}>
          <div className={`${notification.type === 'info'
            ? 'bg-blue-600 text-white'
            : 'bg-green-600 text-white'
            } px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-64`}>
            {notification.type === 'info' ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />

      {/* Acknowledgment Modal */}
      <AcknowledgmentModal
        update={selectedUpdate}
        teamMembers={allUsers}
        isOpen={showAcknowledgmentModal}
        onClose={() => {
          setShowAcknowledgmentModal(false);
          setSelectedUpdate(null);
        }}
      />
    </DashboardShell>
    </>
  );
};

export default TrainerDashboard;

