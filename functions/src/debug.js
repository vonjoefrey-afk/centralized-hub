const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const db = admin.firestore();

exports.getUserDoc = onCall(async (request) => {
  const doc = await db.collection('users').doc('z0DVsd4JQmSjhDq8o49l112N03V2').get();
  return { docData: doc.data() };
});
