import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import "./NursingOrders.css";
import NursingOrderCreate from "./NursingOrderCreate";

/* =========================
   Helpers
========================= */

const fmtCurrency = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fmtDateTime = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
};

// ✅ normalize ANY date to YYYY-MM-DD
function toYmd(value) {
  if (!value) return null;

  // if datetime-local string
  if (typeof value === "string") {
    return value.split("T")[0];
  }

  // firestore timestamp
  if (value?.toDate) {
    const d = value.toDate();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  // JS Date
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
  }

  return null;
}
const toDateOnly = (value) => {
  if (!value) return null;

  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);

  return null;
};

export default function CaretakerOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("all");
const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");
const [serviceFilter, setServiceFilter] = useState("all");
const [kpiFilter, setKpiFilter] = useState("all");
  /* =========================
     Load Nursing Orders
  ========================= */

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const q = query(
        collection(db, "nursingOrders"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setOrders(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
      );
      setLoading(false);
    };

    load();
  }, []);

  const deleteOrder = async (order) => {

  const ok = window.confirm(
    `Delete order ${order.orderNo || order.id}?`
  );

  if(!ok) return;

  try{

    const recycleData = {
      ...order,
      deletedAt: serverTimestamp(),
      originalId: order.id
    };

    // move to recycle bin
    await setDoc(
      doc(db,"nursingOrders_recycle_bin",order.id),
      recycleData
    );

    // delete from main collection
    await deleteDoc(
      doc(db,"nursingOrders",order.id)
    );

    // update UI
    setOrders(prev =>
      prev.filter(o => o.id !== order.id)
    );

  }catch(err){

    console.error(err);
    alert("Failed to delete order");

  }

};
  
function getServiceType(order) {
  const name = order.items?.[0]?.name?.toLowerCase() || "";

  if (name.includes("caretaker")) return "caretaker";
  if (name.includes("nurs")) return "nursing";

  return "other";
}
const pageOrders = orders.filter(
  (o) => o.serviceType === "caretaker"
);
const nursingCount = orders.filter((o) =>
  o.items?.[0]?.name?.toLowerCase().includes("nurs")
).length;

const caretakerCount = orders.filter((o) =>
  o.items?.[0]?.name?.toLowerCase().includes("caretaker")
).length;

const allCount = orders.length;
const getRefundPending = (order) => {
  return (order.refunds || [])
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
};

const filteredOrders = pageOrders.filter((o) => {

  const q = search.toLowerCase();

  const matchesSearch =
    !q ||
    o.orderNo?.toLowerCase().includes(q) ||
    o.customerName?.toLowerCase().includes(q) ||
    o.deliveryAddress?.toLowerCase().includes(q);

  const matchesStatus =
    statusFilter === "all" || o.status === statusFilter;

  /* ---------- SERVICE TYPE ---------- */

  const serviceType = getServiceType(o);

  const matchesService =
    serviceFilter === "all" || serviceType === serviceFilter;

  /* ---------- SERVICE DATES ---------- */

  const startDates =
    o.items?.map((it) => toYmd(it.expectedStartDate)).filter(Boolean) || [];

  const endDates =
    o.items?.map((it) => toYmd(it.expectedEndDate)).filter(Boolean) || [];

  const startDate =
    startDates.length > 0 ? startDates.sort()[0] : null;

  const endDate =
    endDates.length > 0 ? endDates.sort().slice(-1)[0] : null;

  const today = new Date().toLocaleDateString("en-CA");

  /* ---------- DATE RANGE FILTER ---------- */

  let matchesDate = true;

  if (fromDate && startDate) {
    matchesDate = startDate >= fromDate;
  }

  if (toDate && startDate) {
    matchesDate = matchesDate && startDate <= toDate;
  }

  /* ---------- KPI FILTER ---------- */

  let matchesKpi = true;

  if (kpiFilter === "active") {
    matchesKpi = o.status === "active";
  }

  if (kpiFilter === "completed") {
    matchesKpi = o.status === "completed";
  }

  if (kpiFilter === "startingToday") {
    matchesKpi = startDate && startDate === today;
  }

  if (kpiFilter === "endingToday") {
    matchesKpi = endDate && endDate === today;
  }

  if (kpiFilter === "endingSoon") {

    if (!endDate) return false;

    const diff =
      (new Date(endDate) - new Date(today)) /
      (1000 * 60 * 60 * 24);

    matchesKpi = diff > 0 && diff <= 5;
  }
  if (kpiFilter === "refundPending") {
  const refundPending = getRefundPending(o);
  matchesKpi = refundPending > 0;
}

  return (
    matchesSearch &&
    matchesStatus &&
    matchesService &&
    matchesDate &&
    matchesKpi
  );

});
const today = new Date().toLocaleDateString("en-CA");
const serviceRanges = pageOrders.map((o) => {

  const startDates =
    o.items?.map((it) => toDateOnly(it.expectedStartDate)).filter(Boolean) || [];

  const endDates =
    o.items?.map((it) => toDateOnly(it.expectedEndDate)).filter(Boolean) || [];

  const start =
    startDates.length > 0 ? startDates.sort()[0] : null;

  const end =
    endDates.length > 0 ? endDates.sort().slice(-1)[0] : null;

  return {
    ...o,
    serviceStart: start,
    serviceEnd: end
  };

});
const activeCount = serviceRanges.filter(
  (o) => o.status === "active"
).length;

