import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bars3Icon, XMarkIcon, StarIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import UserMenu from './UserMenu';
import { logTabView, dashboardForRole } from '../../services/activity';
import { getSectionIcon } from './navIcons';

// Desktop (lg) gets a docked sidebar that collapses to an icon rail; smaller
// screens keep the slide-in drawer.
const DESKTOP_QUERY = '(min-width: 1024px)';
export const SIDEBAR_COLLAPSED_KEY = 'dashboardSidebarCollapsed';

const readCollapsed = () => {
  try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; } catch { return false; }
};

const useMediaQuery = (query) => {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return undefined;
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
};

// Section icon, or a monogram for sections without a mapped icon.
const SectionIcon = ({ s, className }) => {
  const Icon = getSectionIcon(s.id);
  if (Icon) return <Icon className={className} aria-hidden="true" />;
  return (
    <span aria-hidden="true" className={`${className} flex items-center justify-center rounded-md bg-gray-200/70 dark:bg-white/10 text-[11px] font-black`}>
      {(s.label || '?').charAt(0).toUpperCase()}
    </span>
  );
};

const focusRing ='focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#14161f]';

/**
 * DashboardShell — the shared Google-Cloud-style console frame used by every
 * dashboard (Admin, Team Member, Team Leader, Trainer).
 *
 * A top app bar carries the ☰ button beside the signed-in user's role + name +
 * email, with the account menu on the right. On desktop the navigation is a
 * docked sidebar that ☰ (or the footer chevron) collapses to an icon-only rail
 * with tooltips; the choice is remembered in localStorage and the content
 * area reflows to use the freed space. Below lg, ☰ slides the same grouped
 * nav in as a drawer over a dimmed content area. Theme-adaptive (light bar in
 * light mode, deep aurora in dark) so it reads correctly in both.
 *
 * @param {Object}   user          - the signed-in user
 * @param {Array}    sections      - [{ id, label, group?, badge?, onSelect? }]
 * @param {string}   activeId      - current section id
 * @param {Function} onNavigate    - (id) => void, sets the active section
 * @param {string}   title         - optional override for the page heading
 * @param {boolean}  fullWidth     - drop the 1400px content cap (for dense, dashboard-style tabs)
 * @param {Function} onSignOut, onChangePassword, onRefresh - passed to UserMenu
 */
