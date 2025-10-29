// src/components/DriverApp.js
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./DriverApp.css";

/**
 * Helper to format Firestore Timestamp / ISO string / Date / number
 */
function formatTimestampToLocale(t) {
  if (!t) return "";
  // Firestore Timestamp object
  if (typeof t === "object" && t !== null && (t.seconds || t.nanoseconds)) {
    try {
      return new Date(t.seconds * 1000).toLocaleString();
    } catch (e) {
      // fallback
    }
  }
  // Firestore may return a Date
  if (t instanceof Date) return t.toLocaleString();
  // ISO string
  if (typeof t === "string") {
    try {
      const d = new Date(t);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    } catch (e) {}
  }
  // number (ms)
  if (typeof t === "number") {
    try {
      return new Date(t).toLocaleString();
    } catch (e) {}
  }
  return String(t);
}

/**
 * Simple totals calc compatible with Orders.js behaviour
 */
function calcTotals(items = [], discount = { type: "percent", value: 0 }, taxes = []) {
  const subtotal = (items || []).reduce((s, it) => {
    const q = Number(it?.qty || 0);
    const r = Number(it?.rate || 0);
    return s + q * r;
  }, 0);

  let discountAmount = 0;
  try {
    if (discount && Number(discount.value)) {
      if ((discount.type || "").toLowerCase() === "percent") {
        discountAmount = subtotal * (Number(discount.value) / 100);
      } else {
        discountAmount = Number(discount.value || 0);
      }
    }
  } catch (e) {
    discountAmount = 0;
  }
  discountAmount = Number(discountAmount.toFixed(2));
  const taxableAmount = Math.max(0, subtotal - discountAmount);

  const taxBreakdown = (taxes || []).map((t) => {
    const tType = ((t.type || "percent") + "").toLowerCase();
    const tValue = Number(t.value ?? t.rate ?? 0);
    let amount = 0;
    if (tType === "percent") amount = taxableAmount * (tValue / 100);
    else amount = tValue;
    return {
      id: t.id || t.name || "",
      name: t.name || "",
      value: tValue,
      amount: Number((amount || 0).toFixed(2)),
    };
  });
  const totalTax = taxBreakdown.reduce((s, tt) => s + Number(tt.amount || 0), 0);
  const total = Number((taxableAmount + totalTax).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount: discountAmount,
    taxes: taxBreakdown,
    totalTax: Number(totalTax.toFixed(2)),
    total,
  };
}

