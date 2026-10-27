import { vi } from 'vitest';
import { fetchUsdRate, clearFxCache } from './fxRates';

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

describe('fxRates', () => {
  beforeEach(() => { clearFxCache(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns units per 1 USD and the update time, fetching once per session', async () => {
    const fetchMock = vi.fn(() => ok({ result: 'success', time_last_update_unix: 1793059351, rates: { USD: 1, JPY: 150.25, EUR: 0.92 } }));
    vi.stubGlobal('fetch', fetchMock);
    const jpy = await fetchUsdRate('JPY');
    expect(jpy.rate).toBe(150.25);
    expect(jpy.updatedAt.toISOString()).toBe('2026-10-27T00:02:31.000Z');
    expect((await fetchUsdRate('EUR')).rate).toBe(0.92);
    expect(fetchMock).toHaveBeenCalledTimes(1); // cached
  });

  it('throws for unknown currencies and failed responses (caller falls back to manual entry)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({ result: 'success', time_last_update_unix: 1, rates: { USD: 1 } })));
    await expect(fetchUsdRate('XYZ')).rejects.toThrow('No live rate for XYZ');
    clearFxCache();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 503 })));
    await expect(fetchUsdRate('JPY')).rejects.toThrow('503');
    clearFxCache();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await expect(fetchUsdRate('JPY')).rejects.toThrow('offline');
  });
});
