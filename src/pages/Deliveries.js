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
import { makeHistoryEntry, propagateToLead } from "../utils/status";
import "./Deliveries.css";

// Deliveries (Ops) — manages delivery assignments, stage changes, proof uploads
export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState(false);

  // realtime deliveries list
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "deliveries"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setDeliveries(docs);
        setLoading(false);
      },
      (err) => {
        console.error("deliveries snapshot", err);
        setError(err.message || "Failed to load deliveries");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // drivers list (one-time)
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

  const filtered = deliveries.filter((d) => (filter === "all" ? true : (d.status || "assigned") === filter));

  const openDetails = (d) => {
    setSelected(d);
    setError("");
  };
  const closeDetails = () => setSelected(null);

  // Create delivery doc from order (helper used by Orders module as well). Keep idempotent.
  const createDeliveryFromOrder = async (order) => {
    if (!order) return;
    try {
      const payload = {
        orderId: order.id,
        orderNo: order.orderNo || "",
        driverId: order.delivery?.driverId || null,
        driverName: order.delivery?.driverName || null,
        status: order.delivery?.status || "assigned",
        pickupAddress: order.pickupAddress || order.deliveryAddress || "",
        dropAddress: order.deliveryAddress || "",
        items: order.items || [],
        timestamps: {},
        proofPhotos: order.delivery?.proofPhotos || [],
        signature: order.delivery?.signature || null,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || "",
      };
      const ref = await addDoc(collection(db, "deliveries"), payload);
      return ref.id;
    } catch (err) {
      console.error("createDeliveryFromOrder", err);
      setError(err.message || "Failed to create delivery");
      return null;
    }
  };

  const assignDriver = async (deliveryId, driverId) => {
    setAssigning(true);
    setError("");
    try {
      const drv = drivers.find((d) => d.id === driverId) || {};
      await updateDoc(doc(db, "deliveries", deliveryId), {
        driverId: driverId,
        driverName: drv.name || "",
        status: "assigned",
        timestamps: { assignedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
      });

      // optionally, update linked order's delivery object if present
      const snap = await getDocs(collection(db, "deliveries")); // keep minimal — ops may choose different policy

    } catch (err) {
      console.error("assignDriver", err);
      setError(err.message || "Failed to assign driver");
    } finally {
      setAssigning(false);
    }
  };

  const updateDeliveryStage = async (delivery, newStage, note = "") => {
    if (!delivery?.id) return setError("No delivery selected");
    setError("");
    try {
      const dRef = doc(db, "deliveries", delivery.id);
      const historyEntry = { at: new Date(), by: auth.currentUser?.uid || "", stage: newStage, note };
      const updates = {
        status: newStage,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        history: (delivery.history || []).concat([historyEntry]),
      };

      // add timestamp fields for specific stages
      if (newStage === "accepted") updates["timestamps.acceptedAt"] = serverTimestamp();
      if (newStage === "picked_up") updates["timestamps.pickedAt"] = serverTimestamp();
      if (newStage === "delivered") updates["timestamps.deliveredAt"] = serverTimestamp();
      if (newStage === "completed") updates["timestamps.completedAt"] = serverTimestamp();

      await updateDoc(dRef, updates);

      // also propagate status to linked order & requirement/lead
      if (delivery.orderId) {
        try {
          await updateDoc(doc(db, "orders", delivery.orderId), {
            deliveryStatus: newStage,
            deliveryHistory: (delivery.deliveryHistory || []).concat([historyEntry]),
            updatedAt: serverTimestamp(),
          });

          // if linked requirement exists (stored on order), propagate
          const orderSnap = await getDocs(collection(db, "orders")); // keep lightweight: callers may already handle propagation
        } catch (err) {
          console.warn("Failed to update order with delivery stage", err);
        }

        // propagate to lead via requirement if available (best-effort)
        try {
          const deliveriesDoc = await (await import('firebase/firestore')).getDoc(doc(db, 'deliveries', delivery.id));
          const data = deliveriesDoc.exists ? deliveriesDoc.data() : null;
          // if delivery contains requirementId, call propagateToLead
          const reqId = data?.requirementId || data?.requirementId;
          if (reqId) propagateToLead(reqId, 'delivery', delivery.status || '', newStage, note);
        } catch (err) {
          // ignore — this is best-effort
        }
      }
    } catch (err) {
      console.error("updateDeliveryStage", err);
      setError(err.message || "Failed to update delivery stage");
    }
  };

  // proof photo upload helper
  const uploadProofPhoto = async (deliveryId, file) => {
    if (!file || !deliveryId) return;
    setUploading(true);
    setError("");
    try {
      const path = `deliveries/${deliveryId}/${Date.now()}-${file.name}`;
      const sref = storageRef(storage, path);
      const snap = await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      // append URL to delivery.proofPhotos
      await updateDoc(doc(db, "deliveries", deliveryId), {
        proofPhotos: (selected?.proofPhotos || []).concat([{ url, name: file.name, uploadedAt: serverTimestamp() }]),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("uploadProofPhoto", err);
      setError(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  // signature upload (simple photo of signature) — stores URL into delivery.signature
  const uploadSignature = async (deliveryId, file) => {
    if (!file || !deliveryId) return;
    setUploading(true);
    try {
      const path = `deliveries/${deliveryId}/signature-${Date.now()}-${file.name}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      await updateDoc(doc(db, "deliveries", deliveryId), {
        signature: { url, uploadedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("uploadSignature", err);
      setError(err.message || "Failed to upload signature");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="deliveries-wrap">Loading deliveries…</div>;

  return (
    <div className="deliveries-wrap">
      <header className="deliveries-header">
        <h1>Deliveries</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="cp-input">
            <option value="all">All status</option>
            <option value="assigned">Assigned</option>
            <option value="accepted">Accepted</option>
            <option value="picked_up">Picked up</option>
            <option value="in_transit">In transit</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </header>

      {error && <div className="deliveries-error">{error}</div>}

      <div className="deliveries-list">
        <table className="deliveries-table">
          <thead>
            <tr>
              <th>Delivery ID</th>
              <th>Order</th>
              <th>Driver</th>
              <th>Status</th>
              <th>Pickup</th>
              <th>Drop</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <td className="strong">{d.id}</td>
                <td>{d.orderNo || d.orderId || "—"}</td>
                <td>{d.driverName || d.driverId || "—"}</td>
                <td style={{ textTransform: "capitalize" }}>{d.status || "assigned"}</td>
                <td>{d.pickupAddress || "—"}</td>
                <td>{d.dropAddress || "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="cp-link" onClick={() => openDetails(d)}>View</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" className="deliveries-empty">No deliveries found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Details drawer */}
      {selected && (
        <div className="cp-drawer" onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeDetails(); }}>
          <div className="cp-form" onClick={(e) => e.stopPropagation()}>
            <div className="cp-form-head">
              <h2>Delivery — {selected.orderNo || selected.id}</h2>
              <div>
                <button className="cp-btn" onClick={() => closeDetails()}>Close</button>
              </div>
            </div>

            <div className="cp-grid">
              <div>
                <div className="label">Order</div>
                <div className="value">{selected.orderNo || selected.orderId}</div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Pickup</div>
                  <div className="value">{selected.pickupAddress || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Drop</div>
                  <div className="value">{selected.dropAddress || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Items</div>
                  {(selected.items || []).map((it, i) => (
                    <div key={i} style={{ padding: 8, borderBottom: "1px solid #f3f6f9" }}>
                      <div style={{ fontWeight: 700 }}>{it.name || it.productId || "—"}</div>
                      <div className="muted">Qty: {it.qty || 0}</div>
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
                  <div className="label">Delivery Status</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button className="cp-btn ghost" onClick={() => updateDeliveryStage(selected, "accepted")}>Accept</button>
                    <button className="cp-btn ghost" onClick={() => updateDeliveryStage(selected, "picked_up")}>Picked up</button>
                    <button className="cp-btn ghost" onClick={() => updateDeliveryStage(selected, "in_transit")}>In transit</button>
                    <button className="cp-btn ghost" onClick={() => updateDeliveryStage(selected, "delivered")}>Delivered</button>
                    <button className="cp-btn" onClick={() => updateDeliveryStage(selected, "completed")}>Complete</button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Proof Photos</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <input type="file" accept="image/*" onChange={(e) => uploadProofPhoto(selected.id, e.target.files?.[0])} />
                    {uploading && <div className="muted">Uploading…</div>}
                  </div>

                  <div style={{ marginTop: 8 }}>
                    {(selected.proofPhotos || []).map((p, i) => (
                      <div key={i} style={{ padding: 6, borderBottom: "1px solid #f3f6f9" }}>
                        <a href={p.url} target="_blank" rel="noreferrer">{p.name || p.url}</a>
                        <div className="muted">{p.uploadedAt?.seconds ? new Date(p.uploadedAt.seconds * 1000).toLocaleString() : "—"}</div>
                      </div>
                    ))}
                  </div>

                </div>

              </div>

              <div>
                <div className="label">Signature</div>
                <div style={{ marginTop: 8 }}>
                  <input type="file" accept="image/*" onChange={(e) => uploadSignature(selected.id, e.target.files?.[0])} />
                </div>
                {selected.signature && (
                  <div style={{ marginTop: 12 }}>
                    <a href={selected.signature.url} target="_blank" rel="noreferrer">View signature</a>
                  </div>
                )}

                <div style={{ marginTop: 20 }}>
                  <div className="label">Delivery History</div>
                  <div style={{ marginTop: 8 }}>
                    {(selected.history || []).slice().reverse().map((h, i) => (
                      <div key={i} style={{ padding: 8, borderBottom: "1px solid #f3f6f9" }}>
                        <div style={{ fontSize: 13 }}>{h.stage || h.note}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{h.by} • {h.at ? (h.at.seconds ? new Date(h.at.seconds*1000).toLocaleString() : new Date(h.at).toLocaleString()) : ""}</div>
                      </div>
                    ))}
                    {(!selected.history || selected.history.length === 0) && <div className="muted">No events yet.</div>}
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
