// src/components/OrderDrawer.jsx
import React from "react";

/**
 * Pure UI for the Orders drawer + modals.
 * All data + actions are passed in via props so Orders.js stays lean.
 */
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
  checkoutAssignedAssetsForItem,
  autoAssignAssets,
  unassignAsset,
  checkinAssignedAsset,
  assignDriverToOrder,
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

  const anyAssignedCheckedOut = (item) => {
    if (!item || !item.assignedAssets || item.assignedAssets.length === 0)
      return false;
    return item.assignedAssets.some((aid) => {
      const a = assetsById[aid];
      if (!a) return false;
      const st = (a.status || "").toLowerCase();
      return (
        st === "out_for_rental" || st === "checked_out" || st === "rented"
      );
    });
  };

  const computePaymentsSummary = (payments = [], totalOrderAmount = 0) => {
    const totalPaid = (payments || []).reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );
    const balance = Math.max(0, Number(totalOrderAmount || 0) - totalPaid);
    return { totalPaid, balance };
  };

  if (!selectedOrder) return null;

  const paymentSummary = computePaymentsSummary(
    selectedOrder.payments || [],
    selectedOrder.totals?.total || 0
  );

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
      background: (typeof detailedStatusColor === "function")
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
          {/* Left — items */}
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
                  const checkedOutPresent = anyAssignedCheckedOut(it);

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
                                    {checkedOutPresent
                                      ? "View / Reassign"
                                      : "View Assigned"}
                                  </button>

                                  {!checkedOutPresent && (
                                    <button
                                      className="cp-btn ghost"
                                      onClick={() =>
                                        checkoutAssignedAssetsForItem(idx)
                                      }
                                    >
                                      Checkout Assigned
                                    </button>
                                  )}
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
                                      autoAssignAssets(
                                        idx,
                                        it.qty || 1,
                                        true
                                      )
                                    }
                                    disabled={!it.productId}
                                  >
                                    Auto-assign & Checkout
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
                                        {meta &&
                                        ((meta.status || "").toLowerCase() ===
                                          "out_for_rental" ||
                                          (meta.status || "").toLowerCase() ===
                                            "checked_out") ? (
                                          <button
                                            className="cp-btn ghost"
                                            onClick={() =>
                                              checkinAssignedAsset(aid, idx)
                                            }
                                          >
                                            Check-in
                                          </button>
                                        ) : (
                                          <button
                                            className="cp-btn ghost"
                                            onClick={() =>
                                              checkoutAssignedAssetsForItem(idx)
                                            }
                                          >
                                            Checkout Assigned
                                          </button>
                                        )}

                                        <button
                                          className="cp-btn ghost"
                                          onClick={() =>
                                            unassignAsset(idx, aid, false)
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
                  <div className="label muted">Driver</div>
                  <select
                    className="cp-input"
                    value={selectedOrder.delivery?.driverId || ""}
                    onChange={(e) =>
                      (selectedOrder.delivery = {
                        ...(selectedOrder.delivery || {}),
                        driverId: e.target.value,
                      }) && null /* handled by Assign action */
                    }
                  >
                    <option value="">Select driver</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                        {d.phone ? ` · ${d.phone}` : ""}
                      </option>
                    ))}
                  </select>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {!selectedOrder.delivery?.deliveryId &&
                    selectedOrder.deliveryStatus !== "assigned" ? (
                      <button
                        className="cp-btn"
                        onClick={() => {
                          const did = selectedOrder.delivery?.driverId;
                          if (!did) {
                            alert("Choose a driver first");
                            return;
                          }
                          assignDriverToOrder(did);
                        }}
                        disabled={!selectedOrder.delivery?.driverId}
                      >
                        Assign driver
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div
                          style={{
                            padding: "6px 10px",
                            background: "#ecfdf5",
                            borderRadius: 8,
                            color: "#065f46",
                            fontWeight: 700,
                          }}
                        >
                          Assigned:{" "}
                          {selectedOrder.delivery?.driverName ||
                            (
                              drivers.find(
                                (d) => d.id === selectedOrder.delivery?.driverId
                              ) || {}
                            ).name ||
                            selectedOrder.delivery?.driverId ||
                            "—"}
                        </div>
                        <button
                          className="cp-btn ghost"
                          onClick={() => {
                            // local unlink to allow reassignment (doesn't delete deliveries doc)
                            selectedOrder.delivery = {
                              ...(selectedOrder.delivery || {}),
                              deliveryId: null,
                            };
                            selectedOrder.deliveryStatus = null;
                            // force simple UI refresh: close/open or rely on parent state updates
                            // parent keeps source of truth; this is UI-only
                          }}
                        >
                          Reassign
                        </button>
                      </div>
                    )}

                    <button className="cp-btn ghost" onClick={() => navigate("/drivers")}>
                      Manage drivers
                    </button>
                  </div>
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

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="cp-btn ghost"
                      onClick={driverAcceptDelivery}
                      disabled={
                        !selectedOrder.delivery?.deliveryId ||
                        selectedOrder.deliveryStatus === "accepted"
                      }
                    >
                      Driver Accept
                    </button>
                    <button
                      className="cp-btn ghost"
                      onClick={markPickedUp}
                      disabled={
                        !selectedOrder.delivery?.deliveryId ||
                        selectedOrder.deliveryStatus === "picked_up"
                      }
                    >
                      Picked up
                    </button>
                    <button
                      className="cp-btn ghost"
                      onClick={markInTransit}
                      disabled={
                        !selectedOrder.delivery?.deliveryId ||
                        selectedOrder.deliveryStatus === "in_transit"
                      }
                    >
                      In transit
                    </button>
                    <button
                      className="cp-btn ghost"
                      onClick={markDelivered}
                      disabled={
                        !selectedOrder.delivery?.deliveryId ||
                        selectedOrder.deliveryStatus === "delivered"
                      }
                    >
                      Delivered
                    </button>
                    <button
                      className="cp-btn"
                      onClick={confirmDeliveryAccepted}
                      disabled={
                        !selectedOrder.delivery?.deliveryId ||
                        selectedOrder.deliveryStatus === "completed"
                      }
                    >
                      Accept delivery
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label muted">Delivery history</div>
                  <div style={{ marginTop: 8 }}>
                    {(selectedOrder.deliveryHistory || [])
                      .slice()
                      .reverse()
                      .map((h, i) => (
                        <div
                          key={i}
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f3f6f9",
                          }}
                        >
                          <div style={{ fontSize: 13 }}>{h.stage || h.note}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {h.by || ""} •{" "}
                            {h.at?.seconds
                              ? new Date(h.at.seconds * 1000).toLocaleString()
                              : h.at
                              ? new Date(h.at).toLocaleString()
                              : ""}
                          </div>
                        </div>
                      ))}
                    {(!selectedOrder.deliveryHistory ||
                      selectedOrder.deliveryHistory.length === 0) && (
                      <div className="muted">No delivery events yet.</div>
                    )}
                  </div>
                </div>

                {/* Totals */}
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

                {/* Payments */}
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
                          borderBottom: "1px solid #f3f6f9",
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
                      // Keep "Save Order" logic in parent; here we just trigger the same handler via savePayment modal path if needed.
                      // If you want Save Order inside the drawer, expose a parent handler and call it here.
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

        {/* Asset picker modal */}
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
                  onClick={() => confirmAssignAssetsFromPicker(false)}
                >
                  Assign selected
                </button>
                <button
                  className="cp-btn"
                  onClick={() => confirmAssignAssetsFromPicker(true)}
                >
                  Assign & Checkout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment modal */}
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
    </div>
  );
}
