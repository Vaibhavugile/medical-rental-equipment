const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.updateStaffOnDutyStatus = onSchedule(
    {
      schedule: "5 0 * * *", // Every day at 12:05 AM
      timeZone: "Asia/Kolkata",
      region: "asia-south1",
    },

    async () => {
      try {
      // Get today's date in India timezone
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date());

        const year = parts.find((p) => p.type === "year").value;
        const month = parts.find((p) => p.type === "month").value;
        const day = parts.find((p) => p.type === "day").value;

        // Match your Firestore date format exactly
        const today = `${year}-${month}-${day}T00:00`;

        console.log("Checking active staff assignments for:", today);

        // Find assignments where:
        // startDate <= today
        // endDate >= today
        const assignmentsSnapshot = await db
            .collection("staffAssignments")
            .where("startDate", "<=", today)
            .where("endDate", ">=", today)
            .get();

        console.log(
            `Found ${assignmentsSnapshot.size} active assignments`,
        );

        // Get unique staff IDs
        const staffIds = new Set();

        assignmentsSnapshot.forEach((doc) => {
          const assignment = doc.data();

          if (assignment.staffId) {
            staffIds.add(assignment.staffId);
          }
        });

        console.log(`Unique staff on duty: ${staffIds.size}`);

        if (staffIds.size === 0) {
          console.log("No active staff assignments found.");
          return;
        }

        const uniqueStaffIds = Array.from(staffIds);

        // Firestore batch limit is 500
        const chunkSize = 500;

        for (let i = 0; i < uniqueStaffIds.length; i += chunkSize) {
          const chunk = uniqueStaffIds.slice(i, i + chunkSize);

          const batch = db.batch();

          chunk.forEach((staffId) => {
            const staffRef = db.collection("staff").doc(staffId);

            batch.update(staffRef, {
              currentStatus: "on duty",
              statusUpdatedAt:
              admin.firestore.FieldValue.serverTimestamp(),
            });
          });

          await batch.commit();

          console.log(
              `Updated ${chunk.length} staff members to on duty`,
          );
        }

        console.log("Staff duty status update completed successfully.");
      } catch (error) {
        console.error(
            "Error updating staff on duty status:",
            error,
        );
      }
    },
);
