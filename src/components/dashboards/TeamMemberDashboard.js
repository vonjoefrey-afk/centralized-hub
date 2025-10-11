import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signOutUser } from '../../firebase/auth';
import { getTeam, getUpdatesByTeam, acknowledgeUpdate, getUserAcknowledgment, getAcknowledgmentStatus } from '../../firebase/firestore';

const TeamMemberDashboard = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acknowledgments, setAcknowledgments] = useState({});

  useEffect(() => {
    if (user?.teamId) {
      loadTeamData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      const teamData = await getTeam(user.teamId);
      setTeam(teamData);
      
      if (teamData) {
        const updatesData = await getUpdatesByTeam(user.teamId);
        setUpdates(updatesData);
        
        // Load acknowledgment status for each update
        const ackStatus = {};
        for (const update of updatesData) {
          const userAck = await getUserAcknowledgment(update.id, user.uid);
          ackStatus[update.id] = userAck;
        }
        setAcknowledgments(ackStatus);
      }
    } catch (err) {
      setError('Failed to load team data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (updateId, comment = '') => {
    try {
      await acknowledgeUpdate(updateId, user.uid, comment);
      setAcknowledgments(prev => ({
        ...prev,
        [updateId]: { acknowledgedAt: new Date() }
      }));
    } catch (err) {
      setError('Failed to acknowledge update');
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error(err);
    }
  };

  const isAcknowledged = (updateId) => {
    return acknowledgments[updateId] && acknowledgments[updateId].acknowledgedAt;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user?.teamId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Team Assigned</h2>
          <p className="text-gray-600">You haven't been assigned to a team yet. Please contact your administrator.</p>
          <button
            onClick={handleSignOut}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const pendingUpdates = updates.filter(update => !isAcknowledged(update.id));
  const acknowledgedUpdates = updates.filter(update => isAcknowledged(update.id));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Team Member Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user?.displayName}</p>
              {team && (
                <p className="text-sm text-gray-500">Team: {team.name}</p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button className="border-primary-500 text-primary-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
              Updates
            </button>
            <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
              Team Info
            </button>
            <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
              My Activity
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Updates */}
          <div>
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Pending Updates</h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {pendingUpdates.length} pending
                  </span>
                </div>

                {pendingUpdates.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending updates</p>
                ) : (
                  <div className="space-y-4">
                    {pendingUpdates.map((update) => (
                      <div key={update.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">{update.title}</h4>
                          <span className="text-xs text-gray-500">
                            {update.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-4">{update.content}</p>
                        <button
                          onClick={() => handleAcknowledge(update.id)}
                          className="w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                          Acknowledge Update
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Acknowledged Updates */}
          <div>
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Acknowledged Updates</h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {acknowledgedUpdates.length} acknowledged
                  </span>
                </div>

                {acknowledgedUpdates.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No acknowledged updates</p>
                ) : (
                  <div className="space-y-4">
                    {acknowledgedUpdates.map((update) => (
                      <div key={update.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">{update.title}</h4>
                          <span className="text-xs text-gray-500">
                            {update.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-2">{update.content}</p>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Acknowledged
                          </span>
                          <span className="text-xs text-gray-500">
                            {acknowledgments[update.id]?.acknowledgedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamMemberDashboard;
