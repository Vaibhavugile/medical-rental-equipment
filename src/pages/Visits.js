// src/pages/Visits.jsx
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

// --- helpers / constants ---
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
const userNameOf = (u) => u?.displayName || u?.email || u?.phoneNumber || u?.uid || "";
const STATUS_FLOW = ["planned", "started", "reached", "done"]; // 'cancelled' via separate action
const STATUSES = ["planned", "started", "reached", "done", "cancelled"];

const defaultForm = {
  id: null,
  customerName: "",
  phone: "",
  address: "",
  purpose: "",
  relatedLeadId: "",
  status: "planned",

  // assignment / creators
  assignedToId: "",
  assignedToName: "",
  createdBy: "",
  createdByName: "",

  // geo (optional)
  plannedGeoLat: "",
  plannedGeoLng: "",

  notes: "",
  history: [],
};

function makeHistoryEntry(user, { stage, note, meta = {} }) {
  return {
    stage,
    by: user?.uid || "",
    byName: userNameOf(user),
    at: new Date().toISOString(),
    ...(note ? { note } : {}),
    ...meta,
  };
}

export default function Visits() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Status chips filter
  const [statusFilter, setStatusFilter] = useState("all");

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [closing, setClosing] = useState(false);
  const CLOSE_MS = 180;
  const [form, setForm] = useState(defaultForm);

  const [detailsVisit, setDetailsVisit] = useState(null);

  const [statusModal, setStatusModal] = useState({
    open: false,
    visit: null,
    nextStage: null,
    note: "",
  });

  const [cancelModal, setCancelModal] = useState({
    open: false,
    visit: null,
    note: "",
  });

  // Real-time visits listener
  useEffect(() => {
    setLoading(true);
    setError("");
    const qv = query(collection(db, "visits"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qv,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            customerName: data.customerName || "",
            phone: (data.contact?.phone || data.phone || ""),
            address: data.address || "",
            purpose: data.purpose || "",
            relatedLeadId: data.relatedLeadId || "",

            status: data.status || "planned",

            // assignment / creators
            assignedToId: data.assignedToId || "",
            assignedToName: data.assignedToName || "",
            createdBy: data.createdBy || "",
            createdByName: data.createdByName || "",

            // timestamps
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            startedAtMs: data.startedAtMs || null,
            reachedAtMs: data.reachedAtMs || null,
            doneAtMs: data.doneAtMs || null,

            // geo
            plannedGeo: data.plannedGeo || null,
            startedGeo: data.startedGeo || null,
            reachedGeo: data.reachedGeo || null,

            // notes + history
            notes: data.notes || "",
            history: Array.isArray(data.history) ? data.history : [],
          };
        });
        setVisits(docs);
        setLoading(false);
      },
      (err) => {
        console.error("visits onSnapshot error", err);
        setError(err.message || "Failed to load visits.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Search (text filter only)
  const filteredBySearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visits;
    return visits.filter((v) => {
      return (
        (v.customerName || "").toLowerCase().includes(q) ||
        (v.phone || "").toLowerCase().includes(q) ||
        (v.address || "").toLowerCase().includes(q) ||
        (v.purpose || "").toLowerCase().includes(q) ||
        (v.notes || "").toLowerCase().includes(q)
      );
    });
  }, [visits, search]);

  // Status chip counts (based on current search)
  const statusCounts = useMemo(() => {
    const counts = { all: filteredBySearch.length };
    for (const s of STATUSES) counts[s] = 0;
    for (const v of filteredBySearch) {
      const s = String(v.status || "planned").toLowerCase();
      if (counts[s] === undefined) counts[s] = 0;
      counts[s] += 1;
    }
    return counts;
  }, [filteredBySearch]);

  // Apply status chip filter
  const visible = useMemo(() => {
    if (statusFilter === "all") return filteredBySearch;
    const s = statusFilter.toLowerCase();
    return filteredBySearch.filter(v => String(v.status || "planned").toLowerCase() === s);
  }, [filteredBySearch, statusFilter]);

  // Drawer helpers
  const openDrawer = (initial = defaultForm) => {
    // default assignment to current user for “directly created” flow
    const u = auth.currentUser || {};
    const base = {
      assignedToId: u.uid || "",
      assignedToName: userNameOf(u),
      createdBy: u.uid || "",
      createdByName: userNameOf(u),
    };
    setForm({ ...defaultForm, ...base, ...initial });
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

  const editVisit = (v) => {
    openDrawer({
      id: v.id,
      customerName: v.customerName || "",
      phone: v.phone || "",
      address: v.address || "",
      purpose: v.purpose || "",
      relatedLeadId: v.relatedLeadId || "",
      status: v.status || "planned",
      assignedToId: v.assignedToId || "",
      assignedToName: v.assignedToName || "",
      createdBy: v.createdBy || "",
      createdByName: v.createdByName || "",
      plannedGeoLat: v.plannedGeo?.lat ?? "",
      plannedGeoLng: v.plannedGeo?.lng ?? "",
      history: v.history || [],
      notes: v.notes || "",
    });
  };

  // Create or update visit
  const handleSave = async (e) => {
    e?.preventDefault();
    setError("");
    if (!form.customerName.trim() || !form.phone.trim()) {
      setError("Customer and Phone are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customerName: form.customerName.trim(),
        address: form.address?.trim() || "",
        purpose: form.purpose?.trim() || "",
        relatedLeadId: form.relatedLeadId?.trim() || "",
        status: form.status || "planned",

        // assignment/creator
        assignedToId: form.assignedToId || "",
        assignedToName: form.assignedToName || "",
        createdBy: form.createdBy || (auth.currentUser?.uid || ""),
        createdByName: form.createdByName || userNameOf(auth.currentUser),

        // planned geo
        plannedGeo:
          form.plannedGeoLat && form.plannedGeoLng
            ? { lat: Number(form.plannedGeoLat), lng: Number(form.plannedGeoLng) }
            : null,

        // notes
        notes: form.notes?.trim() || "",
      };

      const user = auth.currentUser || {};
      if (form.id) {
        // UPDATE (do not touch createdAt)
        const existing = visits.find((x) => x.id === form.id) || {};
        const changes = [];
        const comparePairs = [
          ["customerName", existing.customerName, payload.customerName],
          ["phone", existing.phone, form.phone?.trim() || ""],
          ["address", existing.address, payload.address],
          ["purpose", existing.purpose, payload.purpose],
          ["relatedLeadId", existing.relatedLeadId, payload.relatedLeadId],
          ["status", existing.status, payload.status],
          ["assignedToId", existing.assignedToId, payload.assignedToId],
          ["assignedToName", existing.assignedToName, payload.assignedToName],
          ["plannedGeoLat", (existing?.plannedGeo?.lat ?? ""), (form.plannedGeoLat ?? "")],
          ["plannedGeoLng", (existing?.plannedGeo?.lng ?? ""), (form.plannedGeoLng ?? "")],
          ["notes", existing.notes || "", payload.notes || ""],
        ];
        for (const [key, oldV, newV] of comparePairs) {
          if (String(oldV ?? "") !== String(newV ?? "")) {
            changes.push(makeHistoryEntry(user, {
              stage: key === "status" ? "status" : "update",
              note: key === "status" ? `Status: ${oldV || "—"} → ${newV || "—"}` : `${key} changed`,
              meta: { oldValue: oldV ?? "—", newValue: newV ?? "—" },
            }));
          }
        }

        const docRef = doc(db, "visits", form.id);
        const meta = { updatedAt: serverTimestamp() };

        if (changes.length > 0) {
          await updateDoc(docRef, {
            ...payload,
            ...meta,
            history: arrayUnion(...changes),
          });
        } else {
          await updateDoc(docRef, { ...payload, ...meta });
        }
      } else {
        // CREATE
        const userForCreate = auth.currentUser || {};
        const createEntry = makeHistoryEntry(userForCreate, {
          stage: "planned",
          note: "Visit created",
        });

        await addDoc(collection(db, "visits"), {
          ...payload,
          contact: { phone: form.phone.trim() },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          history: [createEntry],
        });
      }

      closeDrawer();
    } catch (err) {
      console.error("save visit error", err);
      setError(err.message || "Failed to save visit.");
    } finally {
      setSaving(false);
    }
  };

  // STATUS: next stage
  const openStatusModal = (v) => {
    const cur = (v.status || "planned").toLowerCase();
    const idx = STATUS_FLOW.indexOf(cur);
    const next = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : STATUS_FLOW[Math.max(0, idx)];
    setStatusModal({ open: true, visit: v, nextStage: next, note: "" });
  };
  const closeStatusModal = () => setStatusModal({ open: false, visit: null, nextStage: null, note: "" });

  const confirmStatusChange = async () => {
    const { visit, nextStage, note } = statusModal;
    if (!visit) return closeStatusModal();
    if (!note || !note.trim()) {
      setError("Please provide a note for the status change.");
      return;
    }
    setError("");
    try {
      const user = auth.currentUser || {};
      const entry = makeHistoryEntry(user, { stage: nextStage, note: note.trim() });

      await updateDoc(doc(db, "visits", visit.id), {
        status: nextStage,
        updatedAt: serverTimestamp(),
        history: arrayUnion(entry),
        ...(nextStage === "started" ? { startedAtMs: Date.now() } : {}),
        ...(nextStage === "reached" ? { reachedAtMs: Date.now() } : {}),
        ...(nextStage === "done" ? { doneAtMs: Date.now() } : {}),
      });

      closeStatusModal();
    } catch (err) {
      console.error("confirmStatusChange error", err);
      setError(err.message || "Failed to change visit stage.");
    }
  };

  // STATUS: cancel
  const openCancelModal = (v) => setCancelModal({ open: true, visit: v, note: "" });
  const closeCancelModal = () => setCancelModal({ open: false, visit: null, note: "" });

  const confirmCancel = async () => {
    const { visit, note } = cancelModal;
    if (!visit) return closeCancelModal();
    if (!note || !note.trim()) {
      setError("Please provide a reason for cancellation.");
      return;
    }
    try {
      const user = auth.currentUser || {};
      const entry = makeHistoryEntry(user, { stage: "cancelled", note: note.trim() });

      await updateDoc(doc(db, "visits", visit.id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
        history: arrayUnion(entry),
      });

      closeCancelModal();
    } catch (err) {
      console.error("confirmCancel error", err);
      setError(err.message || "Failed to cancel visit.");
    }
  };

  // Details drawer
  const openDetails = (v) => setDetailsVisit(v);
  const closeDetails = () => setDetailsVisit(null);

  // Delete
  const handleDelete = async (v) => {
    try {
      await deleteDoc(doc(db, "visits", v.id));
    } catch (err) {
      console.error("delete visit error", err);
      setError(err.message || "Failed to delete visit.");
    }
  };

  // lock body scroll when drawers/modals open
  useEffect(() => {
    if (showForm || detailsVisit || statusModal.open || cancelModal.open) document.body.classList.add("coupons-drawer-open");
    else document.body.classList.remove("coupons-drawer-open");
    return () => document.body.classList.remove("coupons-drawer-open");
  }, [showForm, detailsVisit, statusModal.open, cancelModal.open]);

  // esc to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (statusModal.open) closeStatusModal();
        else if (cancelModal.open) closeCancelModal();
        else if (detailsVisit) closeDetails();
        else if (showForm && !closing) closeDrawer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [statusModal, cancelModal, detailsVisit, showForm, closing]);

  if (loading) {
    return (
      <div className="coupons-wrap">
        <div className="coupons-loading">Loading visits…</div>
      </div>
    );
  }

  return (
    <div className="coupons-wrap">
      {error && <div className="coupons-error">{error}</div>}

      <header className="coupons-header">
        <div>
          <h1>📍 Visits</h1>
          <p>Plan and track marketing visits. Update stages and review history.</p>
        </div>
        <div className="coupons-actions">
          <button className="cp-btn" onClick={() => openDrawer(defaultForm)}>+ New Visit</button>
        </div>
      </header>

      {/* Topbar with search + status chips + counts */}
      <section className="coupons-toolbar" style={{ gap: 12, alignItems: "center" }}>
        <input
          className="cp-input"
          placeholder="Search by customer, phone, address, purpose…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />

        {/* Chips row (grid styles from CSS) */}
        <div className="visits-chip-row">
          {[
            { key: "all", label: "All" },
            { key: "planned", label: "Planned" },
            { key: "started", label: "Started" },
            { key: "reached", label: "Reached" },
            { key: "done", label: "Done" },
            { key: "cancelled", label: "Cancelled" },
          ].map(({ key, label }) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                className={`chip ${active ? "is-active" : ""}`}
                onClick={() => setStatusFilter(key)}
                style={{ cursor: "pointer" }}
                title={`Filter: ${label}`}
              >
                {label} <span className="count">({statusCounts[key] ?? 0})</span>
              </button>
            );
          })}
        </div>

        <div className="muted" style={{ whiteSpace: "nowrap" }}>
          Showing {visible.length} of {filteredBySearch.length} (total {visits.length})
        </div>
      </section>

      <section className="coupons-card">
        <div className="tbl-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((v) => (
                <tr key={v.id}>
                  <td className="strong">{v.customerName}</td>
                  <td>{v.phone || "—"}</td>
                  <td className="muted">{v.purpose || "—"}</td>
                  <td>
                    <span className={`chip ${String(v.status || "").split(" ").map(s => s[0]?.toUpperCase() + s.slice(1)).join("")}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="muted">{v.assignedToName || v.assignedToId || "—"}</td>
                  <td className="muted">{v.createdAt ? fmtDate(v.createdAt) : "—"} {v.createdByName ? `· ${v.createdByName}` : ""}</td>
                  <td className="muted">{v.updatedAt ? fmtDate(v.updatedAt) : "—"}</td>
                  <td>
                    <div className="row-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button title="Edit visit" className="row-action-icon" onClick={() => editVisit(v)} style={{ padding: 6 }}>✎</button>
                      <button className="cp-link" onClick={() => setDetailsVisit(v)}>View Details</button>

                      {v.status !== "done" && v.status !== "cancelled" ? (
                        <button className="cp-link next-stage" onClick={() => openStatusModal(v)}>Next Stage →</button>
                      ) : null}

                      {v.status !== "cancelled" && v.status !== "done" ? (
                        <button className="cp-link" onClick={() => setCancelModal({ open: true, visit: v, note: "" })} style={{ color: "#b91c1c" }}>
                          Cancel
                        </button>
                      ) : null}

                      <button title="Delete visit" className="row-action-icon" onClick={() => handleDelete(v)} style={{ padding: 6, color: "#b91c1c" }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan="8"><div className="empty">No visits found.</div></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drawer: create / edit visit */}
      {showForm && (
        <div className={`cp-drawer ${closing ? "closing" : ""}`} onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeDrawer(); }}>
          <form className="cp-form" onSubmit={handleSave}>
            <div className="cp-form-head">
              <h2>{form.id ? "Edit Visit" : "New Visit"}</h2>
              <button type="button" className="cp-icon" onClick={closeDrawer}>✕</button>
            </div>

            <div className="cp-grid">
              <div className="cp-field">
                <label>Customer / Hospital</label>
                <input className="cp-input" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} required />
              </div>

              <div className="cp-field">
                <label>Phone</label>
                <input className="cp-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
              </div>

              <div className="cp-field" style={{ gridColumn: "1 / -1" }}>
                <label>Address</label>
                <input className="cp-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>

              <div className="cp-field" style={{ gridColumn: "1 / -1" }}>
                <label>Purpose</label>
                <input className="cp-input" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
              </div>

              <div className="cp-field">
                <label>Related Lead ID (optional)</label>
                <input className="cp-input" value={form.relatedLeadId} onChange={(e) => setForm((f) => ({ ...f, relatedLeadId: e.target.value }))} />
              </div>

              <div className="cp-field">
                <label>Status</label>
                <select className="cp-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="planned">planned</option>
                  <option value="started">started</option>
                  <option value="reached">reached</option>
                  <option value="done">done</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>

              <div className="cp-field">
                <label>Assigned To (name)</label>
                <input className="cp-input" value={form.assignedToName} onChange={(e) => setForm((f) => ({ ...f, assignedToName: e.target.value }))} />
              </div>

              <div className="cp-field">
                <label>Assigned To (user id)</label>
                <input className="cp-input" value={form.assignedToId} onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))} />
              </div>

              <div className="cp-field">
                <label>Planned Lat</label>
                <input className="cp-input" type="number" step="any" value={form.plannedGeoLat} onChange={(e) => setForm((f) => ({ ...f, plannedGeoLat: e.target.value }))} />
              </div>

              <div className="cp-field">
                <label>Planned Lng</label>
                <input className="cp-input" type="number" step="any" value={form.plannedGeoLng} onChange={(e) => setForm((f) => ({ ...f, plannedGeoLng: e.target.value }))} />
              </div>

              <div className="cp-field" style={{ gridColumn: "1 / -1" }}>
                <label>Notes</label>
                <textarea className="cp-input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </div>

            {/* compact history preview */}
            {form.id && (
              <>
                <hr />
                <h3 style={{ marginTop: 4 }}>Recent history</h3>
                <div style={{ maxHeight: 180, overflowY: "auto", padding: "8px 4px" }}>
                  {(form.history || []).slice().reverse().slice(0, 8).map((h, i) => (
                    <div key={i} style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{(h.stage || "update").toUpperCase()}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{fmtDate(h.at)}</div>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>
                        <span className="muted" style={{ fontWeight: 600 }}>{h.byName || h.by}</span>
                        {h.note ? <div style={{ marginTop: 6 }}>{h.note}</div> : null}
                      </div>
                    </div>
                  ))}
                  {!((form.history || []).length) && (
                    <div className="muted" style={{ padding: 8 }}>No history yet for this visit.</div>
                  )}
                </div>
              </>
            )}

            <div className="cp-form-actions">
              <button type="button" className="cp-btn ghost" onClick={closeDrawer} disabled={saving}>Cancel</button>
              <button className="cp-btn primary" disabled={saving}>{saving ? "Saving…" : form.id ? "Update Visit" : "Create Visit"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Status modal */}
      {statusModal.open && statusModal.visit && (
        <div className="cp-modal" onClick={(e) => { if (e.target.classList.contains("cp-modal")) closeStatusModal(); }}>
          <div className="cp-modal-card">
            <h3>Move visit “{statusModal.visit.customerName}”</h3>
            <p className="muted">From <strong>{statusModal.visit.status}</strong> → <strong>{statusModal.nextStage}</strong></p>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Note</label>
              <textarea value={statusModal.note} onChange={(e) => setStatusModal(s => ({ ...s, note: e.target.value }))} rows={4} className="cp-input" placeholder="What changed? (required)" />
            </div>

            <div className="cp-form-actions" style={{ marginTop: 12 }}>
              <button className="cp-btn ghost" onClick={closeStatusModal}>Cancel</button>
              <button className="cp-btn primary" onClick={confirmStatusChange} disabled={!statusModal.note.trim()}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {cancelModal.open && cancelModal.visit && (
        <div className="cp-modal" onClick={(e) => { if (e.target.classList.contains("cp-modal")) closeCancelModal(); }}>
          <div className="cp-modal-card">
            <h3>Cancel visit “{cancelModal.visit.customerName}”</h3>
            <p className="muted">Please provide a reason.</p>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Reason</label>
              <textarea value={cancelModal.note} onChange={(e) => setCancelModal(s => ({ ...s, note: e.target.value }))} rows={4} className="cp-input" placeholder="Reason for cancelling (required)" />
            </div>

            <div className="cp-form-actions" style={{ marginTop: 12 }}>
              <button className="cp-btn ghost" onClick={closeCancelModal}>Back</button>
              <button className="cp-btn danger" onClick={confirmCancel} disabled={!cancelModal.note.trim()}>Cancel Visit</button>
            </div>
          </div>
        </div>
      )}

      {/* Details drawer (full details + full history) */}
      {detailsVisit && (
        <div className="cp-drawer" onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeDetails(); }}>
          <div className="cp-form details">
            <div className="cp-form-head">
              <h2>Visit Details</h2>
              <button type="button" className="cp-icon" onClick={closeDetails}>✕</button>
            </div>

            <div className="details-grid">
              <div className="details-left">
                <div className="details-row">
                  <div className="label muted">Customer</div>
                  <div className="value strong">{detailsVisit.customerName}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Phone</div>
                  <div className="value">{detailsVisit.phone || "—"}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Address</div>
                  <div className="value">{detailsVisit.address || "—"}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Purpose</div>
                  <div className="value">{detailsVisit.purpose || "—"}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Related Lead</div>
                  <div className="value">{detailsVisit.relatedLeadId || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Notes</h3>
                  <div className="details-notes">{detailsVisit.notes || "—"}</div>
                </div>
              </div>

              <div>
                <div className="details-meta">
                  <div className="meta-row">
                    <div className="label muted">Status</div>
                    <div className="value">
                      <span className={`chip ${String(detailsVisit.status || "").split(" ").map(s => s[0]?.toUpperCase() + s.slice(1)).join("")}`}>
                        {detailsVisit.status}
                      </span>
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Assigned</div>
                    <div className="value">{detailsVisit.assignedToName || detailsVisit.assignedToId || "—"}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Created</div>
                    <div className="value">{fmtDate(detailsVisit.createdAt)} · {detailsVisit.createdByName || detailsVisit.createdBy || "—"}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Last Updated</div>
                    <div className="value">{detailsVisit.updatedAt ? fmtDate(detailsVisit.updatedAt) : "—"}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Stage Timestamps</div>
                    <div className="value" style={{ marginTop: 6 }}>
                      <div>Started: {detailsVisit.startedAtMs ? fmtDate(detailsVisit.startedAtMs) : "—"}</div>
                      <div>Reached: {detailsVisit.reachedAtMs ? fmtDate(detailsVisit.reachedAtMs) : "—"}</div>
                      <div>Done: {detailsVisit.doneAtMs ? fmtDate(detailsVisit.doneAtMs) : "—"}</div>
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Planned Geo</div>
                    <div className="value">
                      {detailsVisit.plannedGeo ? `${detailsVisit.plannedGeo.lat}, ${detailsVisit.plannedGeo.lng}` : "—"}
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Start Geo</div>
                    <div className="value">
                      {detailsVisit.startedGeo ? `${detailsVisit.startedGeo.lat}, ${detailsVisit.startedGeo.lng}` : "—"}
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Reached Geo</div>
                    <div className="value">
                      {detailsVisit.reachedGeo ? `${detailsVisit.reachedGeo.lat}, ${detailsVisit.reachedGeo.lng}` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="hr" />

            <div style={{ marginTop: 8 }}>
              <h3>Full History</h3>
              <div className="history-list" style={{ marginTop: 8 }}>
                {(detailsVisit.history || []).slice().reverse().map((h, i) => (
                  <div key={i} className="history-item">
                    <div className="meta">
                      <div className="who">
                        <span className="type">{(h.stage || "update").toUpperCase()}</span>
                      </div>
                      <div className="time muted">{fmtDate(h.at)}</div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 700 }}>{h.byName || h.by}</div>
                      {h.note ? <div className="note">{h.note}</div> : null}
                      {(h.oldValue !== undefined || h.newValue !== undefined) ? (
                        <div className="changes" style={{ marginTop: 10 }}>
                          <div className="change-pill">
                            <div className="k">From</div>
                            <div className="v">{String(h.oldValue ?? "—")}</div>
                          </div>
                          <div className="change-pill">
                            <div className="k">To</div>
                            <div className="v">{String(h.newValue ?? "—")}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(!detailsVisit.history || !detailsVisit.history.length) && <div className="muted" style={{ padding: 8 }}>No history available.</div>}
              </div>
            </div>

            <div className="details-footer">
              <div />
              <div>
                <button className="cp-btn ghost" onClick={closeDetails}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
