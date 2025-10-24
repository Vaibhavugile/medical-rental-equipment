// src/pages/Quotations.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./Quotations.css";

/*
 Quotation management for operations:
 - Lists quotations (sortable/filterable by status)
 - View quotation details in a drawer
 - Change quotation status: draft -> sent -> accepted / rejected
 - Convert accepted quotation into an Order (orders collection) and update related requirement
 - Create a simple Invoice (invoices collection) for accepted orders
 - Records history entries on requirements when state changes (uses arrayUnion)
*/

const fmtCurrency = (v) => {
  try {
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return v ?? "0.00";
  }
};

const parseDate = (ts) => {
  if (!ts) return "—";
  if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleString();
  if (typeof ts === "string") {
    const d = new Date(ts);
    if (!isNaN(d)) return d.toLocaleString();
  }
  if (ts instanceof Date) return ts.toLocaleString();
  if (typeof ts === "number") return new Date(ts).toLocaleString();
  return "—";
};

const makeHistoryEntry = (user, opts = {}) => ({
  ts: new Date().toISOString(),
  changedBy: user.uid || "unknown",
  changedByName: user.displayName || user.email || "unknown",
  type: opts.type || "update",
  field: opts.field || null,
  oldValue: opts.oldValue == null ? null : String(opts.oldValue),
  newValue: opts.newValue == null ? null : String(opts.newValue),
  note: opts.note || null,
});

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, draft, sent, accepted, rejected
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "quotations"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setQuotations(docs);
        setLoading(false);
      },
      (err) => {
        console.error("quotations snapshot", err);
        setError(err.message || "Failed to load quotations");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return quotations;
    return quotations.filter((q) => (q.status || "draft").toLowerCase() === filter.toLowerCase());
  }, [quotations, filter]);

  const openDetails = (q) => setDetails(q);
  const closeDetails = () => setDetails(null);

  const updateQuotationStatus = async (quote, newStatus, note = "") => {
    setError("");
    try {
      const user = auth.currentUser || {};
      const qRef = doc(db, "quotations", quote.id);
      await updateDoc(qRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
      });
      // If the quotation is linked to a requirement, update requirement history and status where relevant
      if (quote.requirementId) {
        const reqRef = doc(db, "requirements", quote.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "status",
          field: "quotation",
          oldValue: quote.status || "",
          newValue: newStatus,
          note: note || `Quotation ${quote.quoNo || quote.id} marked ${newStatus}`,
        });
        // on requirement, also update status for ops flow:
        // If accepted -> requirement status = 'order created' (or 'quotation accepted')
        const reqStatus = newStatus === "accepted" ? "order_created" : newStatus === "rejected" ? "quotation_rejected" : undefined;
        const updates = {
          history: arrayUnion(entry),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        };
        if (reqStatus) updates.status = reqStatus;
        await updateDoc(reqRef, updates);
      }
    } catch (err) {
      console.error("updateQuotationStatus", err);
      setError(err.message || "Failed to update quotation status");
    }
  };

  // Convert an accepted quotation to an Order
  const convertToOrder = async (quote, opts = {}) => {
    setError("");
    try {
      const user = auth.currentUser || {};
      if ((quote.status || "").toLowerCase() !== "accepted") {
        setError("Only accepted quotations can be converted to orders. Mark as 'accepted' first.");
        return;
      }

      const orderPayload = {
        quotationId: quote.id,
        requirementId: quote.requirementId || "",
        orderNo: `O-${Math.floor(Date.now() / 1000)}`,
        items: (quote.items || []).map((it) => ({ name: it.name, qty: Number(it.qty || 0), rate: Number(it.rate || 0), amount: Number(it.amount || 0), notes: it.notes || "", days: it.days || 0, expectedStartDate: it.expectedStartDate || "", expectedEndDate: it.expectedEndDate || "", productId: it.productId || "" })),
        totals: quote.totals || {},
        status: "created",
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || "",
      };

      const ref = await addDoc(collection(db, "orders"), orderPayload);

      // update quotation record to reference the order
      await updateDoc(doc(db, "quotations", quote.id), { orderId: ref.id, updatedAt: serverTimestamp() });

      // update requirement status and history (if linked)
      if (quote.requirementId) {
        const reqRef = doc(db, "requirements", quote.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "order",
          field: "status",
          oldValue: quote.status || "",
          newValue: "order_created",
          note: `Order ${orderPayload.orderNo} created from quotation ${quote.quoNo || quote.id}`,
        });
        await updateDoc(reqRef, {
          status: "order_created",
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
          history: arrayUnion(entry),
        });
      }
    } catch (err) {
      console.error("convertToOrder", err);
      setError(err.message || "Failed to convert quotation to order");
    }
  };

  // Create a simple invoice for an order (or quotation)
  const createInvoice = async (src, opts = {}) => {
    setError("");
    try {
      const user = auth.currentUser || {};
      // src can be a quotation or order
      const invoicePayload = {
        sourceType: src.orderNo ? "order" : "quotation",
        sourceId: src.orderNo ? src.id : src.id,
        invoiceNo: `INV-${Math.floor(Date.now() / 1000)}`,
        requirementId: src.requirementId || "",
        items: (src.items || []).map((it) => ({ name: it.name, qty: Number(it.qty || 0), rate: Number(it.rate || 0), amount: Number(it.amount || 0) })),
        totals: src.totals || {},
        status: "unpaid",
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || "",
      };

      const ref = await addDoc(collection(db, "invoices"), invoicePayload);

      // update order/quotation with invoice reference
      if (src.orderNo) {
        await updateDoc(doc(db, "orders", src.id), { invoiceId: ref.id, updatedAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, "quotations", src.id), { invoiceId: ref.id, updatedAt: serverTimestamp() });
      }

      // update requirement status/story if linked
      if (src.requirementId) {
        const reqRef = doc(db, "requirements", src.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "invoice",
          field: "invoice",
          oldValue: null,
          newValue: invoicePayload.invoiceNo,
          note: `Invoice ${invoicePayload.invoiceNo} created`,
        });
        await updateDoc(reqRef, {
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
          history: arrayUnion(entry),
        });
      }
    } catch (err) {
      console.error("createInvoice", err);
      setError(err.message || "Failed to create invoice");
    }
  };

  if (loading) return <div className="qp-wrap"><div className="qp-loading">Loading quotations…</div></div>;

  return (
    <div className="qp-wrap">
      <header className="qp-header">
        <h1>Quotations</h1>
        <div className="qp-toolbar">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="qp-select">
            <option value="all">All status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </header>

      {error && <div className="qp-error">{error}</div>}

      <div className="qp-card">
        <table className="qp-table">
          <thead>
            <tr>
              <th>Q No</th>
              <th>Requirement</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Created</th>
              <th>Totals</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <tr key={q.id}>
                <td className="strong">{q.quoNo || q.quotationId || q.id}</td>
                <td>{q.requirementId || "—"}</td>
                <td>{q.createdByName || q.createdBy || "—"}</td>
                <td>{q.status || "draft"}</td>
                <td>{parseDate(q.createdAt)}</td>
                <td>{fmtCurrency(q.totals?.total || 0)}</td>
                <td>
                  <div className="qp-actions">
                    <button className="qp-link" onClick={() => openDetails(q)}>View</button>
                    { (q.status || "").toLowerCase() === "draft" && <button className="qp-link" onClick={() => updateQuotationStatus(q, "sent", "Sent to customer")}>Mark Sent</button> }
                    { (q.status || "").toLowerCase() === "sent" && <>
                        <button className="qp-link" onClick={() => updateQuotationStatus(q, "accepted", "Accepted by customer")}>Accept</button>
                        <button className="qp-link" onClick={() => updateQuotationStatus(q, "rejected", "Rejected by customer")}>Reject</button>
                      </> }
                    { (q.status || "").toLowerCase() === "accepted" && <button className="qp-link" onClick={() => convertToOrder(q)}>Convert to Order</button> }
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="7" className="qp-empty">No quotations found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Details drawer */}
      {details && (
        <div className="qp-drawer" onClick={(e) => { if (e.target.classList.contains("qp-drawer")) closeDetails(); }}>
          <div className="qp-form" onClick={(e) => e.stopPropagation()}>
            <div className="qp-form-head">
              <h2>Quotation: {details.quoNo || details.id}</h2>
              <button className="qp-close" onClick={closeDetails}>✕</button>
            </div>

            <div className="qp-grid">
              <div className="qp-left">
                <div className="qp-section">
                  <div className="label">Requirement</div>
                  <div className="value">{details.requirementId || "—"}</div>
                </div>

                <div className="qp-section">
                  <div className="label">Created</div>
                  <div className="value">{parseDate(details.createdAt)} · {details.createdByName || details.createdBy}</div>
                </div>

                <div className="qp-section">
                  <div className="label">Items</div>
                  <table className="qp-items">
                    <thead>
                      <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
                    </thead>
                    <tbody>
                      {(details.items || []).map((it, i) => (
                        <tr key={i}>
                          <td>{it.name}</td>
                          <td>{it.qty}</td>
                          <td>{fmtCurrency(it.rate)}</td>
                          <td>{fmtCurrency(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="qp-section">
                  <div className="label">Notes</div>
                  <div className="value">{details.notes || "—"}</div>
                </div>
              </div>

              <div className="qp-right">
                <div className="qp-meta">
                  <div className="meta-row"><div className="label">Status</div><div className="value">{details.status || "draft"}</div></div>
                  <div className="meta-row"><div className="label">Subtotal</div><div className="value">{fmtCurrency(details.totals?.subtotal || 0)}</div></div>
                  <div className="meta-row"><div className="label">Discount</div><div className="value">{fmtCurrency(details.totals?.discountAmount || 0)}</div></div>
                  <div className="meta-row"><div className="label">Taxes</div><div className="value">{fmtCurrency(details.totals?.totalTax || 0)}</div></div>
                  <div className="meta-row"><div className="label strong">Total</div><div className="value strong">{fmtCurrency(details.totals?.total || 0)}</div></div>
                </div>

                <div className="qp-ops">
                  { (details.status || "").toLowerCase() === "draft" && <button className="cp-btn primary" onClick={() => updateQuotationStatus(details, "sent", "Sent by ops")}>Mark Sent</button> }
                  { (details.status || "").toLowerCase() === "sent" && <>
                      <button className="cp-btn primary" onClick={() => updateQuotationStatus(details, "accepted", "Accepted by ops")}>Mark Accepted</button>
                      <button className="cp-btn ghost" onClick={() => updateQuotationStatus(details, "rejected", "Rejected by ops")}>Mark Rejected</button>
                    </> }
                  { (details.status || "").toLowerCase() === "accepted" && <>
                      <button className="cp-btn primary" onClick={() => convertToOrder(details)}>Create Order</button>
                      <button className="cp-btn ghost" onClick={() => createInvoice(details)}>Create Invoice</button>
                    </> }

                  {/* Quick actions */}
                  <div style={{ marginTop: 12 }}>
                    <button className="cp-btn ghost" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(details)); alert("Copied JSON to clipboard"); }}>Copy JSON</button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