const completedCount = serviceRanges.filter(
  (o) => o.status === "completed"
).length;

const startingTodayCount = serviceRanges.filter((o) => {

  if (!o.serviceStart) return false;

  return o.serviceStart.slice(0,10) === today;

}).length;

const endingTodayCount = serviceRanges.filter((o) => {

  if (!o.serviceEnd) return false;

  return o.serviceEnd.slice(0,10) === today;

}).length;

const endingSoonCount = serviceRanges.filter((o) => {
  if (!o.serviceEnd) return false;

  const diff =
    (new Date(o.serviceEnd) - new Date(today)) /
    (1000 * 60 * 60 * 24);

  return diff > 0 && diff <= 5; // next 3 days
}).length;
const refundPendingCount = serviceRanges.filter((o) => {
  const refundPending = (o.refunds || [])
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return refundPending > 0;
}).length;

  return (
    <div className="no-wrap">
      {/* Header */}
     <div className="no-head">
      <div className="no-kpis">

  <div
    className={`no-kpi ${kpiFilter === "active" ? "active" : ""}`}
    onClick={() =>
      setKpiFilter(kpiFilter === "active" ? "all" : "active")
    }
  >
    <div className="no-kpi-label">Active</div>
    <div className="no-kpi-value">{activeCount}</div>
  </div>

  <div
    className={`no-kpi ${kpiFilter === "completed" ? "active" : ""}`}
    onClick={() =>
      setKpiFilter(kpiFilter === "completed" ? "all" : "completed")
    }
  >
    <div className="no-kpi-label">Completed</div>
    <div className="no-kpi-value">{completedCount}</div>
  </div>

  <div
    className={`no-kpi ${kpiFilter === "startingToday" ? "active" : ""}`}
    onClick={() =>
      setKpiFilter(kpiFilter === "startingToday" ? "all" : "startingToday")
    }
  >
    <div className="no-kpi-label">Starting Today</div>
    <div className="no-kpi-value">{startingTodayCount}</div>
  </div>

  <div
    className={`no-kpi ${kpiFilter === "endingToday" ? "active" : ""}`}
    onClick={() =>
      setKpiFilter(kpiFilter === "endingToday" ? "all" : "endingToday")
    }
  >
    <div className="no-kpi-label">Ending Today</div>
    <div className="no-kpi-value">{endingTodayCount}</div>
  </div>

  <div
    className={`no-kpi warning ${kpiFilter === "endingSoon" ? "active" : ""}`}
    onClick={() =>
      setKpiFilter(kpiFilter === "endingSoon" ? "all" : "endingSoon")
    }
  >
    <div className="no-kpi-label">Ending Soon</div>
    <div className="no-kpi-value">{endingSoonCount}</div>
  </div>
  <div
  className={`no-kpi danger ${kpiFilter === "refundPending" ? "active" : ""}`}
  onClick={() =>
    setKpiFilter(kpiFilter === "refundPending" ? "all" : "refundPending")
  }
>
  <div className="no-kpi-label">Refund Pending</div>
  <div className="no-kpi-value">{refundPendingCount}</div>
</div>

</div>
  <div className="no-head-top">
    <h2>Caretakers Orders</h2>
    
<button
  className="cp-btn"
  onClick={() => setCreateOpen(true)}
>
  + Add Caretaker Order
</button>  </div>
<div className="service-filter">

  <button
    className={`service-filter-btn ${serviceFilter === "all" ? "is-active" : ""}`}
    onClick={() => setServiceFilter("all")}
  >
    All <span className="filter-count">{allCount}</span>
  </button>

  <button
    className={`service-filter-btn ${serviceFilter === "nursing" ? "is-active" : ""}`}
    onClick={() => setServiceFilter("nursing")}
  >
    Nursing <span className="filter-count">{nursingCount}</span>
  </button>

  <button
    className={`service-filter-btn ${serviceFilter === "caretaker" ? "is-active" : ""}`}
    onClick={() => setServiceFilter("caretaker")}
  >
    Caretaker <span className="filter-count">{caretakerCount}</span>
  </button>

</div>

  <div className="no-filters">
    <div className="no-filter-row-1">
      <input
  type="text"
  className="no-input no-search"
  placeholder="Search order no, customer, address…"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
/>
    </div>

    <div className="no-filter-row-2">
<select
  className="no-input no-compact"
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value)}
>
  <option value="all">All Status</option>
  <option value="created">Created</option>
  <option value="assigned">Assigned</option>
  <option value="active">Active</option>
  <option value="completed">Completed</option>
