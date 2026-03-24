const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

admin.initializeApp();

exports.deleteUser = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const {uid} = req.body;

    try {
      await admin.auth().deleteUser(uid);

      const db = admin.firestore();

      await db.collection("users").doc(uid).delete().catch(() => {});
      await db.collection("marketing").doc(uid).delete().catch(() => {});
      await db.collection("drivers").doc(uid).delete().catch(() => {});
      await db.collection("staff").doc(uid).delete().catch(() => {});

      res.json({success: true});
    } catch (error) {
      console.error(error);
      res.status(500).send(error.message);
    }
  });
});
