/**
 * Create Backup Admin Account Script
 * 
 * This script creates a backup admin account for emergency recovery.
 * 
 * Usage:
 * 1. Set your Firebase project: firebase use centralized-gcp
 * 2. Run: node create-backup-admin.js
 * 3. Follow prompts to create backup admin account
 * 
 * Security: This uses Firebase Admin SDK, so it requires proper authentication.
 */

const admin = require("firebase-admin");
const readline = require("readline");

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createBackupAdmin() {
  try {
    console.log("🔐 Backup Admin Account Creator");
    console.log("==============================\n");

    // Get admin details
    const email = await question("Enter backup admin email: ");
    const password = await question("Enter secure password: ");
    const displayName = await question("Enter display name: ");

    if (!email || !password || !displayName) {
      console.error("❌ All fields are required!");
      process.exit(1);
    }

    // Validate email format
    if (!email.includes("@")) {
      console.error("❌ Invalid email format!");
      process.exit(1);
    }

    // Validate password strength
    if (password.length < 8) {
      console.error("❌ Password must be at least 8 characters!");
      process.exit(1);
    }

    console.log("\n⏳ Creating backup admin account...");

    // Check if user already exists
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log("⚠️  User already exists. Updating to admin...");

      // Update existing user to admin
      await admin.auth().updateUser(userRecord.uid, {
        password: password,
        displayName: displayName,
      });

      // Update Firestore document
      const userDoc = await admin.firestore().collection("users").doc(userRecord.uid).get();
      if (userDoc.exists) {
        await admin.firestore().collection("users").doc(userRecord.uid).update({
          role: "admin",
          isApproved: true,
          pendingApproval: false,
          displayName: displayName,
          isBackupAdmin: true,
        });
      } else {
        await admin.firestore().collection("users").doc(userRecord.uid).set({
          email: email,
          displayName: displayName,
          role: "admin",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          teamId: null,
          isApproved: true,
          pendingApproval: false,
          status: "active",
          isBackupAdmin: true,
        });
      }
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        // Create new user
        userRecord = await admin.auth().createUser({
          email: email,
          password: password,
          displayName: displayName,
        });

        // Create Firestore document
        await admin.firestore().collection("users").doc(userRecord.uid).set({
          email: email,
          displayName: displayName,
          role: "admin",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          teamId: null,
          isApproved: true,
          pendingApproval: false,
          status: "active",
          isBackupAdmin: true,
        });
      } else {
        throw error;
      }
    }

    // Log the creation
    await admin.firestore().collection("admin_audit_log").add({
      action: "backup_admin_created",
      adminEmail: email,
      adminUid: userRecord.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: "script",
    });

    console.log("\n✅ Backup admin account created successfully!");
    console.log("\n📋 Account Details:");
    console.log(`   Email: ${email}`);
    console.log(`   Display Name: ${displayName}`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Role: admin`);
    console.log(`   Status: active`);
    console.log("\n🔒 Security Reminders:");
    console.log("   - Store credentials securely (password manager)");
    console.log("   - Document this account in company security docs");
    console.log("   - Use this account only for emergency recovery");
    console.log("   - Change password regularly (every 90 days)");

    rl.close();
  } catch (error) {
    console.error("\n❌ Error creating backup admin:", error);
    rl.close();
    process.exit(1);
  }
}

// Run the script
createBackupAdmin();
