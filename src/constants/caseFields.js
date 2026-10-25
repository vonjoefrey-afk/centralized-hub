// Field options for a tracked case, shared between the owner's Case Tracker and
// the SPII Case POC management view so the two never drift apart.

export const STATUS_OPTIONS = ['Assigned', 'SO', 'Closed', 'WOCR', 'WOCRE', 'IPGS', 'IPTP', 'IPGO', 'IPGE', 'IPCR'];
// Case classification for EOD reporting — new work vs. carried-over backlog.
export const WORK_TYPE_OPTIONS = ['New Case', 'Backlog'];
export const ORIGIN_OPTIONS = ['Chat', 'Email'];
export const SURVEY_OPTIONS = ['CES', 'NCES', 'Not applicable'];
export const SPII_OPTIONS = ['Yes', 'No'];
export const TRANSFER_OPTIONS = ['Yes', 'No'];
export const TRANSFER_VALIDATION_OPTIONS = ['Maps', 'A&S', 'Tech'];
export const IRT_OPTIONS_EMAIL = [
  'Close to Resolution SLA upon Case assignment',
  'CT Transfer',
];
export const IRT_OPTIONS_CHAT = [
  'Past 2 mins upon chat assignment',
  'Close to Resolution SLA upon Case assignment',
  'CT Transfer',
];
export const IRT_TYPE_OPTIONS_CHAT = ['Original Owner', 'Seamless Recontact'];

// Statuses that mean a case is resolved — these drop out of the SPII chat
// follow-up and the open-case views.
export const RESOLVED_STATUSES = ['SO', 'Closed'];

/** Mirror of the Case Tracker's survey-status derivation, kept in one place. */
export const deriveSurveyStatus = (survey, origin, isChatContinued) => {
  if (survey === 'Not applicable') return 'Not applicable';
  if (survey === 'CES' && origin === 'Chat' && isChatContinued === 'Yes') return 'Invalid';
  return 'Valid';
};
