import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { logTabView } from '../../services/activity';

const DashboardTabNav = ({ visibleTabs, activeTab, setActiveTab }) => {
  const { user } = useAuth();
  return (
    <div className="mb-10 bg-white/50 dark:bg-[#111111] backdrop-blur-md p-2 rounded-[2rem] shadow-xl dark:shadow-black/50 border border-gray-200/50 dark:border-white/5 inline-flex overflow-x-auto max-w-full scrollbar-hidden">
      <nav className="flex space-x-2">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.onClick) tab.onClick();
              logTabView(user, tab.id, tab.label);
            }}
            className={`whitespace-nowrap py-3.5 px-6 flex items-center justify-center rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 ${
              activeTab === tab.id
              ? 'tab-pill-active'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default DashboardTabNav;
