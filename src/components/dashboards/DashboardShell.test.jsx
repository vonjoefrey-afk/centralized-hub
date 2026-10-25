import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import DashboardShell, { SIDEBAR_COLLAPSED_KEY } from './DashboardShell';

vi.mock('./UserMenu', () => ({ default: () => null }));
vi.mock('../../services/activity', () => ({
  logTabView: vi.fn(),
  dashboardForRole: () => 'Team Member',
}));

const sections = [
  { id: 'updates', label: 'Updates' },
  { id: 'case-tracker', label: 'Case Tracker', badge: 3 },
  { id: 'mystery', label: 'Zeta Tools' }, // no mapped icon → monogram
];

const setViewport = (desktop) => {
  window.matchMedia = (query) => ({
    matches: desktop,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
};

const renderShell = (props = {}) => render(
  <DashboardShell user={{ uid: 'u1', role: 'team_member', email: 'a@test.com' }} sections={sections} activeId="updates" onNavigate={() => {}} {...props}>
    <p>content</p>
  </DashboardShell>,
);

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('DashboardShell sidebar (desktop)', () => {
  beforeEach(() => setViewport(true));

  it('starts expanded with labels and marks the active section', () => {
    renderShell();
    const sidebar = document.getElementById('dashboard-sidebar');
    expect(sidebar.dataset.collapsed).toBe('false');
    expect(sidebar.textContent).toContain('Case Tracker');
    expect(screen.getByRole('button', { name: 'Updates' }).getAttribute('aria-current')).toBe('page');
    // Both the ☰ in the app bar and the sidebar footer chevron toggle it.
    const toggles = screen.getAllByRole('button', { name: 'Collapse navigation sidebar' });
    expect(toggles).toHaveLength(2);
    toggles.forEach((t) => {
      expect(t.getAttribute('aria-expanded')).toBe('true');
      expect(t.getAttribute('aria-controls')).toBe('dashboard-sidebar');
    });
  });

  it('collapses to an icon rail, persists the choice, and restores it on reload', () => {
    renderShell();
    fireEvent.click(screen.getAllByRole('button', { name: 'Collapse navigation sidebar' })[0]);

    const sidebar = document.getElementById('dashboard-sidebar');
    expect(sidebar.dataset.collapsed).toBe('true');
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('true');
    // Labels move to aria-label (badge included); the visible text is gone.
    expect(screen.getByRole('button', { name: 'Case Tracker (3)' })).toBeTruthy();
    expect(sidebar.textContent).not.toContain('Case Tracker');
    // Unmapped section falls back to a monogram.
    expect(screen.getByRole('button', { name: 'Zeta Tools' }).textContent).toBe('Z');

    cleanup();
    renderShell();
    expect(document.getElementById('dashboard-sidebar').dataset.collapsed).toBe('true');
    expect(screen.getAllByRole('button', { name: 'Expand navigation sidebar' })[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('shows a tooltip for rail items on keyboard focus and hides it on blur / Escape', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
    renderShell();
    const item = screen.getByRole('button', { name: 'Updates' });

    fireEvent.focus(item);
    expect(screen.getByText('Updates', { selector: 'div' })).toBeTruthy();
    fireEvent.blur(item);
    expect(screen.queryByText('Updates', { selector: 'div' })).toBeNull();

    fireEvent.mouseEnter(item);
    expect(screen.getByText('Updates', { selector: 'div' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Updates', { selector: 'div' })).toBeNull();
  });

  it('navigates from the rail', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: 'Case Tracker (3)' }));
    expect(onNavigate).toHaveBeenCalledWith('case-tracker');
  });

  it('caps content width by default and drops the cap with fullWidth', () => {
    renderShell();
    expect(document.querySelector('main').className).toContain('max-w-[1400px]');
    cleanup();
    renderShell({ fullWidth: true });
    expect(document.querySelector('main').className).toContain('max-w-none');
    expect(document.querySelector('main').className).not.toContain('max-w-[1400px]');
  });

  it('survives localStorage being unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    renderShell();
    expect(document.getElementById('dashboard-sidebar').dataset.collapsed).toBe('false');
    spy.mockRestore();
  });
});

describe('DashboardShell drawer (mobile)', () => {
  beforeEach(() => setViewport(false));

  it('uses the slide-in drawer instead of the docked sidebar', () => {
    renderShell();
    expect(document.getElementById('dashboard-sidebar')).toBeNull();
    const drawer = document.getElementById('dashboard-drawer');
    expect(drawer.hasAttribute('inert')).toBe(true);

    const menu = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(menu);
    expect(drawer.hasAttribute('inert')).toBe(false);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close navigation menu' }));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(drawer.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(menu);
  });
});
