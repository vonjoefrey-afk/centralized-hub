import React from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';

const MemberCard = ({ member, onRemove }) => {
  return (
    <div className="bg-white dark:bg-white/3 border border-gray-200 dark:border-white/10 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-white/5 hover:shadow-md dark:hover:shadow-none transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
            {member.displayName?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{member.displayName}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-500">{member.email}</p>
            <div className="mt-1 flex items-center space-x-2">
               <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                 member.status === 'active'
                   ? 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-400'
                   : 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-400'
               }`}>
                 {member.status || 'active'}
               </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => onRemove(member.id)}
          className="p-2 text-gray-400 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors"
          title="Remove from team"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default MemberCard;
