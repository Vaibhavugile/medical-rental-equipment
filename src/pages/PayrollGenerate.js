import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { groupAssignmentsByStaff } from "../utils/payroll";
import "./PayrollGenerate.css";

/* ======================
   Helpers
====================== */

const monthToRange = (month) => {
  const [y, m] = month.split("-");
  const start = new Date(Number(y), Number(m) - 1, 1);
  const end = new Date(Number(y), Number(m), 0, 23, 59, 59);

  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
  };
};

const fmtCurrency = (v) =>
  Number(v || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

/* ======================
   Component
====================== */

export default function PayrollGenerate() {
  const [month, setMonth] = useState("");

  // unpaid
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);

  // paid
  const [paidPayroll, setPaidPayroll] = useState([]);
  const [loadingPaid, setLoadingPaid] = useState(false);

  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
// dashboard
const [revenue, setRevenue] = useState(0);
const [salaryPaid, setSalaryPaid] = useState(0);
const [salaryPending, setSalaryPending] = useState(0);
  const [staffReport, setStaffReport] = useState([]);
  const [orderTotals, setOrderTotals] = useState({});
// manual payments
const [manualPayments, setManualPayments] = useState([]);
const [loadingManual, setLoadingManual] = useState(false);


  /* ======================
     LOAD UNPAID ASSIGNMENTS
  ====================== */

  useEffect(() => {
    if (!month) return;

    const loadUnpaid = async () => {
      setLoading(true);
      setError("");

      try {
        const { start, end } = monthToRange(month);

        const q = query(
          collection(db, "staffAssignments"),
          where("status", "==", "completed"),
          where("paid", "==", false),
          where("completedAt", ">=", start),
          where("completedAt", "<=", end)
        );

        const snap = await getDocs(q);

        setAssignments(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() || {}),
          }))
        );
      } catch (e) {
        console.error(e);
        setError("Failed to load unpaid assignments");
      } finally {
        setLoading(false);
      }
    };

    loadUnpaid();
  }, [month]);

  /* ======================
     LOAD PAID PAYROLL
  ====================== */

  useEffect(() => {
  if (!month) return;

  const loadPaid = async () => {
    setLoadingPaid(true);
    try {
      // 1️⃣ Get ALL payroll runs for the month
      const runQ = query(
        collection(db, "payrollRuns"),
        where("month", "==", month)
      );

      const runSnap = await getDocs(runQ);

      if (runSnap.empty) {
        setPaidPayroll([]);
        setLoadingPaid(false);
        return;
      }

      const allItems = [];

      // 2️⃣ For EACH payroll run, load its items
      for (const runDoc of runSnap.docs) {
        const run = {
          id: runDoc.id,
          ...(runDoc.data() || {}),
        };

        const itemsQ = query(
          collection(db, "payrollItems"),
          where("payrollRunId", "==", run.id)
        );

        const itemsSnap = await getDocs(itemsQ);

        itemsSnap.forEach((d) => {
          allItems.push({
            id: d.id,
            payrollRunId: run.id,
            paidAt: run.generatedAt,
            ...(d.data() || {}),
          });
        });
      }

      setPaidPayroll(allItems);
    } catch (e) {
      console.error("loadPaid error", e);
    } finally {
      setLoadingPaid(false);
    }
  };

  loadPaid();
}, [month]);
useEffect(() => {
  if (!month) return;

  const loadManualPayments = async () => {
    setLoadingManual(true);
    try {
      const { start, end } = monthToRange(month);

      const q = query(
        collection(db, "staffAssignments"),
        where("paid", "==", true),
        where("paymentMode", "==", "manual"),
        where("completedAt", ">=", start),
        where("completedAt", "<=", end)
      );

      const snap = await getDocs(q);

      setManualPayments(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }))
      );
    } catch (e) {
      console.error("loadManualPayments error", e);
    } finally {
      setLoadingManual(false);
    }
  };

  loadManualPayments();
}, [month]);



  /* ======================
     PAYROLL CALC (UNPAID)
  ====================== */

  const payroll = useMemo(
    () => groupAssignmentsByStaff(assignments),
    [assignments]
  );

  const totalAmount = payroll.reduce(
    (sum, p) => sum + p.totalAmount,
    0
  );

  /* ======================
     FINALIZE PAYROLL
  ====================== */
