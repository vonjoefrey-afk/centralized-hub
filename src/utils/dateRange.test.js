import { getDateRange, isInDateRange } from './dateRange';

// Local-time instants; these tests hold in any TZ (run with TZ=Asia/Manila etc.).
const at = (y, m, d, h = 0, min = 0, s = 0, ms = 0) => new Date(y, m - 1, d, h, min, s, ms);
const NOW = at(2026, 11, 9, 0, 30); // just after local midnight — where the UTC bug bit

describe('getDateRange', () => {
  it('Yesterday spans 00:00:00.000 → 23:59:59.999 of the previous local day', () => {
    const [start, end] = getDateRange('Yesterday', {}, NOW);
    expect(start).toEqual(at(2026, 11, 8, 0, 0, 0, 0));
    expect(end).toEqual(at(2026, 11, 8, 23, 59, 59, 999));
  });

  it('Yesterday selects exactly the cases a Custom range for that day selects', () => {
    const custom = { start: '2026-11-08', end: '2026-11-08' };
    expect(getDateRange('Yesterday', {}, NOW)).toEqual(getDateRange('Custom', custom, NOW));
    const cases = [at(2026, 11, 7, 23, 59, 59, 999), at(2026, 11, 8), at(2026, 11, 8, 12), at(2026, 11, 8, 23, 59, 59, 999), at(2026, 11, 9)];
    const pick = (preset, c) => cases.filter((d) => isInDateRange(d, preset, c, NOW));
    expect(pick('Yesterday')).toEqual(pick('Custom', custom));
    expect(pick('Yesterday')).toEqual([at(2026, 11, 8), at(2026, 11, 8, 12), at(2026, 11, 8, 23, 59, 59, 999)]);
  });

  it('handles month and year boundaries', () => {
    expect(getDateRange('Yesterday', {}, at(2026, 3, 1, 9))[0]).toEqual(at(2026, 2, 28));
    expect(getDateRange('Yesterday', {}, at(2028, 3, 1, 9))[0]).toEqual(at(2028, 2, 29)); // leap year
    expect(getDateRange('Yesterday', {}, at(2027, 1, 1, 9))[0]).toEqual(at(2026, 12, 31));
  });

  it('Today, Last Week, Last Month end at the end of today', () => {
    expect(getDateRange('Today', {}, NOW)).toEqual([at(2026, 11, 9), at(2026, 11, 9, 23, 59, 59, 999)]);
    expect(getDateRange('Last Week', {}, NOW)[0]).toEqual(at(2026, 11, 2));
    expect(getDateRange('Last Month', {}, NOW)[0]).toEqual(at(2026, 10, 9));
    expect(getDateRange('Last Month', {}, NOW)[1]).toEqual(at(2026, 11, 9, 23, 59, 59, 999));
  });

  it('All Time and an incomplete Custom range impose no limit', () => {
    expect(getDateRange('All Time', {}, NOW)).toBeNull();
    expect(getDateRange('Custom', { start: '2026-11-01', end: '' }, NOW)).toBeNull();
    expect(isInDateRange(at(2000, 1, 1), 'All Time', {}, NOW)).toBe(true);
  });
});