const DashboardShell = ({
  user,
  sections = [],
  activeId,
  onNavigate,
  title,
  fullWidth = false,
  onSignOut,
  onChangePassword,
  onRefresh,
  topCenter = null,
  topRight = null,
  children,
}) => {
  const [open, setOpen] = useState(false); // mobile drawer
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [tooltip, setTooltip] = useState(null); // { label, top, left } for the icon rail
  const menuButtonRef = useRef(null);
  const drawerCloseRef = useRef(null);
  const drawerRef = useRef(null);

  const role = dashboardForRole(user?.role);
  const activeLabel = sections.find((s) => s.id === activeId)?.label || title || '';
  const hasGroups = sections.some((s) => s.group);
  const rail = isDesktop && collapsed;

  const toggleCollapsed = useCallback(() => {
    setTooltip(null);
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

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

  // Escape closes the drawer and any rail tooltip.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      setTooltip(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The drawer is mobile-only; drop it if the viewport grows to desktop.
  useEffect(() => { if (isDesktop) setOpen(false); }, [isDesktop]);

  // Drawer focus: move focus in when it opens, back to ☰ when it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      drawerCloseRef.current?.focus();
    } else if (wasOpen.current && drawerRef.current?.contains(document.activeElement)) {
      menuButtonRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Keep Tab / Shift+Tab inside the open drawer (it's a modal dialog).
  const trapDrawerFocus = (e) => {
    if (e.key !== 'Tab' || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll('button, a[href]');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const handleNav = (s) => {
    onNavigate?.(s.id);
    logTabView(user, s.id, s.label);
    if (s.onSelect) s.onSelect();
    setOpen(false);
  };

  const showTooltip = (e, label) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hideTooltip = () => setTooltip(null);
  const tooltipHandlers = (label) => ({
    onMouseEnter: (e) => showTooltip(e, label),
    onMouseLeave: hideTooltip,
    onFocus: (e) => showTooltip(e, label),
    onBlur: hideTooltip,
  });

  // Full-width nav row (drawer + expanded sidebar).
  const NavItem = (s) => {
    const active = activeId === s.id;
    const isPinned = pinned.includes(s.id);
    return (
      <div key={s.id} className="relative group/nav">
        <button
          onClick={() => handleNav(s)}
          aria-current={active ? 'page' : undefined}
          className={`w-full flex items-center gap-3 pl-3 pr-11 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors ${focusRing} ${
            active ? 'tab-pill-active' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
          }`}
        >
          <SectionIcon s={s} className="w-5 h-5 flex-none" />
          <span className="truncate">{s.label}</span>
          {s.badge ? (
            <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-md ${active ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'}`}>{s.badge}</span>
          ) : null}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); togglePin(s.id); }}
          title={isPinned ? 'Remove from quick access' : 'Pin to quick access'}
          aria-label={isPinned ? `Remove ${s.label} from quick access` : `Pin ${s.label} to quick access`}
          aria-pressed={isPinned}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/15 transition-colors ${focusRing}`}
        >
          {isPinned
            ? <StarSolidIcon className="w-4 h-4 text-amber-400" />
            : <StarIcon className={`w-4 h-4 transition-opacity ${active ? 'text-white/70' : 'text-gray-400 opacity-0 group-hover/nav:opacity-100 group-focus-within/nav:opacity-100'}`} />}
        </button>
      </div>
    );
  };

  // Icon-only row for the collapsed rail; the label lives in aria-label + tooltip.
  const RailItem = (s) => {
    const active = activeId === s.id;
    const label = s.badge ? `${s.label} (${s.badge})` : s.label;
    return (
      <button
        key={s.id}
        onClick={() => handleNav(s)}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        {...tooltipHandlers(label)}
        className={`relative w-full h-11 flex items-center justify-center rounded-xl transition-colors ${focusRing} ${
          active ? 'tab-pill-active' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-100'
        }`}
      >
        <SectionIcon s={s} className="w-5 h-5" />
        {s.badge ? (
          <span aria-hidden="true" className="absolute top-1 right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-black bg-rose-500 text-white">{s.badge}</span>
        ) : null}
      </button>
    );
  };

  // Group sections in first-seen order when any carry a `group`.
  const grouped = [];
  if (hasGroups) {
    const map = new Map();
    sections.forEach((s) => {
      const g = s.group || 'More';
      if (!map.has(g)) { map.set(g, []); grouped.push([g, map.get(g)]); }
      map.get(g).push(s);
    });
  }

  const renderNavList = (compact) => {
    const Item = compact ? RailItem : NavItem;
    if (!hasGroups) return <div className={compact ? 'space-y-1' : ''}>{sections.map(Item)}</div>;
    return grouped.map(([g, items], i) => (
      <div key={g} role="group" aria-label={g} className={compact ? 'space-y-1' : ''}>
        {compact
          ? (i > 0 && <div className="my-2 mx-3 border-t border-gray-200 dark:border-white/10" aria-hidden="true" />)
          : <div className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">{g}</div>}
        {items.map(Item)}
      </div>
    ));
  };

  const pinHint = (
    <p className="px-3 pt-1 pb-2 text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
      Tap the <StarIcon className="w-3.5 h-3.5 inline" /> to pin a shortcut.
    </p>
  );

  const menuButtonLabel = isDesktop
    ? (collapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar')
    : 'Open navigation menu';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] transition-colors duration-300">
      {/* Top app bar */}
      <header className="sticky top-0 z-40 flex items-center gap-2 sm:gap-3 h-16 px-3 sm:px-4 bg-white/90 dark:bg-[#0d0f16]/90 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
        <button
          ref={menuButtonRef}
          onClick={isDesktop ? toggleCollapsed : () => setOpen(true)}
          aria-label={menuButtonLabel}
          title={menuButtonLabel}
          aria-expanded={isDesktop ? !collapsed : open}
          aria-controls={isDesktop ? 'dashboard-sidebar' : 'dashboard-drawer'}
          className={`w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex-none ${focusRing}`}
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

      {/* Docked sidebar (desktop): expanded with labels, or a collapsed icon rail */}
      {isDesktop && (
        <aside
          id="dashboard-sidebar"
          aria-label="Main navigation"
          data-collapsed={collapsed}
          className={`fixed top-16 left-0 bottom-0 z-30 flex flex-col bg-white dark:bg-[#14161f] border-r border-gray-200 dark:border-white/10 transition-[width] duration-300 motion-reduce:transition-none ${collapsed ? 'w-[72px]' : 'w-64'}`}
        >
          <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'p-3' : 'p-2'}`} onScroll={hideTooltip}>
            {!collapsed && pinHint}
            {renderNavList(collapsed)}
          </nav>
          <div className={`p-2 border-t border-gray-200 dark:border-white/10 flex-none flex ${collapsed ? 'flex-col items-center gap-1' : 'items-center gap-1'}`}>
            {!collapsed && (
              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 text-center py-2 rounded-lg text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors ${focusRing}`}
              >
                View documentation
              </a>
            )}
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
              aria-expanded={!collapsed}
              aria-controls="dashboard-sidebar"
              {...(collapsed ? tooltipHandlers('Expand sidebar') : { title: 'Collapse sidebar' })}
              className={`w-10 h-10 flex-none flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${focusRing}`}
            >
              {collapsed ? <ChevronDoubleRightIcon className="w-5 h-5" /> : <ChevronDoubleLeftIcon className="w-5 h-5" />}
            </button>
          </div>
        </aside>
      )}

      {/* Rail tooltip — fixed so the scrolling nav can't clip it; visual only (labels are in aria-label) */}
      {rail && tooltip && (
        <div
          aria-hidden="true"
          className="fixed z-50 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs font-semibold shadow-lg whitespace-nowrap pointer-events-none"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.label}
        </div>
      )}

      {/* Everything right of the sidebar; its left padding tracks the sidebar width */}
      <div className={`transition-[padding] duration-300 motion-reduce:transition-none ${isDesktop ? (collapsed ? 'pl-[72px]' : 'pl-64') : ''}`}>
        {/* Quick-access shortcut bar (pinned sections) */}
        {pinnedSections.length > 0 && (
          <div className="sticky top-16 z-20 bg-gray-50/90 dark:bg-[#0b0d14]/90 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3 overflow-x-auto">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 flex-none">
                <StarSolidIcon className="w-3.5 h-3.5 text-amber-400" /> Quick access
              </span>
              <span className="hidden sm:block w-px h-4 bg-gray-300/70 dark:bg-white/10 flex-none" />
              {pinnedSections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleNav(s)}
                  aria-current={activeId === s.id ? 'page' : undefined}
                  className={`flex-none inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${focusRing} ${
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

        {/* Page content */}
        <main className={`${fullWidth ? 'max-w-none' : 'max-w-[1400px]'} mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24`}>
          {activeLabel && (
            <div className="mb-5">
              <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500">{role} › {activeLabel}</div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white mt-0.5">{activeLabel}</h1>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile: scrim + slide-in navigation drawer */}
      {!isDesktop && (
        <>
          <div
            onClick={() => setOpen(false)}
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            id="dashboard-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            aria-hidden={!open}
            onKeyDown={trapDrawerFocus}
            // Closed drawer is off-screen: keep it out of the tab order too.
            {...(!open && { inert: '' })}
            className={`fixed top-0 left-0 bottom-0 z-50 w-[300px] max-w-[86%] bg-white dark:bg-[#14161f] border-r border-gray-200 dark:border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}
          >
            <div className="flex items-center gap-2.5 px-4 h-14 border-b border-gray-200 dark:border-white/10 flex-none">
              <span className="w-6 h-6 rounded-md gradient-accent" />
              <span className="font-bold text-gray-900 dark:text-white">Team Portal</span>
              <button
                ref={drawerCloseRef}
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className={`ml-auto w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${focusRing}`}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2">
              {pinHint}
              {renderNavList(false)}
            </nav>

            <div className="p-2 border-t border-gray-200 dark:border-white/10 flex-none">
              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className={`block text-center py-2 rounded-lg text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors ${focusRing}`}
              >
                View documentation
              </a>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default DashboardShell;