useEffect(() => {
  if (!month) return;

  const loadDashboard = async () => {
    try {
      const { start, end } = monthToRange(month);

      /* =====================
         REVENUE (ORDERS)
         completedAt → fallback updatedAt
      ===================== */

      let revenueTotal = 0;
      const seenOrderIds = new Set();
      const ordersMap = {}; // 👈 orderId → orderTotal

      // 1️⃣ Orders WITH completedAt
      const completedQ = query(
        collection(db, "nursingOrders"),
        where("status", "==", "completed"),
        where("completedAt", ">=", start),
        where("completedAt", "<=", end)
      );

      const completedSnap = await getDocs(completedQ);

      completedSnap.forEach((d) => {
        const total = Number(d.data()?.totals?.total || 0);
        seenOrderIds.add(d.id);
        ordersMap[d.id] = total;
        revenueTotal += total;
      });

      // 2️⃣ Orders WITHOUT completedAt → fallback to updatedAt
      const fallbackQ = query(
        collection(db, "nursingOrders"),
        where("status", "==", "completed"),
        where("updatedAt", ">=", start),
        where("updatedAt", "<=", end)
      );

      const fallbackSnap = await getDocs(fallbackQ);

      fallbackSnap.forEach((d) => {
        if (seenOrderIds.has(d.id)) return; // 🚫 prevent double count
        const total = Number(d.data()?.totals?.total || 0);
        ordersMap[d.id] = total;
        revenueTotal += total;
      });

      setRevenue(revenueTotal);
      setOrderTotals(ordersMap); // ✅ IMPORTANT

      /* =====================
         SALARY + STAFF REPORT
      ===================== */

      const assignQ = query(
        collection(db, "staffAssignments"),
        where("status", "==", "completed"),
        where("completedAt", ">=", start),
        where("completedAt", "<=", end)
      );

      const assignSnap = await getDocs(assignQ);

      let paid = 0;
      let pending = 0;
      const staffMap = {};

      assignSnap.forEach((d) => {
        const a = d.data() || {};
        const amount = Number(a.amount || 0);
        const staffId = a.staffId;

        if (a.paid) paid += amount;
        else pending += amount;

        if (!staffMap[staffId]) {
          staffMap[staffId] = {
            staffId,
            staffName: a.staffName || "—",
            staffType: a.staffType || "—",
            paid: 0,
            pending: 0,
            orders: new Set(),
          };
        }

        if (a.paid) staffMap[staffId].paid += amount;
        else staffMap[staffId].pending += amount;

        if (a.orderId) {
          staffMap[staffId].orders.add(a.orderId);
        }
      });

      setSalaryPaid(paid);
      setSalaryPending(pending);

      setStaffReport(
        Object.values(staffMap).map((s) => ({
          staffId: s.staffId,
          staffName: s.staffName,
          staffType: s.staffType,
          paid: s.paid,
          pending: s.pending,
          total: s.paid + s.pending,
          orderCount: s.orders.size,
        }))
      );
    } catch (e) {
      console.error("loadDashboard error", e);
    }
  };

  loadDashboard();
}, [month]);




  const finalizePayroll = async () => {
    if (!month || payroll.length === 0) {
      alert("Nothing to finalize");
      return;
    }

    if (!window.confirm("Finalize payroll? This cannot be undone.")) {
      return;
    }

    setFinalizing(true);

    try {
      const runRef = await addDoc(collection(db, "payrollRuns"), {
        month,
        totalStaff: payroll.length,
        totalAmount,
        status: "finalized",
        generatedAt: serverTimestamp(),
        generatedBy: auth.currentUser?.uid || "",
      });

      const payrollRunId = runRef.id;

      for (const p of payroll) {
        await addDoc(collection(db, "payrollItems"), {
          payrollRunId,
          staffId: p.staffId,
          staffName: p.staffName,
          staffType: p.staffType,
          totalDays: p.totalDays,
          totalAmount: p.totalAmount,
          assignments: p.assignments,
        });
      }

      for (const a of assignments) {
        await updateDoc(doc(db, "staffAssignments", a.id), {
          paid: true,
          payrollRunId,
          paidAt: serverTimestamp(),
        });
      }

      alert("Payroll finalized successfully");
      setAssignments([]);
      setMonth("");
    } catch (e) {
      console.error(e);
      alert("Failed to finalize payroll");
    } finally {
      setFinalizing(false);
    }
  };

  /* ======================
     UI
  ====================== */

  return (
    <div className="payroll-wrap">
      <h2>Payroll</h2>

      <div className="payroll-toolbar">
        <label>Select Month</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      {/* ===== DASHBOARD ===== */}
{month && (
  <div className="payroll-dashboard">
    <div className="dash-card">
      <div className="dash-label">Revenue</div>
      <div className="dash-amount green">
        ₹ {fmtCurrency(revenue)}
      </div>
    </div>

    <div className="dash-card">
      <div className="dash-label">Salary Paid</div>
      <div className="dash-amount red">
        ₹ {fmtCurrency(salaryPaid)}
      </div>
    </div>

    <div className="dash-card">
      <div className="dash-label">Salary Pending</div>
      <div className="dash-amount orange">
        ₹ {fmtCurrency(salaryPending)}
      </div>
    </div>

    <div className="dash-card">
      <div className="dash-label">Gross Margin</div>
      <div className="dash-amount">
        ₹ {fmtCurrency(revenue - salaryPaid)}
      </div>
    </div>
  </div>
)}


      {error && <div className="error">{error}</div>}
      {/* ===== STAFF WISE SALARY REPORT ===== */}
{month && staffReport.length > 0 && (
  <div className="payroll-card">
    <h3>Staff-wise Salary Report</h3>

    <table className="payroll-table">
      <thead>
        <tr>
          <th>Staff</th>
          <th>Type</th>
          <th>Orders</th>
          <th>Paid</th>
          <th>Pending</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {staffReport.map((s) => (
          <tr key={s.staffId}>
            <td>{s.staffName}</td>
            <td>{s.staffType}</td>
            <td>{s.orderCount}</td>
            <td className="green">
              ₹ {fmtCurrency(s.paid)}
            </td>
            <td className="orange">
              ₹ {fmtCurrency(s.pending)}
            </td>
            <td>
              ₹ {fmtCurrency(s.paid + s.pending)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}



      {/* ========== PENDING PAYROLL ========== */}
      <h3>Pending Payroll (Not Paid)</h3>

      {loading && <div className="muted">Loading unpaid payroll…</div>}

      {!loading && payroll.length === 0 && (
        <div className="muted">No unpaid payroll</div>
      )}

      {payroll.length > 0 && (
        <div className="payroll-card">
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Type</th>
                <th>Days</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payroll.map((p) => (
                <React.Fragment key={p.staffId}>
                  <tr>
                    <td>{p.staffName}</td>
                    <td>{p.staffType}</td>
                    <td>{p.totalDays}</td>
                    <td>₹ {fmtCurrency(p.totalAmount)}</td>
                  </tr>

                  <tr className="payroll-breakdown">
                    <td colSpan="4">
                     {p.assignments.map((a) => (
  <div key={a.assignmentId} className="breakdown-row">
    <div>
      <strong>{a.orderNo}</strong>{" "}
      <span className="muted">
        ({a.startDate} → {a.endDate})
      </span>
    </div>

    <div className="breakdown-right">
      <span className="muted">
        Order Total: ₹ {fmtCurrency(orderTotals[a.orderId] || 0)}
      </span>
      <span>
        {a.days} × ₹{a.rate} = ₹ {fmtCurrency(a.amount)}
      </span>
    </div>
  </div>
))}

                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <div className="payroll-summary">
            <strong>Total Payable:</strong> ₹ {fmtCurrency(totalAmount)}
          </div>

          <button
            className="payroll-btn primary"
            disabled={finalizing}
            onClick={finalizePayroll}
          >
            {finalizing ? "Finalizing…" : "Finalize Payroll"}
          </button>
        </div>
      )}

      {/* ========== PAID PAYROLL ========== */}
     <h3 style={{ marginTop: 32 }}>Paid via Payroll Run</h3>


      {loadingPaid && (
        <div className="muted">Loading paid payroll…</div>
      )}

      {!loadingPaid && paidPayroll.length === 0 && (
        <div className="muted">No paid payroll for this month</div>
      )}

      {!loadingPaid && paidPayroll.length > 0 && (
        <div className="payroll-card">
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Type</th>
                <th>Days</th>
                <th>Amount</th>
                <th>Paid On</th>
              </tr>
            </thead>
            <tbody>
              {paidPayroll.map((p) => (
                <React.Fragment key={p.id}>
                  <tr>
                    <td>{p.staffName}</td>
                    <td>{p.staffType}</td>
                    <td>{p.totalDays}</td>
                    <td>₹ {fmtCurrency(p.totalAmount)}</td>
                    <td>
                      {p.paidAt?.toDate
                        ? p.paidAt.toDate().toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>

                  <tr className="payroll-breakdown">
                    <td colSpan="5">
                      {p.assignments.map((a) => (
  <div key={a.assignmentId} className="breakdown-row">
    <div>
      <strong>{a.orderNo}</strong>{" "}
      <span className="muted">
        ({a.startDate} → {a.endDate})
      </span>
    </div>

    <div className="breakdown-right">
      <span className="muted">
        Order Total: ₹ {fmtCurrency(orderTotals[a.orderId] || 0)}
      </span>
      <span>
        {a.days} × ₹{a.rate} = ₹ {fmtCurrency(a.amount)}
      </span>
    </div>
  </div>
))}

                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========== MANUAL PAYMENTS ========== */}
{/* ========== MANUAL PAYMENTS ========== */}
<h3 style={{ marginTop: 32 }}>
  Manual Payments (Outside Payroll)
</h3>

{loadingManual && (
  <div className="muted">Loading manual payments…</div>
)}

{!loadingManual && manualPayments.length === 0 && (
  <div className="muted">No manual payments for this month</div>
)}

{!loadingManual && manualPayments.length > 0 && (
  <div className="payroll-card">
    <table className="payroll-table">
      <thead>
        <tr>
          <th>Staff</th>
          <th>Type</th>
          <th>Order</th>
          <th>Order Period</th>
          <th>Order Total</th>
          <th>Staff Paid</th>
          <th>Paid On</th>
          <th>Mode</th>
        </tr>
      </thead>
      <tbody>
        {manualPayments.map((m) => (
          <tr key={m.id}>
            <td>{m.staffName}</td>
            <td>{m.staffType}</td>

            <td>
              <strong>{m.orderNo}</strong>
            </td>

            <td className="muted">
              {m.startDate} → {m.endDate}
            </td>

            <td>
              ₹ {fmtCurrency(orderTotals[m.orderId] || 0)}
            </td>

            <td className="green">
              ₹ {fmtCurrency(m.amount)}
            </td>

            <td>
              {m.paidAt?.toDate
                ? m.paidAt.toDate().toLocaleDateString()
                : "—"}
            </td>

            <td>
              <span className="badge badge-orange">
                Manual
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}

    </div>
  );
}
