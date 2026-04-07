import React, { useEffect, useState } from "react";
import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";

import { db } from "../firebase";
import "./OrderActivityModal.css";

/* ===============================
PRODUCT CACHE
================================ */

const productCache = new Map();

export default function OrderActivityModal({ order, onClose }) {

    const [data, setData] = useState(null);
    const [payments, setPayments] = useState([]);
    const [extensions, setExtensions] = useState([]);
    const [refunds, setRefunds] = useState([]);
    const [stops, setStops] = useState([]);
    const [staffAssignments, setStaffAssignments] = useState([]);
    useEffect(() => {
        if (order) {
            console.log("Opening order modal:", order);
            loadOrder();
        }
    }, [order]);

    /* ===============================
    GET PRODUCT NAME WITH CACHE
    ================================ */

    const getProductName = async (productId) => {

        if (!productId) return "";

        if (productCache.has(productId)) {
            console.log("Product cache hit:", productId);
            return productCache.get(productId);
        }

        try {

            console.log("Fetching product:", productId);

            const snap = await getDoc(doc(db, "products", productId));

            if (snap.exists()) {

                const name = snap.data().name || productId;

                console.log("Product fetched:", name);

                productCache.set(productId, name);

                return name;

            }

            console.warn("Product not found:", productId);

        } catch (err) {

            console.error("Product fetch error:", err);

        }

        return productId;

    };

    /* ===============================
    LOAD ORDER
    ================================ */

    const loadOrder = async () => {

        setData(null);
        setPayments([]);
        setExtensions([]);
        setRefunds([]);
        setStops([]);

        try {

            console.log("Loading order:", order.collection, order.id);

            const ref = doc(db, order.collection, order.id);
            const snap = await getDoc(ref);

            if (!snap.exists()) {
                console.warn("Order not found");
                return;
            }

            const d = snap.data();

            console.log("Order data:", d);

            /* ===============================
            RESOLVE PRODUCT NAMES
            ================================ */

            const items = Array.isArray(d.items) ? d.items : [];

            console.log("Items found:", items);

            const resolvedItems = await Promise.all(

                items.map(async (it) => {

                    let name = it.name;

                    console.log("Processing item:", it);

                    if (!name && it.productId) {

                        console.log("Item missing name, fetching product:", it.productId);

                        name = await getProductName(it.productId);

                    }

                    return {
                        ...it,
                        name
                    };

                })

            );

            d.items = resolvedItems;

            setData(d);
            /* ===============================
   REFUNDS
================================ */

            let refundList = d.refunds || [];

            refundList.sort((a, b) => {
                const da = new Date(a.createdAt || 0);
                const db = new Date(b.createdAt || 0);
                return db - da;
            });

            setRefunds(refundList);
            /* ===============================
               STOP HISTORY (FROM ITEMS)
            ================================ */

            let stopList = [];

            /* EQUIPMENT */
            if (order.collection === "orders") {
                resolvedItems.forEach((it) => {
                    (it.stopHistory || []).forEach(s => {
                        stopList.push({
                            ...s,
                            serviceName: it.name
                        });
                    });
                });
            }

            /* NURSING (handle both safely) */
            if (order.collection === "nursingOrders") {

                // root-level
                (d.stopHistory || []).forEach(s => {
                    stopList.push({
                        ...s,
                        serviceName: s.serviceName || "Service"
                    });
                });

                // item-level fallback
                resolvedItems.forEach((it) => {
                    (it.stopHistory || []).forEach(s => {
                        stopList.push({
                            ...s,
                            serviceName: it.name
                        });
                    });
                });

            }

            stopList.sort((a, b) => {
                const da = new Date(a.stoppedAt || 0);
                const db = new Date(b.stoppedAt || 0);
                return db - da;
            });

            setStops(stopList);

            /* ===============================
            EXTENSIONS
            ================================ */

            let ext = [];

            if (order.collection === "orders") {

                resolvedItems.forEach(item => {
                    (item.extensionHistory || []).forEach(e => {
                        ext.push(e);
                    });
                });

            } else {

                ext = d.extensionHistory || [];

            }

            ext.sort((a, b) => {
                const da = new Date(a.extendedAt || a.date || 0);
                const db = new Date(b.extendedAt || b.date || 0);
                return db - da;
            });

            console.log("Extensions loaded:", ext);

            setExtensions(ext);

            /* ===============================
            PAYMENTS
            ================================ */

            let payList = [];

            if (order.collection === "orders") {

                const paySnap = await getDocs(
                    collection(db, "orders", order.id, "payments")
                );

                payList = paySnap.docs.map(p => ({
                    id: p.id,
                    ...p.data()
                }));

                console.log("Equipment payments loaded:", payList);

            } else {

                payList = d.payments || [];

                console.log("Nursing payments loaded:", payList);

            }

            payList.sort((a, b) => {
                const da = new Date(a.createdAt || a.date || 0);
                const db = new Date(b.createdAt || b.date || 0);
                return db - da;
            });

            setPayments(payList);

/* ===============================
STAFF ASSIGNMENTS
================================ */

try {

  const q = query(
    collection(db, "staffAssignments"),
    where("orderId", "==", order.id)
  );

  const snap = await getDocs(q);

  const list = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  console.log("Staff assignments loaded:", list);

  setStaffAssignments(list);

} catch (err) {

  console.error("Staff assignment load error:", err);

}

        } catch (err) {

            console.error("Order load error:", err);

        }

    };

    /* ===============================
    HELPERS
    ================================ */

    const fmt = (v) => {

        if (!v) return "";

        if (v.toDate) return v.toDate().toLocaleString();

        return new Date(v).toLocaleString();

    };

    /* ===============================
    FINANCIAL CALCULATIONS
    ================================ */

    const totalPaid = payments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
    );

    const taxAmount =
        data?.totals?.totalTax ||
        data?.totals?.taxBreakdown?.reduce(
            (a, t) => a + Number(t.amount || 0), 0
        ) ||
        0;

    const totalAmount = data?.totals?.total || 0;

    const refundPaid = refunds.reduce(
        (s, r) => s + Number(r.paidAmount || 0),
        0
    );

    const netPaid = totalPaid - refundPaid;

    const balance = totalAmount - netPaid;
    /* ===============================
STAFF SALARY TOTALS
================================ */