export default function DriverApp() {
  const [user, setUser] = useState(auth.currentUser || null);
  const [driver, setDriver] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchesMap, setBranchesMap] = useState({}); // branchId -> branch doc

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  // Load branches map
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "branches"));
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() || {}) };
        });
        setBranchesMap(map);
      } catch (err) {
        console.warn("Failed to load branches:", err);
      }
    })();
  }, []);

  // Fetch driver record by auth uid/email
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const q1 = query(collection(db, "drivers"), where("authUid", "==", user.uid));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
          setDriver({ id: snap1.docs[0].id, ...snap1.docs[0].data() });
          return;
        }
        const q2 = query(collection(db, "drivers"), where("loginEmail", "==", user.email));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          setDriver({ id: snap2.docs[0].id, ...snap2.docs[0].data() });
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load driver profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Subscribe to deliveries for this driver and enrich with order + payments + stores
  useEffect(() => {
    if (!driver) return;
    setLoading(true);
    const q = query(collection(db, "deliveries"), where("driverId", "==", driver.id));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          const out = [];
          for (const d of snap.docs) {
            const del = { id: d.id, ...(d.data() || {}) };

            // fetch order doc if linked
            if (del.orderId) {
              const oSnap = await getDoc(doc(db, "orders", del.orderId));
              if (oSnap.exists()) {
                const orderData = { id: oSnap.id, ...(oSnap.data() || {}) };

                // fetch payments subcollection (Orders page uses subcollection)
                try {
                  const paymentsSnap = await getDocs(collection(db, "orders", orderData.id, "payments"));
                  const payments = paymentsSnap.docs.map((p) => ({ id: p.id, ...(p.data() || {}) }));
                  orderData.payments = payments;
                } catch (err) {
                  console.warn("Failed to fetch payments for order", orderData.id, err);
                  orderData.payments = orderData.payments || [];
                }

                // compute totals if not present
                if (!orderData.totals) {
                  orderData.totals = calcTotals(orderData.items || [], orderData.discount || { type: "percent", value: 0 }, orderData.taxes || []);
                }

                // calculate payment summary (totalPaid, balance)
                const totalPaid = (orderData.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
                const balance = Math.max(0, Number(orderData.totals?.total || 0) - totalPaid);

                orderData.paymentSummary = { totalPaid, balance };

                // determine deposit / depositAmount (if set on order fields)
                orderData.depositAmount = orderData.depositAmount ?? orderData.deposit ?? 0;

                // determine stores using items' branchId
                const branchIds = Array.from(
                  new Set((orderData.items || []).map((it) => it.branchId).filter(Boolean))
                );
                orderData.stores = branchIds.map((bId) => {
                  const branch = branchesMap[bId];
                  return branch ? { id: bId, name: branch.name || branch.displayName || bId } : { id: bId, name: bId };
                });

                // attach order onto delivery
                del.order = orderData;
              } else {
                del.order = { id: del.orderId };
              }
            }

            // merge delivery-level history if exists (deliveries.history) with order.deliveryHistory so driver sees full timeline
            // normalize both sources to objects with at, stage, by, note
            const unifyHistory = (arr) =>
              (arr || []).map((h) => {
                const at = h?.at ?? h?.createdAt ?? h?.timestamp ?? null;
                return {
                  stage: h?.stage || h?.name || h?.note || "",
                  at: at,
                  by: h?.by || h?.byId || h?.createdBy || "",
                  note: h?.note || "",
                };
              });

            const delHist = unifyHistory(del.history || []);
            const orderHist = unifyHistory(del.order?.deliveryHistory || del.order?.deliveryHistory || []);
            // combine and sort by timestamp ascending (oldest -> newest)
            const combined = [...orderHist, ...delHist].filter(Boolean).sort((a, b) => {
              try {
                const atA = typeof a.at === "string" ? Date.parse(a.at) : (a.at && a.at.seconds ? a.at.seconds * 1000 : (a.at ? Number(a.at) : 0));
                const atB = typeof b.at === "string" ? Date.parse(b.at) : (b.at && b.at.seconds ? b.at.seconds * 1000 : (b.at ? Number(b.at) : 0));
                return (atA || 0) - (atB || 0);
              } catch {
                return 0;
              }
            });

            del.combinedHistory = combined;

            out.push(del);
          }
          setDeliveries(out);
          setLoading(false);
        } catch (err) {
          console.error("deliveries enrichment failed", err);
          setError("Failed to load deliveries");
          setDeliveries([]);
          setLoading(false);
        }
      },
      (err) => {
        console.error("deliveries onSnapshot error", err);
        setError("Failed to subscribe to deliveries.");
        setLoading(false);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, branchesMap]);

  // update delivery stage (driver app) — updates deliveries doc and also the linked orders doc
  const handleStageUpdate = async (deliveryId, newStage) => {
    try {
      const ref = doc(db, "deliveries", deliveryId);
      // Build history entry using client ISO timestamp (avoid serverTimestamp inside arrayUnion)
      const historyEntry = {
        stage: newStage,
        at: new Date().toISOString(),
        by: user?.uid || auth.currentUser?.uid || "",
        note: `Driver ${driver?.name || ""} set ${newStage}`,
      };

      // Update delivery doc
      await updateDoc(ref, {
        status: newStage,
        history: arrayUnion(historyEntry),
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || auth.currentUser?.uid || "",
      });

      // find delivery locally to get orderId
      const local = deliveries.find((d) => d.id === deliveryId);
      const orderId = local?.orderId || local?.order?.id;
      if (orderId) {
        const orderRef = doc(db, "orders", orderId);
        const orderHistoryEntry = {
          stage: newStage,
          at: new Date().toISOString(),
          by: user?.uid || auth.currentUser?.uid || "",
          note: `Driver ${driver?.name || ""} set ${newStage}`,
        };
        await updateDoc(orderRef, {
          deliveryStatus: newStage,
          deliveryHistory: arrayUnion(orderHistoryEntry),
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || auth.currentUser?.uid || "",
          updatedByName: user?.displayName || auth.currentUser?.displayName || user?.email || auth.currentUser?.email || "",
        });
      }
    } catch (err) {
      console.error("Stage update failed:", err);
      setError("Failed to update stage");
    }
  };

  const handleSignOut = async () => {
    await auth.signOut();
    window.location.href = "/login";
  };

  const openMap = (addr) =>
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`,
      "_blank"
    );

  const getProgress = (status) => {
    const steps = ["assigned", "accepted", "in_transit", "delivered", "completed"];
    const index = steps.indexOf(status);
    return ((index + 1) / steps.length) * 100;
  };

  if (loading) return <div className="driver-loading">Loading your dashboard…</div>;
  if (!driver)
    return (
      <div className="driver-empty">
        No driver profile linked. Please contact admin.
      </div>
    );

  return (
    <div className="driver-app">
      <header className="driver-topbar">
        <div>
          <h2>🚚 {driver.name}</h2>
          <p>{driver.vehicle || "No vehicle info"}</p>
        </div>
        <button className="signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </header>

      <section className="driver-section">
        <h3>Assigned Deliveries</h3>
        {deliveries.length === 0 && <p>No deliveries assigned yet.</p>}
        <div className="driver-cards">
          {deliveries.map((d) => {
            const o = d.order || {};
            const payments = o.payments || [];
            const total = o.totals?.total ?? o.totalAmount ?? 0;
            const deposit = o.depositAmount ?? 0;
            const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
            const paymentStatus = totalPaid >= Number(total || 0) ? "paid" : totalPaid > 0 ? "partial" : "pending";

            return (
              <div key={d.id} className="driver-card fade-in">
                <div className="driver-card-header">
                  <div>
                    <h4>{o.customerName || "Unknown Customer"}</h4>
                    <p className="muted">{o.deliveryAddress || o.address || o.dropAddress}</p>

                    {o.stores && o.stores.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <small className="muted">Stores:</small>{" "}
                        {o.stores.map((s, i) => (
                          <span key={s.id} style={{ marginRight: 8 }}>
                            {s.name}
                            {i < o.stores.length - 1 ? "," : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    {d.fetchedByName && (
                      <div style={{ marginTop: 4 }} className="muted">
                        Fetched by: {d.fetchedByName}
                      </div>
                    )}
                  </div>
                  <div className={`status-tag ${d.status || (o.deliveryStatus || "")}`}>{d.status || (o.deliveryStatus || "—")}</div>
                </div>

                <div className="driver-summary">
                  <div>
                    <strong>Order No:</strong> {o.orderNo || d.orderId}
                  </div>
                  <div>
                    <strong>Total:</strong> ₹{Number(total || 0).toLocaleString()}
                  </div>
                  <div>
                    <strong>Deposit:</strong> ₹{Number(deposit || 0).toLocaleString()}
                  </div>
                  <div>
                    <strong>Payment:</strong> {paymentStatus} ({Number(totalPaid || 0).toLocaleString()})
                  </div>
                </div>

                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${getProgress(d.status || (o.deliveryStatus || "assigned"))}%` }} />
                </div>

                <div className="driver-actions">
                  {d.status === "assigned" && (
                    <>
                      <button className="cp-btn" onClick={() => handleStageUpdate(d.id, "accepted")}>Accept</button>
                      <button className="cp-btn ghost" onClick={() => handleStageUpdate(d.id, "rejected")}>Reject</button>
                    </>
                  )}
                  {d.status === "accepted" && <button className="cp-btn" onClick={() => handleStageUpdate(d.id, "in_transit")}>Start Trip</button>}
                  {d.status === "in_transit" && (
                    <>
                      <button className="cp-btn" onClick={() => handleStageUpdate(d.id, "delivered")}>Delivered</button>
                      <button className="cp-btn ghost" onClick={() => openMap(o.deliveryAddress || o.address || o.dropAddress)}>Navigate</button>
                    </>
                  )}
                  {d.status === "delivered" && <button className="cp-btn" onClick={() => handleStageUpdate(d.id, "completed")}>Complete</button>}
                </div>

                <button className="details-btn" onClick={() => setSelected(d)}>View Details</button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Details Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Delivery Details</h3>
              <button onClick={() => setSelected(null)}>✖</button>
            </header>
            <div className="modal-body">
              <h4>{selected.order?.customerName}</h4>
              <p>{selected.order?.deliveryAddress || selected.order?.address}</p>

              {selected.order?.stores && selected.order.stores.length > 0 && (
                <div className="modal-section">
                  <h5>Stores</h5>
                  <ul>
                    {selected.order.stores.map((s) => <li key={s.id}>{s.name} ({s.id})</li>)}
                  </ul>
                </div>
              )}

              <div className="modal-section">
                <h5>Items</h5>
                {selected.order?.items?.map((item, i) => (
                  <div key={i}>
                    {item.name} × {item.qty} – ₹{item.rate} {item.branchId ? ` · branch: ${branchesMap[item.branchId]?.name || item.branchId}` : ""}
                  </div>
                ))}
              </div>

              <div className="modal-section">
                <h5>Payment</h5>
                <p>Total: ₹{selected.order?.totals?.total ?? selected.order?.totalAmount ?? 0}</p>
                <p>Deposit: ₹{selected.order?.depositAmount ?? 0}</p>
                <p>Status: {selected.order?.paymentSummary ? `${selected.order.paymentSummary.balance > 0 ? "Due" : "Paid"} (Paid ₹${selected.order.paymentSummary.totalPaid})` : "—"}</p>
              </div>

              <div className="modal-section">
                <h5>History</h5>
                <ul className="timeline">
                  {(selected.combinedHistory || []).slice().reverse().map((h, i) => (
                    <li key={i}>
                      <span>{h.stage || h.note}</span>
                      <span className="time">{formatTimestampToLocale(h.at)} {h.by ? ` • by ${h.by}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="driver-error">{error}</div>}
    </div>
  );
}
