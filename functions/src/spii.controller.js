const admin = require("firebase-admin");
const functions = require("firebase-functions");

const {GoogleAuth} = require("google-auth-library");

// Function to send the message using Application Default Credentials
const sendChatApiMessage = async (message, spaceId) => {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/chat.bot"],
  });

  const client = await auth.getClient();
  const url = `https://chat.googleapis.com/v1/${spaceId}/messages`;

  const response = await client.request({
    url,
    method: "POST",
    data: {
      text: message,
    },
  });

  return response.data;
};

const compileSpiiMessage = async (options = {}) => {
  const {require24Hours = false, teamId = null, memberId = null} = options;
  const db = admin.firestore();

  // Load chat automation config
  let messageTemplate = "Owner:\n[CASES]";
  let spaceId = "spaces/AAQAI65Kmwo"; // Fallback standard if none is set
  let targetStatuses = ["Open", "SO", "Closed"];
  try {
    const configSnap = await db.collection("settings").doc("spii_chat").get();
    if (configSnap.exists) {
      const data = configSnap.data();
      if (data.dailyMessageTemplate) {
        messageTemplate = data.dailyMessageTemplate;
      }
      if (data.spaceId) {
        spaceId = data.spaceId;
      }
      if (data.targetStatuses && Array.isArray(data.targetStatuses) && data.targetStatuses.length > 0) {
        targetStatuses = data.targetStatuses;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch settings/spii_chat config, using defaults", err);
  }

  // Every status a case can actually be given across the app (Case Tracker and
  // My SPII Cases). Kept as one explicit list so a status is never silently
  // invisible to the notification query just because it wasn't hardcoded here.
  const ALL_CASE_STATUSES = ["Assigned", "WOCR", "WOCRE", "IPGS", "IPGE", "IPCR", "IPGO", "IPTP", "SO", "Closed"];
  const RESOLVED_STATUSES = ["SO", "Closed"];

  // "Open" is a UI-level grouping, not a literal stored status: it means
  // "anything not yet SO/Closed". Expanding it this way (instead of a fixed
  // sub-list) means a newly added status is automatically covered without
  // needing another code change here.
  let expandedStatuses = [];
  for (const st of targetStatuses) {
    if (st === "Open") {
      expandedStatuses.push(...ALL_CASE_STATUSES.filter((s) => !RESOLVED_STATUSES.includes(s)));
    } else {
      expandedStatuses.push(st);
    }
  }
  // Ensure uniqueness before passing to Firestore 'in'
  expandedStatuses = [...new Set(expandedStatuses)];

  // Build the base query for the selected statuses
  let query = db.collection("spii_cases").where("status", "in", expandedStatuses);

  if (memberId) {
    query = query.where("userId", "==", memberId);
  }
  const casesSnap = await query.get();

  const cases = [];
  const now = Date.now();

  casesSnap.forEach((doc) => {
    const data = doc.data();

    // The UI saves lowercase "yes" or "no", or it might be undefined/null
    const hasPrivacy = data.submittedPrivacy === "yes" || data.submittedPrivacy === "Yes";

    // Only ping cases that haven't received a full review yet
    if (hasPrivacy) return;

    if (require24Hours) {
      // Daily automation: only surface cases that have been sitting >24h,
      // regardless of status category.
      const createdAtMs = data.createdAt?.toMillis?.() || 0;
      const hoursSinceCreation = createdAtMs > 0 ? (now - createdAtMs) / (1000 * 60 * 60) : 0;
      if (hoursSinceCreation > 24) {
        cases.push({id: doc.id, ...data});
      }
    } else {
      // Manual follow-up: send every unreviewed case immediately, no matter
      // how new it is — this is the "pull everything right now" button.
      cases.push({id: doc.id, ...data});
    }
  });

  // If the user specified a team filter but no specific member filter,
  // we must filter the cases AFTER fetching, because case docs don't store teamId directly.
  let filteredCases = cases;
  if (teamId && !memberId) {
    const teamMembersSnap = await db.collection("users").where("teamId", "==", teamId).get();
    const validMemberIds = new Set();
    teamMembersSnap.forEach((doc) => validMemberIds.add(doc.id));

    filteredCases = cases.filter((c) => validMemberIds.has(c.userId));
  }

  if (filteredCases.length === 0) {
    return null; // Nothing to report
  }

  // Fetch all users to map userId to display name
  const usersMap = {};
  const usersSnap = await db.collection("users").get();
  usersSnap.forEach((doc) => {
    const u = doc.data();
    usersMap[doc.id] = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.displayName || u.email || "Unknown User";
  });

  // Group by owner
  const grouped = {};
  for (const c of filteredCases) {
    let ownerName = c.ownerName || c.userDisplayName;
    if (!ownerName) {
      // Fallback to the users map
      ownerName = usersMap[c.userId] || "Unknown Owner";
    }

    if (!grouped[ownerName]) {
      grouped[ownerName] = [];
    }
    grouped[ownerName].push(c);
  }

  // Format the cases chunk
  let casesString = "";
  for (const [owner, ownerCases] of Object.entries(grouped)) {
    casesString += `Owner: ${owner}\n`;
    for (let idx = 0; idx < ownerCases.length; idx++) {
      const c = ownerCases[idx];
      casesString += `${idx + 1}. Case ID: ${c.caseId || c.id}\n`;
      casesString += `- Status: ${c.status || "Unknown"}\n`;
    }
    casesString += "\n";
  }

  // Inject into Template
  const finalMessage = messageTemplate.replace("[CASES]", casesString.trim()).trim();
  return {message: finalMessage, spaceId};
};

exports.manualSpiiChatFollowUp = async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  // false = it will pull ALL un-reviewed cases immediately for the manual button
  // apply the payload UI filters (if passed)
  const options = {
    require24Hours: false,
    teamId: data.teamId || null,
    memberId: data.memberId || null,
  };

  const result = await compileSpiiMessage(options);
  if (!result || !result.message) {
    return {success: true, message: "No pending SPII cases match these filters right now."};
  }

  try {
    await sendChatApiMessage(result.message, result.spaceId);
    return {success: true, message: "Successfully sent follow-up including any unreviewed SO/Closed cases and Open cases > 24h."};
  } catch (err) {
    console.error("Error sending chat message via API:", err);
    throw new functions.https.HttpsError("internal", "Failed to communicate with Google Chat Space: " + err.message);
  }
};

exports.dailySpiiChatFollowUp = async (context) => {
  const db = admin.firestore();

  // Default values
  let configHour = 9; // 9 AM
  let configTz = "Asia/Manila";

  try {
    const configSnap = await db.collection("settings").doc("spii_chat").get();
    if (configSnap.exists) {
      const data = configSnap.data();
      if (typeof data.runHour === "number") configHour = data.runHour;
      if (data.timezone) configTz = data.timezone;
    }
  } catch (err) {
    console.warn("Failed to read settings/spii_chat", err);
  }

  // Check if current hour in the specified timezone matches the config hour
  const currentHourString = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: configTz,
  }).format(new Date());

  const currentHour = parseInt(currentHourString, 10);

  if (currentHour !== configHour) {
    console.log(
        `Skipping execution: Current hour (${currentHour}) ` +
        `does not match configured runHour (${configHour}) for timezone ${configTz}.`,
    );
    return null;
  }

  // true = only flag cases that have been sitting without review for over 24 hours
  const result = await compileSpiiMessage({require24Hours: true});
  if (!result || !result.message) {
    console.log("No pending SPII cases found for daily run.");
    return null;
  }

  try {
    await sendChatApiMessage(result.message, result.spaceId);
    console.log("Successfully sent daily SPII follow-up to Chat via API.");
  } catch (err) {
    console.error("Error logging daily chat API message:", err);
  }
  return null;
};
