import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowsPointingOutIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { showInfo } from '../../utils/toast';

/**
 * FloatingPanel — pop a tab's content into a floating desktop window so it stays
 * visible while you work in another app (e.g. keeping Templates handy while
 * chatting). Prefers Document Picture-in-Picture (always-on-top); falls back to
 * a normal pop-out window where PiP isn't available.
 *
 * The content is rendered into the floating window with its OWN React root
 * (createRoot on the new window's document). React 18 does not deliver events
 * to a portal placed in another document, so a separate root — not createPortal
 * — is what makes buttons inside the floating window actually work.
 *
 * While floating, the in-page slot shows a placeholder with a "Bring back"
 * button; closing the window (or clicking Bring back) restores it inline.
 *
 * `active` controls only the in-page slot: pass false when the host tab isn't
 * showing. The component stays mounted and the floating window keeps running,
 * so switching tabs/views does NOT close an open float. Mount this at the
 * dashboard layout level (not inside a per-tab conditional) for that to hold.
 */
const pipSupported = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window;

const copyStyles = (win) => {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    try { win.document.head.appendChild(node.cloneNode(true)); } catch { /* ignore */ }
  });
};

const FloatingPanel = ({ title = 'Floating window', children, width = 460, height = 680, active = true }) => {
  const [floating, setFloating] = useState(false);
  const winRef = useRef(null);
  const rootRef = useRef(null);
  const mountRef = useRef(null);
  const themeObserverRef = useRef(null);
  // `children` may be a render function (floating) => ReactNode, letting the
  // caller show a compact layout only while floating.
  const renderContent = useCallback(
    (isFloating) => (typeof children === 'function' ? children(isFloating) : children),
    [children]
  );
  const renderRef = useRef(renderContent);
  renderRef.current = renderContent;

  const teardown = useCallback(() => {
    if (themeObserverRef.current) { themeObserverRef.current.disconnect(); themeObserverRef.current = null; }
    if (rootRef.current) { try { rootRef.current.unmount(); } catch { /* ignore */ } rootRef.current = null; }
    mountRef.current = null;
    winRef.current = null;
    setFloating(false);
  }, []);

  const prepareWindow = useCallback((win) => {
    copyStyles(win);
    win.document.title = title;
    win.document.documentElement.className = document.documentElement.className;
    win.document.body.style.margin = '0';
    win.document.body.className = 'bg-gray-50 dark:bg-[#050505]';

    const mount = win.document.createElement('div');
    mount.className = 'min-h-screen p-4';
    win.document.body.appendChild(mount);
    mountRef.current = mount;

    const root = createRoot(mount);
    root.render(renderRef.current(true));
    rootRef.current = root;

    // Keep the floating window's light/dark theme in sync with the app.
    const obs = new MutationObserver(() => {
      win.document.documentElement.className = document.documentElement.className;
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    themeObserverRef.current = obs;

    win.addEventListener('pagehide', teardown, { once: true });
    winRef.current = win;
    setFloating(true);
  }, [title, teardown]);

  const openFloat = useCallback(async () => {
    // Preferred: always-on-top Document Picture-in-Picture.
    if (pipSupported()) {
      try {
        const pip = await window.documentPictureInPicture.requestWindow({ width, height });
        prepareWindow(pip);
        return;
      } catch { /* fall through to popup */ }
    }
    // Fallback: a normal pop-out window (movable, not always-on-top).
    const popup = window.open('', 'floating-panel', `popup,width=${width},height=${height}`);
    if (!popup) {
      showInfo('Allow pop-ups for this site to float this tab.');
      return;
    }
    prepareWindow(popup);
  }, [width, height, prepareWindow]);

  const closeFloat = useCallback(() => {
    if (winRef.current) { try { winRef.current.close(); } catch { /* ignore */ } }
    teardown();
  }, [teardown]);

  // Re-render the floating root when the content changes.
  useEffect(() => {
    if (floating && rootRef.current) rootRef.current.render(renderContent(true));
  }, [renderContent, floating]);

  // Close the floating window if this component unmounts (navigating away).
  useEffect(() => () => { if (winRef.current) { try { winRef.current.close(); } catch { /* ignore */ } } }, []);

  // When the host tab isn't showing, render nothing in-page — but stay mounted
  // so an open floating window survives the tab switch.
  if (!active) return null;

  return (
    <div>
      <div className="flex justify-end mb-3">
        {floating ? (
          <button
            onClick={closeFloat}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <ArrowUturnLeftIcon className="w-4 h-4" /> Bring back
          </button>
        ) : (
          <button
            onClick={openFloat}
            title="Float this tab in a window that stays on top of other apps"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowsPointingOutIcon className="w-4 h-4" /> Float
          </button>
        )}
      </div>

      {floating ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/15 p-10 text-center bg-gray-50/60 dark:bg-white/[0.02]">
          <ArrowsPointingOutIcon className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-base font-black text-gray-900 dark:text-white">{title} is floating</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">It’s in a separate window. Keep it visible while you work in other apps.</p>
          <button onClick={closeFloat} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
            <ArrowUturnLeftIcon className="w-4 h-4" /> Bring back
          </button>
        </div>
      ) : (
        renderContent(false)
      )}
    </div>
  );
};

export default FloatingPanel;
