import React from 'react';
import UpdateCard from '../UpdateCard';

const TLAcknowledgmentsTab = ({ 
  user, 
  updates, 
  acknowledgments, 
  handleAcknowledge, 
  handleEditUpdate, 
  handleDeleteUpdate, 
  isAcknowledged 
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pending Updates */}
      <div>
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Pending Updates</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {updates.filter(update => !isAcknowledged(update.id)).length} pending
              </span>
            </div>

            {updates.filter(update => !isAcknowledged(update.id)).length === 0 ? (
              <p className="text-gray-500 text-center py-4">No pending updates</p>
            ) : (
              <div className="space-y-4">
                {updates.filter(update => !isAcknowledged(update.id)).map((update) => (
                  <UpdateCard
                    key={update.id}
                    update={update}
                    onAcknowledge={handleAcknowledge}
                    isAcknowledged={false}
                    onEdit={update.createdBy === user.uid ? handleEditUpdate : null}
                    onDelete={update.createdBy === user.uid ? handleDeleteUpdate : null}
                  />
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
                {updates.filter(update => isAcknowledged(update.id)).length} acknowledged
              </span>
            </div>

            {updates.filter(update => isAcknowledged(update.id)).length === 0 ? (
              <p className="text-gray-500 text-center py-4">No acknowledged updates</p>
            ) : (
              <div className="space-y-4">
                {updates.filter(update => isAcknowledged(update.id)).map((update) => (
                  <UpdateCard
                    key={update.id}
                    update={update}
                    isAcknowledged={true}
                    acknowledgmentDate={acknowledgments[update.id]?.acknowledgedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                    onEdit={update.createdBy === user.uid ? handleEditUpdate : null}
                    onDelete={update.createdBy === user.uid ? handleDeleteUpdate : null}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TLAcknowledgmentsTab;
