import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./ProductReport.css";
import { useNavigate } from "react-router-dom";


const COLORS = ["#22c55e", "#6366f1", "#f59e0b", "#ef4444"];

export default function FinancialReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
const navigate = useNavigate();

  const isDateActive = startDate && endDate;
  const [paymentModal, setPaymentModal] = useState({
  open: false,
  date: null,
  method: null,
  rows: [],
});


  /* ---------- INITIAL LOAD ---------- */
  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    setLoading(true);
    const snap = await getDocs(collection(db, "reports_financial_daily"));

    if (snap.empty) {
      await rebuildFinancialReport();
      return loadReport();
    }

    const data = snap.docs
      .map((d) => d.data())
      .sort((a, b) => a.date.localeCompare(b.date));

    setRows(data);
    setLoading(false);
  }
async function openPaymentDetails(date, method) {

const start = Timestamp.fromDate(new Date(date + "T00:00:00.000Z"));
const end = Timestamp.fromDate(new Date(date + "T23:59:59.999Z"));
  const q = query(
    collectionGroup(db, "payments"),
    where("status", "==", "completed"),
    where("method", "==", method),
    where("createdAt", ">=", start),
    where("createdAt", "<=", end)
  );

  const snap = await getDocs(q);

  const payments = snap.docs.map((d) => ({
    id: d.id,
    ref: d.ref,
    ...d.data(),
  }));

  const rows = [];
for (const pay of payments) {

  const payDate = pay.createdAt?.toDate().toISOString().slice(0,10);
  if (payDate !== date) continue;

  const orderId = pay.ref.parent.parent.id;

  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);

  const order = orderSnap.data() || {};
  const orderTotal = Number(order.totals?.total || 0);

  rows.push({
    orderNo: order.orderNo || orderId,
    customer: order.customerName || "—",
    orderTotal,
    paymentAmount: pay.amount,
    paymentMethod: pay.method,
    paidAt: pay.createdAt?.toDate().toLocaleString(),
    outstanding: orderTotal - Number(order.paymentSummary?.totalPaid || 0)
  });
}

  setPaymentModal({
    open: true,
    date,
    method,
    rows,
  });
}



  const cashTotals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const m = r.paymentsByMethod || {};
        acc.cash += Number(m.cash || 0);
        acc.upi += Number(m.upi || 0);
        acc.card += Number(m.card || 0);
        acc.bank += Number(m.bank || 0);
        return acc;
      },
      { cash: 0, upi: 0, card: 0, bank: 0 }
    );
  }, [rows]);


  /* ---------- DATE RANGE ---------- */
  useEffect(() => {
    if (!isDateActive) return;

    (async () => {
      setLoading(true);
      const data = await buildFinancialByDate(startDate, endDate);
      setRows(data);
      setLoading(false);
    })();
  }, [startDate, endDate]);
  useEffect(() => {
    if (startDate || endDate) return;
    loadReport();
  }, [startDate, endDate]);


  /* ---------- KPIs ---------- */
  const kpis = useMemo(() => {
    const sum = (k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);

    return {
      gross: sum("grossRevenue"),
      discount: sum("discountTotal"),
      tax: sum("taxTotal"),
      net: sum("netRevenue"),
      paid: sum("paymentsReceived"),
      balance:
        rows.length > 0
          ? rows[rows.length - 1].outstanding
          : 0,

      // ✅ ADD-ONLY: method KPIs
      cash: rows.reduce((s, r) => s + (r.paymentsByMethod?.cash || 0), 0),
      upi: rows.reduce((s, r) => s + (r.paymentsByMethod?.upi || 0), 0),
      card: rows.reduce((s, r) => s + (r.paymentsByMethod?.card || 0), 0),
      bank: rows.reduce((s, r) => s + (r.paymentsByMethod?.bank || 0), 0),
    };
  }, [rows]);

  const paymentVsOutstandingPie = [
    { name: "Payments Received", value: kpis.paid },
    { name: "Outstanding", value: kpis.balance },
  ];

  if (loading) {
    return <div className="report-loading">Loading Financial Report…</div>;
  }


  return (
    <div className="report-page">
      <h1>💰 Financial Report</h1>
      <p className="muted">
        Accrual revenue, cashflow, and outstanding balance tracking
      </p>

      <button
        className="rebuild-btn"
        onClick={async () => {
          await rebuildFinancialReport();
          await loadReport();
          alert("Financial report rebuilt successfully");
        }}
      >
        🔄 Rebuild Report
      </button>

      {/* KPIs */}
      <div className="kpi-grid">
        <Kpi label="Gross Revenue" value={kpis.gross} />
        <Kpi label="Discounts" value={kpis.discount} />
        <Kpi label="Tax Collected" value={kpis.tax} />
        <Kpi label="Net Revenue" value={kpis.net} />
        <Kpi label="Amount Received" value={kpis.paid} />
        <Kpi
  label="Outstanding Balance"
  value={kpis.balance}
  onClick={() => navigate("/crm/reports/financial/outstanding")}
/>

      </div>

      {/* ✅ ADD-ONLY: LONG METHOD BOXES */}
      <div className="kpi-grid kpi-grid-wide">
        <Kpi label="Cash Payments" value={kpis.cash} />
        <Kpi label="UPI Payments" value={kpis.upi} />
        <Kpi label="Card Payments" value={kpis.card} />
        <Kpi label="Bank Transfers" value={kpis.bank} />
      </div>

      {/* Filters */}
      <div className="report-filters">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <ChartCard title="Revenue vs Cashflow">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="netRevenue" fill="#6366f1" name="Revenue" />
              <Bar dataKey="paymentsReceived" fill="#22c55e" name="Cash Inflow" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Payments vs Outstanding">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={paymentVsOutstandingPie} dataKey="value" outerRadius={90}>
                {paymentVsOutstandingPie.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Cashflow Trend */}
      <ChartCard title="Daily Cashflow (Payments Received)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line dataKey="paymentsReceived" stroke="#22c55e" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Outstanding Trend */}
      <ChartCard title="Outstanding Balance Trend">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line dataKey="outstanding" stroke="#ef4444" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Table */}
      <div className="report-table">
        <div className="table-group-header">
          Cash In (By Method)
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Gross</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Net</th>
              <th>Cash</th>
              <th>UPI</th>
              <th>Card</th>
              <th>Bank</th>
              <th>Outstanding</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const m = r.paymentsByMethod || {};

              return (
                <tr key={r.date}>
                  <td>{r.date}</td>
                  <td>₹ {r.grossRevenue}</td>
                  <td>₹ {r.discountTotal}</td>
                  <td>₹ {r.taxTotal}</td>
                  <td>₹ {r.netRevenue}</td>
                  <td
                    className="clickable-cell"
                    onClick={() => openPaymentDetails(r.date, "cash")}
                  >
                    ₹ {m.cash || 0}
                  </td>

                  <td
                    className="clickable-cell"
                    onClick={() => openPaymentDetails(r.date, "upi")}
                  >
                    ₹ {m.upi || 0}
                  </td>

                  <td
  className="clickable-cell"
  onClick={() => openPaymentDetails(r.date, "card")}
>
                    ₹ {m.card || 0}
                  </td>

                  <td
                    className="clickable-cell"
                    onClick={() => openPaymentDetails(r.date, "bank")}
                  >
                    ₹ {m.bank || 0}
                  </td>

                  <td>₹ {r.outstanding}</td>
                </tr>
              );
            })}

            {/* ✅ TOTAL CASH IN ROW */}
            {rows.length > 0 && (
              <tr className="cash-total-row">
                <td colSpan="5"><strong>Total Cash In</strong></td>
                <td><strong>₹ {cashTotals.cash}</strong></td>
                <td><strong>₹ {cashTotals.upi}</strong></td>
                <td><strong>₹ {cashTotals.card}</strong></td>
                <td><strong>₹ {cashTotals.bank}</strong></td>
                <td>—</td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

{paymentModal.open && (
  <div className="report-modal">
    <div className="modal-card">
      <h3>
        Payments on {paymentModal.date} — {paymentModal.method.toUpperCase()}
      </h3>

      <table>
        <thead>
  <tr>
    <th>Order</th>
    <th>Customer</th>
    <th>Order Total</th>
    <th>Paid Amount</th>
    <th>Outstanding</th>
    <th>Method</th>
    <th>Paid At</th>
  </tr>
</thead>

        <tbody>
  {paymentModal.rows.map((r, i) => (
    <tr key={i}>
      <td>{r.orderNo}</td>
      <td>{r.customer}</td>
      <td>₹ {r.orderTotal}</td>
      <td>₹ {r.paymentAmount}</td>
      <td
        style={{
          color: r.outstanding > 0 ? "#dc2626" : "#16a34a",
          fontWeight: 600,
        }}
      >
        ₹ {r.outstanding}
      </td>
      <td>{r.paymentMethod}</td>
      <td>{r.paidAt}</td>
    </tr>
  ))}
</tbody>

      </table>

      <button onClick={() => setPaymentModal({ open: false })}>
        Close
      </button>
    </div>
  </div>
)}


    </div>
  );
}

