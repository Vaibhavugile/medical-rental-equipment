// src/pages/Drivers.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./Drivers.css";

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", vehicle: "", status: "available", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "drivers"), (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openModal = (driver = null) => {
    if (driver) {
      setEditing(driver);
      setForm({
        name: driver.name || "",
        phone: driver.phone || "",
        vehicle: driver.vehicle || "",
        status: driver.status || "available",
        notes: driver.notes || "",
      });
    } else {
      setEditing(null);
      setForm({ name: "", phone: "", vehicle: "", status: "available", notes: "" });
    }
    setModalOpen(true);
  };

  const saveDriver = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await updateDoc(doc(db, "drivers", editing.id), {
          ...form,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || "",
        });
      } else {
        await addDoc(collection(db, "drivers"), {
          ...form,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.uid || "",
        });
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      console.error(err);
      setError("Failed to save driver");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drivers-page">
      <div className="drivers-header">
        <h1>Drivers / Delivery Agents</h1>
        <button className="cp-btn" onClick={() => openModal()}>+ Add Driver</button>
      </div>

      {loading && <div className="muted">Loading drivers…</div>}
      {!loading && drivers.length === 0 && (
        <div className="empty-state">No drivers found. Click “Add Driver” to create one.</div>
      )}

      <div className="drivers-grid">
        {drivers.map((d) => (
          <div key={d.id} className="driver-card">
            <div className="driver-avatar">
              <span>{d.name?.[0]?.toUpperCase() || "?"}</span>
            </div>
            <div className="driver-info">
              <div className="driver-top">
                <h3>{d.name}</h3>
                <span className={`badge ${d.status || "available"}`}>{d.status}</span>
              </div>
              <p className="muted">📞 {d.phone || "No phone"}</p>
              {d.vehicle && <p className="muted">🚐 {d.vehicle}</p>}
              {d.notes && <p className="muted small">{d.notes}</p>}
              <div className="driver-actions">
                <button className="cp-btn ghost" onClick={() => openModal(d)}>Edit</button>
                <button
                  className="cp-btn ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(d, null, 2));
                    alert("Driver info copied!");
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="cp-modal" onClick={() => setModalOpen(false)}>
          <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "Edit Driver" : "Add Driver"}</h2>
            <form onSubmit={saveDriver} className="driver-form">
              <label>Name *</label>
              <input
                className="cp-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <label>Phone *</label>
              <input
                className="cp-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />

              <label>Vehicle</label>
              <input
                className="cp-input"
                value={form.vehicle}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
              />

              <label>Status</label>
              <select
                className="cp-input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>

              <label>Notes</label>
              <textarea
                className="cp-input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              {error && <div className="form-error">{error}</div>}

              <div className="form-actions">
                <button className="cp-btn" type="submit" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Update Driver" : "Create Driver"}
                </button>
                <button className="cp-btn ghost" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
