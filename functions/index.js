const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

// ---- Custom sound + channel config ----
const ANDROID_CHANNEL_ID = "urgent_delivery_channel";
const ANDROID_SOUND = "urgent_delivery";
const IOS_SOUND = "urgent_delivery.wav";

exports.notifyDriverOnAssignmentUpdate = functions.firestore
    .document("deliveries/{deliveryId}")
    .onUpdate(async (change, context) => {
      const before = change.before.data() || {};
      const after = change.after.data() || {};
      const deliveryId = context.params.deliveryId;

      const status = (after.status || "").toLowerCase();
      console.log("📦 Delivery update:", deliveryId, "Status:", status);

      // ---- Only act in ASSIGNED stage ----
      if (status !== "assigned") {
        console.log("⏭ Skipping — not in assigned stage");
        return;
      }

      const beforeDrivers = Array.isArray(before.assignedDriverIds) ?
      before.assignedDriverIds :
      [];

      const afterDrivers = Array.isArray(after.assignedDriverIds) ?
      after.assignedDriverIds :
      [];

      // ---- Find newly added drivers ----
      const newDrivers = afterDrivers.filter(
          (id) => id && !beforeDrivers.includes(id),
      );

      if (!newDrivers.length) {
        console.log("No new drivers added");
        return;
      }

      console.log("🆕 New drivers added:", newDrivers);

      const orderNo = after.orderNo || after.orderId || deliveryId;

      const address =
      after.dropAddress ||
      after.deliveryAddress ||
      "New delivery assigned";

      // ---- Notify each new driver ----
      for (const driverId of newDrivers) {
        try {
          const driverRef = admin
              .firestore()
              .doc(`drivers/${driverId}`);

          const driverSnap = await driverRef.get();

          if (!driverSnap.exists) {
            console.log("⚠️ Driver not found:", driverId);
            continue;
          }

          const driver = driverSnap.data() || {};

          // ---- Collect FCM tokens ----
          let tokens = [];

          if (Array.isArray(driver.fcmTokens)) {
            tokens = driver.fcmTokens.filter(Boolean);
          } else if (driver.lastFcmToken) {
            tokens = [driver.lastFcmToken];
          }

          if (!tokens.length) {
            console.log("⚠️ No tokens for driver:", driverId);
            continue;
          }

          // ---- Notification payload ----
          const baseMessage = {
            notification: {
              title: "🚚 Urgent Delivery Assigned",
              body: `Order ${orderNo} • ${address}`,
            },
            data: {
              deliveryId: String(deliveryId),
              driverId: String(driverId),
              status: "assigned",
              type: "driver_assigned",
            },
            android: {
              priority: "high",
              notification: {
                channelId: ANDROID_CHANNEL_ID,
                sound: ANDROID_SOUND,
              },
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
              payload: {
                aps: {
                  sound: IOS_SOUND,
                },
              },
            },
          };

          // ---- Send to all tokens (parallel) ----
          await Promise.all(
              tokens.map((token) =>
                admin.messaging().send({
                  ...baseMessage,
                  token,
                }),
              ),
          );

          console.log("✅ Notification sent to driver:", driverId);
        } catch (error) {
          console.error(
              "❌ Notification failed for driver:",
              driverId,
              error,
          );
        }
      }
    });
