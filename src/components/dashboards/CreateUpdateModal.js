import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';

import { Modal, Button, Input, DateTimePicker, Badge } from '../ui';
import UpdateCard from './UpdateCard';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BellIcon, 
  PencilSquareIcon, 
  EyeIcon, 
  ClockIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

/**
 * CreateUpdateModal Component
 * 
 * A premium, unified modal for creating team updates. 
 * Features a live preview of the UpdateCard.
 */
const DEFAULT_INITIAL_DATA = { title: '', content: '', deadline: '', excludedUserIds: [] };

const CreateUpdateModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData = DEFAULT_INITIAL_DATA,
  currentUser,
  allUsers = [] // For trainers to exclude specific users
}) => {
  const [formData, setFormData] = useState(initialData);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'preview'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync with initialData only when the modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setActiveTab('edit');
    }
  }, [isOpen]); // Removed initialData to avoid infinite loops if parent passes non-stable objects

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleExcludedUser = (userId) => {
    const currentExcluded = formData.excludedUserIds || [];
    const newExcluded = currentExcluded.includes(userId)
      ? currentExcluded.filter(id => id !== userId)
      : [...currentExcluded, userId];
    handleChange('excludedUserIds', newExcluded);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      logger.error('Error submitting update:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock update object for preview
  const previewUpdate = {
    ...formData,
    id: 'preview-id',
    createdAt: { toDate: () => new Date() },
    createdBy: currentUser?.uid,
    creatorName: currentUser?.displayName || 'You',
    deadline: formData.deadline ? { toDate: () => new Date(formData.deadline) } : null
  };

  const characterCount = formData.content.length;
  const isOverLimit = characterCount > 2000;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      className="overflow-visible"
    >
      <Modal.Header onClose={onClose}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <BellIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <Modal.Title>{initialData?.id ? 'Edit Update' : 'Create New Update'}</Modal.Title>
        </div>
      </Modal.Header>

      <div className="flex border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 px-6">
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${
            activeTab === 'edit'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <PencilSquareIcon className="w-4 h-4" />
            Compose
          </div>
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${
            activeTab === 'preview'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <EyeIcon className="w-4 h-4" />
            Live Preview
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <Modal.Body className="bg-white/50 dark:bg-[#0a0a0a]/50 backdrop-blur-md">
          <AnimatePresence mode="wait">
            {activeTab === 'edit' ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <Input
                  label="Update Title"
                  placeholder="e.g., Important: New Process for Case Tracking"
                  required
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="bg-white dark:bg-white/5"
                />

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-0.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      Update Content
                    </label>
                    <span className={`text-[10px] font-bold ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
                      {characterCount}/2000 characters
                    </span>
                  </div>
                  <textarea
                    rows="6"
                    required
                    placeholder="Provide detailed instructions or information..."
                    className={`w-full px-4 py-3 border rounded-2xl shadow-sm transition-all duration-200 text-[15px] resize-none focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:text-white ${
                      isOverLimit 
                        ? 'border-red-500 bg-red-50/50' 
                        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 focus:border-primary-500'
                    }`}
                    value={formData.content}
                    onChange={(e) => handleChange('content', e.target.value)}
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 ml-1">
                    <InformationCircleIcon className="w-3.5 h-3.5" />
                    You can use standard text and URLs will be automatically linked.
                  </div>
                </div>

                <div className="p-5 bg-primary-50/50 dark:bg-primary-900/10 rounded-2xl border border-primary-100/50 dark:border-primary-800/20">
                  <div className="flex items-center gap-2 mb-4 text-primary-700 dark:text-primary-300">
                    <ClockIcon className="w-4 h-4" />
                    <span className="text-sm font-bold">Acknowledgment Deadline</span>
                  </div>
                  <DateTimePicker
                    value={formData.deadline}
                    onChange={(val) => handleChange('deadline', val)}
                    min={new Date().toISOString().slice(0, 16)}
                    helperText={(() => {
                      if (!formData.deadline) return "Select a required date for team acknowledgment";
                      const deadlineDate = new Date(formData.deadline);
                      const now = new Date();
                      const diff = deadlineDate - now;

                      if (diff < 0) return "⚠️ Deadline must be in the future";

                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const days = Math.floor(hours / 24);

                      if (days > 0) {
                        return `🕒 Deadline set for ${days}d ${hours % 24}h from now`;
                      } else if (hours > 0) {
                        return `🕒 Deadline set for ${hours}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}m from now`;
                      } else {
                        return `🕒 Deadline in ${Math.floor(diff / (1000 * 60))} minutes`;
                      }
                    })()}
                  />
                </div>
                {allUsers.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
                      Exclude Users (Optional)
                    </label>
                    <div className="bg-white/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden shadow-inner">
                      <div className="max-h-48 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {allUsers.map(userItem => {
                            const isExcluded = formData.excludedUserIds?.includes(userItem.id);
                            return (
                              <button
                                key={userItem.id}
                                type="button"
                                onClick={() => toggleExcludedUser(userItem.id)}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 text-left ${
                                  isExcluded
                                    ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/30 ring-1 ring-amber-500/10'
                                    : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-200 dark:hover:border-white/10'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                  isExcluded 
                                    ? 'bg-amber-500 border-amber-500 text-white' 
                                    : 'border-gray-300 dark:border-white/20'
                                }`}>
                                  {isExcluded && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-xs font-bold truncate ${isExcluded ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                    {userItem.displayName || userItem.email}
                                  </p>
                                  <p className="text-[10px] text-gray-400 truncate uppercase tracking-tighter">{userItem.role?.replace('_', ' ')}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="py-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mobile & Desktop Preview</span>
                  <Badge variant="primary" size="sm">Live</Badge>
                </div>
                <div className="bg-gray-50/50 dark:bg-white/5 p-6 rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/10">
                  {formData.title || formData.content ? (
                    <UpdateCard 
                      update={previewUpdate} 
                      className="shadow-2xl shadow-primary-500/10"
                    />
                  ) : (
                    <div className="text-center py-20">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <EyeIcon className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-400 font-medium">Add some content to see a preview</p>
                    </div>
                  )}
                </div>
                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/20 flex gap-3">
                  <InformationCircleIcon className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    This is how your update will appear to team members. Review for clarity and ensure links (if any) are correct before sending.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Modal.Body>

        <Modal.Footer className="bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur-md border-t border-gray-100 dark:border-white/5">
          <Button
            variant="outline"
            onClick={onClose}
            type="button"
            className="hover:bg-gray-50 dark:hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            disabled={!formData.title || !formData.content || isOverLimit}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25 px-8"
          >
            {initialData?.id ? 'Save Changes' : 'Send Update & Notify Team'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default CreateUpdateModal;
