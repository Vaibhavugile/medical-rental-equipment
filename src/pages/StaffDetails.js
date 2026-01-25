import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import "./StaffDetails.css";

/* ======================
   Helpers
====================== */

const fmtCurrency = (v) =>
  Number(v || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

export default function StaffDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [staff, setStaff] = useState(null);

  const [activeAssignments, setActiveAssignments] = useState([]);
  const [assignmentHistory, setAssignmentHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const [payrollHistory, setPayrollHistory] = useState([]);
const [loadingPayroll, setLoadingPayroll] = useState(true);

  /* ======================
     Load Staff
  ====================== */

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const snap = await getDoc(doc(db, "staff", id));
        if (!snap.exists()) {
          setError("Staff not found");
        } else {
          setStaff({ id: snap.id, ...(snap.data() || {}) });
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    loadStaff();
  }, [id]);

  /* ======================
     Load Assignments (CORRECT WAY)
  ====================== */
useEffect(() => {
  if (!id) return;

  const loadAssignments = async () => {
    try {
      /* ===============================
         ACTIVE ASSIGNMENTS
      =============================== */

      const activeQ = query(
        collection(db, "staffAssignments"),
        where("staffId", "==", id),
        where("status", "==", "active")
      );

      /* ===============================
         ASSIGNMENT HISTORY
      =============================== */

      const historyQ = query(
        collection(db, "staffAssignments"),
        where("staffId", "==", id),
        where("status", "in", ["completed", "cancelled"])
      );

      const [activeSnap, historySnap] = await Promise.all([
        getDocs(activeQ),
        getDocs(historyQ),
      ]);

      setActiveAssignments(
        activeSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }))
      );

      setAssignmentHistory(
        historySnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }))
      );
    } catch (e) {
      console.error("loadAssignments error", e);
    }
  };

  loadAssignments();
}, [id]);
useEffect(() => {
  if (!id) return;

  const loadPayrollHistory = async () => {
    setLoadingPayroll(true);
    try {
      // 1️⃣ Load payroll items for this staff
      const q = query(
        collection(db, "payrollItems"),
        where("staffId", "==", id),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() || {}),
      }));

      // 2️⃣ Load related payroll runs (month, paid date)
      const runsMap = {};

      for (const item of items) {
        if (!runsMap[item.payrollRunId]) {
          const runSnap = await getDoc(
            doc(db, "payrollRuns", item.payrollRunId)
          );
          if (runSnap.exists()) {
            runsMap[item.payrollRunId] = runSnap.data();
          }
        }
      }

      // 3️⃣ Merge run info into payroll items
      const enriched = items.map((p) => ({
        ...p,
        month: runsMap[p.payrollRunId]?.month || "",
        paidAt: runsMap[p.payrollRunId]?.generatedAt || null,
      }));

      setPayrollHistory(enriched);
    } catch (e) {
      console.error("loadPayrollHistory error", e);
    } finally {
      setLoadingPayroll(false);
    }
  };

  loadPayrollHistory();
}, [id]);


  /* ======================
     UI
  ====================== */

  if (loading) return <div className="sd-muted">Loading…</div>;
  if (error) return <div className="sd-error">{error}</div>;
  if (!staff) return null;

  return (
    <div className="sd-wrap">
      {/* HEADER */}
      <div className="sd-head">
        <h2>{staff.name}</h2>
        <button className="sd-btn ghost" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      {/* BASIC INFO */}
      <div className="sd-card">
        <h3>Basic Information</h3>
        <div className="sd-grid">
          <div>
            <label>Email</label>
            <div>{staff.loginEmail}</div>
          </div>
          <div>
            <label>Phone</label>
            <div>{staff.phone || "-"}</div>
          </div>
          <div>
            <label>Staff Type</label>
            <div>{staff.staffType}</div>
          </div>
          <div>
            <label>Shift Preference</label>
            <div>{staff.shiftPreference}</div>
          </div>
        </div>
      </div>

      {/* PROFESSIONAL */}
      <div className="sd-card">
        <h3>Professional Details</h3>
        <div className="sd-grid">
          <div>
            <label>Qualifications</label>
            <div>{staff.qualifications || "-"}</div>
          </div>
          <div>
            <label>Experience</label>
            <div>
              {staff.experienceYears
                ? `${staff.experienceYears} years`
                : "-"}
            </div>
          </div>
          <div>
            <label>Services Offered</label>
            <div>
              {(staff.servicesOffered || []).length
                ? staff.servicesOffered.join(", ")
                : "-"}
            </div>
          </div>
          <div>
            <label>Rate</label>
            <div>
              {staff.baseRate
                ? `₹${staff.baseRate}/${staff.rateType}`
                : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* STATUS */}
      <div className="sd-card sd-status">
        <strong>Status</strong>
        <div className="sd-badges">
          <span className={`sd-badge ${staff.active ? "ok" : "off"}`}>
            {staff.active ? "Active" : "Inactive"}
          </span>
          <span className={`sd-badge ${staff.available ? "ok" : "warn"}`}>
            {staff.available ? "Available" : "Unavailable"}
          </span>
        </div>
      </div>

      {/* ACTIVE ASSIGNMENTS */}
      <div className="sd-card">
        <h3>Active Assignments</h3>

        {activeAssignments.length === 0 && (
          <div className="sd-muted">No active assignments</div>
        )}

        {activeAssignments.map((a) => (
          <div
            key={a.id}
            className="sd-assign-row clickable"
            onClick={() =>
              navigate(`/crm/nursing-orders/${a.orderId}`)
            }
          >
            <div>
              <strong>{a.orderNo}</strong>
              <div className="sd-muted">
                {a.startDate} → {a.endDate}
              </div>
            </div>
            <div className="sd-amount">
              ₹ {fmtCurrency(a.amount)}
            </div>
          </div>
        ))}
      </div>

      {/* ASSIGNMENT HISTORY */}
      <div className="sd-card">
        <h3>Assignment History</h3>

        {assignmentHistory.length === 0 && (
          <div className="sd-muted">No previous assignments</div>
        )}

        {assignmentHistory.map((a) => (
          <div key={a.id} className="sd-assign-row">
            <div>
              <strong>{a.orderNo}</strong>
              <div className="sd-muted">
                {a.startDate} → {a.endDate}
              </div>
            </div>
            <div>
              ₹ {fmtCurrency(a.amount)}{" "}
              {a.paid ? (
                <span className="sd-badge ok">Paid</span>
              ) : (
                <span className="sd-badge warn">Unpaid</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* PAYROLL HISTORY */}
<div className="sd-card">
  <h3>Payroll History</h3>

  {loadingPayroll && (
    <div className="sd-muted">Loading payroll history…</div>
  )}

  {!loadingPayroll && payrollHistory.length === 0 && (
    <div className="sd-muted">No payroll records found</div>
  )}

  {!loadingPayroll &&
    payrollHistory.map((p) => (
      <div key={p.id} className="sd-assign-row">
        <div>
          <strong>{p.month}</strong>
          <div className="sd-muted">
            {p.totalDays} days
          </div>
        </div>

        <div>
          ₹ {fmtCurrency(p.totalAmount)}
          <div className="sd-muted">
            Paid on{" "}
            {p.paidAt?.toDate
              ? p.paidAt.toDate().toLocaleDateString()
              : "—"}
          </div>
        </div>
      </div>
    ))}
</div>

    </div>
  );
}
