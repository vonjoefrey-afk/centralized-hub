import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../../firebase/firestore', () => ({
  getUserScratchpad: vi.fn(), logSpiiAudit: vi.fn(),
  getScratchpadDocuments: vi.fn(), createScratchpadDocument: vi.fn(),
  updateScratchpadDocument: vi.fn(), deleteScratchpadDocument: vi.fn(),
  deleteScratchpadDocuments: vi.fn(), markScratchpadMigrated: vi.fn(),
}));
vi.mock('../../../services/activity', () => ({ logActivity: vi.fn() }));
vi.mock('../../../utils/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }));
vi.mock('../../../utils/googleDrivePicker', () => ({
  isDrivePickerConfigured: () => false, pickAndImportGoogleDoc: vi.fn(),
}));

// eslint-disable-next-line import/first
import ScratchpadTab from '../ScratchpadTab';

// In-memory stand-in for the Firestore document store.
const makeApi = (initial) => {
  const store = new Map(initial.map((d) => [d.id, { ...d }]));
  let next = 1;
  return {
    store,
    list: vi.fn(async () => [...store.values()].map((d) => ({ ...d }))),
    create: vi.fn(async (_uid, data) => { const id = `new${next++}`; store.set(id, { id, ...data }); return id; }),
    update: vi.fn(async (_uid, id, data) => {
      if (!store.has(id)) throw new Error(`no document ${id}`);
      store.set(id, { ...store.get(id), ...data });
    }),
    remove: vi.fn(async (_uid, id) => { store.delete(id); }),
    removeMany: vi.fn(async (_uid, ids) => { ids.forEach((id) => store.delete(id)); }),
    legacy: vi.fn(async () => null),
    markMigrated: vi.fn(),
  };
};

const user = { uid: 'u1', displayName: 'Tester' };
const docs = [
  { id: 'a', title: 'Doc A', content: '<p>alpha</p>', parentId: null, order: 0 },
  { id: 'b', title: 'Doc B', content: '<p>bravo</p>', parentId: null, order: 1 },
];

const editor = (container) => container.querySelector('[contenteditable]');

const typeInto = (el, html) => { el.innerHTML = html; fireEvent.input(el); };

const setup = async () => {
  const api = makeApi(docs);
  const utils = render(<ScratchpadTab user={user} spiiSettings={{ enabled: false }} api={api} />);
  await screen.findAllByText('Doc B');
  await act(async () => {}); // let the editor-load effect run
  return { api, ...utils };
};

// The desktop sidebar is the first rendered copy of each row.
const openMenuFor = (title) => {
  const row = screen.getAllByText(title)[0].closest('.group');
  fireEvent.click(row.querySelector('[aria-label="Document options"]'));
  return row;
};

afterEach(() => { vi.useRealTimers(); });

describe('ScratchpadTab (Notes) — unsaved edits', () => {
  it('saves pending edits when the Notes tab unmounts before the debounce fires', async () => {
    const { api, container, unmount } = await setup();
    typeInto(editor(container), '<p>alpha edited</p>');
    unmount();
    await act(async () => {});
    expect(api.store.get('a').content).toBe('<p>alpha edited</p>');
  });

  it('saves pending edits to the open doc when renaming another doc', async () => {
    const { api, container } = await setup();
    typeInto(editor(container), '<p>alpha edited</p>');
    openMenuFor('Doc B');
    await act(async () => { fireEvent.click(screen.getAllByText('Rename')[0]); });
    await act(async () => { await new Promise((r) => setTimeout(r, 1000)); });
    expect(api.store.get('a').content).toBe('<p>alpha edited</p>');
    expect(api.store.get('b').content).toBe('<p>bravo</p>');
  });

  it('duplicates the latest (unsaved) content and keeps the original\'s edits', async () => {
    const { api, container } = await setup();
    typeInto(editor(container), '<p>alpha edited</p>');
    openMenuFor('Doc A');
    await act(async () => { fireEvent.click(screen.getAllByText('Duplicate')[0]); });
    await act(async () => { await new Promise((r) => setTimeout(r, 1000)); });
    expect(api.store.get('a').content).toBe('<p>alpha edited</p>');
    expect(api.store.get('new1').content).toBe('<p>alpha edited</p>');
  });
});
