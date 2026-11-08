// Date-range presets for list filters, as [start, end] Dates in the user's
// LOCAL timezone: start = 00:00:00.000 of the first day, end = 23:59:59.999
// of the last. Every preset and Custom go through the same day boundaries, so
// "Yesterday" and a Custom range for that same day always select the same rows.

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** 'YYYY-MM-DD' (a date input's value) → that calendar day in local time, or null. */
const parseDay = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/**
 * @param {string} preset 'Today' | 'Yesterday' | 'Last Week' | 'Last Month' | 'Custom' | 'All Time'
 * @param {{start: string, end: string}} [custom] date-input values for 'Custom'
 * @param {Date} [now]
 * @returns {[Date, Date] | null} null = no date restriction (All Time, or an incomplete Custom range)
 */
export const getDateRange = (preset, custom = {}, now = new Date()) => {
  switch (preset) {
    case 'Today': return [startOfDay(now), endOfDay(now)];
    case 'Yesterday': { const y = addDays(now, -1); return [startOfDay(y), endOfDay(y)]; }
    case 'Last Week': return [startOfDay(addDays(now, -7)), endOfDay(now)];
    case 'Last Month': {
      const m = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return [startOfDay(m), endOfDay(now)];
    }
    case 'Custom': {
      const s = parseDay(custom.start), e = parseDay(custom.end);
      return s && e ? [startOfDay(s), endOfDay(e)] : null;
    }
    default: return null;
  }
};

/** True when `date` falls inside the preset's range (always true when there is no range). */
export const isInDateRange = (date, preset, custom, now) => {
  const range = getDateRange(preset, custom, now);
  if (!range) return true;
  return date >= range[0] && date <= range[1];
};