const totalSalary = staffAssignments.reduce(
  (s, a) => s + Number(a.amount || 0),
  0
);

const paidSalary = staffAssignments.reduce(
  (s, a) => s + Number(a.paidAmount || 0),
  0
);

const pendingSalary = staffAssignments.reduce(
  (s, a) => s + Number(a.balanceAmount || 0),
  0
);
const profit = totalAmount - totalSalary;
    /* ===============================
    UI
    ================================ */

    if (!order) return null;

    return (

        <div className="order-modal-overlay" onClick={onClose}>

            <div
                className="order-modal"
                onClick={(e) => e.stopPropagation()}
            >

                <div className="modal-header">

                    <h2>Order {order.orderNo}</h2>

                    <button
                        className="close-btn"
                        onClick={onClose}
                    >
                        ✕
                    </button>

                </div>

                {!data && (
                    <div className="modal-loading">
                        Loading...
                    </div>
                )}

                {data && (

                    <div className="modal-body">

                        {/* CUSTOMER */}

                        <div className="section">

                            <h3>Customer</h3>

                            <div>{data.customerName}</div>
                            <div>{data.customerPhone}</div>
                            <div>{data.customerEmail}</div>
                            <div>{data.deliveryAddress}</div>

                        </div>

                        {/* SERVICES */}

                        <div className="section">

                            <h3>Services</h3>

                            {(data.items || []).map((it, i) => (

                                <div key={i} className="item">

                                    <div className="item-name">
                                        {it.name || it.productId || "Unknown Product"}
                                    </div>

                                    <div className="muted">
                                        Qty: {it.qty || 1}
                                    </div>


                                    <div>
                                        {it.expectedStartDate} → {it.expectedEndDate}
                                    </div>

                                    <div className="amount">
                                        ₹{it.amount}
                                    </div>

                                </div>

                            ))}

                        </div>

                        {/* EXTENSIONS */}

                        <div className="section">

                            <h3>Extension History</h3>

                            {extensions.length === 0 && (
                                <div>No extensions</div>
                            )}

                            {extensions.map((e, i) => (

                                <div key={i} className="history-item">

                                    <div className="history-main">

                                        <div>
                                            {e.oldEndDate || e.previousEndDate} → {e.newEndDate}
                                        </div>

                                        <div className="muted">
                                            Extra ₹{e.extraAmount || e.extraPrice}
                                        </div>

                                    </div>

                                    <div className="history-meta">

                                        <div>
                                            Extended by: {e.extendedByName || "—"}
                                        </div>

                                        <div className="muted">
                                            {fmt(e.extendedAt || e.date)}
                                        </div>

                                    </div>

                                </div>

                            ))}

                        </div>
                        <div className="section">

                            <h3>Service Stop History</h3>

                            {stops.length === 0 && <div>No stops</div>}

                            {stops.map((s, i) => (

                                <div key={i} className="history-item">

                                    <div className="history-main">

                                        <div>
                                            <strong>{s.serviceName}</strong>
                                        </div>

                                        <div>
                                            {s.oldEndDate} → {s.newEndDate}
                                        </div>

                                        <div className="muted">
                                            ₹{s.oldAmount} → ₹{s.newAmount}
                                        </div>

                                    </div>

                                    <div className="history-meta">

                                        <div className="muted">
                                            {fmt(s.stoppedAt)}
                                        </div>

                                        <div className="muted small">
                                            Loss: ₹{(s.oldAmount || 0) - (s.newAmount || 0)}
                                        </div>

                                    </div>

                                </div>

                            ))}

                        </div>

                        {/* PAYMENTS */}

                        <div className="section">

                            <h3>Payments</h3>

                            {payments.length === 0 && (
                                <div>No payments</div>
                            )}

                            {payments.map((p, i) => (

                                <div key={i} className="history-item">

                                    <div className="history-main">

                                        <div className="amount">
                                            ₹{p.amount}
                                        </div>

                                        <div className="muted">
                                            {p.method}
                                        </div>

                                    </div>

                                    <div className="history-meta">

                                        <div>
                                            Received by: {p.createdByName || "—"}
                                        </div>

                                        <div className="muted">
                                            {fmt(p.createdAt || p.date)}
                                        </div>

                                    </div>

                                </div>

                            ))}

                        </div>
                        <div className="section">

                            <h3>Refund History</h3>

                            {refunds.length === 0 && <div>No refunds</div>}

                            {refunds.map((r, i) => {

                                const remaining =
                                    (r.amount || 0) - (r.paidAmount || 0);

                                return (

                                    <div key={i} className="history-item">

                                        <div className="history-main">

                                            <div className="amount">
                                                ₹{r.paidAmount || 0} / ₹{r.amount}
                                            </div>

                                            <div className={`badge ${r.status}`}>
                                                {r.status}
                                            </div>

                                        </div>

                                        <div className="history-meta">

                                            <div className="muted">
                                                Created: {fmt(r.createdAt)}
                                            </div>

                                            <div className="muted">
                                                Remaining: ₹{remaining}
                                            </div>

                                            {/* REFUND PAYMENTS */}
                                            {(r.payments || []).length > 0 && (

                                                <div style={{ marginTop: 6 }}>

                                                    {(r.payments || []).map((p, idx) => (

                                                        <div key={idx} className="mini-history">

                                                            <div>₹{p.amount}</div>

                                                            <div className="muted">
                                                                {p.method} • {fmt(p.date)}
                                                            </div>

                                                            {p.note && (
                                                                <div className="muted small">
                                                                    {p.note}
                                                                </div>
                                                            )}

                                                        </div>

                                                    ))}

                                                </div>

                                            )}

                                        </div>

                                    </div>

                                );

                            })}

                        </div>
                        {/* STAFF SALARY */}

<div className="section">

  <h3>Staff Salary</h3>

  {staffAssignments.length === 0 && (
    <div>No staff assigned</div>
  )}

  {staffAssignments.map((a,i)=>(

  <div key={i} className="history-item">

    <div className="history-main">

      <div>
        <strong>{a.staffName}</strong>
      </div>

      <div className="muted">
        {a.role} • {a.shift}
      </div>

    </div>

    <div className="history-meta">

      <div>Total: ₹{a.amount}</div>

      <div className="muted">
        Paid: ₹{a.paidAmount || 0}
      </div>

      <div className="muted">
        Pending: ₹{a.balanceAmount || 0}
      </div>

    </div>

    {/* STAFF PAYMENT HISTORY */}

    {(a.payments || []).length > 0 && (

      <div style={{marginTop:8}}>

        {(a.payments || []).map((p,idx)=>(

          <div key={idx} className="mini-history">

            <div>₹{p.amount}</div>

            <div className="muted">
              {fmt(p.date)}
            </div>

          </div>

        ))}

      </div>

    )}

  </div>

))}

  <hr/>

  <div className="total-row">
    <span>Total Salary</span>
    <span>₹{totalSalary}</span>
  </div>

  <div className="total-row">
    <span>Paid Salary</span>
    <span>₹{paidSalary}</span>
  </div>

  <div className="total-row balance">
    <span>Pending Salary</span>
    <span>₹{pendingSalary}</span>
  </div>

</div>

                        {/* TOTALS */}

                        <div className="section">

                            <h3>Totals</h3>

                            <div className="total-row">
                                <span>Subtotal</span>
                                <span>₹{data.totals?.subtotal || 0}</span>
                            </div>

                            <div className="total-row">
                                <span>Tax</span>
                                <span>₹{taxAmount}</span>
                            </div>

                            <div className="total-row total-main">
                                <span>Total</span>
                                <span>₹{totalAmount}</span>
                            </div>

                            <hr />

                            <div className="total-row">
                                <span>Total Paid</span>
                                <span>₹{totalPaid}</span>
                            </div>

                            <div className="total-row" style={{ color: "#b91c1c" }}>
                                <span>Refund Paid</span>
                                <span>- ₹{refundPaid}</span>
                            </div>

                            <hr />

                            <div className="total-row">
                                <span>Net Paid</span>
                                <span>₹{netPaid}</span>
                            </div>

                            <div className="total-row balance">
                                <span>Balance</span>
                                <span>₹{balance}</span>
                            </div>
                            <hr/>


<div
  className="total-row profit"
  style={{ color: profit >= 0 ? "#059669" : "#dc2626" }}
>
  <span>Profit</span>
  <span>₹{profit}</span>
</div>

                        </div>

                    </div>

                )}

            </div>

        </div>

    );

}