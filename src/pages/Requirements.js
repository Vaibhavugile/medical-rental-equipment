// src/pages/Requirements.js
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
  getDoc,
} from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import "./Coupons.css";

/*
 Requirements.js
 - list requirements
 - create/edit a requirement (drawer)
 - can be prefilled from a lead via navigation state: navigate('/requirements/new', { state: { lead } })
*/

const emptyItem = () => ({ productId: "", name: "", qty: 1, unit: "pcs", price: 0 });

const defaultReq = {
  id: null,
  leadId: "",
  items: [emptyItem()],
  startDate: "",
  period: { value: 7, unit: "days" },
  deliveryAddress: "",
  notes: "",
  status: "draft",
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

export default function Requirements() {
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultReq);
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // realtime list of requirements
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "requirements"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setReqs(docs);
        setLoading(false);
      },
      (err) => {
        console.error("requirements snapshot err", err);
        setError(err.message || "Failed to load requirements.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // prefill from lead when navigated with state, only when opening new
  useEffect(() => {
    if (location.pathname.endsWith("/new") && location.state && location.state.lead) {
      const lead = location.state.lead;
      setForm((f) => ({
        ...defaultReq,
        leadId: lead.id || "",
        deliveryAddress: lead.address || "",
        notes: `Converted from lead ${lead.customerName || ""} (${lead.contactPerson || ""})`,
        // items left default — user can add
      }));
      setDrawerOpen(true);
    }
  }, [location]);

  // helper: make history entry (client timestamp)
  const makeHistoryEntry = (opts = {}) => {
    const user = auth.currentUser || {};
    return {
      ts: new Date().toISOString(),
      changedBy: user.uid || "unknown",
      changedByName: user.displayName || user.email || user.uid || "unknown",
      type: opts.type || "update",
      field: opts.field || null,
      oldValue: opts.oldValue === undefined ? null : String(opts.oldValue),
      newValue: opts.newValue === undefined ? null : String(opts.newValue),
      note: opts.note || null,
    };
  };

  // open create drawer
  const openCreate = (lead) => {
    const base = { ...defaultReq };
    if (lead) {
      base.leadId = lead.id || "";
      base.deliveryAddress = lead.address || "";
      base.notes = `Converted from lead ${lead.customerName || ""} (${lead.contactPerson || ""})`;
    }
    setForm(base);
    setDrawerOpen(true);
    // navigate to new route optionally so copy/pasting link keeps state (not required)
    navigate("/requirements/new", { state: { lead } });
  };

  // open edit
  const openEdit = (r) => {
    setForm({
      ...r,
      id: r.id,
      // ensure items exist
      items: Array.isArray(r.items) && r.items.length ? r.items : [emptyItem()],
    });
    setDrawerOpen(true);
    navigate(`/requirements/${r.id}`, { replace: true });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setForm(defaultReq);
    // navigate back to /requirements (clear state)
    navigate("/requirements", { replace: true });
  };

  // items operations
  const addItemRow = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItemRow = (index) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  const updateItem = (index, patch) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));

  // compute totals
  const totals = useMemo(() => {
    const subtotal = (form.items || []).reduce((s, it) => s + (Number(it.qty || 0) * Number(it.price || 0)), 0);
    return { subtotal };
  }, [form.items]);

  // save create/update
  const handleSave = async (e) => {
    e?.preventDefault();
    setError("");
    // basic validation
    if (!form.items || !form.items.length) {
      setError("Add at least one item.");
      return;
    }
    setSaving(true);
    try {
      const user = auth.currentUser || {};
      const payload = {
        leadId: form.leadId || "",
        items: form.items.map((it) => ({
          productId: it.productId || "",
          name: it.name || "",
          qty: Number(it.qty || 0),
          unit: it.unit || "pcs",
          price: Number(it.price || 0),
        })),
        startDate: form.startDate || null,
        period: form.period || { value: 7, unit: "days" },
        deliveryAddress: form.deliveryAddress || "",
        notes: form.notes || "",
        status: form.status || "draft",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || user.uid || "",
      };

      if (form.id) {
        // update existing
        // compute a single history entry summarizing update (or break into field-level if needed)
        const entry = makeHistoryEntry({
          type: "update",
          field: null,
          oldValue: null,
          newValue: JSON.stringify({ items: payload.items, startDate: payload.startDate, period: payload.period }),
          note: "Requirement updated",
        });
        const docRef = doc(db, "requirements", form.id);
        await updateDoc(docRef, {
          ...payload,
          history: arrayUnion(entry),
        });
      } else {
        // create new
        const entry = makeHistoryEntry({
          type: "create",
          field: null,
          oldValue: null,
          newValue: JSON.stringify({ items: payload.items }),
          note: "Requirement created",
        });
        await addDoc(collection(db, "requirements"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid || "",
          createdByName: user.displayName || user.email || user.uid || "",
          history: [entry],
        });
      }

      // optional: navigate to requirements list or details
      closeDrawer();
    } catch (err) {
      console.error("save requirement err", err);
      setError(err.message || "Failed to save requirement.");
    } finally {
      setSaving(false);
    }
  };

  // quick helper: convert a lead directly (creates requirement minimal and opens its edit)
  const createFromLeadQuick = async (lead) => {
    try {
      const user = auth.currentUser || {};
      const entry = makeHistoryEntry({
        type: "create",
        note: `Requirement auto-created from lead ${lead.customerName || ""}`,
        field: null,
      });
      const payload = {
        leadId: lead.id || "",
        items: [emptyItem()],
        startDate: null,
        period: { value: 7, unit: "days" },
        deliveryAddress: lead.address || "",
        notes: `Converted from lead ${lead.customerName || ""}`,
        status: "draft",
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || user.uid || "",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || user.uid || "",
        history: [entry],
      };
      const ref = await addDoc(collection(db, "requirements"), payload);
      // open the newly created requirement for editing
      // read doc to get its server timestamps (optional)
      const docSnapshot = await getDoc(doc(db, "requirements", ref.id));
      if (docSnapshot.exists()) {
        const data = { id: ref.id, ...(docSnapshot.data() || {}) };
        openEdit(data);
      } else {
        // fallback: open blank edit pointing to new id
        navigate(`/requirements/${ref.id}`, { state: { id: ref.id } });
      }
    } catch (e) {
      console.error("quick create from lead error", e);
      setError(e.message || "Failed to convert lead to requirement.");
    }
  };

  // simple UI renderers
  return (
    <div className="coupons-wrap">
      <header className="coupons-header">
        <div>
          <h1>📦 Requirements</h1>
          <p>Manage equipment requirements (create from leads, edit, request, convert).</p>
        </div>
        <div className="coupons-actions">
          <button className="cp-btn" onClick={() => openCreate(null)}>+ New Requirement</button>
        </div>
      </header>

      <section className="coupons-toolbar">
        <div className="muted">Showing {reqs.length} requirements</div>
      </section>

      <section className="coupons-card">
        {loading ? (
          <div className="coupons-loading">Loading requirements…</div>
        ) : (
          <div className="tbl-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Items</th>
                  <th>Start</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reqs.map((r) => (
                  <tr key={r.id}>
                    <td className="strong">{r.leadId || "—"}</td>
                    <td className="muted">{(r.items || []).map((it) => `${it.name || it.productId || "item"} x${it.qty}`).join(", ")}</td>
                    <td>{r.startDate ? fmtDate(r.startDate) : "—"}</td>
                    <td>{r.period ? `${r.period.value} ${r.period.unit}` : "—"}</td>
                    <td><span className={`chip ${ (r.status || "draft").charAt(0).toUpperCase() + (r.status || "draft").slice(1)}`}>{r.status}</span></td>
                    <td className="muted">{r.createdAt ? fmtDate(r.createdAt) : "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="cp-link" onClick={() => openEdit(r)}>Edit</button>
                        <button className="cp-link" onClick={() => openEdit(r)}>View</button>
                        <button className="cp-link" onClick={() => console.log("TODO -> create quotation for", r.id)}>Quotation</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!reqs.length && (
                  <tr><td colSpan="7"><div className="empty">No requirements yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Drawer: create / edit */}
      {drawerOpen && (
        <div className="cp-drawer" onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeDrawer(); }}>
          <form className="cp-form details" onSubmit={handleSave}>
            <div className="cp-form-head">
              <h2>{form.id ? "Edit Requirement" : "New Requirement"}</h2>
              <button type="button" className="cp-icon" onClick={closeDrawer}>✕</button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label className="muted">Lead ID</label>
                  <input className="cp-input" value={form.leadId || ""} onChange={(e) => setForm((f) => ({ ...f, leadId: e.target.value }))} />
                </div>

                <div style={{ width: 200 }}>
                  <label className="muted">Start Date</label>
                  <input className="cp-input" type="date" value={form.startDate || ""} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>

                <div style={{ width: 160 }}>
                  <label className="muted">Period</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="cp-input" type="number" min="1" value={form.period?.value || 7} onChange={(e) => setForm((f) => ({ ...f, period: { ...(f.period||{}), value: Number(e.target.value) } }))} />
                    <select className="cp-input" value={form.period?.unit || "days"} onChange={(e) => setForm((f) => ({ ...f, period: { ...(f.period||{}), unit: e.target.value } }))}>
                      <option value="days">days</option>
                      <option value="weeks">weeks</option>
                      <option value="months">months</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="muted">Delivery Address</label>
                <input className="cp-input" value={form.deliveryAddress || ""} onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))} />
              </div>

              <div>
                <label className="muted">Notes</label>
                <textarea className="cp-input" rows={3} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>

              <div>
                <h3 style={{ margin: "8px 0" }}>Items</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {form.items.map((it, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 120px 40px", gap: 8, alignItems: "center" }}>
                      <input className="cp-input" placeholder="Item name or product id" value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} />
                      <input className="cp-input" type="number" min="0" value={it.qty} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })} />
                      <input className="cp-input" placeholder="unit" value={it.unit} onChange={(e) => updateItem(i, { unit: e.target.value })} />
                      <input className="cp-input" type="number" placeholder="price" value={it.price} onChange={(e) => updateItem(i, { price: Number(e.target.value) })} />
                      <button type="button" className="cp-btn ghost" onClick={() => removeItemRow(i)} style={{ padding: "6px 8px" }}>✕</button>
                    </div>
                  ))}
                  <div>
                    <button type="button" className="cp-btn" onClick={addItemRow}>+ Add item</button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <div className="muted">Subtotal</div>
                <div className="strong">₹ {form.items.reduce((s, it) => s + (Number(it.qty||0) * Number(it.price||0)), 0)}</div>
              </div>
            </div>

            {error && <div className="coupons-error" style={{ marginTop: 8 }}>{error}</div>}

            <div className="cp-form-actions" style={{ marginTop: 12 }}>
              <button type="button" className="cp-btn ghost" onClick={closeDrawer} disabled={saving}>Cancel</button>
              <button type="submit" className="cp-btn primary" disabled={saving}>{saving ? "Saving…" : form.id ? "Update Requirement" : "Create Requirement"}</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
