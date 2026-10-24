import React, { useState, useEffect } from 'react';
import { Bars3Icon, XMarkIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import UserMenu from './UserMenu';
import { logTabView, dashboardForRole } from '../../services/activity';

/**
 * DashboardShell — the shared Google-Cloud-style console frame used by every
 * dashboard (Admin, Team Member, Team Leader, Trainer).
 *
 * A top app bar carries the ☰ button beside the signed-in user's role + name +
 * email, with the account menu on the right. Clicking ☰ slides a grouped nav
 * drawer in from the left over a dimmed content area. Theme-adaptive (light bar
 * in light mode, deep aurora in dark) so it reads correctly in both.
 *
 * @param {Object}   user          - the signed-in user
 * @param {Array}    sections      - [{ id, label, group?, badge?, onSelect? }]
 * @param {string}   activeId      - current section id
 * @param {Function} onNavigate    - (id) => void, sets the active section
 * @param {string}   title         - optional override for the page heading
 * @param {Function} onSignOut, onChangePassword, onRefresh - passed to UserMenu
 */
const DashboardShell = ({
  user,
  sections = [],
  activeId,
  onNavigate,
  title,
  onSignOut,
  onChangePassword,
  onRefresh,
  topCenter = null,
  topRight = null,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const role = dashboardForRole(user?.role);
  const activeLabel = sections.find((s) => s.id === activeId)?.label || title || '';
  const hasGroups = sections.some((s) => s.group);

  // Quick-access shortcuts: sections the user pins, persisted per user.
  const storageKey = user?.uid ? `dashboardQuickAccess:${user.uid}` : null;
  const [pinned, setPinned] = useState([]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      setPinned(raw ? JSON.parse(raw) : []);
    } catch { /* storage unavailable */ }
  }, [storageKey]);
  const togglePin = (id) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const pinnedSections = sections.filter((s) => pinned.includes(s.id));

  // Close the drawer on Escape.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleNav = (s) => {
    onNavigate?.(s.id);
    logTabView(user, s.id, s.label);
    if (s.onSelect) s.onSelect();
    setOpen(false);
  };

  const NavItem = (s) => {
    const active = activeId === s.id;
    const isPinned = pinned.includes(s.id);
    return (
      <div key={s.id} className="relative group/nav">
        <button
          onClick={() => handleNav(s)}
          className={`w-full flex items-center gap-3 pl-3 pr-11 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors ${
            active ? 'tab-pill-active' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
          }`}
        >
          <span className="truncate">{s.label}</span>
          {s.badge ? (
            <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-md ${active ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'}`}>{s.badge}</span>
          ) : null}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); togglePin(s.id); }}
          title={isPinned ? 'Remove from quick access' : 'Pin to quick access'}
          aria-label={isPinned ? 'Remove from quick access' : 'Pin to quick access'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
        >
          {isPinned
            ? <StarSolidIcon className="w-4 h-4 text-amber-400" />
            : <StarIcon className={`w-4 h-4 transition-opacity ${active ? 'text-white/70' : 'text-gray-400 opacity-0 group-hover/nav:opacity-100'}`} />}
        </button>
      </div>
    );
  };

  // Group sections in first-seen order when any carry a `group`.
  const groups = [];
  if (hasGroups) {
    const map = new Map();
    sections.forEach((s) => {
      const g = s.group || 'More';
      if (!map.has(g)) { map.set(g, []); groups.push(g); }
      map.get(g).push(s);
    });
    var grouped = groups.map((g) => [g, map.get(g)]);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] transition-colors duration-300">
      {/* Top app bar */}
      <header className="sticky top-0 z-40 flex items-center gap-2 sm:gap-3 h-16 px-3 sm:px-4 bg-white/90 dark:bg-[#0d0f16]/90 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex-none"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg gradient-accent flex-none shadow-sm shadow-indigo-500/30" />
          <div className="min-w-0 leading-tight">
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
              <span className="text-indigo-600 dark:text-indigo-400">{role}</span>
              {(user?.displayName || user?.email) ? <span className="text-gray-400 dark:text-gray-500"> · </span> : null}
              {user?.displayName || user?.email}
            </div>
            {user?.email && <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user.email}</div>}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex justify-center px-2">{topCenter}</div>
        <div className="flex items-center gap-2 flex-none">
          {topRight}
          <UserMenu user={user} onSignOut={onSignOut} onChangePassword={onChangePassword} onRefresh={onRefresh} />
        </div>
      </header>

      {/* Quick-access shortcut bar (pinned sections) */}
      {pinnedSections.length > 0 && (
        <div className="sticky top-16 z-30 bg-gray-50/90 dark:bg-[#0b0d14]/90 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3 overflow-x-auto">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 flex-none">
              <StarSolidIcon className="w-3.5 h-3.5 text-amber-400" /> Quick access
            </span>
            <span className="hidden sm:block w-px h-4 bg-gray-300/70 dark:bg-white/10 flex-none" />
            {pinnedSections.map((s) => (
              <button
                key={s.id}
                onClick={() => handleNav(s)}
                className={`flex-none inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                  activeId === s.id
                    ? 'tab-pill-active shadow-md shadow-indigo-500/25'
                    : 'bg-white/70 dark:bg-white/[0.06] backdrop-blur-md border border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-200 shadow-sm hover:border-indigo-300/60 dark:hover:border-white/20 hover:shadow-md hover:-translate-y-px'
                }`}
              >
                {s.label}
                {s.badge ? (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${activeId === s.id ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'}`}>{s.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scrim */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
      />

      {/* Slide-in navigation drawer */}
      <aside
        role="dialog"
        aria-label="Navigation menu"
        aria-hidden={!open}
        className={`fixed top-0 left-0 bottom-0 z-50 w-[300px] max-w-[86%] bg-white dark:bg-[#14161f] border-r border-gray-200 dark:border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-gray-200 dark:border-white/10 flex-none">
          <span className="w-6 h-6 rounded-md gradient-accent" />
          <span className="font-bold text-gray-900 dark:text-white">Team Portal</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <p className="px-3 pt-1 pb-2 text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
            Tap the <StarIcon className="w-3.5 h-3.5 inline" /> to pin a shortcut.
          </p>
          {hasGroups
            ? grouped.map(([g, items]) => (
                <div key={g}>
                  <div className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">{g}</div>
                  {items.map(NavItem)}
                </div>
              ))
            : sections.map(NavItem)}
        </nav>

        <div className="p-2 border-t border-gray-200 dark:border-white/10 flex-none">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center py-2 rounded-lg text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors"
          >
            View documentation
          </a>
        </div>
      </aside>

      {/* Page content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
        {activeLabel && (
          <div className="mb-5">
            <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500">{role} › {activeLabel}</div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white mt-0.5">{activeLabel}</h1>
          </div>
        )}
        {children}
      </main>
    </div>
  );
};

export default DashboardShell;
