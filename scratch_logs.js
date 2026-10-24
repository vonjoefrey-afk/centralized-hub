const admin = require("firebase-admin");
const serviceAccount = require("./functions/serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const snapshot = await db.collection('shift_history').orderBy('createdAt', 'desc').limit(5).get();
  console.log("Found history items:", snapshot.size);
  snapshot.forEach(doc => {
    console.log("ID:", doc.id);
    console.log("Data:", JSON.stringify(doc.data(), null, 2));
    console.log("-----------------------------------------");
  });
}
check();