</select>
<input
  type="date"
  className="no-input no-compact"
  value={fromDate}
  onChange={(e) => setFromDate(e.target.value)}
/>     
<input
  type="date"
  className="no-input no-compact"
  value={toDate}
  onChange={(e) => setToDate(e.target.value)}
/>    
<button
  className="cp-btn ghost"
  onClick={() => {
    setSearch("");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
    setServiceFilter("all");
  }}
>
  Clear
</button>    </div>
  </div>
</div>



      <div className="no-table-card">
        <table className="no-table">
          <thead>
            <tr>
              <th>Order No</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Service</th>
              <th>Start</th>
              <th>End</th>
              <th>Created</th>
              <th>Nurse</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="10" className="no-muted">
                  Loading nursing orders…
                </td>
              </tr>
            )}

           {!loading && filteredOrders.length === 0 && (

              <tr>
                <td colSpan="10" className="no-muted">
                  No nursing orders found
                </td>
              </tr>
            )}

            {!loading &&
             filteredOrders.map((o) => {

                const staffCount =
                  o.items?.reduce(
                    (s, it) => s + Number(it.qty || 0),
                    0
                  ) || 0;

            const startDates =
  o.items?.map((it) => toYmd(it.expectedStartDate)).filter(Boolean) || [];

const endDates =
  o.items?.map((it) => toYmd(it.expectedEndDate)).filter(Boolean) || [];

const startDate =
  startDates.length > 0
    ? startDates.sort()[0]
    : null;

const endDate =
  endDates.length > 0
    ? endDates.sort().slice(-1)[0]
    : null;

                return (
                  <tr key={o.id}>
                    <td className="mono">
                      {o.orderNo || "—"}
                    </td>

                    <td>
                      <div className="cust">
                        <strong>{o.customerName || "—"}</strong>
                        <div className="muted small">
                          {o.deliveryAddress || ""}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`pill ${o.status || "created"}`}>
                        {o.status || "created"}
                      </span>
                    </td>

                    <td>
  <span className="pill blue">
    {o.items?.[0]?.name || "—"}
  </span>
</td>

                    <td>{fmtDate(startDate)}</td>
<td>{fmtDate(endDate)}</td>
<td>{fmtDateTime(o.createdAt)}</td>

                    <td>{staffCount}</td>

                    <td className="right">
                      ₹ {fmtCurrency(o.totals?.total || 0)}
                    </td>

                    <td className="actions">
                      <button
                        className="link"
                        onClick={() =>
                          navigate(`/crm/nursing-orders/${o.id}`)
                        }
                      >
                        View
                      </button>

                      <button
                        className="link"
                        onClick={() =>
                          navigate(`/crm/nursing-orders/${o.id}?open=true`)
                        }
                      >
                        Open
                      </button>
                      <button
  className="link danger"
  onClick={() => deleteOrder(o)}
>
Delete
</button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {createOpen && (
  <NursingOrderCreate
    open
    serviceType="caretaker"
    onClose={() => setCreateOpen(false)}
    onCreated={() => {
      setCreateOpen(false);
      // reload orders
      setOrders((prev) => [...prev]);
    }}
  />
)}

    </div>
  );
}
