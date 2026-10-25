import { getWorkType, matchesWorkType, WORK_TYPE_UNCLASSIFIED } from '../constants/caseFields';
import {
  CASE_TRACKER_CSV_HEADERS, buildCaseTrackerCsvRows, countByWorkType, formatManilaDateTime,
} from './caseExport';
import { csvEscape } from './csv';

// Minimal Firestore Timestamp stand-in.
const ts = (iso) => ({ toDate: () => new Date(iso) });

describe('Case Type (workType) classification', () => {
  it('returns the stored type for classified cases', () => {
    expect(getWorkType({ workType: 'New Case' })).toBe('New Case');
    expect(getWorkType({ workType: 'Backlog' })).toBe('Backlog');
  });

  it('falls back to Unclassified for legacy or unknown values', () => {
    expect(getWorkType({})).toBe(WORK_TYPE_UNCLASSIFIED);
    expect(getWorkType({ workType: '' })).toBe(WORK_TYPE_UNCLASSIFIED);
    expect(getWorkType({ workType: 'something else' })).toBe(WORK_TYPE_UNCLASSIFIED);
    expect(getWorkType(undefined)).toBe(WORK_TYPE_UNCLASSIFIED);
  });

  it('filters by type, with All matching everything including legacy cases', () => {
    const legacy = {};
    const backlog = { workType: 'Backlog' };
    expect(matchesWorkType(legacy, 'All')).toBe(true);
    expect(matchesWorkType(backlog, 'All')).toBe(true);
    expect(matchesWorkType(backlog, 'Backlog')).toBe(true);
    expect(matchesWorkType(backlog, 'New Case')).toBe(false);
    expect(matchesWorkType(legacy, 'New Case')).toBe(false);
    expect(matchesWorkType(legacy, WORK_TYPE_UNCLASSIFIED)).toBe(true);
  });

  it('counts cases per type for the EOD summary', () => {
    const counts = countByWorkType([
      { workType: 'New Case' }, { workType: 'New Case' }, { workType: 'Backlog' }, {},
    ]);
    expect(counts).toEqual({ 'New Case': 2, Backlog: 1, [WORK_TYPE_UNCLASSIFIED]: 1 });
  });
});

describe('Case Tracker CSV export', () => {
  it('formats dates in Manila time (UTC+8)', () => {
    // 20:30 UTC is 04:30 the next day in Manila.
    expect(formatManilaDateTime(ts('2026-10-25T20:30:00Z'))).toBe('2026-10-26 04:30');
    expect(formatManilaDateTime(null)).toBe('');
    expect(formatManilaDateTime('not a date')).toBe('');
  });

  it('puts Case Type in its own column, aligned with the headers', () => {
    const [row] = buildCaseTrackerCsvRows([{
      createdAt: ts('2026-10-26T01:00:00Z'),
      caseId: '1-234', workType: 'Backlog', status: 'SO', origin: 'Email',
      survey: 'CES', surveyStatus: 'Valid', irt: '', isSpii: 'No',
      isTransferred: 'No', transferValidation: '', comments: 'follow-up',
    }]);
    expect(row).toHaveLength(CASE_TRACKER_CSV_HEADERS.length);
    expect(row[CASE_TRACKER_CSV_HEADERS.indexOf('Case Type')]).toBe('Backlog');
    expect(row[CASE_TRACKER_CSV_HEADERS.indexOf('Case ID')]).toBe('1-234');
    expect(row[CASE_TRACKER_CSV_HEADERS.indexOf('Date (Manila)')]).toBe('2026-10-26 09:00');
  });

  it('exports legacy cases as Unclassified with blank optional fields', () => {
    const [row] = buildCaseTrackerCsvRows([{ caseId: 'OLD-1', status: 'Closed' }]);
    expect(row[CASE_TRACKER_CSV_HEADERS.indexOf('Case Type')]).toBe(WORK_TYPE_UNCLASSIFIED);
    expect(row[CASE_TRACKER_CSV_HEADERS.indexOf('Comments')]).toBe('');
  });

  it('keeps comments with commas, quotes and newlines intact once escaped', () => {
    const [row] = buildCaseTrackerCsvRows([{ caseId: 'X', comments: 'said "hi", then\nleft' }]);
    const cell = row[CASE_TRACKER_CSV_HEADERS.indexOf('Comments')];
    expect(csvEscape(cell)).toBe('"said ""hi"", then\nleft"');
  });
});
