// Live USD exchange rates for the GCP Billing tab's limit checks, from the
// free ExchangeRate-API open endpoint (no key, CORS-enabled, updated daily,
// attribution required — the tab links to it).
// shortcut: fetched per browser and cached for the page session; move to a
// scheduled Cloud Function + Firestore if everyone must share one recorded rate
// or this endpoint proves unreliable.
export const FX_SOURCE_URL = 'https://open.er-api.com/v6/latest/USD';
export const FX_ATTRIBUTION_URL = 'https://www.exchangerate-api.com';

let cached = null; // { rates, updatedAt, fetchedAt }
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** { rates: { JPY: 150.2, … } (units per 1 USD), updatedAt: Date } — throws on failure. */
export const fetchUsdRates = async () => {
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached;
  const res = await fetch(FX_SOURCE_URL);
  if (!res.ok) throw new Error(`Rate service responded ${res.status}`);
  const data = await res.json();
  if (data.result !== 'success' || !data.rates) throw new Error('Rate service returned no rates');
  cached = { rates: data.rates, updatedAt: new Date(data.time_last_update_unix * 1000), fetchedAt: Date.now() };
  return cached;
};

/** Units of `currency` per 1 USD, or throws when unavailable. */
export const fetchUsdRate = async (currency) => {
  const { rates, updatedAt } = await fetchUsdRates();
  const rate = rates[currency];
  if (!(rate > 0)) throw new Error(`No live rate for ${currency}`);
  return { rate, updatedAt };
};

// Test hook: forget the cached rates.
export const clearFxCache = () => { cached = null; };
