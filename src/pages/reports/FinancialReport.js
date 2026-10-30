import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection, collectionGroup, getDocs, query, where, Timestamp,
  doc, setDoc, serverTimestamp, getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import "./FinancialReport.css";

const COLORS = ["#675cf5", "#18b981", "#f5a623", "#ef6472"];
const METHODS = ["cash", "upi", "card", "bank"];
const money = (value) => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
const dateFromValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dateKey = (value) => {
  const d = dateFromValue(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const safeNumber = (value) => Number(value || 0) || 0;

export default function FinancialReport() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentModal, setPaymentModal] = useState({ open: false, date: null, method: null, rows: [], loading: false, error: "" });

  const loadReport = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const snap = await getDocs(collection(db, "reports_financial_daily"));
      if (snap.empty) {
        await rebuildFinancialReport();
        const rebuilt = await getDocs(collection(db, "reports_financial_daily"));
        setRows(rebuilt.docs.map((d) => d.data()).filter((r) => r.date).sort((a, b) => a.date.localeCompare(b.date)));
      } else {
        setRows(snap.docs.map((d) => d.data()).filter((r) => r.date).sort((a, b) => a.date.localeCompare(b.date)));
      }
    } catch (e) {
      console.error("Financial report load failed:", e);
      setError(e.message || "Unable to load financial report.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadReport(); }, [loadReport]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (startDate > endDate) { setError("Start date cannot be after end date."); return; }
    let active = true;
    (async () => {
      setLoading(true); setError("");
      try {
        const data = await buildFinancialByDate(startDate, endDate);
        if (active) setRows(data);
      } catch (e) {
        console.error("Date range report failed:", e);
        if (active) setError(e.message || "Unable to load the selected date range.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [startDate, endDate]);

  useEffect(() => {
    if (!startDate && !endDate) loadReport();
  }, [startDate, endDate, loadReport]);

  const kpis = useMemo(() => {
    const sum = (key) => rows.reduce((total, row) => total + safeNumber(row[key]), 0);
    const latest = rows.length ? rows[rows.length - 1] : null;
    return {
      gross: sum("grossRevenue"), discount: sum("discountTotal"), tax: sum("taxTotal"),
      net: sum("netRevenue"), paid: sum("paymentsReceived"),
      balance: latest ? safeNumber(latest.outstanding) : 0,
      cash: rows.reduce((s, r) => s + safeNumber(r.paymentsByMethod?.cash), 0),
      upi: rows.reduce((s, r) => s + safeNumber(r.paymentsByMethod?.upi), 0),
      card: rows.reduce((s, r) => s + safeNumber(r.paymentsByMethod?.card), 0),
      bank: rows.reduce((s, r) => s + safeNumber(r.paymentsByMethod?.bank), 0),
    };
  }, [rows]);

  const paymentVsOutstanding = useMemo(() => [
    { name: "Received", value: Math.max(0, kpis.paid) },
    { name: "Outstanding", value: Math.max(0, kpis.balance) },
  ].filter((x) => x.value > 0), [kpis.paid, kpis.balance]);

  const cashTotals = useMemo(() => ({ cash: kpis.cash, upi: kpis.upi, card: kpis.card, bank: kpis.bank }), [kpis]);

  const handleRebuild = async () => {
    setRefreshing(true); setError("");
    try {
      await rebuildFinancialReport();
      if (startDate && endDate) setRows(await buildFinancialByDate(startDate, endDate));
      else await loadReport();
    } catch (e) {
      console.error("Financial report rebuild failed:", e);
      setError(e.message || "Report rebuild failed.");
    } finally { setRefreshing(false); }
  };

  const openPaymentDetails = async (date, method) => {
    setPaymentModal({ open: true, date, method, rows: [], loading: true, error: "" });
    try {
      const start = Timestamp.fromDate(new Date(`${date}T00:00:00`));
      const end = Timestamp.fromDate(new Date(`${date}T23:59:59.999`));
      const q = query(collectionGroup(db, "payments"), where("status", "==", "completed"), where("method", "==", method), where("createdAt", ">=", start), where("createdAt", "<=", end));
      const snap = await getDocs(q);
      const payments = snap.docs.map((d) => ({ ref: d.ref, ...d.data() }));
      const details = await Promise.all(payments.map(async (pay) => {
        if (dateKey(pay.createdAt) !== date) return null;
        const orderId = pay.ref.parent.parent?.id;
        if (!orderId) return null;
        const orderSnap = await getDoc(doc(db, "orders", orderId));
        const order = orderSnap.data() || {};
        const orderTotal = safeNumber(order.totals?.total);
        return {
          orderNo: order.orderNo || orderId,
          customer: order.customerName || "—",
          orderTotal,
          paymentAmount: safeNumber(pay.amount),
          paymentMethod: pay.method || method,
          paidAt: dateFromValue(pay.createdAt)?.toLocaleString("en-IN") || "—",
          outstanding: Math.max(0, orderTotal - safeNumber(order.paymentSummary?.totalPaid)),
        };
      }));
      setPaymentModal((old) => ({ ...old, rows: details.filter(Boolean), loading: false }));
    } catch (e) {
      console.error("Payment details failed:", e);
      setPaymentModal((old) => ({ ...old, loading: false, error: e.message || "Unable to load payment details." }));
    }
  };

  const clearDates = () => { setStartDate(""); setEndDate(""); };

  if (loading && !rows.length) return <div className="fr-loading"><span className="fr-spinner" />Loading your financial overview…</div>;

  return (
    <main className="fr-page">
      <div className="fr-shell">
        <header className="fr-header">
          <div>
            <div className="fr-eyebrow"><span className="fr-live-dot" /> FINANCE & ANALYTICS</div>
            <h1>Financial overview</h1>
            <p>Track revenue performance, collections and outstanding balances in one place.</p>
          </div>
          <div className="fr-header-actions">
            <button className="fr-btn fr-btn-ghost" onClick={() => navigate("/crm/reports/financial/outstanding")}>View outstanding <span>↗</span></button>
            <button className="fr-btn fr-btn-primary" onClick={handleRebuild} disabled={refreshing}>{refreshing ? <><span className="fr-spinner fr-spinner-small" /> Rebuilding…</> : <><span>↻</span> Rebuild report</>}</button>
          </div>
        </header>

        {error && <div className="fr-error"><span>!</span><div>{error}</div><button onClick={() => setError("")}>×</button></div>}

        <section className="fr-filterbar">
          <div className="fr-filter-title"><span className="fr-filter-icon">⌕</span><div><strong>Report period</strong><small>Choose a date range to refine the numbers</small></div></div>
          <div className="fr-date-controls">
            <label><span>From</span><input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} /></label>
            <span className="fr-date-separator">→</span>
            <label><span>To</span><input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} /></label>
            {(startDate || endDate) && <button className="fr-clear" onClick={clearDates}>Clear dates</button>}
          </div>
        </section>

        <section className="fr-section-heading"><div><span>01 / PERFORMANCE</span><h2>Revenue snapshot</h2></div><small>{startDate && endDate ? `${startDate} — ${endDate}` : "All recorded dates"}</small></section>
        <section className="fr-kpi-grid">
          <Kpi label="Gross revenue" value={kpis.gross} icon="↗" tone="violet" note="Before discounts and tax" />
          <Kpi label="Net revenue" value={kpis.net} icon="◈" tone="blue" note="After discounts and including tax" />
          <Kpi label="Amount received" value={kpis.paid} icon="✓" tone="green" note="Completed payments" />
          <Kpi label="Outstanding balance" value={kpis.balance} icon="◷" tone="rose" note="Latest running balance" onClick={() => navigate("/crm/reports/financial/outstanding")} />
        </section>

        <section className="fr-mini-grid">
          <MiniMetric label="Discounts" value={kpis.discount} color="amber" />
          <MiniMetric label="Tax collected" value={kpis.tax} color="slate" />
          <MiniMetric label="Cash received" value={kpis.cash} color="green" />
          <MiniMetric label="UPI received" value={kpis.upi} color="violet" />
          <MiniMetric label="Card received" value={kpis.card} color="blue" />
          <MiniMetric label="Bank transfer" value={kpis.bank} color="rose" />
        </section>

        <section className="fr-section-heading fr-chart-heading"><div><span>02 / INSIGHTS</span><h2>Financial trends</h2></div><small>{rows.length} daily records</small></section>
        <section className="fr-chart-grid">
          <ChartCard title="Revenue vs cash inflow" subtitle="Net revenue compared with completed payments" className="fr-chart-wide">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barGap={5}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f6" />
                <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={68} />
                <Tooltip content={<FinancialTooltip />} />
                <Legend iconType="circle" />
                <Bar dataKey="netRevenue" fill="#7065ed" name="Net revenue" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="paymentsReceived" fill="#20b889" name="Cash inflow" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Received vs outstanding" subtitle="Current mix of collections and balance">
            {paymentVsOutstanding.length ? <div className="fr-donut-wrap"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={paymentVsOutstanding} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={4} stroke="none">{paymentVsOutstanding.map((_, i) => <Cell key={i} fill={i === 0 ? "#20b889" : "#f0a34b"} />)}</Pie><Tooltip formatter={(v) => money(v)} /></PieChart></ResponsiveContainer><div className="fr-donut-center"><strong>{money(kpis.paid + kpis.balance)}</strong><span>Total tracked</span></div></div> : <EmptyChart />}
            <div className="fr-legend-list"><span><i className="dot-green" /> Amount received <b>{money(kpis.paid)}</b></span><span><i className="dot-amber" /> Outstanding <b>{money(kpis.balance)}</b></span></div>
          </ChartCard>
          <ChartCard title="Daily collections" subtitle="Completed payments received each day">
            <ResponsiveContainer width="100%" height={240}><LineChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f6" /><XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} /><YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={68} /><Tooltip content={<FinancialTooltip />} /><Line dataKey="paymentsReceived" name="Payments received" stroke="#20b889" strokeWidth={3} dot={false} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Outstanding balance trend" subtitle="Running balance across recorded dates">
            <ResponsiveContainer width="100%" height={240}><LineChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f6" /><XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} /><YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={68} /><Tooltip content={<FinancialTooltip />} /><Line dataKey="outstanding" name="Outstanding" stroke="#ed7180" strokeWidth={3} dot={false} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="fr-section-heading fr-table-heading"><div><span>03 / TRANSACTIONS</span><h2>Daily financial ledger</h2></div><small>Click a payment amount to inspect its transactions</small></section>
        <section className="fr-ledger-card">
          <div className="fr-ledger-top"><div><strong>Cash received by method</strong><span>Daily revenue, collections and outstanding balance</span></div><div className="fr-ledger-total"><small>Total received</small><b>{money(kpis.paid)}</b></div></div>
          <div className="fr-table-scroll"><table className="fr-table"><thead><tr><th>Date</th><th>Gross</th><th>Discount</th><th>Tax</th><th>Net</th><th>Cash</th><th>UPI</th><th>Card</th><th>Bank</th><th>Outstanding</th></tr></thead><tbody>
            {rows.map((r) => { const m = r.paymentsByMethod || {}; return <tr key={r.date}><td className="fr-date-cell">{formatDate(r.date)}</td><td>{money(r.grossRevenue)}</td><td>{money(r.discountTotal)}</td><td>{money(r.taxTotal)}</td><td className="fr-strong-cell">{money(r.netRevenue)}</td>{METHODS.map((method) => <td key={method}><button className="fr-payment-link" onClick={() => openPaymentDetails(r.date, method)}>{money(m[method])}</button></td>)}<td className="fr-outstanding-cell">{money(r.outstanding)}</td></tr>; })}
            {!rows.length && <tr><td colSpan="10"><div className="fr-empty-table">No financial records found for this period.</div></td></tr>}
          </tbody>{rows.length > 0 && <tfoot><tr><td colSpan="5">TOTAL RECEIVED</td><td>{money(cashTotals.cash)}</td><td>{money(cashTotals.upi)}</td><td>{money(cashTotals.card)}</td><td>{money(cashTotals.bank)}</td><td>{money(kpis.balance)}</td></tr></tfoot>}</table></div>
          <div className="fr-ledger-foot">Payment amounts are clickable and open the completed payment records for that date and method.</div>
        </section>
      </div>

      {paymentModal.open && <div className="fr-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPaymentModal((s) => ({ ...s, open: false })); }}><section className="fr-payment-modal"><header><div><span>PAYMENT BREAKDOWN</span><h3>{paymentModal.method?.toUpperCase()} payments</h3><p>{formatDate(paymentModal.date)}</p></div><button className="fr-modal-close" onClick={() => setPaymentModal((s) => ({ ...s, open: false }))}>×</button></header>{paymentModal.loading ? <div className="fr-modal-state"><span className="fr-spinner" />Loading payment records…</div> : paymentModal.error ? <div className="fr-error">{paymentModal.error}</div> : <><div className="fr-modal-summary"><span>{paymentModal.rows.length} completed transactions</span><b>{money(paymentModal.rows.reduce((s, r) => s + r.paymentAmount, 0))}</b></div><div className="fr-modal-table-wrap"><table className="fr-table"><thead><tr><th>Order</th><th>Customer</th><th>Order total</th><th>Paid</th><th>Outstanding</th><th>Method</th><th>Paid at</th></tr></thead><tbody>{paymentModal.rows.map((r, i) => <tr key={`${r.orderNo}-${i}`}><td className="fr-strong-cell">{r.orderNo}</td><td>{r.customer}</td><td>{money(r.orderTotal)}</td><td className="fr-paid-cell">{money(r.paymentAmount)}</td><td>{money(r.outstanding)}</td><td><span className="fr-method-pill">{r.paymentMethod}</span></td><td>{r.paidAt}</td></tr>)}{!paymentModal.rows.length && <tr><td colSpan="7"><div className="fr-empty-table">No completed payments found.</div></td></tr>}</tbody></table></div></>}</section></div>}
    </main>
  );
}

function Kpi({ label, value, icon, tone, note, onClick }) { return <article className={`fr-kpi fr-kpi-${tone} ${onClick ? "fr-kpi-clickable" : ""}`} onClick={onClick} onKeyDown={(e) => onClick && e.key === "Enter" && onClick()} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}><div className="fr-kpi-top"><span>{label}</span><i>{icon}</i></div><strong>{money(value)}</strong><small>{note}</small></article>; }
function MiniMetric({ label, value, color }) { return <div className="fr-mini-metric"><span className={`fr-mini-dot ${color}`} /><div><small>{label}</small><b>{money(value)}</b></div></div>; }
function ChartCard({ title, subtitle, children, className = "" }) { return <article className={`fr-chart-card ${className}`}><div className="fr-card-heading"><div><h3>{title}</h3><p>{subtitle}</p></div><span className="fr-card-menu">···</span></div>{children}</article>; }
function FinancialTooltip({ active, payload, label }) { if (!active || !payload?.length) return null; return <div className="fr-chart-tooltip"><small>{formatDate(label)}</small>{payload.map((p) => <div key={p.dataKey}><i style={{ background: p.color }} />{p.name}<b>{money(p.value)}</b></div>)}</div>; }
function EmptyChart() { return <div className="fr-empty-chart">No collection data to display</div>; }
function shortDate(value) { return value ? value.slice(5) : ""; }
function compactMoney(value) { const n = Number(value) || 0; return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(0)}k` : `₹${n}`; }
function formatDate(value) { const d = dateFromValue(value); return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"; }

async function rebuildFinancialReport() {
  const ordersSnap = await getDocs(collection(db, "orders"));
  const daily = {};
  const initDay = (date) => { if (!daily[date]) daily[date] = { date, grossRevenue: 0, discountTotal: 0, taxTotal: 0, netRevenue: 0, paymentsReceived: 0, paymentsByMethod: { cash: 0, upi: 0, card: 0, bank: 0 }, outstanding: 0 }; };
  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data();
    const orderDate = dateKey(order.createdAt);
    if (!orderDate) continue;
    initDay(orderDate);
    const totals = order.totals || {};
    daily[orderDate].grossRevenue += safeNumber(totals.subtotal);
    daily[orderDate].discountTotal += safeNumber(totals.discountAmount);
    daily[orderDate].taxTotal += safeNumber(totals.totalTax);
    daily[orderDate].netRevenue += safeNumber(totals.total);
    const paymentsSnap = await getDocs(collection(db, "orders", orderDoc.id, "payments"));
    paymentsSnap.forEach((paymentDoc) => {
      const payment = paymentDoc.data();
      if (payment.status !== "completed") return;
      const paymentDate = dateKey(payment.createdAt);
      if (!paymentDate) return;
      const amount = safeNumber(payment.amount);
      const method = String(payment.method || "cash").toLowerCase();
      initDay(paymentDate);
      daily[paymentDate].paymentsReceived += amount;
      daily[paymentDate].paymentsByMethod[method] = safeNumber(daily[paymentDate].paymentsByMethod[method]) + amount;
    });
  }
  let runningOutstanding = 0;
  const sorted = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
  for (const day of sorted) { runningOutstanding += day.netRevenue - day.paymentsReceived; day.outstanding = runningOutstanding; }
  for (const day of sorted) await setDoc(doc(db, "reports_financial_daily", day.date), { ...day, lastUpdated: serverTimestamp() });
}

async function buildFinancialByDate(start, end) {
  const startAt = new Date(`${start}T00:00:00`);
  const endAt = new Date(`${end}T23:59:59.999`);
  const ordersSnap = await getDocs(query(collection(db, "orders"), where("createdAt", ">=", Timestamp.fromDate(startAt)), where("createdAt", "<=", Timestamp.fromDate(endAt))));
  const daily = {};
  const initDay = (date) => { if (!daily[date]) daily[date] = { date, grossRevenue: 0, discountTotal: 0, taxTotal: 0, netRevenue: 0, paymentsReceived: 0, paymentsByMethod: { cash: 0, upi: 0, card: 0, bank: 0 }, outstanding: 0 }; };
  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data();
    const orderDate = dateKey(order.createdAt);
    if (!orderDate || orderDate < start || orderDate > end) continue;
    initDay(orderDate);
    const totals = order.totals || {};
    daily[orderDate].grossRevenue += safeNumber(totals.subtotal);
    daily[orderDate].discountTotal += safeNumber(totals.discountAmount);
    daily[orderDate].taxTotal += safeNumber(totals.totalTax);
    daily[orderDate].netRevenue += safeNumber(totals.total);
    const paymentsSnap = await getDocs(collection(db, "orders", orderDoc.id, "payments"));
    paymentsSnap.forEach((paymentDoc) => {
      const payment = paymentDoc.data();
      if (payment.status !== "completed") return;
      const paymentDate = dateKey(payment.createdAt);
      if (!paymentDate || paymentDate < start || paymentDate > end) return;
      const method = String(payment.method || "cash").toLowerCase();
      const amount = safeNumber(payment.amount);
      initDay(paymentDate);
      daily[paymentDate].paymentsReceived += amount;
      daily[paymentDate].paymentsByMethod[method] = safeNumber(daily[paymentDate].paymentsByMethod[method]) + amount;
    });
  }
  // For a filtered window, use the first day's opening balance from the full report when available.
  let runningOutstanding = 0;
  try {
    const priorSnap = await getDocs(query(collection(db, "reports_financial_daily"), where("date", "<", start)));
    priorSnap.forEach((d) => { const data = d.data(); if (data.date && data.date > ("")) runningOutstanding = Math.max(runningOutstanding, safeNumber(data.outstanding)); });
  } catch (e) { console.warn("Could not load opening outstanding balance:", e); }
  return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)).map((day) => { runningOutstanding += day.netRevenue - day.paymentsReceived; return { ...day, outstanding: runningOutstanding }; });
}
