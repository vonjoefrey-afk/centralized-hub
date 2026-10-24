/**
 * googleDrivePicker — import a Google Doc directly from the user's Drive.
 *
 * Flow: request an OAuth access token (drive.readonly) via Google Identity
 * Services, show the Google Picker filtered to Google Docs, then export the
 * chosen Doc to HTML through the Drive REST API and sanitize it.
 *
 * Requires three build-time values (all with the REACT_APP_ prefix Vite is
 * configured to expose):
 *   REACT_APP_GOOGLE_CLIENT_ID  - OAuth 2.0 Web client ID
 *   REACT_APP_GOOGLE_API_KEY    - API key with the Picker API enabled
 *                                 (falls back to the Firebase API key)
 *   REACT_APP_GOOGLE_APP_ID     - the GCP project NUMBER
 *
 * and, in the Google Cloud project: the Google Picker API + Google Drive API
 * enabled, and the Drive scope added to the OAuth consent screen.
 */
import { sanitizeImportedHtml } from './importDoc';

const CLIENT_ID = import.meta.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.REACT_APP_GOOGLE_API_KEY || import.meta.env.REACT_APP_FIREBASE_API_KEY;
const APP_ID = import.meta.env.REACT_APP_GOOGLE_APP_ID;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DOC_MIME = 'application/vnd.google-apps.document';

export const isDrivePickerConfigured = () => Boolean(CLIENT_ID && API_KEY && APP_ID);

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

let pickerLoaded = false;
const loadPicker = async () => {
  await loadScript('https://apis.google.com/js/api.js');
  if (!pickerLoaded) {
    await new Promise((resolve) => window.gapi.load('picker', { callback: resolve }));
    pickerLoaded = true;
  }
};

let tokenClient = null;
const getAccessToken = async () => {
  await loadScript('https://accounts.google.com/gsi/client');
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: () => {}, // set per-request below
      });
    }
    tokenClient.callback = (resp) => {
      if (resp.error) reject(new Error(resp.error));
      else resolve(resp.access_token);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
};

const showPicker = (accessToken) =>
  new Promise((resolve, reject) => {
    try {
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCUMENTS)
        .setIncludeFolders(false)
        .setMimeTypes(DOC_MIME)
        .setOwnedByMe(true);
      const picker = new window.google.picker.PickerBuilder()
        .setAppId(APP_ID)
        .setOAuthToken(accessToken)
        .setDeveloperKey(API_KEY)
        .addView(view)
        .setTitle('Import a Google Doc')
        .setCallback((data) => {
          const action = data[window.google.picker.Response.ACTION];
          if (action === window.google.picker.Action.PICKED) {
            const doc = data[window.google.picker.Response.DOCUMENTS][0];
            resolve({
              id: doc[window.google.picker.Document.ID],
              name: doc[window.google.picker.Document.NAME] || 'Imported document',
            });
          } else if (action === window.google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      reject(err);
    }
  });

const exportDocHtml = async (fileId, accessToken) => {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/html`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive export failed (${res.status})`);
  return res.text();
};

/**
 * Open the Drive picker and import the selected Google Doc.
 * @returns {Promise<{title: string, content: string} | null>} null if cancelled.
 */
export const pickAndImportGoogleDoc = async () => {
  if (!isDrivePickerConfigured()) {
    throw new Error('Google Drive import is not configured for this deployment.');
  }
  const accessToken = await getAccessToken();
  await loadPicker();
  const picked = await showPicker(accessToken);
  if (!picked) return null;
  const html = await exportDocHtml(picked.id, accessToken);
  return { title: picked.name.replace(/\.[^.]+$/, ''), content: sanitizeImportedHtml(html) };
};
