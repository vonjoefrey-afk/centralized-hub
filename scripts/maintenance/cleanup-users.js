// Cleanup script for development
// This script helps clean up test users during development

console.log('Firebase Cleanup Instructions:');
console.log('');
console.log('1. Go to Firebase Console > Authentication > Users');
console.log('2. Delete all test users from Authentication');
console.log('3. Go to Firestore Database');
console.log('4. Delete all documents in the "users" collection');
console.log('5. Now you can sign up with the same emails again');
console.log('');
console.log('Alternative: Use different email addresses for testing');
console.log('Examples:');
console.log('- admin@test.com → admin1@test.com');
console.log('- user@test.com → user2@test.com');
console.log('- test@example.com → test3@example.com');
console.log('');
console.log('This is a common development issue - Firebase Auth and Firestore are separate systems!');



