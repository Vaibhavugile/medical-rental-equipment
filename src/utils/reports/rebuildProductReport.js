import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

export async function rebuildProductReport() {
  console.log("🔄 Rebuilding product report...");

  const ordersSnap = await getDocs(collection(db, "orders"));
  const map = {};

  ordersSnap.forEach((docSnap) => {
    const order = docSnap.data();
    const orderId = docSnap.id; // 👈 IMPORTANT

    (order.items || []).forEach((it) => {
      if (!it.productId) return;

      if (!map[it.productId]) {
        map[it.productId] = {
          productId: it.productId,
          productName: it.name || "", // we can improve later
          totalQty: 0,
          totalRevenue: 0,
          orders: new Set(), // 👈 track unique orders
        };
      }

      map[it.productId].totalQty += Number(it.qty || 0);
      map[it.productId].totalRevenue += Number(it.amount || 0);

      // ✅ count each order only once per product
      map[it.productId].orders.add(orderId);
    });
  });

  for (const p of Object.values(map)) {
    const avgRate =
      p.totalQty > 0 ? p.totalRevenue / p.totalQty : 0;

    await setDoc(doc(db, "reports_products", p.productId), {
      productId: p.productId,
      productName: p.productName,
      totalQty: p.totalQty,
      totalRevenue: p.totalRevenue,
      orderCount: p.orders.size, // ✅ FIXED
      avgRate,
      lastUpdated: serverTimestamp(),
    });
  }

  console.log("✅ Product report generated:", Object.keys(map).length);
}
