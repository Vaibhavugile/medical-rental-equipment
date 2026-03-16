import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export const migrateNursingOrders = async () => {

  const snap = await getDocs(collection(db, "nursingOrders"));

  console.log("Total nursing orders:", snap.size);

  for (const d of snap.docs) {

    const orderId = d.id;
    const data = d.data();

    let lastPaymentAt = null;
    let lastExtendedAt = null;

    /* =====================
       FIND LAST PAYMENT
    ===================== */

    const payments = data.payments || [];

    payments.forEach(p => {

      const date = new Date(p.createdAt || p.date);

      if (!lastPaymentAt || date > lastPaymentAt) {
        lastPaymentAt = date;
      }

    });

    /* =====================
       FIND LAST EXTENSION
    ===================== */

    const extensions = data.extensionHistory || [];

    extensions.forEach(e => {

      const date = new Date(e.extendedAt);

      if (!lastExtendedAt || date > lastExtendedAt) {
        lastExtendedAt = date;
      }

    });

    /* =====================
       UPDATE ORDER
    ===================== */

    const updateData = {};

    if (lastPaymentAt) updateData.lastPaymentAt = lastPaymentAt;
    if (lastExtendedAt) updateData.lastExtendedAt = lastExtendedAt;

    if (Object.keys(updateData).length > 0) {

      await updateDoc(doc(db, "nursingOrders", orderId), updateData);

      console.log("Updated nursing order:", orderId);

    }

  }

  console.log("Nursing migration complete");

};