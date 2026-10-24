import React, { useState } from 'react';
import { ChatBubbleLeftRightIcon, BugAntIcon, ClipboardDocumentCheckIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, Input } from '../ui';
import { showSuccess, showError } from '../../utils/toast';
import { submitFeedback } from '../../services/feedback';
import { DASHBOARD_FEATURES, DASHBOARD_LABELS } from '../../constants/dashboardFeatures';

const FEEDBACK_TYPES = [
  {
    id: 'bug',
    label: 'Bug Feedback',
    description: 'Something broken or not working as expected',
    icon: BugAntIcon,
  },
  {
    id: 'uat',
    label: 'UAT Feedback',
    description: 'Go through every feature and flag what fails',
    icon: ClipboardDocumentCheckIcon,
  },
];

const buildInitialFeatureStatuses = (featureOptions) => {
  const initial = {};
  featureOptions.forEach((f) => {
    initial[f.id] = { label: f.label, status: 'working', note: '' };
  });
  return initial;
};

const FeedbackButton = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('bug');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [featureStatuses, setFeatureStatuses] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const featureOptions = DASHBOARD_FEATURES[user.role] || [];

  const resetForm = () => {
    setType('bug');
    setTitle('');
    setMessage('');
    setFeatureStatuses({});
  };

  const handleClose = () => {
    if (submitting) return;
    setIsOpen(false);
    resetForm();
  };

  const handleTypeChange = (id) => {
    setType(id);
    setTitle('');
    setMessage('');
    if (id === 'uat') {
      setFeatureStatuses(buildInitialFeatureStatuses(featureOptions));
    }
  };

  const toggleFeatureWorking = (id) => {
    setFeatureStatuses((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: prev[id].status === 'working' ? 'not_working' : 'working',
      },
    }));
  };

  const updateFeatureNote = (id, note) => {
    setFeatureStatuses((prev) => ({
      ...prev,
      [id]: { ...prev[id], note },
    }));
  };

  const notWorkingEntries = Object.entries(featureStatuses).filter(([, v]) => v.status === 'not_working');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (type === 'bug') {
      if (!title.trim()) {
        showError('Please give your bug report a title.');
        return;
      }
      if (!message.trim()) {
        showError('Please provide some details before submitting.');
        return;
      }
    } else {
      const missingNote = notWorkingEntries.find(([, v]) => !v.note.trim());
      if (missingNote) {
        showError(`Please explain why "${missingNote[1].label}" isn't working.`);
        return;
      }
    }

    const uatTitle =
      notWorkingEntries.length === 0
        ? 'UAT: All features working'
        : `UAT: ${notWorkingEntries.length} feature${notWorkingEntries.length > 1 ? 's' : ''} not working`;

    setSubmitting(true);
    try {
      await submitFeedback({
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email,
        role: user.role,
        type,
        title: type === 'bug' ? title.trim() : uatTitle,
        message: message.trim(),
        featureStatuses: type === 'uat' ? featureStatuses : null,
        page: window.location.pathname,
      });
      showSuccess(type === 'bug' ? 'Bug report submitted. Thanks!' : 'UAT feedback submitted. Thanks!');
      handleClose();
    } catch (err) {
      showError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-[#050505]"
        aria-label="Send feedback"
        title="Send feedback"
      >
        <ChatBubbleLeftRightIcon className="w-6 h-6" aria-hidden="true" />
      </button>

      <Modal isOpen={isOpen} onClose={handleClose} size="lg">
        <Modal.Header onClose={handleClose}>
          <Modal.Title>Send Feedback</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {FEEDBACK_TYPES.map(({ id, label, description, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => handleTypeChange(id)}
                  className={`text-left p-4 rounded-xl border-2 transition-colors ${
                    type === id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-2 ${type === id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}
                    aria-hidden="true"
                  />
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</div>
                </button>
              ))}
            </div>

            {type === 'bug' ? (
              <>
                <Input
                  id="feedback-title"
                  label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Create Update button missing"
                  required
                />
                <div>
                  <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Details
                  </label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    required
                    placeholder="What happened? What did you expect instead? Steps to reproduce help a lot."
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Every feature on the {DASHBOARD_LABELS[user.role] || 'dashboard'} defaults to Working — flag any that
                    aren't
                  </label>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {featureOptions.map((f) => {
                      const entry = featureStatuses[f.id] || { status: 'working', note: '' };
                      const isNotWorking = entry.status === 'not_working';
                      return (
                        <div
                          key={f.id}
                          className={`rounded-xl border p-3 transition-colors ${
                            isNotWorking
                              ? 'border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/5'
                              : 'border-gray-200 dark:border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{f.label}</span>
                            <button
                              type="button"
                              onClick={() => toggleFeatureWorking(f.id)}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                isNotWorking
                                  ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                  : 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400'
                              }`}
                            >
                              {isNotWorking ? (
                                <XCircleIcon className="w-4 h-4" aria-hidden="true" />
                              ) : (
                                <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
                              )}
                              {isNotWorking ? 'Not Working' : 'Working'}
                            </button>
                          </div>
                          {isNotWorking && (
                            <textarea
                              value={entry.note}
                              onChange={(e) => updateFeatureNote(f.id, e.target.value)}
                              placeholder={`Why isn't ${f.label} working?`}
                              rows={2}
                              required
                              className="mt-2 w-full rounded-lg border border-rose-200 dark:border-rose-500/20 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Anything else worth mentioning about this testing pass?"
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Submit
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  );
};

export default FeedbackButton;
