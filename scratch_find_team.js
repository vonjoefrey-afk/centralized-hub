const admin = require("firebase-admin");

// Initialize with Application Default Credentials
process.env.GOOGLE_CLOUD_PROJECT = "centralized-gcp";
admin.initializeApp({
  projectId: "centralized-gcp"
});
const db = admin.firestore();

async function findTeam() {
  try {
    const teamsSnap = await db.collection("teams").limit(5).get();
    if (teamsSnap.empty) {
      console.log("No teams found in database.");
      return;
    }
    console.log("Available Teams:");
    teamsSnap.forEach(doc => {
      console.log(`- ID: ${doc.id}`);
      console.log(`  Data:`, JSON.stringify(doc.data(), null, 2));
    });
  } catch (err) {
    console.error("Error finding team:", err);
  }
  process.exit(0);
}

findTeam();
