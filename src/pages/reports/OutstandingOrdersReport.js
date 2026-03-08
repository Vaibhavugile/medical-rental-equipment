import { collection, getDocs,collectionGroup } from "firebase/firestore";
import { db } from "../../firebase";
import { useEffect, useState,useMemo } from "react";

export default function OutstandingOrdersReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
const [search, setSearch] = useState("");
const [sortField, setSortField] = useState("outstanding");
const [sortDir, setSortDir] = useState("desc");
  useEffect(() => {
    loadOutstandingOrders();
  }, []);

  async function loadOutstandingOrders() {
  setLoading(true);

  /* -------- GET ALL ORDERS -------- */
  const ordersSnap = await getDocs(collection(db, "orders"));

  const ordersMap = {};
  const result = [];

  ordersSnap.forEach((docSnap) => {
    const order = docSnap.data();

    ordersMap[docSnap.id] = {
      id: docSnap.id,
      orderNo: order.orderNo || docSnap.id,
      customer: order.customerName || "—",
      orderDate: order.createdAt?.toDate().toISOString().slice(0, 10),
      orderTotal: Number(order.totals?.total || 0),
      totalPaid: 0,
      methods: { cash: 0, upi: 0, card: 0, bank: 0 },
      items: order.items || [],
    };
  });

  /* -------- GET ALL PAYMENTS -------- */
  const paymentsSnap = await getDocs(collectionGroup(db, "payments"));

  paymentsSnap.forEach((docSnap) => {
    const pay = docSnap.data();

    if (pay.status !== "completed") return;

    const orderId = docSnap.ref.parent.parent.id;
    const order = ordersMap[orderId];

    if (!order) return;

    const amount = Number(pay.amount || 0);

    order.totalPaid += amount;
    order.methods[pay.method] =
      (order.methods[pay.method] || 0) + amount;
  });

  /* -------- BUILD FINAL RESULT -------- */
  Object.values(ordersMap).forEach((order) => {
    const outstanding = order.orderTotal - order.totalPaid;

    if (outstanding <= 0) return;

    const items = order.items;

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

    result.push({
      orderNo: order.orderNo,
      customer: order.customer,
      orderDate: order.orderDate,
      startDate,
      endDate,
      days,
      orderTotal: order.orderTotal,
      totalPaid: order.totalPaid,
      outstanding,
      methods: order.methods,
    });
  });

  setRows(result);
  setLoading(false);
}
const filteredRows = useMemo(() => {
  let data = [...rows];

  /* -------- SEARCH -------- */
  if (search) {
    const s = search.toLowerCase();
    data = data.filter(
      (r) =>
        r.orderNo?.toLowerCase().includes(s) ||
        r.customer?.toLowerCase().includes(s)
    );
  }

  /* -------- SORT -------- */
  data.sort((a, b) => {
    let v1 = a[sortField];
    let v2 = b[sortField];

    if (typeof v1 === "string") v1 = v1.toLowerCase();
    if (typeof v2 === "string") v2 = v2.toLowerCase();

    if (v1 < v2) return sortDir === "asc" ? -1 : 1;
    if (v1 > v2) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return data;
}, [rows, search, sortField, sortDir]);
  if (loading) return <div>Loading Outstanding Orders…</div>;

  return (
    <div className="report-page">
      <h1>📌 Outstanding Orders</h1>
      <p className="muted">Orders with pending payments</p>
      <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
  <input
    type="text"
    placeholder="Search order or customer..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    style={{
      padding: "8px 10px",
      borderRadius: 6,
      border: "1px solid #e2e8f0",
      width: 260
    }}
  />

  <select
    value={sortField}
    onChange={(e) => setSortField(e.target.value)}
  >
    <option value="outstanding">Outstanding</option>
    <option value="orderDate">Order Date</option>
    <option value="orderTotal">Order Total</option>
    <option value="customer">Customer</option>
  </select>

  <select
    value={sortDir}
    onChange={(e) => setSortDir(e.target.value)}
  >
    <option value="desc">Desc</option>
    <option value="asc">Asc</option>
  </select>
</div>

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
            {filteredRows.map((r, i) => (
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
