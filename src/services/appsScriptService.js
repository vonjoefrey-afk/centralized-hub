/**
 * appsScriptService — the ONLY integration point between this full-stack app and
 * one or more separate Google Apps Script Web Apps.
 *
 *   Full-Stack App  ──HTTP──▶  Apps Script Web App (/exec)  ──▶  Sheets / Docs / Drive / Gmail …
 *
 * Multiple Web Apps are supported. Each is a named entry:
 *   { id, name, url, transport }   transport: 'direct' | 'proxy'
 * stored (admin-managed) in Firestore `settings/integrations.appsScriptApps`.
 *
 * Transports (per app, switchable by an admin):
 *   - 'direct': browser → Apps Script /exec (GET; POST as text/plain to skip the
 *               CORS preflight Apps Script can't answer).
 *   - 'proxy' : browser → Firebase Cloud Function (appsScriptProxy) → Apps Script.
 *               Removes browser CORS; can attach a server-side shared secret.
 *
 * SECURITY: no API keys / OAuth secrets / credentials in the frontend. A shared
 * secret, if needed, lives only in the Cloud Function env (proxy transport). The
 * proxy resolves the target URL from `appId` server-side, so the client can't
 * point it at an arbitrary URL.
 */
import { db, functions } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { logger } from '../utils/logger';

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'integrations';
const ENV_URL = (import.meta.env.REACT_APP_APPS_SCRIPT_URL || '').trim();

// A deployed Apps Script Web App endpoint looks like either:
//   https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec              (personal)
//   https://script.google.com/a/macros/<domain>/s/<DEPLOYMENT_ID>/exec   (Workspace)
const EXEC_URL_RE = /^https:\/\/script\.google\.com\/(?:macros\/s\/|a\/macros\/[^/]+\/s\/)[A-Za-z0-9_-]+\/exec\b/;

let cachedApps = null; // [{ id, name, url, transport }]

/** True when a string looks like a deployed Apps Script /exec URL. */
export const isValidExecUrl = (url) => EXEC_URL_RE.test((url || '').trim());

/** Whether a given user has the Apps Script feature enabled (off by default). */
export const isAppsScriptEnabled = (user) => !!(user && user.features && user.features.appsScript);

/**
 * Filter the configured apps down to the ones a user may access.
 * `features.appsScriptIds` is the per-user allow-list. If it's absent (legacy
 * users enabled before per-script control existed), all apps are allowed.
 */
export const getAllowedAppsForUser = (user, apps) => {
  const ids = user && user.features && user.features.appsScriptIds;
  if (!Array.isArray(ids)) return apps || [];
  return (apps || []).filter((a) => ids.includes(a.id));
};

/** Generate a stable id for a new app entry. */
export const newAppId = () => `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const normalizeApp = (a, i) => ({
  id: a.id || newAppId(),
  name: (a.name || `Apps Script ${i + 1}`).trim(),
  url: (a.url || '').trim(),
  transport: a.transport === 'proxy' ? 'proxy' : 'direct',
});

/**
 * Load the configured Apps Scripts. Returns [] when none. Migrates a legacy
 * single { appsScriptUrl, appsScriptTransport } into a one-item list (read-only;
 * it's persisted as a list next time an admin saves).
 */
export const getAppsScriptApps = async ({ force = false } = {}) => {
  if (cachedApps && !force) return cachedApps;
  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID));
    const data = snap.exists() ? snap.data() : {};
    if (Array.isArray(data.appsScriptApps) && data.appsScriptApps.length) {
      cachedApps = data.appsScriptApps.map(normalizeApp);
    } else if ((data.appsScriptUrl || ENV_URL || '').trim()) {
      // Legacy single-URL config → present as one named app.
      cachedApps = [{
        id: 'default',
        name: 'Apps Script',
        url: (data.appsScriptUrl || ENV_URL || '').trim(),
        transport: data.appsScriptTransport === 'proxy' ? 'proxy' : 'direct',
      }];
    } else {
      cachedApps = [];
    }
  } catch (err) {
    logger.warn('appsScript: failed to read apps, using env fallback:', err);
    cachedApps = ENV_URL ? [{ id: 'default', name: 'Apps Script', url: ENV_URL, transport: 'direct' }] : [];
  }
  return cachedApps;
};

/** Persist the full list of apps (admin only, per Firestore rules on `settings`). */
export const saveAppsScriptApps = async (apps) => {
  const cleaned = (apps || []).map(normalizeApp);
  for (const a of cleaned) {
    if (a.url && !isValidExecUrl(a.url)) {
      throw new Error(`“${a.name}”: enter a valid Apps Script /exec URL (https://script.google.com/macros/s/…/exec).`);
    }
    if (!a.name) throw new Error('Every Apps Script needs a name.');
  }
  await setDoc(
    doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID),
    { appsScriptApps: cleaned, updatedAt: serverTimestamp() },
    { merge: true }
  );
  cachedApps = cleaned;
  return { success: true };
};

