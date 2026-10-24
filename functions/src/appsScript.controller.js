const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * appsScriptProxy — server-side proxy to the external Google Apps Script Web App.
 *
 * Why this exists: browsers can't reliably call an Apps Script /exec URL directly
 * (CORS + login redirects). This callable runs server-side (no CORS), enforces
 * the per-user `appsScript` feature flag, reads the configured URL from Firestore,
 * and can attach a shared secret that never touches the frontend.
 *
 * NOTE: the Apps Script deployment must be reachable without an interactive Google
 * login (Web App access = "Anyone"). A domain-restricted deployment returns a
 * Google login page to any programmatic caller (browser OR server) and would need
 * full OAuth — out of scope here. Protect a public deployment with the optional
 * shared secret below instead.
 *
 * Optional secret: set APPS_SCRIPT_SECRET in the functions environment; it is sent
 * as `secret` (query param for GET, body field for POST) for your Apps Script to
 * validate. If unset, no secret is sent.
 */
const APPS_SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET || "";

const isValidExecUrl = (url) =>
  /^https:\/\/script\.google\.com\/(?:macros\/s\/|a\/macros\/[^/]+\/s\/)[A-Za-z0-9_-]+\/exec\b/.test((url || "").trim());

exports.appsScriptProxy = async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
  }

  const db = admin.firestore();

  // Enforce the per-user feature gate server-side (defense in depth).
  const userSnap = await db.collection("users").doc(context.auth.uid).get();
  const features = userSnap.exists ? (userSnap.data().features || {}) : {};
  if (features.appsScript !== true) {
    throw new functions.https.HttpsError("permission-denied", "Apps Script integration is not enabled for your account.");
  }

  const { appId = null, action = null, method = "GET", params = {}, payload = {} } = data || {};

  // Resolve the target URL server-side (by appId), so the client can't point the
  // proxy at an arbitrary URL. Supports the multi-app list and legacy single URL.
  const settingsSnap = await db.doc("settings/integrations").get();
  const settings = settingsSnap.exists ? (settingsSnap.data() || {}) : {};
  let url = "";
  let resolvedId = null;
  if (Array.isArray(settings.appsScriptApps) && settings.appsScriptApps.length) {
    const app = appId
      ? settings.appsScriptApps.find((a) => a.id === appId)
      : settings.appsScriptApps[0];
    url = app ? (app.url || "") : "";
    resolvedId = app ? app.id : null;
  } else {
    url = settings.appsScriptUrl || ""; // legacy single-URL config
  }
  if (!url || !isValidExecUrl(url)) {
    throw new functions.https.HttpsError("failed-precondition", "Apps Script URL is not configured for this app.");
  }

  // Enforce the per-user, per-script allow-list (if set). Absent = all allowed.
  if (Array.isArray(features.appsScriptIds) && resolvedId && !features.appsScriptIds.includes(resolvedId)) {
    throw new functions.https.HttpsError("permission-denied", "You don't have access to this Apps Script.");
  }

  try {
    let response;
    if (String(method).toUpperCase() === "GET") {
      const qs = new URLSearchParams({
        ...(action ? { action } : {}),
        ...(params || {}),
        ...(APPS_SCRIPT_SECRET ? { secret: APPS_SCRIPT_SECRET } : {}),
      }).toString();
      const sep = url.includes("?") ? "&" : "?";
      response = await fetch(qs ? `${url}${sep}${qs}` : url, { method: "GET", redirect: "follow" });
    } else {
      const body = JSON.stringify({
        action,
        ...(payload || {}),
        ...(APPS_SCRIPT_SECRET ? { secret: APPS_SCRIPT_SECRET } : {}),
      });
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        redirect: "follow",
      });
    }

    const text = await response.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { ok: response.ok, status: response.status, data: parsed };
  } catch (err) {
    throw new functions.https.HttpsError("internal", "Apps Script request failed: " + (err.message || "unknown error"));
  }
};
