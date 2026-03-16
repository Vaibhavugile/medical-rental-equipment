import {
  collection,
  getDocs,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "../firebase";

export const migrateOrders = async () => {

  const ordersSnap = await getDocs(collection(db, "orders"));

  console.log("Total orders:", ordersSnap.size);

  for (const orderDoc of ordersSnap.docs) {

    const orderId = orderDoc.id;
    const data = orderDoc.data();

    let lastExtendedAt = null;
    let lastPaymentAt = null;

    /* ======================
       EXTENSIONS
    ====================== */

    const items = data.items || [];

    items.forEach(item => {

      const history = item.extensionHistory || [];

      history.forEach(ext => {

        const d = new Date(ext.date);

        if (!lastExtendedAt || d > lastExtendedAt) {
          lastExtendedAt = d;
        }

      });

    });

    /* ======================
       PAYMENTS
    ====================== */

    const paymentsSnap = await getDocs(
      collection(db, "orders", orderId, "payments")
    );

    paymentsSnap.forEach(p => {

      const pay = p.data();

      let d;

      if (pay.createdAt?.toDate) {
        d = pay.createdAt.toDate();
      } else if (pay.date) {
        d = new Date(pay.date);
      }

      if (d && (!lastPaymentAt || d > lastPaymentAt)) {
        lastPaymentAt = d;
      }

    });

    /* ======================
       UPDATE ORDER
    ====================== */

    const updateData = {};

    if (lastPaymentAt) updateData.lastPaymentAt = lastPaymentAt;
    if (lastExtendedAt) updateData.lastExtendedAt = lastExtendedAt;

    if (Object.keys(updateData).length > 0) {

      await updateDoc(doc(db, "orders", orderId), updateData);

      console.log("Updated:", orderId);

    }

  }

  console.log("Migration finished");

};