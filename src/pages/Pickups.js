import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebase";
import { listAssets, checkinAsset } from "../utils/inventory";
import { makeHistoryEntry, propagateToLead } from "../utils/status";
import "./Pickups.css";

export default function Pickups() {
  const [pickups, setPickups] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "pickups"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPickups(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
        setLoading(false);
      },
      (err) => {
        console.error("pickups snapshot", err);
        setError(err.message || "Failed to load pickups");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "drivers"));
        setDrivers(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      } catch (err) {
        console.warn("Failed to load drivers", err);
      }
    })();
  }, []);

  const filtered = pickups.filter((p) => (filter === "all" ? true : (p.status || "assigned") === filter));

  const openDetails = (p) => { setSelected(p); setError(""); };
  const closeDetails = () => setSelected(null);

  const assignDriver = async (pickupId, driverId) => {
    setAssigning(true);
    setError("");
    try {
      const drv = drivers.find((d) => d.id === driverId) || {};
      await updateDoc(doc(db, "pickups", pickupId), {
        driverId,
        driverName: drv.name || "",
        status: "assigned",
        timestamps: { assignedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
      });
    } catch (err) {
      console.error("assignDriver", err);
      setError(err.message || "Failed to assign driver");
    } finally {
      setAssigning(false);
    }
  };

  const updatePickupStage = async (pickup, newStage, note = "") => {
    if (!pickup?.id) return setError("No pickup selected");
    setError("");
    try {
      const pRef = doc(db, "pickups", pickup.id);
      const hist = { at: new Date(), by: auth.currentUser?.uid || "", stage: newStage, note };
      const updates = {
        status: newStage,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        history: (pickup.history || []).concat([hist]),
      };
      if (newStage === "collected") updates["timestamps.collectedAt"] = serverTimestamp();
      if (newStage === "returned") updates["timestamps.returnedAt"] = serverTimestamp();
      if (newStage === "completed") updates["timestamps.completedAt"] = serverTimestamp();

      await updateDoc(pRef, updates);

      // when completed, perform asset check-ins if items reference assets
      if (newStage === "completed" && Array.isArray(pickup.items)) {
        for (const it of pickup.items) {
          const ids = it.assignedAssets || [];
          for (const aid of ids) {
            try {
              await checkinAsset(aid, { note: `Checked in via pickup ${pickup.id}` });
            } catch (err) {
              console.warn("checkinAsset failed", aid, err);
            }
          }
        }
      }

      // propagate to order/requirement/lead if available
      if (pickup.orderId && pickup.orderId.length) {
        try {
          await updateDoc(doc(db, "orders", pickup.orderId), { pickupStatus: newStage, updatedAt: serverTimestamp() });
        } catch (err) { console.warn("update order pickup status failed", err); }

        try {
          // best-effort: if pickup contains requirementId
          const pSnap = await (await import('firebase/firestore')).getDoc(doc(db, 'pickups', pickup.id));
          const data = pSnap.exists ? pSnap.data() : null;
          const reqId = data?.requirementId || data?.requirementId;
          if (reqId) propagateToLead(reqId, 'pickup', pickup.status || '', newStage, note);
        } catch (err) { /* ignore */ }
      }
    } catch (err) {
      console.error("updatePickupStage", err);
      setError(err.message || "Failed to update pickup stage");
    }
  };

  const uploadPickupPhoto = async (pickupId, file) => {
    if (!file || !pickupId) return;
    setUploading(true);
    setError("");
    try {
      const path = `pickups/${pickupId}/${Date.now()}-${file.name}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      await updateDoc(doc(db, "pickups", pickupId), {
        photos: (selected?.photos || []).concat([{ url, name: file.name, uploadedAt: serverTimestamp() }]),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("uploadPickupPhoto", err);
      setError(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  // optional: inspect assets available for product during pickup (for ops view)
  const listAvailableAssetsForProduct = async (productId, branchId = null) => {
    try {
      return await listAssets({ productId, branchId, status: "in_stock" });
    } catch (err) {
      console.warn("listAssets failed", err);
      return [];
    }
  };

  if (loading) return <div className="pickups-wrap">Loading pickups…</div>;

  return (
    <div className="pickups-wrap">
      <header className="pickups-header">
        <h1>Pickups</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="cp-input">
            <option value="all">All status</option>
            <option value="assigned">Assigned</option>
            <option value="collected">Collected</option>
            <option value="returned">Returned</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </header>

      {error && <div className="pickups-error">{error}</div>}

      <div className="pickups-list">
        <table className="pickups-table">
          <thead>
            <tr>
              <th>Pickup ID</th>
              <th>Order</th>
              <th>Driver</th>
              <th>Status</th>
              <th>Pickup Address</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="strong">{p.id}</td>
                <td>{p.orderNo || p.orderId || "—"}</td>
                <td>{p.driverName || p.driverId || "—"}</td>
                <td style={{ textTransform: "capitalize" }}>{p.status || "assigned"}</td>
                <td>{p.pickupAddress || "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="cp-link" onClick={() => openDetails(p)}>View</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="6" className="pickups-empty">No pickups found.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="cp-drawer" onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeDetails(); }}>
          <div className="cp-form" onClick={(e) => e.stopPropagation()}>
            <div className="cp-form-head">
              <h2>Pickup — {selected.orderNo || selected.id}</h2>
              <div>
                <button className="cp-btn" onClick={() => closeDetails()}>Close</button>
              </div>
            </div>

            <div className="cp-grid">
              <div>
                <div className="label">Order</div>
                <div className="value">{selected.orderNo || selected.orderId}</div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Pickup Address</div>
                  <div className="value">{selected.pickupAddress || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Items to collect</div>
                  {(selected.items || []).map((it, i) => (
                    <div key={i} style={{ padding: 8, borderBottom: "1px solid #f3f6f9" }}>
                      <div style={{ fontWeight: 700 }}>{it.name || it.productId || "—"}</div>
                      <div className="muted">Qty: {it.qty || 0}</div>
                      {(it.assignedAssets || []).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div className="muted">Assigned assets:</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                            {it.assignedAssets.map((aid) => (
                              <div key={aid} className="asset-card">
                                <div style={{ fontWeight: 700 }}>{aid}</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button className="cp-btn ghost" onClick={async () => { try { await checkinAsset(aid, { note: `Checkin performed manually from pickups UI` }); alert('Checked in'); } catch (err) { console.warn(err); alert('Failed'); } }}>Check-in</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Assign Driver</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select defaultValue={selected.driverId || ""} onChange={(e) => setSelected((s) => ({ ...s, driverId: e.target.value }))} className="cp-input">
                      <option value="">Select driver</option>
                      {drivers.map((dr) => <option key={dr.id} value={dr.id}>{dr.name} {dr.phone ? `· ${dr.phone}` : ""}</option>)}
                    </select>
                    <button className="cp-btn" onClick={() => assignDriver(selected.id, selected.driverId)} disabled={assigning || !selected.driverId}>Assign</button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Pickup Status</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="cp-btn ghost" onClick={() => updatePickupStage(selected, "collected")}>Collected</button>
                    <button className="cp-btn ghost" onClick={() => updatePickupStage(selected, "returned")}>Returned</button>
                    <button className="cp-btn" onClick={() => updatePickupStage(selected, "completed")}>Complete</button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Condition Notes</div>
                  <textarea className="cp-input" rows={4} value={selected.conditionNotes || ""} onChange={(e) => setSelected((s) => ({ ...s, conditionNotes: e.target.value }))} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="cp-btn" onClick={async () => { try { await updateDoc(doc(db, "pickups", selected.id), { conditionNotes: selected.conditionNotes || "", updatedAt: serverTimestamp() }); alert('Saved'); } catch (err) { console.warn(err); setError('Save failed'); } }}>Save Notes</button>
                    <input type="file" accept="image/*" onChange={(e) => uploadPickupPhoto(selected.id, e.target.files?.[0])} />
                    {uploading && <div className="muted">Uploading…</div>}
                  </div>
                </div>

              </div>

              <div>
                <div className="label">Photos</div>
                <div style={{ marginTop: 8 }}>
                  {(selected.photos || []).map((p, i) => (
                    <div key={i} style={{ padding: 6, borderBottom: "1px solid #f3f6f9" }}>
                      <a href={p.url} target="_blank" rel="noreferrer">{p.name || p.url}</a>
                      <div className="muted">{p.uploadedAt?.seconds ? new Date(p.uploadedAt.seconds * 1000).toLocaleString() : "—"}</div>
                    </div>
                  ))}
                  {(!selected.photos || selected.photos.length === 0) && <div className="muted">No photos yet.</div>}
                </div>

                <div style={{ marginTop: 20 }}>
                  <div className="label">Pickup History</div>
                  <div style={{ marginTop: 8 }}>
                    {(selected.history || []).slice().reverse().map((h, i) => (
                      <div key={i} style={{ padding: 8, borderBottom: "1px solid #f3f6f9" }}>
                        <div style={{ fontSize: 13 }}>{h.stage || h.note}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{h.by} • {h.at ? (h.at.seconds ? new Date(h.at.seconds*1000).toLocaleString() : new Date(h.at).toLocaleString()) : ""}</div>
                      </div>
                    ))}
                    {(!selected.history || selected.history.length === 0) && <div className="muted">No events.</div>}
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
