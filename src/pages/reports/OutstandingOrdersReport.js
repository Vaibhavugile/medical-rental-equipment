import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { useEffect, useState } from "react";

export default function OutstandingOrdersReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOutstandingOrders();
  }, []);

  async function loadOutstandingOrders() {
    setLoading(true);

    const ordersSnap = await getDocs(collection(db, "orders"));
    const result = [];

    for (const docSnap of ordersSnap.docs) {
      const order = docSnap.data();
      const orderTotal = Number(order.totals?.total || 0);

      /* ---------------- PAYMENTS ---------------- */
      const paySnap = await getDocs(
        collection(db, "orders", docSnap.id, "payments")
      );

      let totalPaid = 0;
      const methods = { cash: 0, upi: 0, card: 0, bank: 0 };

      paySnap.forEach((p) => {
        const pay = p.data();
        if (pay.status === "completed") {
          totalPaid += Number(pay.amount || 0);
          methods[pay.method] =
            (methods[pay.method] || 0) + Number(pay.amount || 0);
        }
      });

      const outstanding = orderTotal - totalPaid;
      if (outstanding <= 0) continue;

      /* ---------------- START / END / DAYS ---------------- */
      const items = order.items || [];

      let startDates = [];
      let endDates = [];
      let daysArr = [];

      items.forEach((it) => {
        if (it.expectedStartDate) startDates.push(it.expectedStartDate);
        if (it.expectedEndDate) endDates.push(it.expectedEndDate);
        if (it.days) daysArr.push(Number(it.days));
      });

      const startDate =
        startDates.length > 0 ? startDates.sort()[0] : "—";

      const endDate =
        endDates.length > 0 ? endDates.sort().slice(-1)[0] : "—";

      const days =
        daysArr.length > 0 ? Math.max(...daysArr) : "—";

      /* ---------------- PUSH ROW ---------------- */
      result.push({
        orderNo: order.orderNo || docSnap.id,
        customer: order.customerName || "—",
        orderDate: order.createdAt
          ?.toDate()
          .toISOString()
          .slice(0, 10),
        startDate,
        endDate,
        days,
        orderTotal,
        totalPaid,
        outstanding,
        methods,
      });
    }

    setRows(result);
    setLoading(false);
  }

  if (loading) return <div>Loading Outstanding Orders…</div>;

  return (
    <div className="report-page">
      <h1>📌 Outstanding Orders</h1>
      <p className="muted">Orders with pending payments</p>

      <div className="report-table">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Order Date</th>
              <th>Start</th>
              <th>End</th>
              <th>Days</th>
              <th>Order Total</th>
              <th>Paid</th>
              <th>Outstanding</th>
              <th>Cash</th>
              <th>UPI</th>
              <th>Card</th>
              <th>Bank</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{r.orderNo}</td>
                <td>{r.customer}</td>
                <td>{r.orderDate}</td>
                <td>{r.startDate}</td>
                <td>{r.endDate}</td>
                <td>{r.days}</td>

                <td>₹ {r.orderTotal}</td>
                <td>₹ {r.totalPaid}</td>

                <td
                  style={{
                    color: "#dc2626",
                    fontWeight: 700,
                  }}
                >
                  ₹ {r.outstanding}
                </td>

                <td>₹ {r.methods.cash || 0}</td>
                <td>₹ {r.methods.upi || 0}</td>
                <td>₹ {r.methods.card || 0}</td>
                <td>₹ {r.methods.bank || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
