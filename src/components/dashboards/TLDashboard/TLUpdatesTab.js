import React from 'react';
import UpdateCard from '../UpdateCard';
import { Button } from '../../ui';

const TLUpdatesTab = ({ 
  user, 
  updates, 
  statusBreakdown, 
  setShowCreateUpdate, 
  handleEditUpdate, 
  handleDeleteUpdate, 
  handleStatusClick, 
  setSelectedUpdate, 
  setShowAcknowledgmentModal 
}) => {
  return (
    <div className="bg-white dark:bg-[#0a0a0a] shadow dark:shadow-none rounded-2xl border border-gray-100 dark:border-white/10">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Updates - {user?.displayName || user?.email}
            </h3>
            <p className="text-sm text-gray-500">
              Create and manage updates for your team
            </p>
          </div>
          <Button
            onClick={() => setShowCreateUpdate(true)}
            variant="primary"
          >
            Create Update
          </Button>
        </div>

        {updates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No updates created yet. Create your first update for the team.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map((update) => (
              <UpdateCard
                key={update.id}
                update={update}
                statusBreakdown={statusBreakdown}
                onEdit={handleEditUpdate}
                onDelete={handleDeleteUpdate}
                onViewDetails={(u, type) => {
                  if (type) {
                    handleStatusClick(u.id, type);
                  } else {
                    setSelectedUpdate(u);
                    setShowAcknowledgmentModal(true);
                  }
                }}
                isManagerView={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TLUpdatesTab;
