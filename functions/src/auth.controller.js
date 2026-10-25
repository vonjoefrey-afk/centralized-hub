const admin = require("firebase-admin");
const {writeCloudLog} = require("./logging.controller");
const cors = require("cors")({origin: true});

/**
 * Reset user password
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
exports.resetUserPassword = async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({error: "Unauthorized: No token provided"});
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // Verify caller is admin
      const callerDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
      if (!callerDoc.exists || callerDoc.data().role !== "admin") {
        await writeCloudLog("WARNING", `Unauthorized password reset attempt by ${decodedToken.uid}`);
        res.status(403).json({error: "Forbidden: Only admins can reset passwords"});
        return;
      }

      const {userId, tempPassword} = req.body;
      if (!userId || !tempPassword) {
        res.status(400).json({error: "Missing required fields: userId, tempPassword"});
        return;
      }

      // Reset the user's password
      await admin.auth().updateUser(userId, {
        password: tempPassword,
      });

      // Log the reset
      await admin.firestore().collection("password_resets").doc(userId).set({
        temporaryPassword: tempPassword,
        resetBy: decodedToken.uid,
        resetAt: admin.firestore.FieldValue.serverTimestamp(),
        used: true,
      }, {merge: true});

      await writeCloudLog("INFO", `Password reset for user ${userId} by admin ${decodedToken.uid}`);

      res.status(200).json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      await writeCloudLog("ERROR", `Error in resetUserPassword: ${error.message}`, {error});
      res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  });
};

/**
 * Delete user from Authentication
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
exports.deleteUserFromAuth = async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({error: "Unauthorized: No token provided"});
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // Verify caller is admin
      const callerDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
      if (!callerDoc.exists || callerDoc.data().role !== "admin") {
        await writeCloudLog("WARNING", `Unauthorized deletion attempt by ${decodedToken.uid}`);
        res.status(403).json({error: "Forbidden: Only admins can delete users"});
        return;
      }

      const {userId} = req.body;
      if (!userId) {
        res.status(400).json({error: "Missing required field: userId"});
        return;
      }

      await admin.auth().deleteUser(userId);
      await writeCloudLog("INFO", `User ${userId} deleted from Auth by admin ${decodedToken.uid}`);

      res.status(200).json({
        success: true,
        message: "User deleted from Authentication successfully",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      await writeCloudLog("ERROR", `Error in deleteUserFromAuth: ${error.message}`, {error});
      res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  });
};

