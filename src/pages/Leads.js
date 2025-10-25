// src/pages/Leads.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./Leads.css";

// Requirement form integration (place RequirementForm.js in src/data)
import RequirementForm from "../data/RequirementForm";

const defaultForm = {
  id: null,
  customerName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  leadSource: "",
  notes: "",
  status: "new",
  createdBy: "",
  createdByName: "",
  history: [],
};

const fmtDate = (ts) => {
  try {
    if (!ts) return "—";
    if (typeof ts === "string") return new Date(ts).toLocaleString();
    if (ts?.toDate) return ts.toDate().toLocaleString();
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
};

// Extended status flow to include 'req shared' and 'lost' terminal states
const STATUS_FLOW = ["new", "contacted", "req shared", "qualified", "converted"];

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [closing, setClosing] = useState(false);
  const CLOSE_MS = 180;
  const [form, setForm] = useState(defaultForm);

  const [confirmDelete, setConfirmDelete] = useState(null);

  const [statusModal, setStatusModal] = useState({
    open: false,
    lead: null,
    nextStatus: null,
    note: "",
  });

  const [detailsLead, setDetailsLead] = useState(null);

  // separate state for the lead used by RequirementForm
  const [reqLead, setReqLead] = useState(null);

  // requirement drawer state
  const [openReq, setOpenReq] = useState(false);

  // Real-time leads listener
  useEffect(() => {
    setLoading(true);
    setError("");
    const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            customerName: data.customerName || "",
            contactPerson: data.contactPerson || "",
            phone: data.phone || "",
            email: data.email || "",
            address: data.address || "",
            leadSource: data.leadSource || "",
            notes: data.notes || "",
            status: data.status || "new",
            createdAt: data.createdAt || null,
            createdBy: data.createdBy || "",
            createdByName: data.createdByName || "",
            updatedAt: data.updatedAt || null,
            updatedBy: data.updatedBy || "",
            updatedByName: data.updatedByName || "",
            history: Array.isArray(data.history) ? data.history : [],
          };
        });
        setLeads(docs);
        setLoading(false);
      },
      (err) => {
        console.error("leads onSnapshot error", err);
        setError(err.message || "Failed to load leads.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      return (
        (l.customerName || "").toLowerCase().includes(q) ||
        (l.contactPerson || "").toLowerCase().includes(q) ||
        (l.phone || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.leadSource || "").toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q)
      );
    });
  }, [leads, search]);

  // Drawer helpers
  const openDrawer = (initial = defaultForm) => {
    setForm(initial);
    setShowForm(true);
  };
  const closeDrawer = () => {
    setClosing(true);
    setTimeout(() => {
      setShowForm(false);
      setClosing(false);
      setForm(defaultForm);
    }, CLOSE_MS);
  };

  const editLead = (l) => {
    openDrawer({
      id: l.id,
      customerName: l.customerName || "",
      contactPerson: l.contactPerson || "",
      phone: l.phone || "",
      email: l.email || "",
      address: l.address || "",
      leadSource: l.leadSource || "",
      notes: l.notes || "",
      status: l.status || "new",
      createdBy: l.createdBy || "",
      createdByName: l.createdByName || "",
      history: l.history || [],
    });
  };

  // Make history entry (client timestamp)
  const makeHistoryEntry = (opts = {}) => {
    const user = auth.currentUser || {};
    return {
      ts: new Date().toISOString(),
      changedBy: user.uid || "unknown",
      changedByName: user.displayName || user.email || user.uid || "unknown",
      type: opts.type || "update",
      field: opts.field || null,
      oldValue: opts.oldValue == null ? null : String(opts.oldValue),
      newValue: opts.newValue == null ? null : String(opts.newValue),
      note: opts.note || null,
    };
  };

  // Create or update lead
  const handleSave = async (e) => {
    e?.preventDefault();
    setError("");
    if (!form.customerName.trim() || !form.contactPerson.trim() || !form.phone.trim()) {
      setError("Customer, Contact and Phone are required.");
      return;
    }
    setSaving(true);
    try {
      const payloadFields = {
        customerName: form.customerName.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || "",
        address: form.address?.trim() || "",
        leadSource: form.leadSource?.trim() || "",
        notes: form.notes?.trim() || "",
        status: form.status || "new",
      };

      const user = auth.currentUser || {};
      if (form.id) {
        // UPDATE: don't touch createdAt; compute changes and append history
        const existing = leads.find((x) => x.id === form.id) || {};
        const changes = [];
        const keys = ["customerName","contactPerson","phone","email","address","leadSource","notes","status"];
        for (const key of keys) {
          const oldV = existing[key] ?? "";
          const newV = payloadFields[key] ?? "";
          if (String(oldV) !== String(newV)) {
            changes.push(makeHistoryEntry({
              type: key === "status" ? "status" : "update",
              field: key,
              oldValue: oldV,
              newValue: newV,
              note: key === "notes" ? (payloadFields.notes || "") : null,
            }));
          }
        }

        const docRef = doc(db, "leads", form.id);
        const meta = {
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || user.uid || "",
        };

        if (changes.length > 0) {
          await updateDoc(docRef, {
            ...payloadFields,
            ...meta,
            history: arrayUnion(...changes),
          });
        } else {
          // still update meta even if no other field changed (optional)
          await updateDoc(docRef, {
            ...payloadFields,
            ...meta,
          });
        }
      } else {
        // CREATE: store createdBy and initial history (no assignedTo input)
        const createEntry = makeHistoryEntry({
          type: "create",
          field: null,
          oldValue: null,
          newValue: JSON.stringify({
            customerName: payloadFields.customerName,
            contactPerson: payloadFields.contactPerson,
            phone: payloadFields.phone,
          }),
          note: "Lead created",
        });

        await addDoc(collection(db, "leads"), {
          ...payloadFields,
          createdAt: serverTimestamp(),
          createdBy: user.uid || "",
          createdByName: user.displayName || user.email || user.uid || "",
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || user.uid || "",
          history: [createEntry],
        });
      }

      closeDrawer();
    } catch (err) {
      console.error("save lead error", err);
      setError(err.message || "Failed to save lead.");
    } finally {
      setSaving(false);
    }
  };

  // Open status modal (ask for note)
  const openStatusModal = (lead) => {
    const cur = lead.status || "new";
    const idx = STATUS_FLOW.indexOf(cur);
    const next = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : STATUS_FLOW[Math.max(0, idx)];
    setStatusModal({ open: true, lead, nextStatus: next, note: "" });
  };
  const closeStatusModal = () => setStatusModal({ open: false, lead: null, nextStatus: null, note: "" });

  const confirmStatusChange = async () => {
    const { lead, nextStatus, note } = statusModal;
    if (!lead) return closeStatusModal();
    if (!note || !note.trim()) {
      setError("Please provide a note for the status change.");
      return;
    }
    setError("");
    try {
      const user = auth.currentUser || {};
      const entry = makeHistoryEntry({
        type: "status",
        field: "status",
        oldValue: lead.status,
        newValue: nextStatus,
        note: note.trim(),
      });

      await updateDoc(doc(db, "leads", lead.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || user.uid || "",
        history: arrayUnion(entry),
      });

      closeStatusModal();
    } catch (err) {
      console.error("confirmStatusChange error", err);
      setError(err.message || "Failed to change status.");
    }
  };

  // Details drawer
  const openDetails = (lead) => setDetailsLead(lead);
  const closeDetails = () => setDetailsLead(null);

  // Delete
  const handleDelete = async (l) => {
    try {
      await deleteDoc(doc(db, "leads", l.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error("delete error", err);
      setError(err.message || "Failed to delete lead.");
    }
  };

  // lock body scroll when drawer/modal open
  useEffect(() => {
    if (showForm || detailsLead || statusModal.open || openReq) document.body.classList.add("coupons-drawer-open");
    else document.body.classList.remove("coupons-drawer-open");
    return () => document.body.classList.remove("coupons-drawer-open");
  }, [showForm, detailsLead, statusModal.open, openReq]);

  // esc to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (statusModal.open) closeStatusModal();
        else if (detailsLead) closeDetails();
        else if (showForm && !closing) closeDrawer();
        else if (openReq) setOpenReq(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [statusModal, detailsLead, showForm, closing, openReq]);

  if (loading) {
    return (
      <div className="coupons-wrap">
        <div className="coupons-loading">Loading leads…</div>
      </div>
    );
  }

  return (
    <div className="coupons-wrap">
      {error && <div className="coupons-error">{error}</div>}

      <header className="coupons-header">
        <div>
          <h1>📋 Leads</h1>
          <p>Capture basic lead info. Convert when the lead is qualified.</p>
        </div>
        <div className="coupons-actions">
          <button className="cp-btn" onClick={() => openDrawer(defaultForm)}>+ New Lead</button>
          <button
            className="cp-btn primary"
            onClick={() => {
              // open requirement form without opening details drawer
              setDetailsLead(null);
              setReqLead(null);
              setOpenReq(true);
            }}
          >
            + Create Requirement
          </button>
        </div>
      </header>

      <section className="coupons-toolbar">
        <input className="cp-input" placeholder="Search by customer, contact, phone, source…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="muted">Showing {filtered.length} of {leads.length}</div>
      </section>

      <section className="coupons-card">
        <div className="tbl-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td className="strong">{l.customerName}</td>
                  <td className="muted">{l.contactPerson}{l.email ? ` · ${l.email}` : ""}</td>
                  <td>{l.phone}</td>
                  <td className="muted">{l.leadSource || "—"}</td>
                  <td><span className={`chip ${(l.status || "").split(" ").map(s => s[0]?.toUpperCase() + s.slice(1)).join("")}`}>{l.status}</span></td>
                  <td className="muted">{l.createdByName || l.createdBy || "—"}</td>
                  <td className="muted">{l.updatedAt ? fmtDate(l.updatedAt) : (l.createdAt ? fmtDate(l.createdAt) : "—")} {l.updatedByName ? `· ${l.updatedByName}` : ""}</td>
                  <td>
                    <div className="row-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {/* small edit icon */}
                      <button title="Edit lead" className="row-action-icon" onClick={() => editLead(l)} style={{ padding: 6, borderRadius: 6, border: "1px solid rgba(0,0,0,0.04)", background: "#fff" }}>
                        ✎
                      </button>

                      {/* Create Requirement per-row (ONLY for qualified leads) */}
                      { (l.status || "").toLowerCase() === "qualified" ? (
                        <button
                          title="Create Requirement"
                          className="cp-link"
                          onClick={() => { setReqLead(l); setDetailsLead(null); setOpenReq(true); }}
                          style={{ padding: "6px 8px", borderRadius: 6, background: "#f3f4f6", border: "none", fontWeight: 700 }}
                        >
                          + Req
                        </button>
                      ) : null }

                      {/* view details */}
                      <button className="cp-link" onClick={() => openDetails(l)}>View Details</button>

                      {/* next stage */}
                      <button className="cp-link next-stage" onClick={() => openStatusModal(l)}>Next Stage →</button>

                      {/* small delete icon */}
                      <button title="Delete lead" className="row-action-icon" onClick={() => setConfirmDelete(l)} style={{ padding: 6, borderRadius: 6, border: "1px solid rgba(0,0,0,0.04)", background: "#fff", color: "#b91c1c" }}>
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan="8"><div className="empty">No leads found.</div></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drawer: create / edit lead */}
      {showForm && (
        <div className={`cp-drawer ${closing ? "closing" : ""}`} onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeDrawer(); }}>
          <form className="cp-form" onSubmit={handleSave}>
            <div className="cp-form-head">
              <h2>{form.id ? "Edit Lead" : "New Lead"}</h2>
              <button type="button" className="cp-icon" onClick={closeDrawer}>✕</button>
            </div>

            <div className="cp-grid">
              <div className="cp-field">
                <label>Customer / Hospital</label>
                <input className="cp-input" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} required />
              </div>

              <div className="cp-field">
                <label>Contact Person</label>
                <input className="cp-input" value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} required />
              </div>

              <div className="cp-field">
                <label>Phone</label>
                <input className="cp-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
              </div>

              <div className="cp-field">
                <label>Email</label>
                <input className="cp-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>

              <div className="cp-field">
                <label>Address / City</label>
                <input className="cp-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>

              <div className="cp-field">
                <label>Lead Source</label>
                <input className="cp-input" value={form.leadSource} onChange={(e) => setForm((f) => ({ ...f, leadSource: e.target.value }))} />
              </div>

              <div className="cp-field" style={{ gridColumn: "1 / -1" }}>
                <label>Notes</label>
                <textarea className="cp-input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>

              <div className="cp-field">
                <label>Status</label>
                <select className="cp-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="new">new</option>
                  <option value="contacted">contacted</option>
                  <option value="qualified">qualified</option>
                  <option value="lost">lost</option>
                  <option value="converted">converted</option>
                  <option value="req shared">req shared</option>
                </select>
              </div>

              <div className="cp-field">
                <label>Created By</label>
                <input className="cp-input" value={form.createdByName || form.createdBy || ""} readOnly />
                <small className="muted">Automatically recorded</small>
              </div>
            </div>

            {/* compact history preview */}
            {form.id && (
              <>
                <hr />
                <h3 style={{ marginTop: 4 }}>Recent history</h3>
                <div style={{ maxHeight: 180, overflowY: "auto", padding: "8px 4px" }}>
                  {(form.history && form.history.length ? form.history : (leads.find(x => x.id === form.id)?.history || [])).slice().reverse().slice(0, 8).map((h, i) => (
                    <div key={i} style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{h.type?.toUpperCase() || "UPDATE"} {h.field ? `— ${h.field}` : ""}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{fmtDate(h.ts)}</div>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>
                        <span className="muted" style={{ fontWeight: 600 }}>{h.changedByName || h.changedBy}</span>
                        {h.note ? <div style={{ marginTop: 6 }}>{h.note}</div> : null}
                      </div>
                    </div>
                  ))}
                  {!((form.history && form.history.length) || (leads.find(x => x.id === form.id)?.history || []).length) && (
                    <div className="muted" style={{ padding: 8 }}>No history yet for this lead.</div>
                  )}
                </div>
              </>
            )}

            <div className="cp-form-actions">
              <button type="button" className="cp-btn ghost" onClick={closeDrawer} disabled={saving}>Cancel</button>
              <button className="cp-btn primary" disabled={saving}>{saving ? "Saving…" : form.id ? "Update Lead" : "Create Lead"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Status modal */}
      {statusModal.open && statusModal.lead && (
        <div className="cp-modal" onClick={(e) => { if (e.target.classList.contains("cp-modal")) closeStatusModal(); }}>
          <div className="cp-modal-card">
            <h3>Change status for “{statusModal.lead.customerName}”</h3>
            <p className="muted">From <strong>{statusModal.lead.status}</strong> → <strong>{statusModal.nextStatus}</strong></p>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Note / Reason</label>
              <textarea value={statusModal.note} onChange={(e) => setStatusModal(s => ({ ...s, note: e.target.value }))} rows={4} className="cp-input" placeholder="Enter a note explaining the status change (required)"></textarea>
            </div>

            <div className="cp-form-actions" style={{ marginTop: 12 }}>
              <button className="cp-btn ghost" onClick={closeStatusModal}>Cancel</button>
              <button className="cp-btn primary" onClick={confirmStatusChange} disabled={!statusModal.note.trim()}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Details drawer (full details + full history) */}
      {detailsLead && (
        <div className="cp-drawer" onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeDetails(); }}>
          <div className="cp-form details">
            <div className="cp-form-head">
              <h2>Lead Details</h2>
              <button type="button" className="cp-icon" onClick={closeDetails}>✕</button>
            </div>

            <div className="details-grid">
              <div className="details-left">
                <div className="details-row">
                  <div className="label muted">Customer</div>
                  <div className="value strong">{detailsLead.customerName}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Contact</div>
                  <div className="value">{detailsLead.contactPerson}{detailsLead.email ? ` · ${detailsLead.email}` : ""}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Phone</div>
                  <div className="value">{detailsLead.phone}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Address</div>
                  <div className="value">{detailsLead.address || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Notes</h3>
                  <div className="details-notes">{detailsLead.notes || "—"}</div>
                </div>
              </div>

              <div>
                <div className="details-meta">
                  <div className="meta-row">
                    <div className="label muted">Status</div>
                    <div className="value"><span className={`chip ${(detailsLead.status || "").split(" ").map(s => s[0]?.toUpperCase() + s.slice(1)).join("")}`}>{detailsLead.status}</span></div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Lead Source</div>
                    <div className="value">{detailsLead.leadSource || "—"}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Created</div>
                    <div className="value">{fmtDate(detailsLead.createdAt)} · {detailsLead.createdByName || detailsLead.createdBy || "—"}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Last Updated</div>
                    <div className="value">{detailsLead.updatedAt ? `${fmtDate(detailsLead.updatedAt)} · ${detailsLead.updatedByName || detailsLead.updatedBy}` : "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="hr" />

            <div style={{ marginTop: 8 }}>
              <h3>Full History</h3>
              <div className="history-list" style={{ marginTop: 8 }}>
                {(detailsLead.history && detailsLead.history.length ? detailsLead.history.slice().reverse() : []).map((h, i) => (
                  <div key={i} className="history-item">
                    <div className="meta">
                      <div className="who">
                        <span className="type">{h.type?.toUpperCase()}</span>
                        {h.field ? `${h.field}` : ""}
                      </div>
                      <div className="time muted">{fmtDate(h.ts)}</div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 700 }}>{h.changedByName || h.changedBy}</div>
                      {h.note ? <div className="note">{h.note}</div> : null}

                      {(h.oldValue || h.newValue) ? (
                        <div className="changes" style={{ marginTop: 10 }}>
                          <div className="change-pill">
                            <div className="k">From</div>
                            <div className="v">{h.oldValue ?? "—"}</div>
                          </div>
                          <div className="change-pill">
                            <div className="k">To</div>
                            <div className="v">{h.newValue ?? "—"}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(!detailsLead.history || !detailsLead.history.length) && <div className="muted" style={{ padding: 8 }}>No history available.</div>}
              </div>
            </div>

            <div className="details-footer" style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {/* Open requirement form for this lead ONLY if it's qualified */}
                { (detailsLead.status || "").toLowerCase() === "qualified" ? (
                  <button className="cp-btn" onClick={() => { setReqLead(detailsLead); setOpenReq(true); }}>Create Requirement</button>
                ) : null }
              </div>
              <div>
                <button className="cp-btn ghost" onClick={closeDetails}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requirement drawer (opens when Create Requirement clicked) */}
      {openReq && (
        <RequirementForm
          lead={reqLead || detailsLead || { id: "", customerName: "", contactPerson: "", phone: "", address: "" }}
          onCancel={() => { setOpenReq(false); setReqLead(null); }}
          onSaved={() => {
            // Close requirement drawer, then update the lead's status to "req shared" (if we have a lead)
            setOpenReq(false);
            const leadToUse = reqLead || detailsLead;
            setReqLead(null);
            if (leadToUse && leadToUse.id) {
              const user = auth.currentUser || {};
              const entry = makeHistoryEntry({
                type: "status",
                field: "status",
                oldValue: leadToUse.status,
                newValue: "req shared",
                note: "Requirement created and shared",
              });
              updateDoc(doc(db, "leads", leadToUse.id), {
                status: "req shared",
                updatedAt: serverTimestamp(),
                updatedBy: user.uid || "",
                updatedByName: user.displayName || user.email || "",
                history: arrayUnion(entry),
              }).catch((e) => console.error("set req shared status error", e));
            }
          }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="cp-modal">
          <div className="cp-modal-card">
            <h3>Delete lead “{confirmDelete.customerName}”?</h3>
            <p className="muted">This will permanently remove the lead.</p>
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
