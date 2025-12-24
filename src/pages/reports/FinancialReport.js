import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  setDoc,
  serverTimestamp,
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

const COLORS = ["#22c55e", "#6366f1", "#f59e0b", "#ef4444"];

export default function FinancialReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const isDateActive = startDate && endDate;

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
        <Kpi label="Cash Received" value={kpis.paid} />
        <Kpi label="Outstanding Balance" value={kpis.balance} />
      </div>

      {/* Filters */}
      <div className="report-filters">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Revenue vs Cashflow */}
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

        {/* Payments vs Outstanding */}
        <ChartCard title="Payments vs Outstanding">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={paymentVsOutstandingPie}
                dataKey="value"
                outerRadius={90}
              >
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
            <Line
              dataKey="paymentsReceived"
              stroke="#22c55e"
              strokeWidth={3}
            />
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
            <Line
              dataKey="outstanding"
              stroke="#ef4444"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Table */}
      <div className="report-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Gross</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Net</th>
              <th>Cash In</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td>
                <td>₹ {r.grossRevenue}</td>
                <td>₹ {r.discountTotal}</td>
                <td>₹ {r.taxTotal}</td>
                <td>₹ {r.netRevenue}</td>
                <td>₹ {r.paymentsReceived}</td>
                <td>₹ {r.outstanding}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- UI HELPERS ---------- */

function Kpi({ label, value }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">₹ {Math.round(value).toLocaleString()}</div>
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

/* ---------- DATA BUILDERS (CORRECT ACCOUNTING) ---------- */

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
        outstanding: 0,
      };
    }
  };

  // 1️⃣ Revenue by order date
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

    // 2️⃣ Payments by PAYMENT DATE (CRITICAL FIX)
    const paySnap = await getDocs(
      collection(db, "orders", o.id, "payments")
    );

    paySnap.forEach((p) => {
      if (!p.data().createdAt) return;

      const payDate = p.data().createdAt
        .toDate()
        .toISOString()
        .slice(0, 10);

      initDay(payDate);
      daily[payDate].paymentsReceived += Number(
        p.data().amount || 0
      );
    });
  }

  // 3️⃣ Outstanding running balance
  let runningOutstanding = 0;
  Object.values(daily)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((d) => {
      runningOutstanding += d.netRevenue - d.paymentsReceived;
      d.outstanding = runningOutstanding;
    });

  // Save
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

  const initDay = (date) => {
    if (!daily[date]) {
      daily[date] = {
        date,
        grossRevenue: 0,
        discountTotal: 0,
        taxTotal: 0,
        netRevenue: 0,
        paymentsReceived: 0,
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
      if (!p.data().createdAt) return;
      const payDate = p.data().createdAt
        .toDate()
        .toISOString()
        .slice(0, 10);
      initDay(payDate);
      daily[payDate].paymentsReceived += Number(p.data().amount || 0);
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
