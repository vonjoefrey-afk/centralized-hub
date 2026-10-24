import React from 'react';
import Modal from './Modal';
import { 
  ExclamationTriangleIcon, 
  InformationCircleIcon, 
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';

/**
 * ConfirmModal Component
 * 
 * A highly styled, premium modal for confirmation dialogs.
 */
const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action', 
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  loading = false,
}) => {
  
  // Icon mapping
  const renderIcon = () => {
    switch (type) {
      case 'warning': return <ExclamationCircleIcon className="w-8 h-8 text-white" />;
      case 'primary': return <InformationCircleIcon className="w-8 h-8 text-white" />;
      case 'danger':
      default: return <ExclamationTriangleIcon className="w-8 h-8 text-white" />;
    }
  };

  // Glow classes for background
  const glowClasses = {
    danger: 'bg-red-500/10 dark:bg-red-500/20',
    warning: 'bg-amber-500/10 dark:bg-amber-500/20',
    primary: 'bg-indigo-500/10 dark:bg-indigo-500/20',
  };

  // Button background gradients
  const primaryBtnGradients = {
    danger: 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20 hover:shadow-red-500/40 border-t border-red-400/30',
    warning: 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20 hover:shadow-amber-500/40 border-t border-amber-400/30',
    primary: 'bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-indigo-500/20 hover:shadow-indigo-500/40 border-t border-indigo-400/30',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="relative overflow-hidden p-8 z-10">
        {/* Soft Background Glow */}
        <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl pointer-events-none ${glowClasses[type] || glowClasses.primary}`}></div>
        
        <div className="flex flex-col items-center text-center relative z-20">
          
          {/* Main Icon Wrap */}
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-2xl ${primaryBtnGradients[type] || primaryBtnGradients.primary}`}>
            {renderIcon()}
          </div>
          
          <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-tight mb-3">
            {title}
          </h3>
          
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-8 max-w-[340px] w-full">
            {message}
          </div>

          <div className="w-full flex gap-3">
            <button 
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3.5 px-4 bg-gray-100/80 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-black tracking-widest uppercase text-[10px] rounded-2xl transition-all duration-300 active:scale-95 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button 
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 py-3.5 px-4 font-black tracking-widest uppercase text-[10px] text-white rounded-2xl transition-all duration-300 shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center ${primaryBtnGradients[type] || primaryBtnGradients.primary}`}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : confirmText}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