const resolveApp = async (appId) => {
  const apps = await getAppsScriptApps();
  if (!apps.length) return null;
  if (!appId) return apps[0];
  return apps.find((a) => a.id === appId) || apps[0];
};

const withTimeout = (ms) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
};

const callViaProxy = async ({ appId, action, method, params, payload }) => {
  const fn = httpsCallable(functions, 'appsScriptProxy');
  const res = await fn({ appId, action, method, params, payload });
  const out = res.data || {};
  if (out.ok === false) throw new Error(`Apps Script responded with HTTP ${out.status}`);
  return out.data;
};

const callDirect = async ({ base, action, method, params, payload, timeoutMs }) => {
  if (!base) throw new Error('Apps Script URL is not set.');
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    let response;
    if (method === 'GET') {
      const qs = new URLSearchParams({ ...(action ? { action } : {}), ...params }).toString();
      const sep = base.includes('?') ? '&' : '?';
      response = await fetch(qs ? `${base}${sep}${qs}` : base, { method: 'GET', redirect: 'follow', signal });
    } else {
      const body = JSON.stringify({ action, ...(payload || {}) });
      response = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        redirect: 'follow',
        signal,
      });
    }
    if (!response.ok) throw new Error(`Apps Script responded with HTTP ${response.status}`);
    const text = await response.text();
    try { return JSON.parse(text); } catch { return text; }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Apps Script request timed out.');
    throw err;
  } finally {
    clear();
  }
};

/**
 * Core call. Pick which Apps Script with `appId` (defaults to the first).
 * @param {Object} opts { appId, action, method, params, payload, timeoutMs }
 */
export const callAppsScript = async ({ appId, action, method = 'GET', params = {}, payload = null, timeoutMs = 20000 } = {}) => {
  const app = await resolveApp(appId);
  if (!app) throw new Error('Apps Script integration is not configured. An admin can add one in Admin → System Settings.');
  if (app.transport === 'proxy') return callViaProxy({ appId: app.id, action, method, params, payload });
  return callDirect({ base: app.url, action, method, params, payload, timeoutMs });
};

export const appsScriptGet = (appId, action, params = {}) => callAppsScript({ appId, action, method: 'GET', params });
export const appsScriptPost = (appId, action, payload = {}) => callAppsScript({ appId, action, method: 'POST', payload });

/**
 * Connection test for a single app (admin "Test" button, and the user tab).
 * @param {{ id?, url?, transport? }} app - test this app (may be unsaved, direct only)
 */
export const testAppsScriptConnection = async (app = {}) => {
  const transport = app.transport === 'proxy' ? 'proxy' : 'direct';

  if (transport === 'proxy') {
    if (!app.id) return { ok: false, error: 'Save the app first to test via the proxy.' };
    try {
      const out = await callViaProxy({ appId: app.id, action: 'ping', method: 'GET', params: {}, payload: {} });
      return { ok: true, status: 200, sample: typeof out === 'string' ? out.slice(0, 300) : JSON.stringify(out).slice(0, 300) };
    } catch (err) {
      return { ok: false, error: err.message || 'Proxy request failed' };
    }
  }

  const target = (app.url || '').trim();
  if (!target) return { ok: false, error: 'No URL set.' };
  if (!isValidExecUrl(target)) return { ok: false, error: 'URL must be a Google Apps Script /exec URL.' };
  const { signal, clear } = withTimeout(15000);
  try {
    const sep = target.includes('?') ? '&' : '?';
    const res = await fetch(`${target}${sep}action=ping`, { method: 'GET', redirect: 'follow', signal });
    const sample = (await res.text()).slice(0, 300);
    return { ok: res.ok, status: res.status, sample };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'Request timed out.' : (err.message || 'Request failed (likely CORS — try the Secure proxy method).') };
  } finally {
    clear();
  }
};

/* --------------------------------------------------------------------------
 * EXAMPLE wrappers — TEMPLATES ONLY. Pass the target app's id, then rename
 * these + their `action`s/params to match YOUR Apps Script's doGet/doPost.
 * -------------------------------------------------------------------------- */
export const getEmployees = (appId) => appsScriptGet(appId, 'getEmployees');
export const createEmployee = (appId, employee) => appsScriptPost(appId, 'createEmployee', { employee });
export const updateEmployee = (appId, id, employee) => appsScriptPost(appId, 'updateEmployee', { id, employee });
export const deleteEmployee = (appId, id) => appsScriptPost(appId, 'deleteEmployee', { id });
