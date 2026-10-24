/**
 * Acknowledgment Modal Component
 * 
 * This component displays detailed acknowledgment information for team updates.
 * It shows which team members have acknowledged an update and which are still pending.
 * 
 * Features:
 * - Tabbed interface showing pending and acknowledged members
 * - Completion rate visualization with progress bar
 * - Real-time data loading from Firestore
 * - Statistics cards showing total, acknowledged, and pending counts
 * - Status messages based on completion percentage
 * - Responsive design for different screen sizes
 * 
 * This modal is used by team leaders to track acknowledgment progress
 * and identify which team members need follow-up.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

import { getPendingAcknowledgmentMembers, getAcknowledgedMembers, getUpdateAcknowledgmentStatus } from '../services/updates';
import { onSnapshot, query, collection, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import Button from './ui/Button'; // Import standardized Button component

/**
 * AcknowledgmentModal Component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.update - The update object to show acknowledgment data for
 * @param {Array} props.teamMembers - Array of team members
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to call when modal should be closed
 * @returns {JSX.Element} The acknowledgment modal component
 */
const AcknowledgmentModal = ({ update, teamMembers, isOpen, onClose }) => {
  // State management for modal functionality
  const [activeTab, setActiveTab] = useState('pending');        // Current active tab
  const [pendingMembers, setPendingMembers] = useState([]);     // Members who haven't acknowledged
  const [acknowledgedMembers, setAcknowledgedMembers] = useState([]); // Members who have acknowledged
  const [loading, setLoading] = useState(false);                // Loading state for data fetching

  /**
   * Load Acknowledgment Data
   * 
   * Fetches acknowledgment data from Firestore for the current update.
   * This includes:
   * - Members who haven't acknowledged the update
   * - Members who have acknowledged the update
   * - All acknowledgment records for the update
   * 
   * The data is fetched in parallel for better performance.
   */
  const loadAcknowledgmentData = useCallback(async () => {
    if (!update || !teamMembers) return;

    setLoading(true);
    try {
      logger.log('AcknowledgmentModal: Loading acknowledgment data for update:', update.id);
      // Fetch all acknowledgment data in parallel for better performance
      const [pending, acknowledged] = await Promise.all([
        getPendingAcknowledgmentMembers(update.id, teamMembers),  // Members who haven't acknowledged
        getAcknowledgedMembers(update.id, teamMembers),           // Members who have acknowledged
        getUpdateAcknowledgmentStatus(update.id)                  // All acknowledgment records (for future use)
      ]);

      logger.log('AcknowledgmentModal: Loaded data - Pending:', pending.length, 'Acknowledged:', acknowledged.length);

      // Update state with fetched data
      setPendingMembers(pending);
      setAcknowledgedMembers(acknowledged);
    } catch (error) {
      logger.error('AcknowledgmentModal: Error loading acknowledgment data:', error);
    } finally {
      setLoading(false);
    }
  }, [update, teamMembers]);

  // Load acknowledgment data when modal opens
  useEffect(() => {
    if (isOpen && update) {
      loadAcknowledgmentData();
    }
  }, [isOpen, update, loadAcknowledgmentData]);

  // Real-time listener for acknowledgments
  useEffect(() => {
    if (!isOpen || !update || !teamMembers) {
      return;
    }

    logger.log('AcknowledgmentModal: Setting up real-time listener for update:', update.id);

    const acknowledgmentsQuery = query(
      collection(db, 'acknowledgments'),
      where('updateId', '==', update.id)
    );

    const unsubscribe = onSnapshot(acknowledgmentsQuery, async (snapshot) => {
      logger.log('AcknowledgmentModal: Acknowledgments snapshot received, size:', snapshot.size);
      logger.log('AcknowledgmentModal: Changed acknowledgments:', snapshot.docChanges().map(change => ({
        type: change.type,
        userId: change.doc.data().userId
      })));

      // Reload acknowledgment data when acknowledgments change
      await loadAcknowledgmentData();
    }, (error) => {
      logger.error('AcknowledgmentModal: Error in acknowledgments listener:', error);
      logger.error('AcknowledgmentModal: Error code:', error.code);
      logger.error('AcknowledgmentModal: Error message:', error.message);
      // Don't show error to user, just log it
    });

    return () => {
      logger.log('AcknowledgmentModal: Cleaning up acknowledgments listener');
      unsubscribe();
    };
  }, [isOpen, update, teamMembers, loadAcknowledgmentData]);

  /**
   * Calculate Completion Rate
   * 
   * Calculates the percentage of team members who have acknowledged the update.
   * This is used for the progress bar and status messages.
   */
  const completionRate = teamMembers.length > 0
    ? Math.round((acknowledgedMembers.length / teamMembers.length) * 100)
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4">
      <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-5 border w-full sm:w-4/5 max-w-4xl shadow-lg rounded-md bg-white my-4 max-h-[90vh] overflow-y-auto">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Acknowledgment Rate - {update?.title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('pending')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'pending'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Pending ({pendingMembers.length})
              </button>
              <button
                onClick={() => setActiveTab('acknowledged')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'acknowledged'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Acknowledged ({acknowledgedMembers.length})
              </button>
              <button
                onClick={() => setActiveTab('completion')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'completion'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Completion Rate
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {loading ? (
            <div className="text-center py-8">
              <div className="text-lg">Loading...</div>
            </div>
          ) : (
            <>
              {activeTab === 'pending' && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    Members Pending Acknowledgment ({pendingMembers.length})
                  </h4>
                  {pendingMembers.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-green-600 font-medium">All members have acknowledged this update!</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingMembers.map((member) => (
                        <div key={member.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-red-200 flex items-center justify-center">
                              <span className="text-sm font-medium text-red-700">
                                {member.displayName?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-red-900">
                                {member.displayName}
                              </div>
                              <div className="text-sm text-red-600">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'acknowledged' && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    Members Who Acknowledged ({acknowledgedMembers.length})
                  </h4>
                  {acknowledgedMembers.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500">No members have acknowledged this update yet.</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {acknowledgedMembers.map((member) => (
                        <div key={member.id} className="border border-green-200 rounded-lg p-4 bg-green-50">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center">
                              <span className="text-sm font-medium text-green-700">
                                {member.displayName?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-green-900">
                                {member.displayName}
                              </div>
                              <div className="text-sm text-green-600">
                                {member.email}
                              </div>
                            </div>
                            <div className="ml-auto">
                              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'completion' && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    Completion Rate Overview
                  </h4>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                      <span className="text-sm font-medium text-gray-700">{completionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${completionRate}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Statistics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <div className="text-2xl font-bold text-blue-900">{teamMembers.length}</div>
                          <div className="text-sm text-blue-600">Total Members</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <div className="text-2xl font-bold text-green-900">{acknowledgedMembers.length}</div>
                          <div className="text-sm text-green-600">Acknowledged</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <div className="text-2xl font-bold text-red-900">{pendingMembers.length}</div>
                          <div className="text-sm text-red-600">Pending</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Message */}
                  <div className="mt-6 p-4 rounded-lg bg-gray-50">
                    {completionRate === 100 ? (
                      <div className="text-center">
                        <div className="text-green-600 font-medium text-lg">🎉 Perfect! All team members have acknowledged this update.</div>
                      </div>
                    ) : completionRate >= 75 ? (
                      <div className="text-center">
                        <div className="text-blue-600 font-medium text-lg">👍 Great progress! Most team members have acknowledged this update.</div>
                      </div>
                    ) : completionRate >= 50 ? (
                      <div className="text-center">
                        <div className="text-yellow-600 font-medium text-lg">⚠️ Half the team has acknowledged. Consider following up with pending members.</div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-red-600 font-medium text-lg">🚨 Low acknowledgment rate. Consider sending reminders to team members.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcknowledgmentModal;