/* ---------- UI HELPERS ---------- */
function Kpi({ label, value, onClick }) {
  return (
    <div
      className="kpi-card"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        ₹ {Math.round(value).toLocaleString()}
      </div>
    </div>
  );
}


function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* ---------- DATA BUILDERS (ADD-ONLY) ---------- */

async function rebuildFinancialReport() {
  const ordersSnap = await getDocs(collection(db, "orders"));
  const daily = {};

  const initDay = (date) => {
    if (!daily[date]) {
      daily[date] = {
        date,
        grossRevenue: 0,
        discountTotal: 0,
        taxTotal: 0,
        netRevenue: 0,
        paymentsReceived: 0,

        // ✅ ADD-ONLY
        paymentsByMethod: {
          cash: 0,
          upi: 0,
          card: 0,
          bank: 0,
        },

        outstanding: 0,
      };
    }
  };

  for (const o of ordersSnap.docs) {
    const order = o.data();
    if (!order.createdAt) continue;

    const orderDate = new Date(order.createdAt.seconds * 1000)
      .toISOString()
      .slice(0, 10);

    initDay(orderDate);

    const t = order.totals || {};
    daily[orderDate].grossRevenue += Number(t.subtotal || 0);
    daily[orderDate].discountTotal += Number(t.discountAmount || 0);
    daily[orderDate].taxTotal += Number(t.totalTax || 0);
    daily[orderDate].netRevenue += Number(t.total || 0);

    const paySnap = await getDocs(
      collection(db, "orders", o.id, "payments")
    );

    paySnap.forEach((p) => {
      const data = p.data();
      if (!data.createdAt || data.status !== "completed") return;

      const payDate = data.createdAt.toDate().toISOString().slice(0, 10);
      const amount = Number(data.amount || 0);
      const method = data.method || "cash";

      initDay(payDate);
      daily[payDate].paymentsReceived += amount;

      if (!daily[payDate].paymentsByMethod[method]) {
        daily[payDate].paymentsByMethod[method] = 0;
      }
      daily[payDate].paymentsByMethod[method] += amount;
    });
  }

  let runningOutstanding = 0;
  Object.values(daily)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((d) => {
      runningOutstanding += d.netRevenue - d.paymentsReceived;
      d.outstanding = runningOutstanding;
    });

  for (const d of Object.values(daily)) {
    await setDoc(doc(db, "reports_financial_daily", d.date), {
      ...d,
      lastUpdated: serverTimestamp(),
    });
  }
}

