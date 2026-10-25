// CSV rows for tracked cases (Case Tracker ledger + Analytics exports), kept
// pure so the column layout can be unit-tested without a DOM.
import { getWorkType } from '../constants/caseFields';

const toDate = (createdAt) => {
  if (!createdAt) return null;
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Dates are reported in Manila time (UTC+8), matching the Case Tracker's day boundaries.
export const formatManilaDateTime = (createdAt) => {
  const d = toDate(createdAt);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
};

export const CASE_TRACKER_CSV_HEADERS = [
  'Date (Manila)', 'Case ID', 'Case Type', 'Status', 'Origin', 'Survey', 'Survey Status',
  'IRT Breach', 'SPII', 'Transferred', 'Transfer Validation', 'Comments',
];

/** Rows for the member's own Case Tracker export (one row per case). */
export const buildCaseTrackerCsvRows = (cases) =>
  cases.map((c) => [
    formatManilaDateTime(c.createdAt),
    c.caseId || '',
    getWorkType(c),
    c.status || '',
    c.origin || '',
    c.survey || '',
    c.surveyStatus || '',
    c.irt || '',
    c.isSpii || '',
    c.isTransferred || '',
    c.transferValidation || '',
    c.comments || '',
  ]);

/** Per-classification counts for an EOD summary: { 'New Case': n, Backlog: n, Unclassified: n }. */
export const countByWorkType = (cases) =>
  cases.reduce((acc, c) => {
    const t = getWorkType(c);
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
