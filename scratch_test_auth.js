const admin = require("firebase-admin");
const firebaseToolsConfig = require("/Users/von/.config/configstore/firebase-tools.json");
const refreshToken = firebaseToolsConfig.tokens.refresh_token;

try {
  admin.initializeApp({
    projectId: "centralized-gcp",
    credential: admin.credential.refreshToken(refreshToken)
  });
  const db = admin.firestore();
  console.log("[Auth Test] Admin SDK initialized successfully with refresh token!");
  
  async function testFetch() {
    const teamsSnap = await db.collection("teams").limit(1).get();
    console.log("[Auth Test] Successfully fetched teams count:", teamsSnap.size);
    if (!teamsSnap.empty) {
      console.log("[Auth Test] First team ID:", teamsSnap.docs[0].id);
    }
    process.exit(0);
  }
  
  testFetch().catch(err => {
    console.error("[Auth Test] Fetch failed:", err);
    process.exit(1);
  });
} catch (err) {
  console.error("[Auth Test] Init failed:", err);
  process.exit(1);
}
