const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { generateJson } = require("./gemini");

/**
 * AI triage for a piece of user feedback. Admin-only. Uses Gemini to judge
 * whether the feedback is fixable in code and, if so, produce a short plan plus
 * a ready-to-paste prompt for an AI coding agent (e.g. Claude Code).
 *
 * Input (data): { type, title, message, featureStatuses, role, page }
 * Returns: { success, analysis: { fixable, summary, severity, area, plan[], agentPrompt } }
 */
exports.analyzeFeedback = async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  // Admin-only — the User Feedback tab is admin-only.
  const callerDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Only admins can analyze feedback.");
  }

  const { type, title, message, featureStatuses, role, page } = data || {};
  if (!title && !message && !featureStatuses) {
    throw new functions.https.HttpsError("invalid-argument", "No feedback content to analyze.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[analyzeFeedback] GEMINI_API_KEY is missing.");
    throw new functions.https.HttpsError("failed-precondition", "GEMINI_API_KEY is not configured.");
  }

  try {
    const feedbackBlock = JSON.stringify(
      { type, title, message, featureStatuses, submittedByRole: role, page },
      null,
      2,
    );

    const prompt = `You are a senior engineer triaging user feedback for an internal web app.
The app is a React 18 + Vite + Firebase (Firestore, Auth, Cloud Functions) team-management
tool with role-based dashboards (Admin, Trainer, Team Leader, Team Member) and features like
Templates, Notes, Case Tracker, SPII case handling, Metric Analytics, and GCP billing.

Here is one feedback item (a "bug" report or "uat" feature review):
${feedbackBlock}

Assess it and respond with ONLY a JSON object of this exact shape:
{
  "fixable": "yes" | "no" | "needs-info",
  "summary": "2-4 sentence plain-language read on what the user is reporting and whether it is a code fix, a config/permission issue, expected behavior, or unclear.",
  "severity": "low" | "medium" | "high",
  "area": "Best guess at the component/area of the codebase to look at (e.g. 'FeedbackTab.js / feedback service'). Use 'unknown' if unclear.",
  "plan": ["Ordered, concrete investigation or fix steps. 2-6 items."],
  "agentPrompt": "A single ready-to-paste prompt for an AI coding agent (Claude Code) to implement or debug this, written in the imperative, including what to look for and the acceptance criteria. If fixable is 'no' or 'needs-info', make this a prompt to investigate or a note on what extra info is needed."
}

Be concrete and honest. If it is not actually fixable in code (user error, expected behavior, or needs reproduction detail), say so via "fixable" and keep the plan short.`;

    const { text, model: usedModel } = await generateJson(apiKey, [{ role: "user", parts: [{ text: prompt }] }]);

    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch (parseError) {
      console.error("[analyzeFeedback] Failed to parse Gemini JSON:", text);
      throw new functions.https.HttpsError("internal", "AI returned an invalid format. Please try again.");
    }

    // Normalize to guard the UI against missing keys.
    const safe = {
      fixable: analysis.fixable || "needs-info",
      summary: analysis.summary || "",
      severity: analysis.severity || "medium",
      area: analysis.area || "unknown",
      plan: Array.isArray(analysis.plan) ? analysis.plan : [],
      agentPrompt: analysis.agentPrompt || "",
      model: usedModel,
    };

    return { success: true, analysis: safe };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error("[analyzeFeedback] Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
};
