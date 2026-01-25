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

export default function NursingOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);


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

  return (
    <div className="no-wrap">
      {/* Header */}
     <div className="no-head">
  <h2>Nursing Orders</h2>

  <button
    className="cp-btn"
    onClick={() => setCreateOpen(true)}
  >
    + Add Nursing Order
  </button>
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
              <th>Staff</th>
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

            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan="9" className="no-muted">
                  No nursing orders found
                </td>
              </tr>
            )}

            {!loading &&
              orders.map((o) => {
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
                        Nursing
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
