/**
 * Feature/tab options per role's dashboard. Used to scope the UAT feedback
 * feature selector to only the sections that actually exist on the
 * submitter's own dashboard, and to label feedback entries in the admin view.
 */
export const DASHBOARD_FEATURES = {
  admin: [
    { id: 'users', label: 'User Management' },
    { id: 'pending', label: 'Pending Approvals' },
    { id: 'settings', label: 'System Settings' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'spii-analytics', label: 'SPII Analytics' },
    { id: 'spii-audit', label: 'SPII Audit Logs' },
    { id: 'metric-analytics', label: 'Metric Analytics' },
  ],
  trainer: [
    { id: 'updates', label: 'Updates' },
    { id: 'gcp-billing', label: 'GCP Billing' },
    { id: 'notes', label: 'Notes' },
  ],
  team_leader: [
    { id: 'team-members', label: 'Team Members' },
    { id: 'updates', label: 'Updates' },
    { id: 'acknowledgments', label: 'My Acknowledgments' },
    { id: 'migrations', label: 'Migration Requests' },
    { id: 'gcp-billing', label: 'GCP Billing' },
    { id: 'notes', label: 'Notes' },
    { id: 'spii-dashboard', label: 'SPII Analytics' },
    { id: 'case-tracker', label: 'Case Tracker' },
    { id: 'metric-analytics', label: 'Metric Analytics' },
  ],
  team_member: [
    { id: 'updates', label: 'Updates' },
    { id: 'gcp-billing', label: 'GCP Billing Calculation' },
    { id: 'templates', label: 'Templates' },
    { id: 'notes', label: 'Notes' },
    { id: 'case-tracker', label: 'Case Tracker' },
    { id: 'spii-cases', label: 'My SPII Cases' },
    { id: 'spii-dashboard', label: 'SPII Analytics' },
    { id: 'spii-audit', label: 'SPII Audit Logs' },
    { id: 'metric-analytics', label: 'Metric Analytics' },
  ],
};

export const DASHBOARD_LABELS = {
  admin: 'Admin Dashboard',
  trainer: 'Trainer Dashboard',
  team_leader: 'Team Leader Dashboard',
  team_member: 'Team Member Dashboard',
};

/**
 * Every distinct feature across all dashboards, deduped by id, used to build
 * one CSV column per feature on the admin Feedback export. Label preference
 * goes to team_member first (most feedback comes from there), then team_leader,
 * trainer, admin, so the column header reads naturally either way.
 */
export const ALL_FEATURE_COLUMNS = (() => {
  const priorityRoles = ['team_member', 'team_leader', 'trainer', 'admin'];
  const seen = new Map();
  priorityRoles.forEach((role) => {
    (DASHBOARD_FEATURES[role] || []).forEach((f) => {
      if (!seen.has(f.id)) seen.set(f.id, f.label);
    });
  });
  return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
})();
