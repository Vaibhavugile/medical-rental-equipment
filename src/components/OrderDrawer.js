// src/components/OrderDrawer.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  listAssets,
  reserveAsset,
  unreserveAsset,
} from "../utils/inventory";
import DeliveryHistory from "./DeliveryHistory";
export default function OrderDrawer({
  // state
  selectedOrder,
  branches,
  productsMap,
  productsList,
  drivers,
  assetsById,
  assetPicker,
  paymentModal,
  error,
  saving,
  detailedStatus,
  detailedStatusColor,
  // actions
  closeOrder,
  changeOrderStatus,
  updateOrderItem,
  openAssetPickerForItem,
  togglePickerSelect,
  confirmAssignAssetsFromPicker,
  // checkoutAssignedAssetsForItem,  // removed (reserve-only)
  // autoAssignAssets,               // replaced by local reserve-only impl
  unassignAsset,
  // checkinAssignedAsset,           // not used when reserve-only
  assignDriverToOrder,             // existing single-driver API
  assignRunnersToOrder,            // optional new API: (orderId, runners[]) => Promise
  driverAcceptDelivery,
  markPickedUp,
  markInTransit,
  markDelivered,
  confirmDeliveryAccepted,
  openPaymentModal,
  closePaymentModal,
  updatePaymentForm,
  savePayment,
  removePayment,
  markPaymentStatus,

  // misc
  navigate,
}) {
  // --- local helpers (UI-only) ---
  const fmtCurrency = (v) => {
    try {
      return Number(v).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return v ?? "0.00";
    }
  };

  const isFullyAssigned = (item) => {
    if (!item) return false;
    const qty = Number(item.qty || 0);
    const assigned = Array.isArray(item.assignedAssets)
      ? item.assignedAssets.length
      : 0;
    return qty > 0 && assigned >= qty;
  };

  const computePaymentsSummary = (payments = [], totalOrderAmount = 0) => {
    const totalPaid = (payments || []).reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );
    const balance = Math.max(0, Number(totalOrderAmount || 0) - totalPaid);
    return { totalPaid, balance };
  };

  // --- NEW: multiple runners state (local edit buffer) ---
  const [runnersDraft, setRunnersDraft] = useState([]);
  const [runnerSelectId, setRunnerSelectId] = useState("");
  const [editingRunners, setEditingRunners] = useState(false);
  const [savingRunners, setSavingRunners] = useState(false);

  // initialize runnersDraft from selectedOrder when drawer opens / order changes
  useEffect(() => {
    if (!selectedOrder) return;
    const existing = (selectedOrder.delivery && selectedOrder.delivery.runners) || [];
    // normalize to shape: { id, driverId, driverName, phone, assignedItemIndexes: [], status }
    const normalized = (existing || []).map((r, idx) => ({
      id: r.id || `r-${Date.now()}-${idx}`,
      driverId: r.driverId || r.id || "",
      driverName: r.driverName || r.name || "",
      phone: r.phone || r.driverPhone || "",
      assignedItemIndexes: Array.isArray(r.assignedItemIndexes) ? r.assignedItemIndexes : (r.assignedItems ? r.assignedItems : []),
      status: r.status || "assigned",
      note: r.note || "",
    }));
    setRunnersDraft(normalized);
  }, [selectedOrder]);

  // convenience: list of order item labels for checkboxes
  const itemLabels = useMemo(() => {
    return (selectedOrder?.items || []).map((it, idx) => ({
      idx,
      label: it.name || `${it.productId || "item"} #${idx + 1}`,
    }));
  }, [selectedOrder]);

  const toggleAssignedItemForRunner = (runnerIdx, itemIdx) => {
    setRunnersDraft((prev) => {
      const arr = JSON.parse(JSON.stringify(prev || []));
      arr[runnerIdx] = arr[runnerIdx] || {};
      arr[runnerIdx].assignedItemIndexes = arr[runnerIdx].assignedItemIndexes || [];
      const pos = arr[runnerIdx].assignedItemIndexes.indexOf(itemIdx);
      if (pos === -1) arr[runnerIdx].assignedItemIndexes.push(itemIdx);
      else arr[runnerIdx].assignedItemIndexes.splice(pos, 1);
      return arr;
    });
  };

  const addRunnerDraft = () => {
    if (!runnerSelectId) return;
    const d = drivers.find((d) => d.id === runnerSelectId);
    if (!d) return;
    setRunnersDraft((prev) => [
      ...(prev || []),
      {
        id: `r-${Date.now()}`,
        driverId: d.id,
        driverName: d.name,
        phone: d.phone || "",
        assignedItemIndexes: [],
        status: "assigned",
      },
    ]);
    setRunnerSelectId("");
  };

  const removeRunnerDraft = (idx) => {
    setRunnersDraft((prev) => {
      const arr = JSON.parse(JSON.stringify(prev || []));
      arr.splice(idx, 1);
      return arr;
    });
  };

  // Save runners: attempt to call assignRunnersToOrder (preferred) else fall back
  const saveRunners = async () => {
    if (!selectedOrder) return;
    setSavingRunners(true);
    setEditingRunners(false);

    // prepare payload: minimal runner objects to save on order.delivery.runners
    const toSave = (runnersDraft || []).map((r) => ({
      id: r.id,
      driverId: r.driverId,
      driverName: r.driverName,
      phone: r.phone,
      assignedItemIndexes: r.assignedItemIndexes || [],
      status: r.status || "assigned",
      note: r.note || "",
    }));

    try {
      // 1) If parent provides assignRunnersToOrder(orderId, runners[]) -> call it.
      if (typeof assignRunnersToOrder === "function") {
        await assignRunnersToOrder(selectedOrder.id || selectedOrder.orderNo, toSave);
      } else if (typeof assignDriverToOrder === "function") {
        // Fallback: call assignDriverToOrder for each runner sequentially (backwards-compatible).
        // assignDriverToOrder might expect a single driverId — we call it for each runner and rely on parent to update order doc.
        for (const r of toSave) {
          try {
            // If parent expects just driverId, pass driverId
            await assignDriverToOrder(r.driverId, {
              meta: {
                assignedItems: r.assignedItemIndexes,
                runnerId: r.id,
                runnerName: r.driverName,
                runnerPhone: r.phone,
              },
            });
          } catch (err) {
            console.warn("assignDriverToOrder fallback failed for", r.driverId, err);
          }
        }
      } else {
        // No handler available: we'll just update local selectedOrder.delivery object in-memory
        // (Parent must persist these changes later via Save Order action).
        selectedOrder.delivery = selectedOrder.delivery || {};
        selectedOrder.delivery.runners = toSave;
      }
      setRunnersDraft(toSave);
    } catch (err) {
      console.error("saveRunners failed", err);
      alert(err?.message || "Failed to save runners");
    } finally {
      setSavingRunners(false);
    }
  };

  // render driver chips
  const renderRunnerChip = (r, idx) => (
    <div
      key={r.id || `${r.driverId}-${idx}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 8,
        background: "#f3f4f6",
        marginRight: 8,
      }}
    >
      <div style={{ fontWeight: 700 }}>
        {r.driverName || r.driverId || "—"}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        {r.phone || ""}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        {r.assignedItemIndexes && r.assignedItemIndexes.length
          ? `${r.assignedItemIndexes.length} item(s)`
          : "no items"}
      </div>
      <button
        className="cp-btn ghost"
        onClick={() => {
          setEditingRunners(true);
          // keep current runnersDraft as-is for editing
        }}
      >
        Edit
      </button>
    </div>
  );

  if (!selectedOrder) return null;

  const paymentSummary = computePaymentsSummary(
    selectedOrder.payments || [],
    selectedOrder.totals?.total || 0
  );

  // ====== SAME-AS-OrderCreate reserve flow ======
  // (confirmAssignAndReserve, autoAssignAndReserve, unassignAndUnreserve unchanged — left as-is)
  const confirmAssignAndReserve = async () => {
    try {
      const idx = assetPicker.itemIndex;
      if (idx == null) {
        confirmAssignAssetsFromPicker?.("__CLOSE_ONLY__");
        return;
      }

      const picked = Object.keys(assetPicker.selected || {}).filter(
        (id) => assetPicker.selected[id]
      );

      if (!picked.length) {
        confirmAssignAssetsFromPicker?.("__CLOSE_ONLY__");
        return;
      }

      const item = selectedOrder.items?.[idx] || {};
      const orderId = selectedOrder.id || selectedOrder.orderNo;

      // 1) Update assigned assets
      const existing = Array.isArray(item.assignedAssets)
        ? item.assignedAssets
        : [];
      const merged = Array.from(new Set([...existing, ...picked]));
      updateOrderItem?.(idx, { assignedAssets: merged });

      // 2) Reserve each asset
      for (const assetDocId of picked) {
        try {
          await reserveAsset(assetDocId, {
            reservationId: orderId,
            orderId: orderId,
            customer: selectedOrder.customerName || "",
            until: item?.expectedEndDate || null,
            note: `Reserved for order ${selectedOrder.orderNo || orderId}`,
          });
        } catch (err) {
          console.warn("reserveAsset failed", assetDocId, err);
        }
      }
      confirmAssignAssetsFromPicker?.("__CLOSE_ONLY__");
    } catch (e) {
      console.error("Assign & reserve error:", e);
      alert(e?.message || "Failed to reserve selected assets");
    }
  };

  const autoAssignAndReserve = async (itemIndex, count = 1) => {
    try {
      const it = selectedOrder.items?.[itemIndex];
      if (!it?.productId) {
        alert("Select a product first");
        return;
      }

      const assets = await listAssets({
        productId: it.productId || null,
        branchId: it.branchId || null,
        status: "in_stock",
      });

      if (!assets?.length) {
        alert("No assets available to auto-assign");
        return;
      }

      const pick = assets.slice(0, Number(count || 1)).map((a) => a.id);
      const existing = Array.isArray(it.assignedAssets) ? it.assignedAssets : [];
      const merged = Array.from(new Set([...existing, ...pick]));

      updateOrderItem?.(itemIndex, { assignedAssets: merged, autoAssigned: true });

      const orderId = selectedOrder.id || selectedOrder.orderNo;
      for (const assetDocId of pick) {
        try {
          await reserveAsset(assetDocId, {
            reservationId: orderId,
            orderId: orderId,
            customer: selectedOrder.customerName || "",
            until: it?.expectedEndDate || null,
            note: `Reserved for order ${selectedOrder.orderNo || orderId}`,
          });
        } catch (err) {
          console.warn("reserveAsset failed", assetDocId, err);
        }
      }
    } catch (e) {
      console.error("autoAssignAndReserve error:", e);
      alert(e?.message || "Auto-assign failed");
    }
  };

  const unassignAndUnreserve = async (itemIndex, assetDocId) => {
    try {
      await unassignAsset?.(itemIndex, assetDocId, false);
      await unreserveAsset(assetDocId, {
        note: `Unassigned from order ${selectedOrder.orderNo || selectedOrder.id}`,
      });
    } catch (e) {
      console.error("Unassign/unreserve failed:", e);
      alert(e?.message || "Failed to unassign/unreserve asset");
    }
  };

  return (
    <div
      className="cp-drawer"
      onClick={(e) => {
        if (e.target.classList.contains("cp-drawer")) closeOrder();
      }}
    >
      <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
        <div className="cp-form-head">
          <h2>Order — {selectedOrder.orderNo || selectedOrder.id}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ textAlign: "right", marginRight: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Status</div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 700,
                  textTransform: "capitalize",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background:
                      typeof detailedStatusColor === "function"
                        ? detailedStatusColor(detailedStatus)
                        : "#6b7280",
                  }}
                />
                {detailedStatus || selectedOrder.status}
              </div>
            </div>

            <button
              className="cp-btn ghost"
              onClick={() => changeOrderStatus("active")}
              disabled={selectedOrder.status === "active"}
            >
              Activate
            </button>
            <button
              className="cp-btn ghost"
              onClick={() => changeOrderStatus("completed")}
              disabled={selectedOrder.status === "completed"}
            >
              Complete
            </button>
            <button
              className="cp-btn ghost"
              onClick={() => changeOrderStatus("cancelled")}
              disabled={selectedOrder.status === "cancelled"}
            >
              Cancel
            </button>
            <button className="cp-btn" onClick={closeOrder}>
              Close
            </button>
          </div>
        </div>

        {error && <div className="orders-error">{error}</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 420px",
            gap: 18,
          }}
        >
          {/* Left — items (unchanged) */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <div className="label">Customer</div>
              <div style={{ fontWeight: 700 }}>
                {selectedOrder.customerName || "—"}
              </div>
              <div className="muted">{selectedOrder.deliveryAddress || "—"}</div>
            </div>

            <div>
              <h3>Items</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(selectedOrder.items || []).map((it, idx) => {
                  const fullyAssigned = isFullyAssigned(it);

                  return (
                    <div
                      key={idx}
                      style={{
                        border: "1px solid #eef2f7",
                        padding: 10,
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>
                              {it.name || "—"}
                            </div>
                            <div className="muted">
                              Product:{" "}
                              {productsMap[it.productId]?.name ||
                                it.productId ||
                                "—"}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 8,
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div className="muted">Qty</div>
                              <input
                                className="cp-input"
                                style={{ width: 84 }}
                                value={it.qty}
                                onChange={(e) =>
                                  updateOrderItem(idx, {
                                    qty: Number(e.target.value || 0),
                                  })
                                }
                              />
                            </div>

                            <div>
                              <div className="muted">Rate</div>
                              <input
                                className="cp-input"
                                style={{ width: 120 }}
                                value={it.rate}
                                onChange={(e) =>
                                  updateOrderItem(idx, {
                                    rate: Number(e.target.value || 0),
                                  })
                                }
                              />
                            </div>

                            <div>
                              <div className="muted">From</div>
                              <input
                                className="cp-input"
                                style={{ width: 140 }}
                                value={it.expectedStartDate || ""}
                                onChange={(e) =>
                                  updateOrderItem(idx, {
                                    expectedStartDate: e.target.value,
                                  })
                                }
                              />
                            </div>

                            <div>
                              <div className="muted">To</div>
                              <input
                                className="cp-input"
                                style={{ width: 140 }}
                                value={it.expectedEndDate || ""}
                                onChange={(e) =>
                                  updateOrderItem(idx, {
                                    expectedEndDate: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 8,
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div className="muted">Branch</div>
                              <select
                                className="cp-input"
                                value={it.branchId || ""}
                                onChange={(e) =>
                                  updateOrderItem(idx, { branchId: e.target.value })
                                }
                              >
                                <option value="">Default branch</option>
                                {branches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div style={{ marginLeft: 8 }}>
                              <div className="muted">Product</div>
                              <select
                                className="cp-input"
                                value={it.productId || ""}
                                onChange={(e) =>
                                  updateOrderItem(idx, { productId: e.target.value })
                                }
                                style={{ width: 220 }}
                              >
                                <option value="">Select product</option>
                                {productsList.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                    {p.sku ? ` · ${p.sku}` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div
                              style={{
                                marginLeft: "auto",
                                display: "flex",
                                gap: 8,
                              }}
                            >
                              {fullyAssigned ? (
                                <>
                                  <button
                                    className="cp-btn ghost"
                                    onClick={() => openAssetPickerForItem(idx)}
                                  >
                                    View / Reassign
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="cp-btn ghost"
                                    onClick={() => openAssetPickerForItem(idx)}
                                    disabled={!it.productId}
                                  >
                                    Assign Assets
                                  </button>
                                  <button
                                    className="cp-btn ghost"
                                    onClick={() =>
                                      autoAssignAndReserve(idx, it.qty || 1)
                                    }
                                    disabled={!it.productId}
                                  >
                                    Auto-assign (Reserve)
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {(it.assignedAssets || []).length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <div className="muted">Assigned assets</div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                  marginTop: 8,
                                }}
                              >
                                {it.assignedAssets.map((aid) => {
                                  const meta = assetsById[aid];
                                  return (
                                    <div key={aid} className="asset-card">
                                      <div>
                                        <div style={{ fontWeight: 700 }}>
                                          {meta?.assetId || aid}
                                        </div>
                                        <div
                                          className="meta"
                                          style={{ fontSize: 12 }}
                                        >
                                          {meta
                                            ? `${
                                                meta.metadata?.model ||
                                                meta.productId ||
                                                ""
                                              } · ${
                                                (
                                                  branches.find(
                                                    (b) => b.id === meta.branchId
                                                  ) || {}
                                                ).name ||
                                                meta.branchId ||
                                                ""
                                              }`
                                            : ""}
                                        </div>
                                      </div>

                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 8,
                                          alignItems: "center",
                                        }}
                                      >
                                        <button
                                          className="cp-btn ghost"
                                          onClick={() =>
                                            unassignAndUnreserve(idx, aid)
                                          }
                                        >
                                          Unassign
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right — meta / delivery / totals / payments */}
          <div>
            <div className="details-right">
              <div className="meta-row">
                <div className="label">Order No</div>
                <div className="value">{selectedOrder.orderNo}</div>
              </div>
              <div className="meta-row">
                <div className="label">Created</div>
                <div className="value">
                  {selectedOrder.createdAt?.seconds
                    ? new Date(
                        selectedOrder.createdAt.seconds * 1000
                      ).toLocaleString()
                    : "—"}
                </div>
              </div>
              <div className="meta-row">
                <div className="label">Customer</div>
                <div className="value">
                  {selectedOrder.customerName || "—"}
                </div>
              </div>

              {/* Delivery */}
              <div style={{ marginTop: 12 }}>
                <h4>Delivery</h4>

                <div style={{ marginTop: 8 }}>
                  <div className="label muted">Runners / Drivers</div>

                  {/* show existing runner chips */}
                  <div style={{ marginTop: 6, marginBottom: 8 }}>
                    {((selectedOrder.delivery && selectedOrder.delivery.runners) || runnersDraft || []).length === 0 && (
                      <div className="muted">No runners assigned</div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      {((selectedOrder.delivery && selectedOrder.delivery.runners) || runnersDraft || []).map((r, idx) =>
                        renderRunnerChip(r, idx)
                      )}
                    </div>
                  </div>

                  {/* edit area */}
                  {editingRunners ? (
                    <div
                      style={{
                        border: "1px dashed #e6edf3",
                        padding: 10,
                        borderRadius: 8,
                        marginTop: 8,
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          className="cp-input"
                          value={runnerSelectId}
                          onChange={(e) => setRunnerSelectId(e.target.value)}
                        >
                          <option value="">Select driver to add</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}{d.phone ? ` · ${d.phone}` : ""}
                            </option>
                          ))}
                        </select>
                        <button className="cp-btn" onClick={addRunnerDraft} disabled={!runnerSelectId}>
                          Add runner
                        </button>
                        <button className="cp-btn ghost" onClick={() => { setEditingRunners(false); setRunnersDraft((selectedOrder.delivery && selectedOrder.delivery.runners) || []); }}>
                          Cancel
                        </button>
                      </div>

                      {/* runners edit list */}
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        {(runnersDraft || []).map((r, ridx) => (
                          <div key={r.id || ridx} style={{ border: "1px solid #f1f5f9", padding: 8, borderRadius: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ fontWeight: 700 }}>{r.driverName || r.driverId}</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className="cp-btn ghost" onClick={() => removeRunnerDraft(ridx)}>Remove</button>
                              </div>
                            </div>

                            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div>
                                <div className="label muted">Phone</div>
                                <input className="cp-input" value={r.phone || ""} onChange={(e) => setRunnersDraft(prev => { const a = JSON.parse(JSON.stringify(prev || [])); a[ridx].phone = e.target.value; return a; })} />
                              </div>
                              <div>
                                <div className="label muted">Status</div>
                                <select className="cp-input" value={r.status || "assigned"} onChange={(e) => setRunnersDraft(prev => { const a = JSON.parse(JSON.stringify(prev || [])); a[ridx].status = e.target.value; return a; })}>
                                  <option value="assigned">Assigned</option>
                                  <option value="picked_up">Picked up</option>
                                  <option value="in_transit">In transit</option>
                                  <option value="delivered">Delivered</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </div>
                            </div>

                            <div style={{ marginTop: 8 }}>
                              <div className="label muted">Assign items to this runner</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                                {itemLabels.map((it) => (
                                  <label key={it.idx} style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "6px 8px", borderRadius: 6, background: (r.assignedItemIndexes || []).includes(it.idx) ? "#eef2ff" : "#f8fafc" }}>
                                    <input type="checkbox" checked={(r.assignedItemIndexes || []).includes(it.idx)} onChange={() => toggleAssignedItemForRunner(ridx, it.idx)} />
                                    <div style={{ fontSize: 13 }}>{it.label}</div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                        <button className="cp-btn ghost" onClick={() => { setEditingRunners(false); setRunnersDraft((selectedOrder.delivery && selectedOrder.delivery.runners) || []); }}>Close</button>
                        <button className="cp-btn" onClick={saveRunners} disabled={savingRunners}>{savingRunners ? "Saving…" : "Save runners"}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button className="cp-btn" onClick={() => setEditingRunners(true)}>Manage runners</button>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label muted">Delivery Status</div>
                  <div
                    style={{
                      fontWeight: 700,
                      marginTop: 6,
                      textTransform: "capitalize",
                    }}
                  >
                    {selectedOrder.deliveryStatus ||
                      selectedOrder.delivery?.status ||
                      "—"}
                  </div>

                 <section style={{ marginTop: 16 }}>
  <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>Delivery History</h3>
  <DeliveryHistory order={selectedOrder} />
</section>

                </div>

                {/* Totals (unchanged) */}
                <div style={{ marginTop: 12 }}>
                  <h4>Totals</h4>
                  <div className="meta-row">
                    <div className="label">Subtotal</div>
                    <div className="value">
                      {fmtCurrency(selectedOrder.totals?.subtotal || 0)}
                    </div>
                  </div>
                  <div className="meta-row">
                    <div className="label">Discount</div>
                    <div className="value">
                      {selectedOrder.discount?.type === "percent"
                        ? `${selectedOrder.discount?.value || 0}%`
                        : fmtCurrency(selectedOrder.discount?.value || 0)}
                    </div>
                  </div>
                  <div className="meta-row">
                    <div className="label">Tax</div>
                    <div className="value">
                      {fmtCurrency(selectedOrder.totals?.totalTax || 0)}
                    </div>
                  </div>
                  <div className="meta-row">
                    <div className="label strong">Total</div>
                    <div className="value strong">
                      {fmtCurrency(selectedOrder.totals?.total || 0)}
                    </div>
                  </div>
                </div>

                {/* Payments (unchanged) */}
                <div style={{ marginTop: 12 }}>
                  <h4>Payments</h4>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div className="muted">Total paid</div>
                      <div style={{ fontWeight: 700 }}>
                        {fmtCurrency(paymentSummary.totalPaid || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="muted">Balance</div>
                      <div
                        style={{
                          fontWeight: 700,
                          color:
                            paymentSummary.balance > 0
                              ? "#b91c1c"
                              : "#065f46",
                        }}
                      >
                        {fmtCurrency(paymentSummary.balance || 0)}
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <button className="cp-btn" onClick={() => openPaymentModal(null)}>
                        Add Payment
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    {(selectedOrder.payments || []).length === 0 && (
                      <div className="muted">No payments recorded.</div>
                    )}
                    {(selectedOrder.payments || []).map((p, i) => (
                      <div
                        key={p.id || `p-${i}`}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          padding: 8,
                          borderBottom: "1px solid #f3f6f9" ,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>
                            {fmtCurrency(p.amount)}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {p.method || "—"} •{" "}
                            {p.reference ? `Ref: ${p.reference}` : ""} •{" "}
                            {p.date
                              ? p.date.seconds
                                ? new Date(
                                    p.date.seconds * 1000
                                  ).toLocaleDateString()
                                : new Date(p.date).toLocaleDateString()
                              : ""}
                          </div>
                          {p.note ? (
                            <div style={{ fontSize: 13, marginTop: 6 }}>
                              {p.note}
                            </div>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              textTransform: "capitalize",
                            }}
                          >
                            {p.status || "completed"}
                          </div>
                          <button
                            className="cp-btn ghost"
                            onClick={() => openPaymentModal(p.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="cp-btn ghost"
                            onClick={() => removePayment(p.id)}
                          >
                            Delete
                          </button>
                          {p.status !== "refunded" && (
                            <button
                              className="cp-btn ghost"
                              onClick={() => markPaymentStatus(p.id, "refunded")}
                            >
                              Mark refunded
                            </button>
                          )}
                          {p.status !== "pending" && (
                            <button
                              className="cp-btn ghost"
                              onClick={() => markPaymentStatus(p.id, "pending")}
                            >
                              Mark pending
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <button
                    className="cp-btn"
                    onClick={() => {
                      alert("Use the Save action exposed in the parent if needed.");
                    }}
                  >
                    Save Order
                  </button>

                  <button
                    className="cp-btn ghost"
                    style={{ marginLeft: 8 }}
                    onClick={() => {
                      if (selectedOrder.orderNo) {
                        navigator.clipboard?.writeText(
                          JSON.stringify(selectedOrder, null, 2)
                        );
                        alert("Copied order JSON to clipboard");
                      }
                    }}
                  >
                    Copy JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Asset picker modal (unchanged) */}
        {assetPicker.open && assetPicker.itemIndex !== null && (
          <div
            className="cp-modal"
            onClick={() =>
              confirmAssignAssetsFromPicker("__CLOSE_ONLY__" /* sentinel */)
            }
          >
            <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
              <h4>Select assets for item #{assetPicker.itemIndex + 1}</h4>

              {assetPicker.loading && <div className="muted">Loading…</div>}
              {!assetPicker.loading && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  <div className="muted">
                    In stock: {assetPicker.assets.length}
                  </div>
                  <div className="muted">
                    Product:{" "}
                    {productsMap[
                      selectedOrder.items?.[assetPicker.itemIndex]?.productId
                    ]?.name ||
                      selectedOrder.items?.[assetPicker.itemIndex]?.productId ||
                      "—"}
                  </div>
                </div>
              )}

              <div style={{ maxHeight: 340, overflowY: "auto", marginTop: 10 }}>
                {assetPicker.assets.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: 8,
                      borderBottom: "1px solid #eef2f7",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!assetPicker.selected[a.id]}
                      onChange={() => togglePickerSelect(a.id)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>
                        {a.assetId || a.id}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {a.metadata?.model || a.productId} ·{" "}
                        {(branches.find((b) => b.id === a.branchId) || {}).name ||
                          a.branchId ||
                          "—"}
                      </div>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Status:{" "}
                      <strong style={{ textTransform: "capitalize" }}>
                        {a.status}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 12,
                }}
              >
                <button
                  className="cp-btn ghost"
                  onClick={() =>
                    confirmAssignAssetsFromPicker("__CLOSE_ONLY__")
                  }
                >
                  Cancel
                </button>
                <button
                  className="cp-btn"
                  onClick={confirmAssignAndReserve}
                >
                  Assign & Reserve
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment modal (unchanged) */}
        {paymentModal.open && paymentModal.form && (
          <div className="cp-modal" onClick={closePaymentModal}>
            <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
              <h4>{paymentModal.editingPaymentId ? "Edit Payment" : "Add Payment"}</h4>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <div>
                  <div className="label muted">Amount</div>
                  <input
                    className="cp-input"
                    value={paymentModal.form.amount}
                    onChange={(e) =>
                      updatePaymentForm({ amount: e.target.value })
                    }
                  />
                </div>

                <div>
                  <div className="label muted">Date</div>
                  <input
                    type="date"
                    className="cp-input"
                    value={
                      paymentModal.form.date?.slice?.(0, 10) ||
                      paymentModal.form.date ||
                      new Date().toISOString().slice(0, 10)
                    }
                    onChange={(e) => updatePaymentForm({ date: e.target.value })}
                  />
                </div>

                <div>
                  <div className="label muted">Method</div>
                  <select
                    className="cp-input"
                    value={paymentModal.form.method || "cash"}
                    onChange={(e) =>
                      updatePaymentForm({ method: e.target.value })
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>

                <div>
                  <div className="label muted">Status</div>
                  <select
                    className="cp-input"
                    value={paymentModal.form.status || "completed"}
                    onChange={(e) =>
                      updatePaymentForm({ status: e.target.value })
                    }
                  >
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="label muted">Reference</div>
                  <input
                    className="cp-input"
                    value={paymentModal.form.reference || ""}
                    onChange={(e) =>
                      updatePaymentForm({ reference: e.target.value })
                    }
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="label muted">Note</div>
                  <textarea
                    className="cp-input"
                    value={paymentModal.form.note || ""}
                    onChange={(e) => updatePaymentForm({ note: e.target.value })}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 12,
                }}
              >
                <button className="cp-btn ghost" onClick={closePaymentModal}>
                  Cancel
                </button>
                <button className="cp-btn" onClick={savePayment} disabled={paymentModal.saving}>
                  {paymentModal.saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .muted { color:#666; font-size:12px; }
        .asset-card {
          display:flex; align-items:center; justify-content:space-between;
          gap:8px; padding:8px; border:1px solid #eee; border-radius:8px;
        }
      `}</style>
    </div>
  );
}
