// src/pages/Quotations.js
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./Quotations.css";
import { makeHistoryEntry, propagateToLead } from "../utils/status"; // <--- shared helpers

// currency formatter
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

/**
 * Reused totals calculation from Requirements.jsx
 * returns: { subtotal, discountAmount, taxBreakdown, totalTax, total }
 */
const calcAmounts = (items, discount, taxes) => {
  const subtotal = (items || []).reduce(
    (s, it) => s + Number(Number(it.qty || 0) * Number(it.rate || 0)),
    0
  );
  let discountAmount = 0;
  if (discount) {
    if (discount.type === "percent") discountAmount = subtotal * (Number(discount.value || 0) / 100);
    else discountAmount = Number(discount.value || 0);
  }
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxBreakdown = (taxes || []).map((t) => ({ ...t, amount: (taxable * (Number(t.rate || 0) / 100)) }));
  const totalTax = taxBreakdown.reduce((s, t) => s + (t.amount || 0), 0);
  const total = Math.max(0, taxable + totalTax);
  return { subtotal, discountAmount, taxBreakdown, totalTax, total };
};

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [details, setDetails] = useState(null); // open quotation doc
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editQuotation, setEditQuotation] = useState(null);
  const [versions, setVersions] = useState([]);
  const [viewingVersion, setViewingVersion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [shareReady, setShareReady] = useState(false); // flag after a successful save so user can share/mark sent

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

  /* ---------- Open details & subscribe to versions ---------- */
  const openDetails = async (qDoc) => {
    setError("");
    setDetails(qDoc);
    setShareReady(false); // clear share flag when opening a new quotation
    setIsEditing(false);
    setEditQuotation(null);
    setViewingVersion(null);

    try {
      const versionsQuery = query(collection(db, "quotations", qDoc.id, "versions"), orderBy("createdAt", "desc"));
      const unsubVersions = onSnapshot(versionsQuery, (snap) => {
        const vs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setVersions(vs);
      }, (err) => {
        console.error("versions snapshot", err);
        setVersions([]);
      });
      setDetails((prev) => ({ ...qDoc, __unsubVersions: unsubVersions }));
    } catch (err) {
      console.error("openDetails versions", err);
      setVersions([]);
    }
  };

  const closeDetails = () => {
    if (details && details.__unsubVersions) {
      try { details.__unsubVersions(); } catch (e) {}
    }
    setDetails(null);
    setIsEditing(false);
    setEditQuotation(null);
    setVersions([]);
    setViewingVersion(null);
    setShareReady(false);
  };

  /* ---------- Editing helpers ---------- */
  const startEdit = () => {
    setIsEditing(true);
    setShareReady(false); // clear share flag when editing again
    // deep clone for safe edits
    setEditQuotation(JSON.parse(JSON.stringify(details)));
  };
  const cancelEdit = () => {
    setIsEditing(false);
    setEditQuotation(null);
  };

  // Update an arbitrary path on editQuotation
  const updateEditField = (path, value) => {
    setEditQuotation((q) => {
      if (!q) return q;
      const clone = JSON.parse(JSON.stringify(q));
      const parts = path.split(".");
      let cur = clone;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!(p in cur)) cur[p] = {};
        cur = cur[p];
      }
      cur[parts[parts.length - 1]] = value;
      return clone;
    });
  };

  // Item operations
  const updateEditItem = (idx, patch) => {
    setEditQuotation((q) => {
      if (!q) return q;
      const clone = JSON.parse(JSON.stringify(q));
      clone.items = clone.items || [];
      clone.items[idx] = { ...clone.items[idx], ...patch };
      // recalc amount for item
      clone.items[idx].amount = Number(clone.items[idx].qty || 0) * Number(clone.items[idx].rate || 0);
      return clone;
    });
  };
  const addEditItem = () => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.items = clone.items || [];
      clone.items.push({
        id: Date.now() + "-i",
        name: "",
        qty: 1,
        rate: 0,
        amount: 0,
        notes: "",
        days: 0,
        expectedStartDate: "",
        expectedEndDate: "",
        productId: "",
      });
      return clone;
    });
  };
  const removeEditItem = (idx) => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.items = (clone.items || []).filter((_, i) => i !== idx);
      return clone;
    });
  };

  // Taxes operations
  const updateEditTax = (idx, patch) => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.taxes = clone.taxes || [];
      clone.taxes[idx] = { ...clone.taxes[idx], ...patch };
      return clone;
    });
  };
  const addEditTax = () => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.taxes = clone.taxes || [];
      clone.taxes.push({ name: "New Tax", rate: 0 });
      return clone;
    });
  };
  const removeEditTax = (idx) => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.taxes = (clone.taxes || []).filter((_, i) => i !== idx);
      return clone;
    });
  };

  // Discount update
  const updateEditDiscount = (patch) => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.discount = { ...(clone.discount || {}), ...patch };
      return clone;
    });
  };

  // Derived amounts for editing (live)
  const editAmounts = useMemo(() => {
    if (!isEditing || !editQuotation) return null;
    return calcAmounts(editQuotation.items || [], editQuotation.discount || {}, editQuotation.taxes || []);
  }, [isEditing, editQuotation]);

  /* ---------- Save edits (version & update main doc) ---------- */
  const saveEdits = async () => {
    if (!details || !editQuotation) return;
    setSaving(true);
    setError("");
    try {
      const user = auth.currentUser || {};
      const qRef = doc(db, "quotations", details.id);

      // Create version snapshot from current details (previous state)
      const previousSnapshot = { ...details };
      delete previousSnapshot.__unsubVersions;
      await addDoc(collection(db, "quotations", details.id, "versions"), {
        snapshot: previousSnapshot,
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || "",
        note: "Edit snapshot - before update",
      });

      // Compute totals from editQuotation
      const amounts = calcAmounts(editQuotation.items || [], editQuotation.discount || {}, editQuotation.taxes || []);

      // Prepare update payload (persist full fields)
      const toUpdate = {
        quoNo: editQuotation.quoNo || editQuotation.quotationId || details.quoNo,
        quotationId: editQuotation.quotationId || details.quotationId || "",
        items: (editQuotation.items || []).map((it) => ({
          name: it.name || "",
          qty: Number(it.qty || 0),
          rate: Number(it.rate || 0),
          amount: Number(it.amount || 0),
          notes: it.notes || "",
          days: it.days || 0,
          expectedStartDate: it.expectedStartDate || "",
          expectedEndDate: it.expectedEndDate || "",
          productId: it.productId || "",
        })),
        discount: editQuotation.discount || { type: "percent", value: 0 },
        taxes: editQuotation.taxes || [],
        notes: editQuotation.notes || "",
        status: editQuotation.status || details.status || "draft",
        totals: {
          subtotal: amounts.subtotal,
          discountAmount: amounts.discountAmount,
          taxBreakdown: amounts.taxBreakdown,
          totalTax: amounts.totalTax,
          total: amounts.total,
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
      };

      // Write update
      await updateDoc(qRef, toUpdate);

      // Update requirement history/status if required
      if (details.requirementId) {
        const reqRef = doc(db, "requirements", details.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "quotation",
          field: "edit",
          oldValue: details.status || "",
          newValue: toUpdate.status || "",
          note: `Quotation ${details.quoNo || details.id} edited by ${user.displayName || user.email || ""}`,
        });
        await updateDoc(reqRef, {
          history: arrayUnion(entry),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        });

        // propagate the change to the lead via shared helper
        propagateToLead(details.requirementId, "quotation", details.status || "", toUpdate.status || "", entry.note);
      }

      // Update local state so UI reflects saved data
      setDetails((d) => ({ ...d, ...toUpdate }));
      setIsEditing(false);
      setEditQuotation(null);

      // allow the user to explicitly share the updated quotation & mark as sent
      setShareReady(true);
    } catch (err) {
      console.error("saveEdits", err);
      setError(err.message || "Failed to save edits");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Revert and version view ---------- */
  const viewVersion = (v) => setViewingVersion(v);

  const revertToVersion = async (version) => {
    if (!details || !version) return;
    setSaving(true);
    setError("");
    try {
      const user = auth.currentUser || {};
      const qRef = doc(db, "quotations", details.id);

      // snapshot current
      const currentSnapshot = { ...details };
      delete currentSnapshot.__unsubVersions;
      await addDoc(collection(db, "quotations", details.id, "versions"), {
        snapshot: currentSnapshot,
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || "",
        note: `Snapshot before revert to version ${version.id}`,
      });

      // apply snapshot fields to main doc
      const snap = version.snapshot || {};
      const amounts = calcAmounts(snap.items || [], snap.discount || {}, snap.taxes || []);
      const payload = {
        quoNo: snap.quoNo,
        quotationId: snap.quotationId,
        items: snap.items || [],
        discount: snap.discount || {},
        taxes: snap.taxes || [],
        notes: snap.notes || "",
        totals: {
          subtotal: amounts.subtotal,
          discountAmount: amounts.discountAmount,
          taxBreakdown: amounts.taxBreakdown,
          totalTax: amounts.totalTax,
          total: amounts.total,
        },
        status: snap.status || "draft",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
      };

      await updateDoc(qRef, payload);

      if (details.requirementId) {
        const reqRef = doc(db, "requirements", details.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "quotation",
          field: "revert",
          oldValue: details.status || "",
          newValue: payload.status || "",
          note: `Quotation ${details.quoNo || details.id} reverted to version ${version.id}`,
        });
        await updateDoc(reqRef, {
          history: arrayUnion(entry),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        });

        // propagate revert to lead as well
        propagateToLead(details.requirementId, "quotation", details.status || "", payload.status || "", entry.note);
      }

      setDetails((d) => ({ ...d, ...payload }));
      setViewingVersion(null);
      setIsEditing(false);
      setEditQuotation(null);
      setShareReady(false);
    } catch (err) {
      console.error("revertToVersion", err);
      setError(err.message || "Failed to revert to version");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Status update & convert to order (updated to propagate) ---------- */
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
      if (quote.requirementId) {
        const reqRef = doc(db, "requirements", quote.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "status",
          field: "quotation",
          oldValue: quote.status || "",
          newValue: newStatus,
          note: note || `Quotation ${quote.quoNo || quote.id} marked ${newStatus}`,
        });
        const updates = {
          history: arrayUnion(entry),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        };
        if (newStatus === "accepted") updates.status = "order_created";
        await updateDoc(reqRef, updates);

        // propagate this status change to the linked lead
        propagateToLead(quote.requirementId, "quotation", quote.status || "", newStatus, entry.note);
      }
      if (details && details.id === quote.id) {
        setDetails((d) => ({ ...d, status: newStatus }));
      }
    } catch (err) {
      console.error("updateQuotationStatus", err);
      setError(err.message || "Failed to update quotation status");
    }
  };

  const convertToOrder = async (quote) => {
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
      await updateDoc(doc(db, "quotations", quote.id), { orderId: ref.id, updatedAt: serverTimestamp() });
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

        // propagate order creation to lead
        propagateToLead(quote.requirementId, "order", quote.status || "", "order_created", entry.note);
      }
    } catch (err) {
      console.error("convertToOrder", err);
      setError(err.message || "Failed to convert quotation to order");
    }
  };

  // Share the updated quotation and mark it as 'sent'
  const shareUpdated = async () => {
    if (!details) return;
    try {
      // mark quotation as sent (this will also update requirement history via existing helper)
      await updateQuotationStatus(details, "sent", "Updated quotation shared");

      // copy to clipboard for quick sharing
      if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(details, null, 2));
        alert("Updated quotation marked sent and copied to clipboard.");
      } else {
        alert("Updated quotation marked sent. Clipboard not available.");
      }

      setShareReady(false);
    } catch (err) {
      console.error("shareUpdated", err);
      alert("Failed to share updated quotation: " + (err.message || err));
    }
  };

  /* ---------- Render ---------- */
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
                    {(q.status || "").toLowerCase() === "draft" && <button className="qp-link" onClick={() => updateQuotationStatus(q, "sent", "Sent to customer")}>Mark Sent</button>}
                    {(q.status || "").toLowerCase() === "sent" && <>
                      <button className="qp-link" onClick={() => updateQuotationStatus(q, "accepted", "Accepted by customer")}>Accept</button>
                      <button className="qp-link" onClick={() => updateQuotationStatus(q, "rejected", "Rejected by customer")}>Reject</button>
                    </>}
                    {(q.status || "").toLowerCase() === "accepted" && <button className="qp-link" onClick={() => convertToOrder(q)}>Convert to Order</button>}
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
              <div>
                {!isEditing && <button className="cp-btn ghost" onClick={startEdit}>Edit</button>}
                {isEditing && <button className="cp-btn ghost" onClick={cancelEdit}>Cancel</button>}
                <button className="qp-close" onClick={closeDetails}>✕</button>
              </div>
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

                  {isEditing ? (
                    <div style={{ marginTop: 8 }}>
                      {(editQuotation.items || []).map((it, i) => (
                        <div key={it.id || i} className="quotation-item" style={{ marginBottom: 12 }}>
                          <input className="cp-input" placeholder="Item name" value={it.name || ""} onChange={(e) => updateEditItem(i, { name: e.target.value })} />
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <input className="cp-input" placeholder="Qty" value={it.qty} onChange={(e) => updateEditItem(i, { qty: Number(e.target.value || 0) })} />
                            <input className="cp-input" placeholder="Rate" value={it.rate} onChange={(e) => updateEditItem(i, { rate: Number(e.target.value || 0) })} />
                            <input className="cp-input" placeholder="Days" value={it.days ?? 0} onChange={(e) => updateEditItem(i, { days: Number(e.target.value || 0) })} />
                          </div>

                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <input className="cp-input" placeholder="Start date (YYYY-MM-DD)" value={it.expectedStartDate || ""} onChange={(e) => updateEditItem(i, { expectedStartDate: e.target.value })} />
                            <input className="cp-input" placeholder="End date (YYYY-MM-DD)" value={it.expectedEndDate || ""} onChange={(e) => updateEditItem(i, { expectedEndDate: e.target.value })} />
                          </div>

                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <input className="cp-input" placeholder="Product ID" value={it.productId || ""} onChange={(e) => updateEditItem(i, { productId: e.target.value })} />
                            <input className="cp-input" placeholder="Notes" value={it.notes || ""} onChange={(e) => updateEditItem(i, { notes: e.target.value })} />
                            <button className="cp-btn ghost" onClick={() => removeEditItem(i)}>Remove</button>
                          </div>

                          <div className="extra-details" style={{ marginTop: 8 }}>
                            Amount: {fmtCurrency(it.amount || 0)}
                          </div>
                        </div>
                      ))}

                      <div style={{ marginTop: 8 }}>
                        <button className="cp-btn" onClick={addEditItem}>+ Add item</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      {(details.items || []).map((it, i) => (
                        <div key={i} style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ fontWeight: 700 }}>{it.name || "—"}</div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>{it.qty || 0} × {fmtCurrency(it.rate || 0)} = {fmtCurrency(it.amount || 0)}</div>
                          {it.notes ? <div style={{ marginTop: 6 }}>{it.notes}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="qp-section">
                  <div className="label">Notes</div>
                  {isEditing ? (
                    <textarea className="cp-input" value={editQuotation.notes || ""} onChange={(e) => updateEditField("notes", e.target.value)} />
                  ) : (
                    <div className="value">{details.notes || "—"}</div>
                  )}
                </div>

                {/* Versions */}
                <div className="qp-section">
                  <div className="label">Versions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {versions.length === 0 && <div className="qp-empty">No previous versions.</div>}
                    {versions.map((v) => (
                      <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, border: "1px solid #eef2f7", padding: 8, borderRadius: 6 }}>
                        <div style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 700 }}>{v.createdByName || v.createdBy || "Unknown"}</div>
                          <div style={{ color: "#6b7280", fontSize: 12 }}>{parseDate(v.createdAt)}</div>
                          {v.note ? <div style={{ fontSize: 12, color: "#374151", marginTop: 6 }}>{v.note}</div> : null}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="qp-link" onClick={() => viewVersion(v)}>View</button>
                          <button className="qp-link" onClick={() => {
                            if (window.confirm("Revert the current quotation to this saved version? This will create a snapshot of the current quotation before revert.")) {
                              revertToVersion(v);
                            }
                          }}>Revert</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="qp-right">
                <div className="qp-meta">
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div className="label">Quotation No</div>
                      {isEditing ? <input className="cp-input" value={editQuotation.quoNo || ""} onChange={(e) => updateEditField("quoNo", e.target.value)} /> : <div className="value">{details.quoNo}</div>}
                    </div>
                    <div style={{ width: 140 }}>
                      <div className="label">Status</div>
                      {isEditing ? (
                        <select className="cp-input" value={editQuotation.status || "draft"} onChange={(e) => updateEditField("status", e.target.value)}>
                          <option value="draft">draft</option>
                          <option value="sent">sent</option>
                          <option value="accepted">accepted</option>
                          <option value="rejected">rejected</option>
                        </select>
                      ) : <div className="value">{details.status}</div>}
                    </div>
                  </div>

                  {/* Discount editor */}
                  <div style={{ marginTop: 12 }}>
                    <div className="label">Discount</div>
                    {isEditing ? (
                      <div className="qp-discount-row" style={{ marginTop: 6 }}>
                        <select value={editQuotation.discount?.type || "percent"} onChange={(e) => updateEditDiscount({ type: e.target.value })}>
                          <option value="percent">% Percent</option>
                          <option value="fixed">Fixed</option>
                        </select>
                        <input
                          type="number"
                          value={editQuotation.discount?.value ?? 0}
                          onChange={(e) => updateEditDiscount({ value: Number(e.target.value || 0) })}
                          placeholder="Value"
                        />
                      </div>
                    ) : (
                      <div className="value">{details.discount?.type === "percent" ? `${details.discount?.value || 0}%` : fmtCurrency(details.discount?.value || 0)}</div>
                    )}
                  </div>

                  {/* Taxes editor */}
                  <div style={{ marginTop: 12 }}>
                    <div className="label">Taxes</div>
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(editQuotation.taxes || []).map((t, i) => (
                          <div key={i} style={{ display: "flex", gap: 8 }}>
                            <input className="cp-input" value={t.name || ""} onChange={(e) => updateEditTax(i, { name: e.target.value })} />
                            <input className="cp-input" value={t.rate || 0} onChange={(e) => updateEditTax(i, { rate: Number(e.target.value || 0) })} />
                            <button className="cp-btn ghost" onClick={() => removeEditTax(i)}>Remove</button>
                          </div>
                        ))}
                        <button className="cp-btn ghost" onClick={addEditTax}>+ Add Tax</button>
                      </div>
                    ) : (
                      <div className="value">
                        {(details.taxes || []).map((t, i) => <div key={i}>{t.name} — {t.rate}%</div>)}
                      </div>
                    )}
                  </div>

                  {/* Totals */}
                  <div style={{ marginTop: 12 }}>
                    <div className="meta-row"><div className="label">Subtotal</div><div className="value">{fmtCurrency(isEditing ? (editAmounts?.subtotal ?? 0) : (details.totals?.subtotal || 0))}</div></div>
                    <div className="meta-row"><div className="label">Discount Amount</div><div className="value">{fmtCurrency(isEditing ? (editAmounts?.discountAmount ?? 0) : (details.totals?.discountAmount || 0))}</div></div>
                    <div className="meta-row"><div className="label">Total Tax</div><div className="value">{fmtCurrency(isEditing ? (editAmounts?.totalTax ?? 0) : (details.totals?.totalTax || 0))}</div></div>
                    <div className="meta-row"><div className="label strong">Total</div><div className="value strong">{fmtCurrency(isEditing ? (editAmounts?.total ?? 0) : (details.totals?.total || 0))}</div></div>
                  </div>

                  {/* Save/Action buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                    {isEditing ? (
                      <>
                        <button className="cp-btn ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
                        <button className="cp-btn primary" onClick={saveEdits} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
                      </>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(details.status || "").toLowerCase() === "draft" && <button className="cp-btn primary" onClick={() => updateQuotationStatus(details, "sent", "Sent by ops")}>Mark Sent</button>}
                        {(details.status || "").toLowerCase() === "sent" && <>
                          <button className="cp-btn primary" onClick={() => updateQuotationStatus(details, "accepted", "Accepted by ops")}>Mark Accepted</button>
                          <button className="cp-btn ghost" onClick={() => updateQuotationStatus(details, "rejected", "Rejected by ops")}>Mark Rejected</button>
                        </>}
                        {(details.status || "").toLowerCase() === "accepted" && <>
                          <button className="cp-btn primary" onClick={() => convertToOrder(details)}>Create Order</button>
                        </>}
                        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                          <button className="cp-btn ghost" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(details)); alert("Copied JSON to clipboard"); }}>Copy JSON</button>

                          {/* show share button only when shareReady is true */}
                          {shareReady && (
                            <button className="cp-btn primary" onClick={() => {
                              if (window.confirm("Share the updated quotation and mark it as 'sent'?")) {
                                shareUpdated();
                              }
                            }}>
                              Share Updated &amp; Mark Sent
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Version viewer */}
            {viewingVersion && (
              <div style={{ marginTop: 12, borderTop: "1px solid #eef2f7", paddingTop: 12 }}>
                <h3>Viewing Version: {viewingVersion.id}</h3>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{viewingVersion.createdByName || viewingVersion.createdBy} · {parseDate(viewingVersion.createdAt)}</div>
                <div style={{ marginTop: 8 }}>
                  <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 6, maxHeight: 280, overflow: "auto" }}>
                    {JSON.stringify(viewingVersion.snapshot || viewingVersion, null, 2)}
                  </pre>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="cp-btn ghost" onClick={() => setViewingVersion(null)}>Close</button>
                    <button className="cp-btn" onClick={() => {
                      if (window.confirm("Revert to this version? This will snapshot the current quotation first.")) {
                        revertToVersion(viewingVersion);
                      }
                    }}>Revert to this version</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
