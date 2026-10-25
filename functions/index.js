const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});
const {checkRateLimit} = require("./src/middleware");
const {writeCloudLog} = require("./src/logging.controller");
const authController = require("./src/auth.controller");
const spiiController = require("./src/spii.controller");
const caseSyncController = require("./src/caseSync.controller");

const templatesController = require("./src/templates.controller");
const appsScriptController = require("./src/appsScript.controller");
const liveSessionsController = require("./src/liveSessions.controller");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Exported Functions

// 1. Password Reset
exports.resetUserPassword = functions.region("asia-southeast1")
    .https.onRequest(authController.resetUserPassword);

// 2. Delete User from Auth
exports.deleteUserFromAuth = functions.region("asia-southeast1")
    .https.onRequest(authController.deleteUserFromAuth);

// 4. SPII Google Chat Integrations
exports.manualSpiiChatFollowUp = functions.region("asia-southeast1")
    .https.onCall(spiiController.manualSpiiChatFollowUp);

exports.dailySpiiChatFollowUp = functions.region("asia-southeast1")
    .pubsub.schedule("0 * * * *")
    .timeZone("Asia/Manila")
    .onRun(spiiController.dailySpiiChatFollowUp);

// 4.1. Real-time sync: keep each tracked case's SPII mirror current the moment it changes
exports.syncTrackedCaseToSpii = functions.region("asia-southeast1")
    .firestore.document("tracked_cases/{caseId}")
    .onWrite(caseSyncController.onTrackedCaseWrite);

// 4.2. One-time admin sweep to fix any cases left stale before the sync above existed
exports.backfillSpiiCaseSync = functions.region("asia-southeast1")
    .https.onCall(caseSyncController.backfillSpiiCaseSync);

// 4.5. AI Template Extraction
exports.extractTemplatesFromFile = functions.runWith({ 
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 300,
    memory: "512MB"
})
    .region("asia-southeast1")
    .https.onCall(templatesController.extractTemplatesFromFile);

// 4.55. Template live sessions: auto-close sessions left open (browser closed / asleep)
exports.closeStaleLiveSessions = functions.region("asia-southeast1")
    .pubsub.schedule("every 15 minutes")
    .timeZone("Asia/Manila")
    .onRun(liveSessionsController.closeStaleLiveSessions);

// 4.6. Apps Script Web App proxy (server-side, CORS-free; enforces per-user gate)
exports.appsScriptProxy = functions.region("asia-southeast1")
    .https.onCall(appsScriptController.appsScriptProxy);

// 3. Log Receiver
exports.logToCloudLogging = functions.region("asia-southeast1").https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    try {
      // Client IP for rate limiting
      const clientIp = req.headers["fastly-client-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress;

      const rateLimit = checkRateLimit(clientIp);
      if (!rateLimit.allowed) {
        console.warn(`Rate limit exceeded for IP: ${clientIp}`);
        res.status(429).json({error: rateLimit.reason});
        return;
      }

      const {severity, message, context} = req.body;

      // Allow only ERROR and CRITICAL from client to save costs
      if (severity !== "ERROR" && severity !== "CRITICAL") {
        res.status(200).json({skipped: true, reason: "Severity too low"});
        return;
      }

      await writeCloudLog(severity, `Client Error: ${message}`, {
        context,
        ip: clientIp,
        source: "client-side",
      });

      res.status(200).json({success: true});
    } catch (error) {
      console.error("Logging functionality error:", error);
      res.status(500).json({error: "Internal error"});
    }
  });
});

// TEMPORARY DEBUG FUNCTION
exports.checkUsers = functions.region("asia-southeast1").https.onRequest(async (req, res) => {
  try {
    const emails = ["test2@test.com", "test2_member@test.com"];
    const results = {};

    for (const email of emails) {
      const q = await admin.firestore().collection("users").where("email", "==", email).get();
      if (q.empty) {
        results[email] = {found: false};
      } else {
        const doc = q.docs[0];
        results[email] = {
          found: true,
          id: doc.id,
          data: doc.data(),
        };
      }
    }

    // Also check for ALL team members count to see if getAllTeamMemberUsers would return anything
    const tmQuery = await admin.firestore().collection("users").where("role", "==", "team_member").count().get();
    results.totalTeamMembers = tmQuery.data().count;

    res.json(results);
  } catch (error) {
    res.status(500).json({error: error.message, stack: error.stack});
  }
});

// TEMPORARY FIX FUNCTION
exports.fixUser = functions.region("asia-southeast1").https.onRequest(async (req, res) => {
  try {
    const email = "test2@test.com";
    const q = await admin.firestore().collection("users").where("email", "==", email).get();

    if (q.empty) {
      return res.status(404).json({error: "User not found"});
    }

    const doc = q.docs[0];
    await doc.ref.update({
      features: {
        updates: true,
        schedules: true,
        gcpBilling: true,
        templates: true,
        notes: true,
        metrics: true,
        links: true,
        modifiedBreaks: true,
      },
    });

    res.json({success: true, message: "User features updated", id: doc.id});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// DEBUG FUNCTION
exports.checkMemberFeatures = functions.region("asia-southeast1").https.onRequest(async (req, res) => {
  try {
    const email = "test2_member@test.com";
    const q = await admin.firestore().collection("users").where("email", "==", email).get();

    if (q.empty) {
      return res.status(404).json({error: "User not found"});
    }

    const doc = q.docs[0];
    res.json({id: doc.id, features: doc.data().features, role: doc.data().role});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// FIX MEMBER FEATURES
exports.fixMemberFeatures = functions.region("asia-southeast1").https.onRequest(async (req, res) => {
  try {
    const email = "test2_member@test.com";
    const q = await admin.firestore().collection("users").where("email", "==", email).get();

    if (q.empty) {
      return res.status(404).json({error: "User not found"});
    }

    const doc = q.docs[0];
    await doc.ref.update({
      features: {
        updates: true,
        schedules: true,
        gcpBilling: true,
        templates: true,
        notes: true,
        metrics: true,
        links: true,
        modifiedBreaks: true, // Enable for team member
      },
    });

    res.json({success: true, message: "Member features updated", id: doc.id});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// 5. DEBUG Gemini Models
exports.listAvailableModels = functions.runWith({ secrets: ["GEMINI_API_KEY"] })
    .region("asia-southeast1")
    .https.onRequest(async (req, res) => {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "No API Key" });
      
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Iterate through all possible ways to see models
        const models = [];
        // The Node SDK doesn't have a direct listModels yet in all versions, 
        // but we can try a simple generation to check connectivity or use the REST endpoint manually
        res.json({ message: "Check logs for debugging or visit Google AI Studio to verify model names." });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

// FINAL VERIFICATION SCRIPT

exports.getUserDoc = require('./src/debug').getUserDoc;
