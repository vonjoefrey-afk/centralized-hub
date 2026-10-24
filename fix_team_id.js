const admin = require('firebase-admin');
const fs = require('fs');

// Project config from .env
const projectId = 'centralized-gcp';

// Initialize with Application Default Credentials
// This works because the user is logged in via firebase CLI
process.env.GOOGLE_CLOUD_PROJECT = projectId;
admin.initializeApp({
  projectId: projectId
});

const db = admin.firestore();

async function fixTeamId() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  
  const TYPO_ID = 'Y3de2NILXayCHRLIAUWg';
  const CORRECT_ID = 'Y3de2NlLXayCHRLlAUWg';

  let fixedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.teamId === TYPO_ID) {
      console.log(`Fixing User: ${data.displayName || data.email || doc.id}`);
      await doc.ref.update({
        teamId: CORRECT_ID,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      fixedCount++;
    }
  }

  console.log(`Fix completed. Corrected ${fixedCount} user(s).`);
  process.exit(0);
}

fixTeamId().catch(err => {
  console.error('Error fixing team ID:', err);
  process.exit(1);
});
