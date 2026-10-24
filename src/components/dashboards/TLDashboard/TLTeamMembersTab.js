import React from 'react';
import MemberCard from './MemberCard';
import { Button } from '../../ui';

const TLTeamMembersTab = ({ user, teamMembers, setShowAddMember, handleRemoveMember }) => {
  return (
    <div className="bg-white dark:bg-[#0a0a0a] shadow dark:shadow-none rounded-2xl border border-gray-100 dark:border-white/10">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Team Members - {user?.displayName || user?.email}
            </h3>
            <p className="text-sm text-gray-500">
              Manage team members for your team
            </p>
          </div>
          <Button
            onClick={() => setShowAddMember(true)}
            variant="primary"
          >
            Add Team Member
          </Button>
        </div>

        {teamMembers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No team members yet. Add some members to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <MemberCard 
                key={member.id} 
                member={member} 
                onRemove={handleRemoveMember} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TLTeamMembersTab;
