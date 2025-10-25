// src/pages/Requirements.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./Requirements.css";
import { makeHistoryEntry, propagateToLead } from "../utils/status";

/*
 Updated to show per-item dates/duration with fallback to requirement-level fields:
 - item.days = item.expectedDurationDays || item.days || requirement.expectedDurationDays
 - item.expectedStartDate = item.expectedStartDate || requirement.expectedStartDate
 - item.expectedEndDate = item.expectedEndDate || requirement.expectedEndDate

 Also: propagates requirement/quotation status changes to linked Lead documents via propagateToLead().
*/

const defaultQuotation = {
  id: null,
  requirementId: "",
  quoNo: "",
  quotationId: "",
  items: [{ id: Date.now() + "-i1", name: "", qty: 1, rate: 0, amount: 0, notes: "", days: 0, expectedStartDate: "", expectedEndDate: "", productId: "" }],
  discount: { type: "percent", value: 0 },
  taxes: [{ name: "GST", rate: 18 }],
  notes: "",
  status: "draft",
  createdAt: null,
  createdBy: "",
  createdByName: "",
};

const fmtCurrency = (v) => {
  try {
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return v ?? "0.00";
  }
};

const calcAmounts = (items, discount, taxes) => {
  const subtotal = (items || []).reduce((s, it) => s + (Number(it.qty || 0) * Number(it.rate || 0)), 0);
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

const parseDateForDisplay = (ts) => {
  try {
    if (!ts) return "—";
    if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    if (typeof ts === "string") {
      // handle ISO dates and yyyy-mm-dd strings
      const d = new Date(ts);
      if (!isNaN(d)) return d.toLocaleString();
    }
    if (ts instanceof Date) return ts.toLocaleString();
    if (typeof ts === "number") return new Date(ts).toLocaleString();
    return "—";
  } catch {
    return "—";
  }
};

export default function Requirements() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [detailsReq, setDetailsReq] = useState(null);
  const [openQuotation, setOpenQuotation] = useState(false);
  const [quotation, setQuotation] = useState(defaultQuotation);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "requirements"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setRequirements(docs);
        setLoading(false);
      },
      (err) => {
        console.error("requirements onSnapshot", err);
        setError(err.message || "Failed to load requirements");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const openDetails = (r) => setDetailsReq(r);
  const closeDetails = () => setDetailsReq(null);

  // Create quotation draft with fallback: item-level OR requirement-level dates/days
  const openCreateQuotation = async (req) => {
    setError("");
    const user = auth.currentUser || {};

    // Auto-assign if not assigned and user exists
    if (req && !req.assignedTo && user?.uid) {
      try {
        const reqDoc = doc(db, "requirements", req.id);
        const entry = makeHistoryEntry(user, {
          type: "assign",
          field: "assignedTo",
          oldValue: req.assignedTo || "",
          newValue: user.uid,
          note: "Assigned to user when opening quotation",
        });
        updateDoc(reqDoc, {
          assignedTo: user.uid,
          assignedToName: user.displayName || user.email || user.uid || "",
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || user.uid || "",
          history: arrayUnion(entry),
        }).catch((e) => console.error("auto-assign on quotation open failed", e));
      } catch (e) {
        console.error("auto-assign error", e);
      }
    }

    // prepare items: prefer equipment array, else fallback to requirementItems
    const sourceItems = (req?.equipment && Array.isArray(req.equipment) && req.equipment.length)
      ? req.equipment
      : (req?.requirementItems && Array.isArray(req.requirementItems) ? req.requirementItems : []);

    const items = (sourceItems.length ? sourceItems : [{ name: "", qty: 1, expectedDurationDays: 0 }]).map((it, idx) => {
      const name = it.name || it.itemName || it.productName || "";
      const qty = Number(it.qty || it.quantity || 1);
      const rate = Number(it.rate || 0);
      const amount = Number(qty * rate);
      const notes = it.unitNotes || it.notes || it.specialInstructions || "";
      // FALLBACKS: item-level OR requirement-level
      const days = it.expectedDurationDays ?? it.days ?? req?.expectedDurationDays ?? 0;
      const expectedStartDate = it.expectedStartDate || it.startDate || req?.expectedStartDate || "";
      const expectedEndDate = it.expectedEndDate || it.endDate || req?.expectedEndDate || "";
      const productId = it.productId || "";
      return {
        id: Date.now() + "-" + idx,
        name,
        qty,
        rate,
        amount,
        notes,
        days,
        expectedStartDate,
        expectedEndDate,
        productId,
      };
    });

    const base = {
      ...defaultQuotation,
      requirementId: req?.id || "",
      quoNo: `Q-${Date.now()}`,
      quotationId: `QT-${Math.floor(Date.now() / 1000)}`,
      items,
      notes: `Quotation for requirement ${req?.reqNo || req?.id || ""}`,
      status: "draft",
      createdAt: null,
      createdBy: user.uid || "",
      createdByName: user.displayName || user.email || "",
    };

    setQuotation(base);
    setOpenQuotation(true);
  };

  const closeQuotation = () => {
    setOpenQuotation(false);
    setQuotation(defaultQuotation);
  };

  const updateQuotationItem = (idx, patch) => {
    setQuotation((q) => {
      const items = (q.items || []).slice();
      items[idx] = { ...items[idx], ...patch };
      items[idx].amount = Number(items[idx].qty || 0) * Number(items[idx].rate || 0);
      return { ...q, items };
    });
  };
  const addQuotationItem = () =>
    setQuotation((q) => ({ ...q, items: [...(q.items || []), { id: Date.now() + "-i" + Math.random().toString(36).slice(2, 7), name: "", qty: 1, rate: 0, amount: 0, notes: "", days: 0, expectedStartDate: "", expectedEndDate: "", productId: "" }] }));
  const removeQuotationItem = (idx) => setQuotation((q) => ({ ...q, items: q.items.filter((_, i) => i !== idx) }));

  const amounts = useMemo(() => calcAmounts(quotation.items || [], quotation.discount, quotation.taxes || []), [quotation.items, quotation.discount, quotation.taxes]);

  const saveQuotation = async () => {
    setError("");
    try {
      const user = auth.currentUser || {};
      const payload = {
        requirementId: quotation.requirementId || "",
        quoNo: quotation.quoNo || `Q-${Date.now()}`,
        quotationId: quotation.quotationId || `QT-${Math.floor(Date.now() / 1000)}`,
        items: (quotation.items || []).map((it) => ({ name: it.name, qty: Number(it.qty || 0), rate: Number(it.rate || 0), amount: Number(it.amount || 0), notes: it.notes || "", days: it.days || 0, expectedStartDate: it.expectedStartDate || "", expectedEndDate: it.expectedEndDate || "", productId: it.productId || "" })),
        discount: quotation.discount || { type: "percent", value: 0 },
        taxes: quotation.taxes || [],
        notes: quotation.notes || "",
        status: quotation.status || "draft",
        totals: {
          subtotal: amounts.subtotal,
          discountAmount: amounts.discountAmount,
          taxBreakdown: amounts.taxBreakdown,
          totalTax: amounts.totalTax,
          total: amounts.total,
        },
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || "",
      };

      const ref = await addDoc(collection(db, "quotations"), payload);

      if (quotation.requirementId) {
        const reqDoc = doc(db, "requirements", quotation.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "status",
          field: "status",
          oldValue: detailsReq?.status || "",
          newValue: "quotation shared",
          note: `Quotation ${payload.quoNo} created (id ${ref.id})`,
        });
        await updateDoc(reqDoc, {
          status: "quotation shared",
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
          history: arrayUnion(entry),
        });

        // propagate requirement -> lead (sets lead.status exactly to "quotation shared")
        propagateToLead(quotation.requirementId, "quotation", detailsReq?.status || "", "quotation shared", entry.note);
      }

      closeQuotation();
    } catch (err) {
      console.error("saveQuotation error", err);
      setError(err.message || "Failed to save quotation");
    }
  };

  const changeReqStatus = async (req, newStatus, note = "") => {
    try {
      const user = auth.currentUser || {};
      const entry = makeHistoryEntry(user, { type: "status", field: "status", oldValue: req.status, newValue: newStatus, note });
      await updateDoc(doc(db, "requirements", req.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
        history: arrayUnion(entry),
      });

      // propagate requirement status change to lead (sets lead.status exactly to newStatus)
      propagateToLead(req.id, "requirement", req.status || "", newStatus, note || entry.note);
    } catch (err) {
      console.error("changeReqStatus", err);
      setError(err.message || "Failed to change status");
    }
  };

  const assignToMe = async (req) => {
    setError("");
    try {
      const user = auth.currentUser || {};
      if (!user?.uid) {
        setError("You must be signed in to assign.");
        return;
      }
      const reqDoc = doc(db, "requirements", req.id);
      const entry = makeHistoryEntry(user, {
        type: "assign",
        field: "assignedTo",
        oldValue: req.assignedTo || "",
        newValue: user.uid,
        note: `Assigned to ${user.displayName || user.email || user.uid}`,
      });
      await updateDoc(reqDoc, {
        assignedTo: user.uid,
        assignedToName: user.displayName || user.email || user.uid || "",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || user.uid || "",
        history: arrayUnion(entry),
      });
    } catch (err) {
      console.error("assignToMe", err);
      setError(err.message || "Failed to assign");
    }
  };

  const handleDelete = async (r) => {
    try {
      await deleteDoc(doc(db, "requirements", r.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error("delete requirement", err);
      setError(err.message || "Failed to delete requirement");
    }
  };

  if (loading) return <div className="coupons-wrap"><div className="coupons-loading">Loading requirements…</div></div>;

  return (
    <div className="coupons-wrap">
      {error && <div className="coupons-error">{error}</div>}

      <header className="coupons-header">
        <div>
          <h1>📑 Requirements</h1>
          <p>Operations → create quotations and move requirements through stages.</p>
        </div>
      </header>

      <section className="coupons-card">
        <div className="tbl-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Req No</th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((r) => {
                const customer = r.leadSnapshot?.customerName || r.customerName || r.name || "—";
                const contact = r.leadSnapshot?.contactPerson || r.contactPerson || "—";
                const phone = r.leadSnapshot?.phone || r.phone || "—";
                const statusClass = (r.status || "").split(" ").map(s => s[0]?.toUpperCase() + s.slice(1)).join("");
                return (
                  <tr key={r.id}>
                    <td className="strong">{r.reqNo || r.requirementId || r.id}</td>
                    <td className="muted">{customer}</td>
                    <td className="muted">{contact}</td>
                    <td>{phone}</td>
                    <td><span className={`chip ${statusClass}`}>{r.status || "—"}</span></td>
                    <td className="muted">{parseDateForDisplay(r.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="cp-link" onClick={() => openDetails(r)}>View</button>
                        { (r.status || "").toLowerCase() !== "quotation shared" ? (
                          <button className="cp-link" onClick={() => openCreateQuotation(r)}>Create Quotation</button>
                        ) : null }
                        <button className="cp-link" onClick={() => setConfirmDelete(r)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!requirements.length && (
                <tr><td colSpan="7"><div className="empty">No requirements found.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Details drawer */}
      {detailsReq && (
        <div className="cp-drawer" onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeDetails(); }}>
          <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
            <div className="cp-form-head">
              <h2>Requirement: {detailsReq.reqNo || detailsReq.requirementId || detailsReq.id}</h2>
              <button type="button" className="cp-icon" onClick={closeDetails}>✕</button>
            </div>

            <div className="details-grid">
              <div className="details-left">
                <div className="details-row">
                  <div className="label muted">Requester</div>
                  <div className="value strong">{detailsReq.name || detailsReq.customerName || (detailsReq.leadSnapshot && detailsReq.leadSnapshot.customerName) || "—"}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Contact</div>
                  <div className="value">{detailsReq.contactPerson || detailsReq.leadSnapshot?.contactPerson || detailsReq.name || "—"} {detailsReq.email ? `· ${detailsReq.email}` : ""}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Phone</div>
                  <div className="value">{detailsReq.phone || detailsReq.leadSnapshot?.phone || "—"}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Delivery Address</div>
                  <div className="value">{detailsReq.deliveryAddress || detailsReq.address || detailsReq.deliveryCity || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Requirement Details</h3>
                  <div className="details-notes">{detailsReq.specialInstructions || detailsReq.requirementDetails || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Items Requested</h3>

                  <table className="items-table" aria-label="Items requested">
                    <thead>
                      <tr>
                        <th className="col-name">Item</th>
                        <th className="col-qty">Qty</th>
                        <th className="col-days">Days</th>
                        <th className="col-start">Start</th>
                        <th className="col-end">End</th>
                        <th className="col-notes">Notes</th>
                        <th className="col-pid">Product ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailsReq.equipment || detailsReq.requirementItems || []).map((it, i) => {
                        const name = it.name || it.itemName || it.productName || "";
                        const qty = it.qty || it.quantity || 1;
                        // FALLBACKS: item-level OR requirement-level
                        const days = it.expectedDurationDays ?? it.days ?? detailsReq?.expectedDurationDays ?? "—";
                        const start = it.expectedStartDate || it.startDate || detailsReq?.expectedStartDate || "";
                        const end = it.expectedEndDate || it.endDate || detailsReq?.expectedEndDate || "";
                        const notes = it.unitNotes || it.notes || "";
                        const productId = it.productId || "";
                        return (
                          <tr key={i}>
                            <td>{name || "—"}</td>
                            <td>{qty}</td>
                            <td>{days ?? "—"}</td>
                            <td className="item-date">{start ? parseDateForDisplay(start) : "—"}</td>
                            <td className="item-date">{end ? parseDateForDisplay(end) : "—"}</td>
                            <td className="item-notes">{notes || "—"}</td>
                            <td>{productId || "—"}</td>
                          </tr>
                        );
                      })}
                      {((detailsReq.equipment || detailsReq.requirementItems || []).length === 0) && (
                        <tr><td colSpan="7" className="muted">No items listed.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="details-row">
                    <div className="label muted">Urgency</div>
                    <div className="value">{detailsReq.urgency || "normal"}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="details-meta">
                  <div className="meta-row">
                    <div className="label muted">Status</div>
                    <div className="value"><span className={`chip ${(detailsReq.status || "").split(" ").map(s => s[0]?.toUpperCase() + s.slice(1)).join("")}`}>{detailsReq.status || "—"}</span></div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Assigned To</div>
                    <div className="value">
                      {detailsReq.assignedToName ? detailsReq.assignedToName : (detailsReq.assignedTo ? detailsReq.assignedTo : "—")}
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Lead</div>
                    <div className="value">{detailsReq.leadId || detailsReq.leadSnapshot?.customerName || "—"}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Delivery Contact</div>
                    <div className="value">{detailsReq.deliveryContact?.name ? `${detailsReq.deliveryContact.name} · ${detailsReq.deliveryContact.phone || ""}` : (detailsReq.deliveryContact?.phone || "—")}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Created</div>
                    <div className="value">{parseDateForDisplay(detailsReq.createdAt)} · {detailsReq.createdByName || detailsReq.createdBy || "—"}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Operations</div>
                    <div className="value">
                      { (detailsReq.status || "").toLowerCase() !== "quotation shared" ? (
                        <button className="cp-btn" onClick={() => openCreateQuotation(detailsReq)}>Create Quotation</button>
                      ) : <div className="muted">Quotation already shared</div> }
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button className="cp-btn ghost" onClick={() => assignToMe(detailsReq)}>Assign to me</button>
                  </div>

                </div>
              </div>
            </div>

            <hr className="hr" />

            <div>
              <h3>Full History</h3>
              <div className="history-list" style={{ marginTop: 8 }}>
                {(detailsReq.history && detailsReq.history.length ? detailsReq.history.slice().reverse() : []).map((h, i) => (
                  <div key={i} className="history-item">
                    <div className="meta">
                      <div className="who"><span className="type">{h.type?.toUpperCase()}</span> {h.field ? `— ${h.field}` : ""}</div>
                      <div className="time muted">{parseDateForDisplay(h.ts)}</div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 700 }}>{h.changedByName || h.changedBy}</div>
                      {h.note ? <div className="note">{h.note}</div> : null}
                      {(h.oldValue || h.newValue) ? (
                        <div className="changes" style={{ marginTop: 10 }}>
                          <div className="change-pill"><div className="k">From</div><div className="v">{h.oldValue ?? "—"}</div></div>
                          <div className="change-pill"><div className="k">To</div><div className="v">{h.newValue ?? "—"}</div></div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(!detailsReq.history || !detailsReq.history.length) && <div className="muted" style={{ padding: 8 }}>No history available.</div>}
              </div>
            </div>

            <div className="details-footer" style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                { (detailsReq.status || "").toLowerCase() !== "quotation shared" && (
                  <button className="cp-btn" onClick={() => changeReqStatus(detailsReq, "quotation shared", "Manual mark as quotation shared")}>Mark Quotation Shared</button>
                ) }
                <button className="cp-btn ghost" onClick={closeDetails}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quotation drawer */}
      {openQuotation && (
        <div className="cp-drawer" onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeQuotation(); }}>
          <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
            <div className="cp-form-head">
              <h2>Quotation for {quotation.requirementId || "—"}</h2>
              <button type="button" className="cp-icon" onClick={closeQuotation}>✕</button>
            </div>

            <div className="quotation-grid">
              <div>
                <div className="cp-field"><label>Quotation No</label><input className="cp-input" value={quotation.quoNo} onChange={(e) => setQuotation(q => ({ ...q, quoNo: e.target.value }))} /></div>
                <div className="cp-field"><label>Quotation ID</label><input className="cp-input" value={quotation.quotationId} onChange={(e) => setQuotation(q => ({ ...q, quotationId: e.target.value }))} /></div>

                <div style={{ marginTop: 10 }}>
                  <h3>Items</h3>
                  <div className="quotation-items">
                    {quotation.items.map((it, idx) => (
                      <div key={it.id} className="quotation-item">
                        <input className="cp-input" placeholder="Item name" value={it.name} onChange={(e) => updateQuotationItem(idx, { name: e.target.value })} />
                        <input className="cp-input" placeholder="Qty" value={it.qty} onChange={(e) => updateQuotationItem(idx, { qty: Number(e.target.value || 0) })} />
                        <input className="cp-input" placeholder="Rate" value={it.rate} onChange={(e) => updateQuotationItem(idx, { rate: Number(e.target.value || 0) })} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="cp-btn ghost" onClick={() => removeQuotationItem(idx)}>Remove</button>
                        </div>

                        <div className="extra-details">
                          Days: {it.days ?? "—"} • Start: {it.expectedStartDate ? parseDateForDisplay(it.expectedStartDate) : "—"} • End: {it.expectedEndDate ? parseDateForDisplay(it.expectedEndDate) : "—"} • Notes: {it.notes || "—"} • Product ID: {it.productId || "—"}
                        </div>
                      </div>
                    ))}

                    <div>
                      <button type="button" className="cp-btn" onClick={addQuotationItem}>+ Add Item</button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3>Notes</h3>
                  <textarea className="cp-input" rows={4} value={quotation.notes} onChange={(e) => setQuotation(q => ({ ...q, notes: e.target.value }))} />
                </div>
              </div>

              <div>
                <div className="quotation-meta">
                  <div className="meta-row"><div className="label muted">Subtotal</div><div className="value">{fmtCurrency(amounts.subtotal)}</div></div>

                  <div className="meta-row">
                    <div className="label muted">Discount</div>
                    <div className="value">
                      <select className="cp-input" value={quotation.discount.type} onChange={(e) => setQuotation(q => ({ ...q, discount: { ...q.discount, type: e.target.value } }))}>
                        <option value="percent">% Percent</option>
                        <option value="fixed">Fixed</option>
                      </select>
                      <input className="cp-input" style={{ marginTop: 8 }} value={quotation.discount.value} onChange={(e) => setQuotation(q => ({ ...q, discount: { ...q.discount, value: Number(e.target.value || 0) } }))} />
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Taxes</div>
                    <div className="value">
                      {(quotation.taxes || []).map((t, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                          <input className="cp-input" value={t.name} onChange={(e) => setQuotation(q => ({ ...q, taxes: q.taxes.map((tt,ii) => ii===i?{...tt,name:e.target.value}:tt) }))} />
                          <input className="cp-input" value={t.rate} onChange={(e) => setQuotation(q => ({ ...q, taxes: q.taxes.map((tt,ii) => ii===i?{...tt,rate:Number(e.target.value||0)}:tt) }))} />
                        </div>
                      ))}
                      <button className="cp-btn ghost" onClick={() => setQuotation(q => ({ ...q, taxes: [ ...(q.taxes||[]), { name: "New Tax", rate: 0 } ] }))} type="button">+ Add Tax</button>
                    </div>
                  </div>

                  <div className="meta-row"><div className="label muted">Discount Amount</div><div className="value">{fmtCurrency(amounts.discountAmount)}</div></div>
                  <div className="meta-row"><div className="label muted">Total Tax</div><div className="value">{fmtCurrency(amounts.totalTax)}</div></div>
                  <div className="meta-row"><div className="label muted">Total</div><div className="value strong">{fmtCurrency(amounts.total)}</div></div>

                  <div style={{ marginTop: 12 }}>
                    <label className="muted">Quotation Status</label>
                    <select className="cp-input" value={quotation.status} onChange={(e) => setQuotation(q => ({ ...q, status: e.target.value }))}>
                      <option value="draft">draft</option>
                      <option value="sent">sent</option>
                      <option value="accepted">accepted</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                    <button className="cp-btn ghost" onClick={closeQuotation}>Cancel</button>
                    <button className="cp-btn primary" onClick={saveQuotation}>Save & Share</button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="cp-modal">
          <div className="cp-modal-card">
            <h3>Delete requirement “{confirmDelete.reqNo || confirmDelete.customerName}”?</h3>
            <p className="muted">This will permanently remove the requirement and its attachments (if any).</p>
            <div className="cp-form-actions">
              <button className="cp-btn ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="cp-btn danger" onClick={() => handleDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