async function buildFinancialByDate(start, end) {
  const ordersSnap = await getDocs(
    query(
      collection(db, "orders"),
      where("createdAt", ">=", Timestamp.fromDate(new Date(start))),
      where("createdAt", "<=", Timestamp.fromDate(new Date(end + "T23:59:59")))
    )
  );

  const daily = {};

  const isWithinRange = (dateStr) => dateStr >= start && dateStr <= end;

  const initDay = (date) => {
    if (!daily[date]) {
      daily[date] = {
        date,
        grossRevenue: 0,
        discountTotal: 0,
        taxTotal: 0,
        netRevenue: 0,
        paymentsReceived: 0,
        paymentsByMethod: { cash: 0, upi: 0, card: 0, bank: 0 },
        outstanding: 0,
      };
    }
  };

  for (const o of ordersSnap.docs) {
    const order = o.data();
    if (!order.createdAt) continue;

    const orderDate = new Date(order.createdAt.seconds * 1000)
      .toISOString()
      .slice(0, 10);

    if (!isWithinRange(orderDate)) continue;

    initDay(orderDate);

    const t = order.totals || {};
    daily[orderDate].grossRevenue += Number(t.subtotal || 0);
    daily[orderDate].discountTotal += Number(t.discountAmount || 0);
    daily[orderDate].taxTotal += Number(t.totalTax || 0);
    daily[orderDate].netRevenue += Number(t.total || 0);

    const paySnap = await getDocs(
      collection(db, "orders", o.id, "payments")
    );

    paySnap.forEach((p) => {
      const data = p.data();
      if (!data.createdAt || data.status !== "completed") return;

      const payDate = data.createdAt.toDate().toISOString().slice(0, 10);
      if (!isWithinRange(payDate)) return;

      const amount = Number(data.amount || 0);
      const method = data.method || "cash";

      initDay(payDate);
      daily[payDate].paymentsReceived += amount;
      daily[payDate].paymentsByMethod[method] += amount;
    });
  }

  let runningOutstanding = 0;
  return Object.values(daily)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      runningOutstanding += d.netRevenue - d.paymentsReceived;
      return { ...d, outstanding: runningOutstanding };
    });
}

