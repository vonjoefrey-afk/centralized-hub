import { vi } from 'vitest';

// Regression: updates.js used Timestamp without importing it, so creating or
// editing an update WITH a deadline threw "Timestamp is not defined".
const addDoc = vi.fn(async () => ({ id: 'new-update' }));
const updateDoc = vi.fn(async () => {});

vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../firebase/firestore', () => ({ createNotification: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  addDoc: (...args) => addDoc(...args),
  updateDoc: (...args) => updateDoc(...args),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn(async () => {}) })),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  runTransaction: vi.fn(),
  Timestamp: { fromDate: (d) => ({ __ts: d.toISOString() }) },
}));

const { createUpdate, updateUpdate } = await import('./updates');

describe('update deadlines', () => {
  beforeEach(() => { addDoc.mockClear(); updateDoc.mockClear(); });

  it('createUpdate stores a future deadline as a Firestore Timestamp', async () => {
    const deadline = new Date('2026-11-01T09:00:00Z');
    await expect(createUpdate('trainer-updates', 'Title', 'Body', 'admin-uid', deadline, [])).resolves.toBe('new-update');
    expect(addDoc.mock.calls[0][1]).toMatchObject({ deadline: { __ts: '2026-11-01T09:00:00.000Z' }, teamId: 'trainer-updates' });
  });

  it('createUpdate accepts a datetime-local string and no deadline', async () => {
    await createUpdate('trainer-updates', 'T', 'B', 'u', '2026-11-01T17:30', []);
    expect(addDoc.mock.calls[0][1].deadline).toHaveProperty('__ts');
    await createUpdate('trainer-updates', 'T', 'B', 'u', null, []);
    expect(addDoc.mock.calls[1][1].deadline).toBeNull();
  });

  it('updateUpdate (edit) also converts the deadline', async () => {
    await expect(updateUpdate('id-1', 'T', 'B', '2026-12-24T08:00')).resolves.toEqual({ success: true });
    expect(updateDoc.mock.calls[0][1].deadline).toHaveProperty('__ts');
  });
});
