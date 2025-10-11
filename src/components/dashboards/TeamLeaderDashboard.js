import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signOutUser } from '../../firebase/auth';
import { createTeam, getTeamsByLeader, createUpdate, getUpdatesByTeam } from '../../firebase/firestore';

const TeamLeaderDashboard = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateUpdate, setShowCreateUpdate] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', description: '' });
  const [updateForm, setUpdateForm] = useState({ title: '', content: '' });

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadUpdates(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const teamsData = await getTeamsByLeader(user.uid);
      setTeams(teamsData);
      if (teamsData.length > 0 && !selectedTeam) {
        setSelectedTeam(teamsData[0]);
      }
    } catch (err) {
      setError('Failed to load teams');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUpdates = async (teamId) => {
    try {
      const updatesData = await getUpdatesByTeam(teamId);
      setUpdates(updatesData);
    } catch (err) {
      setError('Failed to load updates');
      console.error(err);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      const teamId = await createTeam(teamForm.name, user.uid, teamForm.description);
      setTeamForm({ name: '', description: '' });
      setShowCreateTeam(false);
      await loadTeams();
    } catch (err) {
      setError('Failed to create team');
      console.error(err);
    }
  };

  const handleCreateUpdate = async (e) => {
    e.preventDefault();
    try {
      await createUpdate(selectedTeam.id, updateForm.title, updateForm.content, user.uid);
      setUpdateForm({ title: '', content: '' });
      setShowCreateUpdate(false);
      await loadUpdates(selectedTeam.id);
    } catch (err) {
      setError('Failed to create update');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Team Leader Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user?.displayName}</p>
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
              Teams & Updates
            </button>
            <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
              Team Members
            </button>
            <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
              Analytics
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">My Teams</h3>
                  <button
                    onClick={() => setShowCreateTeam(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded-md text-sm"
                  >
                    Create Team
                  </button>
                </div>
                
                {teams.length === 0 ? (
                  <p className="text-gray-500 text-sm">No teams created yet</p>
                ) : (
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => setSelectedTeam(team)}
                        className={`w-full text-left p-3 rounded-md border ${
                          selectedTeam?.id === team.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{team.name}</div>
                        <div className="text-sm text-gray-500">{team.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Updates Section */}
          <div className="lg:col-span-2">
            {selectedTeam ? (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Updates for {selectedTeam.name}
                    </h3>
                    <button
                      onClick={() => setShowCreateUpdate(true)}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded-md text-sm"
                    >
                      Create Update
                    </button>
                  </div>

                  {updates.length === 0 ? (
                    <p className="text-gray-500">No updates created yet</p>
                  ) : (
                    <div className="space-y-4">
                      {updates.map((update) => (
                        <div key={update.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900">{update.title}</h4>
                            <span className="text-xs text-gray-500">
                              {update.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-3">{update.content}</p>
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              update.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {update.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg p-6 text-center">
                <p className="text-gray-500">Select a team to view updates</p>
              </div>
            )}
          </div>
        </div>

        {/* Create Team Modal */}
        {showCreateTeam && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Team</h3>
                <form onSubmit={handleCreateTeam}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Team Name
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      value={teamForm.name}
                      onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      value={teamForm.description}
                      onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateTeam(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium"
                    >
                      Create Team
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Create Update Modal */}
        {showCreateUpdate && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Update</h3>
                <form onSubmit={handleCreateUpdate}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Update Title
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      value={updateForm.title}
                      onChange={(e) => setUpdateForm({ ...updateForm, title: e.target.value })}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Update Content
                    </label>
                    <textarea
                      rows="4"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      value={updateForm.content}
                      onChange={(e) => setUpdateForm({ ...updateForm, content: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateUpdate(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium"
                    >
                      Create Update
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamLeaderDashboard;
