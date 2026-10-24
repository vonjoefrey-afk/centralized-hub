const admin = require("firebase-admin");
try {
console.log("Initializing admin...");
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

async function check() {
  console.log("Fetching user...");
  const doc = await db.collection('users').doc('z0DVsd4JQmSjhDq8o49l112N03V2').get();
  console.log("User Doc Data:", doc.data());
  process.exit(0);
}
check();
} catch (e) {
  console.error(e);
}
