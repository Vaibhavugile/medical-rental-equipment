import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
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

  // Firestore Timestamp
  if (value?.toDate) {
    return value.toDate().toISOString().slice(0, 10);
  }

  // JS Date
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  // ISO string or yyyy-mm-dd
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return null;
}

export default function NursingOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("all");
const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");
const [serviceFilter, setServiceFilter] = useState("all");

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

function getServiceType(order) {
  const name = order.items?.[0]?.name?.toLowerCase() || "";

  if (name.includes("caretaker")) return "caretaker";
  if (name.includes("nurs")) return "nursing";

  return "other";
}
const nursingCount = orders.filter((o) =>
  o.items?.[0]?.name?.toLowerCase().includes("nurs")
).length;

const caretakerCount = orders.filter((o) =>
  o.items?.[0]?.name?.toLowerCase().includes("caretaker")
).length;

const allCount = orders.length;

const filteredOrders = orders.filter((o) => {

  // SEARCH
  const q = search.toLowerCase();
  const matchesSearch =
    !q ||
    o.orderNo?.toLowerCase().includes(q) ||
    o.customerName?.toLowerCase().includes(q) ||
    o.deliveryAddress?.toLowerCase().includes(q);

  // STATUS
  const matchesStatus =
    statusFilter === "all" || o.status === statusFilter;

  // DATE
  const serviceStartRaw = o.items?.[0]?.expectedStartDate;
  const serviceStart = toYmd(serviceStartRaw);

  let matchesDate = true;

  if (fromDate && serviceStart) {
    matchesDate = serviceStart >= fromDate;
  }

  if (toDate && serviceStart) {
    matchesDate = matchesDate && serviceStart <= toDate;
  }

  // SERVICE TYPE
  const serviceType = getServiceType(o);
  const matchesService =
    serviceFilter === "all" || serviceType === serviceFilter;

  return (
    matchesSearch &&
    matchesStatus &&
    matchesDate &&
    matchesService
  );
});


  return (
    <div className="no-wrap">
      {/* Header */}
     <div className="no-head">
  <div className="no-head-top">
    <h2>Nursing & Caretakers Orders</h2>
    
<button
  className="cp-btn"
  onClick={() => setCreateOpen(true)}
>
  + Add Nursing / Caretaker Order
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
      />
    </div>

    <div className="no-filter-row-2">
      <select className="no-input no-compact">...</select>
      <input type="date" className="no-input no-compact" />
      <input type="date" className="no-input no-compact" />
      <button className="cp-btn ghost">Clear</button>
    </div>
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
              <th>Start Date</th>
              <th>Created</th>
              <th>Nurse</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="9" className="no-muted">
                  Loading nursing orders…
                </td>
              </tr>
            )}

           {!loading && filteredOrders.length === 0 && (

              <tr>
                <td colSpan="9" className="no-muted">
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

                const startDate =
                  o.items?.[0]?.expectedStartDate || null;

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
