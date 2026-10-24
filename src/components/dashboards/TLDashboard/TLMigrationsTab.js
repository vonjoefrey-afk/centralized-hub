import React from 'react';

const TLMigrationsTab = ({ 
  migrationRequests, 
  handleApproveMigration, 
  handleDenyMigration 
}) => {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Migration Requests
          </h3>
        </div>

        {migrationRequests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No migration requests pending.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {migrationRequests.map((migration) => (
              <div key={migration.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      Migration Request
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">{migration.requestingLeaderName || 'A team leader'}</span> requested to move <span className="font-medium">{migration.userDisplayName || 'team member'}</span> {migration.userEmail && <span className="text-gray-500">({migration.userEmail})</span>} from your team to their team.
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      <span className="font-medium">Requested:</span> {migration.createdAt?.toDate?.()?.toLocaleString() || 'Unknown date'}
                    </p>
                  </div>
                  {migration.status === 'pending' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleApproveMigration(migration.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDenyMigration(migration.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                  {migration.status === 'approved' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Approved
                    </span>
                  )}
                  {migration.status === 'denied' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Denied
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TLMigrationsTab;
