// src/pages/Branches.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./Branches.css";

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", address: "", contact: "", phone: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "branches"), orderBy("name", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBranches(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
        setLoading(false);
      },
      (err) => {
        console.error("branches onSnapshot", err);
        setLoading(false);
        setError(err?.message || "Failed to load branches");
      }
    );
    return () => unsub();
  }, []);

  const startAdd = () => {
    setEditing(null);
    setForm({ name: "", address: "", contact: "", phone: "" });
    setError("");
  };
  const startEdit = (b) => {
    setEditing(b);
    setForm({ name: b.name || "", address: b.address || "", contact: b.contact || "", phone: b.phone || "" });
    setError("");
  };

  const save = async (e) => {
    e?.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Branch name required");
    const user = auth.currentUser || {};
    try {
      if (editing) {
        await updateDoc(doc(db, "branches", editing.id), {
          ...form,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        });
      } else {
        await addDoc(collection(db, "branches"), {
          ...form,
          createdAt: serverTimestamp(),
          createdBy: user.uid || "",
          createdByName: user.displayName || user.email || "",
        });
      }
      setEditing(null);
      setForm({ name: "", address: "", contact: "", phone: "" });
    } catch (err) {
      console.error("save branch", err);
      setError(err.message || "Failed to save branch");
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "branches", b.id));
    } catch (err) {
      console.error("delete branch", err);
      setError(err.message || "Failed to delete branch");
    }
  };

  return (
    <div className="branches-wrap">
      <header className="page-header" style={{ marginBottom: 12 }}>
        <h1>Branches</h1>
        <p className="muted">Manage branches / locations where inventory is stored.</p>
      </header>

      {error && <div className="error" role="alert">{error}</div>}

      <div className="two-column">
        <div className="left-col">
          <div style={{ marginBottom: 10, display: "flex", gap: 8 }}>
            <button className="btn" type="button" onClick={startAdd}>+ New Branch</button>
          </div>

          {loading ? (
            <div>Loading…</div>
          ) : (
            <div className="branches-list">
              {branches.map((b) => (
                <div key={b.id} className="branch-card">
                  <div className="branch-title">{b.name}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{b.address || "—"}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{b.contact ? `${b.contact}${b.phone ? ` · ${b.phone}` : ""}` : (b.phone || "—")}</div>
                  <div className="branch-actions">
                    <button className="btn ghost" type="button" onClick={() => startEdit(b)}>Edit</button>
                    <button className="btn danger" type="button" onClick={() => remove(b)}>Delete</button>
                  </div>
                </div>
              ))}
              {branches.length === 0 && <div className="muted">No branches yet.</div>}
            </div>
          )}
        </div>

        <aside className="right-col">
          <form className="card" onSubmit={save} aria-labelledby="branch-form-title">
            <h3 id="branch-form-title">{editing ? `Edit branch: ${editing.name}` : "New Branch"}</h3>

            <label className="label">Name</label>
            <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />

            <label className="label">Address</label>
            <input value={form.address} onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))} />

            <label className="label">Contact</label>
            <input value={form.contact} onChange={(e) => setForm((s) => ({ ...s, contact: e.target.value }))} />

            <label className="label">Phone</label>
            <input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn" type="submit">Save</button>
              <button className="btn ghost" type="button" onClick={() => { setEditing(null); setForm({ name: "", address: "", contact: "", phone: "" }); }}>Cancel</button>
            </div>
          </form>
        </aside>
      </div>

      <style>{`
        /* small layout helper to mimic previous two-column layout */
        .two-column { display: flex; gap: 20px; margin-top: 12px; }
        .left-col { flex: 1; }
        .right-col { width: 420px; }
        @media (max-width: 880px) {
          .two-column { flex-direction: column; }
          .right-col { width: 100%; }
        }
      `}</style>
    </div>
  );
}
