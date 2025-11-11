// index.js
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();

// ---- Custom sound + channel config (must match app) ----
const ANDROID_CHANNEL_ID =
"urgent_delivery_channel"; // same as main.dart channel
const ANDROID_SOUND =
"urgent_delivery"; // raw/urgent_delivery.mp3 (no extension)
const IOS_SOUND =
 "urgent_delivery.wav"; // ios/Runner/Resources/urgent_delivery.wav

exports.notifyDriverOnAssignment = functions.firestore
    .document("deliveries/{deliveryId}")
    .onCreate(async (snap, context) => {
      const data = snap.data() || {};
      const deliveryId = context.params.deliveryId;
      const driverId = data.driverId; // business id from admin panel
      const status = (data.status || "").toLowerCase();

      console.log("🔥 onCreate delivery",
          {deliveryId, driverId, status});
      if (!driverId || status !== "assigned") return;

      // 1) Admin's driver doc (business record)
      const businessDocSnap = await admin.firestore()
          .doc(`drivers/${driverId}`).get();
      const business = businessDocSnap.data() || {};

      // 2) Canonical doc id (auth UID), fallback to business id
      const canonicalId = business.authUid || driverId;

      // 3) Read tokens ONLY from canonical doc
      const canonicalSnap = await admin.firestore()
          .doc(`drivers/${canonicalId}`).get();
      const canonical = canonicalSnap.data() || {};

      // Collect tokens
      let tokens = [];
      if (Array.isArray(canonical.fcmTokens) && canonical.fcmTokens.length) {
        tokens = canonical.fcmTokens.filter(Boolean);
      } else if (canonical.lastFcmToken) {
        tokens = [canonical.lastFcmToken];
      }

      if (!tokens.length) {
        console.log("⚠️ No tokens on canonical driver doc", {canonicalId});
        return;
      }

      const orderNo = data.orderNo || data.orderId || deliveryId;
      const address = data.dropAddress || data.deliveryAddress ||
       "New delivery assigned";

      // Base message (we’ll set token per-send)
      const baseMessage = {
        notification: {
          title: "🚚 Urgent Delivery Assigned",
          body: `Order ${orderNo} • ${address}`,
        },
        data: {
          deliveryId,
          driverId: String(driverId),
          status: "assigned",
          type: "driver_assigned",
        },
        // ---- Android: channel + custom sound ----
        android: {
          priority: "high",
          notification: {
            channelId: ANDROID_CHANNEL_ID,
            sound: ANDROID_SOUND, // no extension
          },
        },
        // ---- iOS: custom sound ----
        apns: {
          headers: {"apns-priority": "10"},
          payload: {
            aps: {
              sound: IOS_SOUND, // include extension
            },
          },
        },
      };

      // Send to each token; clean up invalid on the canonical doc only
      const bad = [];
      for (const t of tokens) {
        try {
          await admin.messaging().send({...baseMessage, token: t});
          console.log("✅ sent to", t);
        } catch (err) {
          const code = err?.errorInfo?.code || err?.code;
          console.log("❌ send fail", t, code, err?.message);
          if (
            code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
          ) {
            bad.push(t);
          }
        }
      }

      if (bad.length) {
        console.log("🧹 removing bad tokens from canonical doc:", bad.length);
        await admin.firestore().doc(`drivers/${canonicalId}`).set(
            {
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...bad),
            },
            {merge: true},
        );
      }
    });
