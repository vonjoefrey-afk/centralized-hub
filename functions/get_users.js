const admin = require("firebase-admin");
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
  const db = admin.firestore();

  async function check() {
    console.log("Fetching all users to find vonneil@test.com...");
    const snapshot = await db.collection('users').where('email', '==', 'vonneil@test.com').get();
    snapshot.forEach(doc => {
      console.log("Matching Doc ID:", doc.id);
      console.log("Matching Doc Data:", doc.data());
    });
    
    console.log("\nFetching the specific UID logged in the console (z0DVsd...)...");
    const uidDoc = await db.collection('users').doc('z0DVsd4JQmSjhDq8o49l112N03V2').get();
    console.log("Doc Data for that UID:", uidDoc.data());

    process.exit(0);
  }
  check();
} catch (e) {
  console.error(e);
}
