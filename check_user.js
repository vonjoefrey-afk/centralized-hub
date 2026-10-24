const admin = require("firebase-admin");
const serviceAccount = require("./functions/serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const doc = await db.collection('users').doc('z0DVsd4JQmSjhDq8o49l112N03V2').get();
  console.log(doc.data());
}
check();
