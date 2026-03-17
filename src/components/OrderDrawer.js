// src/components/OrderDrawer.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  listAvailableAssetsForRange,
  reserveAsset,
  unreserveAsset,
} from "../utils/inventory";
import { doc, onSnapshot, increment, arrayUnion, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { updateAccountReport } from "../utils/accountReport";

export default function OrderDrawer({
  // state
  selectedOrder,
  setSelectedOrder,
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
  createReturnDelivery,

  // 🔹 ADD THESE
  assetCompanyFilter,
  setAssetCompanyFilter,
  assetCompanies,
  groupedAssets,
  setAssetPicker,

  // actions
  closeOrder,
  changeOrderStatus,
  updateOrderItem,
  openAssetPickerForItem,
  togglePickerSelect,
  confirmAssignAssetsFromPicker,
  unassignAsset,
  assignDriverToOrder,

  // payments
  openPaymentModal,
  closePaymentModal,
  updatePaymentForm,
  savePayment,
  removePayment,
  markPaymentStatus,

  // misc
  navigate,
}) {
  const [extendService, setExtendService] = useState({
    open: false,
    itemIndex: null,
    newEndDate: "",
    extraPrice: "",
  });

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] = useState(null);
  const [customerErrors, setCustomerErrors] = useState({});
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
  const validateCustomer = () => {
  const errors = {};

  const name = customerDraft?.customerName?.trim();
  const phoneRaw = customerDraft?.customerPhone || "";
  const phone = phoneRaw.replace(/\D/g, ""); // ✅ remove spaces, +, etc
  const email = customerDraft?.customerEmail?.trim();

  // NAME
  if (!name) {
    errors.customerName = "Name is required";
  }

  // PHONE
  if (!phone) {
    errors.customerPhone = "Phone is required";
  } else if (phone.length !== 10) {
    errors.customerPhone = "Phone must be exactly 10 digits";
  }

  // ADDRESS
  if (!customerDraft?.deliveryAddress?.trim()) {
    errors.deliveryAddress = "Address is required";
  }

  setCustomerErrors(errors);

  return Object.keys(errors).length === 0;
};
  const confirmAndChangeStatus = async (newStatus) => {
    let msg = "";

    if (newStatus === "completed") {
      msg = "Are you sure you want to mark this order as COMPLETED?\n\nThis action cannot be undone.";
    }

    if (newStatus === "cancelled") {
      msg = "Are you sure you want to CANCEL this order?\n\nThis action cannot be undone.";
    }

    if (!msg) return;

    const ok = window.confirm(msg);
    if (!ok) return;

    await changeOrderStatus(newStatus);
  };

  const isFullyAssigned = (item) => {
    if (!item) return false;
    const qty = Number(item.qty || 0);
    const assigned = Array.isArray(item.assignedAssets)
      ? item.assignedAssets.length
      : 0;
    return qty > 0 && assigned >= qty;
  };
  const [liveDelivery, setLiveDelivery] = useState(null);


  const computePaymentsSummary = (payments = [], totalOrderAmount = 0) => {
    const totalPaid = (payments || []).reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );
    const balance = Math.max(0, Number(totalOrderAmount || 0) - totalPaid);
    return { totalPaid, balance };
  };
  // 🔹 ALWAYS put hooks first (before any return)
  const activeDelivery = React.useMemo(() => {
    if (!selectedOrder) return null;

    const deliveryType = selectedOrder.deliveryType || "pickup";

    const deliveryId =
      deliveryType === "return"
        ? selectedOrder.returnDeliveryId
        : selectedOrder.pickupDeliveryId;

    if (!deliveryId) return null;

    return {
      deliveryId,
      deliveryType,
      assignedDrivers:
        deliveryType === "return"
          ? selectedOrder.returnAssignedDrivers || []
          : selectedOrder.pickupAssignedDrivers || [],
      status: selectedOrder.deliveryStatus,
    };
  }, [
    selectedOrder,
  ]);
  useEffect(() => {
    if (!activeDelivery?.deliveryId) {
      setLiveDelivery(null);
      return;
    }

    const ref = doc(db, "deliveries", activeDelivery.deliveryId);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setLiveDelivery({ id: snap.id, ...snap.data() });
      }
    });

    return () => unsubscribe();
  }, [activeDelivery?.deliveryId]);

  // ⛔ early return comes AFTER hooks
  if (!selectedOrder) return null;



  const paymentSummary = computePaymentsSummary(
    selectedOrder.payments || [],
    selectedOrder.totals?.total || 0
  );

  // ====== SAME-AS-OrderCreate reserve flow ======

  // Confirm from picker: add selected IDs then reserve each (no checkout)
  const confirmAssignAndReserve = async () => {
    console.log("🔥 confirmAssignAndReserve() clicked");

    try {
      const idx = assetPicker.itemIndex;
      console.log("Item index:", idx);

      if (idx == null) {
        console.log("No item index, closing modal.");
        confirmAssignAssetsFromPicker?.("__CLOSE_ONLY__");
        return;
      }

      const picked = Object.keys(assetPicker.selected || {}).filter(
        (id) => assetPicker.selected[id]
      );

      console.log("Picked assets:", picked);

      if (!picked.length) {
        console.log("No assets selected, closing modal.");
        confirmAssignAssetsFromPicker?.("__CLOSE_ONLY__");
        return;
      }

      const item = selectedOrder.items?.[idx];
      if (!item) {
        console.warn("Item not found for index:", idx);
        return;
      }

      const orderId = selectedOrder.id || selectedOrder.orderNo;
      console.log("Order ID used for reservation:", orderId);
      console.log("Item expectedStartDate:", item?.expectedStartDate);
      console.log("Item expectedEndDate:", item?.expectedEndDate);

      // 1️⃣ Update assigned assets in order
      const existing = Array.isArray(item.assignedAssets)
        ? item.assignedAssets
        : [];

      const merged = Array.from(new Set([...existing, ...picked]));
      console.log("Merged assignedAssets:", merged);

      updateOrderItem?.(idx, { assignedAssets: merged });

      // 2️⃣ Reserve each selected asset with DATE RANGE
      for (const assetDocId of picked) {
        console.log(`⚙️ Reserving asset ${assetDocId}...`);

        try {
          const result = await reserveAsset(assetDocId, {
            reservationId: orderId,
            orderId: orderId,
            customer: selectedOrder.customerName || "",
            from: item?.expectedStartDate || null,
            to: item?.expectedEndDate || null,
            note: `Reserved for order ${selectedOrder.orderNo || orderId}`,
          });

          console.log(`✅ reserveAsset success for ${assetDocId}`, result);
        } catch (err) {
          console.error(`❌ reserveAsset FAILED for ${assetDocId}`, err);
        }
      }

      console.log("✅ All reserve attempts complete, closing picker.");
      confirmAssignAssetsFromPicker?.("__CLOSE_ONLY__");

    } catch (e) {
      console.error("🔥 Assign & reserve error:", e);
      alert(e?.message || "Failed to reserve selected assets");
    }
  };
  const updateCustomerField = async (field, value) => {
    try {
      const orderRef = doc(db, "orders", selectedOrder.id);

      await updateDoc(orderRef, {
        [field]: value,
        updatedAt: serverTimestamp(),
      });

      // update local state instantly (UI feel)
      setSelectedOrder((prev) => ({
        ...prev,
        [field]: value,
      }));
    } catch (e) {
      console.error("Customer update failed", e);
      alert("Failed to update");
    }
  };
  const startEditingCustomer = () => {
    setCustomerDraft({
      customerName: selectedOrder.customerName || "",
      customerPhone: selectedOrder.customerPhone || "",
      customerEmail: selectedOrder.customerEmail || "",
      deliveryAddress: selectedOrder.deliveryAddress || "",
      deliveryContact: {
        ...(selectedOrder.deliveryContact || {}),
      },
    });

    setIsEditingCustomer(true);
  };
  const saveCustomerDetails = async () => {
    const isValid = validateCustomer();

    if (!isValid) return; // 🚫 STOP SAVE

    try {
      const ref = doc(db, "orders", selectedOrder.id);

      const payload = {
        customerName: customerDraft.customerName,
        customerPhone: customerDraft.customerPhone,
        customerEmail: customerDraft.customerEmail,
        deliveryAddress: customerDraft.deliveryAddress,

        deliveryContact: {
          ...(customerDraft.deliveryContact || {}),
          name: customerDraft.customerName,
          phone: customerDraft.customerPhone,
          email: customerDraft.customerEmail,
        },

        updatedAt: serverTimestamp(),
      };

      await updateDoc(ref, payload);

      setSelectedOrder((prev) => ({
        ...prev,
        ...payload,
      }));

      setIsEditingCustomer(false);
      setCustomerErrors({}); // clear errors

    } catch (e) {
      console.error(e);
    }
  };
  const cancelEditingCustomer = () => {
    setIsEditingCustomer(false);
    setCustomerDraft(null);
  };
  const fmtDate = (d) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };


  // Auto-assign N: pick in-stock assets for product+branch, set & reserve (no checkout)
  const autoAssignAndReserve = async (itemIndex, count = 1) => {
    console.log("🔥 autoAssignAndReserve()", { itemIndex, count });

    try {
      const it = selectedOrder.items?.[itemIndex];
      console.log("Item:", it);

      if (!it?.productId) {
        alert("Select a product first");
        return;
      }

      const assets = await listAvailableAssetsForRange({
        productId: it.productId || null,
        branchId: it.branchId || null,
        from: it.expectedStartDate || null,
        to: it.expectedEndDate || null,
      });


      console.log("Available assets from listAssets:", assets);

      if (!assets?.length) {
        alert("No assets available to auto-assign");
        return;
      }

      const pick = assets
        .slice(0, Number(count || 1))
        .map((a) => a.id);

      console.log("Auto-picked assets:", pick);

      const existing = Array.isArray(it.assignedAssets)
        ? it.assignedAssets
        : [];

      const merged = Array.from(new Set([...existing, ...pick]));
      console.log("Merged assignedAssets:", merged);

      // 1️⃣ Update order item
      updateOrderItem?.(itemIndex, {
        assignedAssets: merged,
        autoAssigned: true,
      });

      const orderId = selectedOrder.id || selectedOrder.orderNo;

      // 2️⃣ Reserve each asset with DATE RANGE
      for (const assetDocId of pick) {
        console.log(`⚙️ Reserving auto-picked asset ${assetDocId}`);

        try {
          const result = await reserveAsset(assetDocId, {
            reservationId: orderId,
            orderId: orderId,
            customer: selectedOrder.customerName || "",
            from: it?.expectedStartDate || null, // ✅ FIXED
            to: it?.expectedEndDate || null,     // ✅ FIXED
            note: `Reserved for order ${selectedOrder.orderNo || orderId}`,
          });

          console.log(`✅ reserveAsset success for ${assetDocId}`, result);
        } catch (err) {
          console.error(`❌ reserveAsset FAILED for ${assetDocId}`, err);
        }
      }
    } catch (e) {
      console.error("🔥 autoAssignAndReserve error:", e);
      alert(e?.message || "Auto-assign failed");
    }
  };



  // Unassign chip: remove from item + unreserve (return to in_stock)
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

            {/* <button
              className="cp-btn ghost"
              onClick={() => changeOrderStatus("active")}
              disabled={selectedOrder.status === "active"}
            >
              Activate
            </button> */}
            <button
              className="cp-btn ghost"
              onClick={() => confirmAndChangeStatus("completed")}
              disabled={selectedOrder.status === "completed"}
            >
              Complete
            </button>

            <button
              className="cp-btn ghost"
              onClick={() => confirmAndChangeStatus("cancelled")}
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
            <div className={`customer-box ${isEditingCustomer ? "editing" : ""}`}>

              {/* HEADER */}
              <div className="customer-header">
                <div className="label">Customer</div>

                {!isEditingCustomer ? (
                  <button className="btn-edit" onClick={startEditingCustomer}>
                    ✏️ Edit
                  </button>
                ) : (
                  <div className="customer-actions">
                    <button className="btn-save" onClick={saveCustomerDetails}>
                      Save
                    </button>
                    <button className="btn-cancel" onClick={cancelEditingCustomer}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* NAME */}
              <input
                className={`customer-input ${customerErrors.customerName ? "error" : ""}`}
                placeholder="Customer name"
                disabled={!isEditingCustomer}
                value={
                  isEditingCustomer
                    ? customerDraft?.customerName || ""
                    : selectedOrder?.customerName || ""
                }
                onChange={(e) =>
                  setCustomerDraft((d) => ({
                    ...(d || {}),
                    customerName: e.target.value,
                  }))
                }
              />
              {customerErrors.customerName && (
                <div className="error-text">{customerErrors.customerName}</div>
              )}

              {/* ADDRESS */}
              <textarea
                className={`customer-input ${customerErrors.deliveryAddress ? "error" : ""}`}
                placeholder="Address"
                disabled={!isEditingCustomer}
                value={
                  isEditingCustomer
                    ? customerDraft?.deliveryAddress || ""
                    : selectedOrder?.deliveryAddress || ""
                }
                onChange={(e) =>
                  setCustomerDraft((d) => ({
                    ...(d || {}),
                    deliveryAddress: e.target.value,
                  }))
                }
              />
              {customerErrors.deliveryAddress && (
                <div className="error-text">{customerErrors.deliveryAddress}</div>
              )}

              {/* PHONE + EMAIL */}
              <div className="customer-row">

                {/* PHONE */}
                <div style={{ flex: 1 }}>
                  <input
                    className={`customer-input ${customerErrors.customerPhone ? "error" : ""}`}
                    placeholder="Phone"
                    disabled={!isEditingCustomer}
                    value={
                      isEditingCustomer
                        ? customerDraft?.customerPhone || ""
                        : selectedOrder?.customerPhone || ""
                    }
                   onChange={(e) => {
  const value = e.target.value.replace(/\D/g, "").slice(0, 10);

  setCustomerDraft((d) => ({
    ...(d || {}),
    customerPhone: value,
  }));
}}
                  />
                  {customerErrors.customerPhone && (
                    <div className="error-text">{customerErrors.customerPhone}</div>
                  )}
                </div>

                {/* EMAIL */}
                <div style={{ flex: 1 }}>
                  <input
                    className={`customer-input ${customerErrors.customerEmail ? "error" : ""}`}
                    placeholder="Email"
                    disabled={!isEditingCustomer}
                    value={
                      isEditingCustomer
                        ? customerDraft?.customerEmail || ""
                        : selectedOrder?.customerEmail || ""
                    }
                    onChange={(e) =>
                      setCustomerDraft((d) => ({
                        ...(d || {}),
                        customerEmail: e.target.value,
                      }))
                    }
                  />
                  {customerErrors.customerEmail && (
                    <div className="error-text">{customerErrors.customerEmail}</div>
                  )}
                </div>

              </div>

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
                            <button
                              className="cp-btn ghost"
                              style={{
                                marginTop: 18,
                                padding: "4px 10px",
                                fontSize: "12px",
                                width: "auto"
                              }}
                              onClick={() =>
                                setExtendService({
                                  open: true,
                                  itemIndex: idx,
                                  newEndDate: it.expectedEndDate || "",
                                  extraPrice: "",
                                })
                              }
                            >
                              Extend Service
                            </button>
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
                                    disabled={
                                      !it.productId ||
                                      selectedOrder.deliveryType === "return" ||
                                      !!activeDelivery?.deliveryId
                                    }

                                  >
                                    Assign Assets
                                  </button>
                                  <button
                                    className="cp-btn ghost"
                                    onClick={() =>
                                      autoAssignAndReserve(idx, it.qty || 1)
                                    }
                                    disabled={
                                      !it.productId ||
                                      selectedOrder.deliveryType === "return" ||
                                      !!activeDelivery?.deliveryId
                                    }

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
                                            ? `${meta.metadata?.model ||
                                            meta.productId ||
                                            ""
                                            } · ${(
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
                                          onClick={() => {
                                            if (selectedOrder.deliveryType === "return") return;
                                            unassignAndUnreserve(idx, aid);
                                          }}

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
                          {(it.extensionHistory || []).length > 0 && (
                            <div style={{ marginTop: 12 }}>

                              <div className="muted" style={{ fontWeight: 600 }}>
                                Extension History
                              </div>

                              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>

                                {(it.extensionHistory || []).map((ext, i) => (

                                  <div
                                    key={i}
                                    style={{
                                      background: "#f9fafb",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 6,
                                      padding: 6,
                                      fontSize: 12
                                    }}
                                  >

                                    <div>
                                      <strong>
                                        {fmtDate(ext.previousEndDate)} → {fmtDate(ext.newEndDate)}
                                      </strong>
                                    </div>

                                    <div className="muted">
                                      Extra: ₹{fmtCurrency(ext.extraPrice || 0)}
                                    </div>

                                    <div className="muted">
                                      {ext.date ? new Date(ext.date).toLocaleString() : ""}
                                    </div>

                                  </div>

                                ))}

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
                {/* DELIVERY TYPE */}
                <select
                  className="cp-input"
                  value={selectedOrder.deliveryType ?? "pickup"}
                  onChange={(e) => {
                    const val = e.target.value;

                    setSelectedOrder((prev) => ({
                      ...prev,
                      deliveryType: val,
                    }));
                  }}
                >
                  <option value="pickup">Pickup (Rent Out)</option>
                  <option value="return">Return (Collect Back)</option>
                </select>



                <div style={{ marginTop: 8 }}>
                  <div className="label muted">Add Driver</div>

                  <select
                    className="cp-input"
                    defaultValue=""
                    onChange={(e) => {
                      const driverId = e.target.value;

                      console.log("🟢 UI selected driverId:", driverId);

                      if (!driverId) {
                        console.warn("⚠️ UI driverId empty");
                        return;
                      }

                      assignDriverToOrder(driverId);


                      e.target.selectedIndex = 0;
                    }}
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
                    <button
                      className="cp-btn ghost"
                      onClick={() => navigate("/drivers")}
                    >
                      Manage drivers
                    </button>
                  </div>

                  {/* ASSIGNED DRIVERS */}
                  {activeDelivery?.assignedDrivers?.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div className="label muted">Assigned Drivers</div>

                      {activeDelivery.assignedDrivers.map((d) => (
                        <div
                          key={d.id}
                          style={{
                            padding: "6px 10px",
                            marginTop: 6,
                            borderRadius: 8,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background:
                              selectedOrder.deliveryType === "return"
                                ? "#fff7ed"
                                : "#ecfdf5",
                            fontWeight: 600,
                          }}
                        >
                          <span>{d.name || d.id}</span>
                          <span
                            style={{
                              fontSize: 12,
                              color:
                                selectedOrder.deliveryType === "return"
                                  ? "#9a3412"
                                  : "#065f46",
                            }}
                          >
                            {selectedOrder.deliveryType === "return"
                              ? "Return"
                              : "Pickup"}
                          </span>
                        </div>
                      ))}
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
                    {liveDelivery?.status ||
                      selectedOrder.deliveryStatus ||
                      "—"}

                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    Status is updated automatically by drivers
                    (accept → scan → pickup → delivery → completion)
                  </div>
                </div>
                {/* Return Delivery CTA */}
                <button
                  className="cp-btn"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    try {
                      await createReturnDelivery();
                      alert("Return delivery created");
                    } catch (e) {
                      alert(e.message || "Failed to create return delivery");
                    }
                  }}
                >
                  Create Return Delivery
                </button>







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
                  {/* Tax Breakdown */}
                  {(selectedOrder.totals?.taxes || []).length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {(selectedOrder.totals.taxes || []).map((t, i) => (
                        <div className="meta-row" key={i}>
                          <div className="label">
                            {t.name || "Tax"}
                          </div>
                          <div className="value">
                            {fmtCurrency(t.amount || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total Tax */}
                  <div className="meta-row">
                    <div className="label">Total Tax</div>
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
                          {/* <button
                            className="cp-btn ghost"
                            onClick={() => openPaymentModal(p.id)}
                          >
                            Edit
                          </button> */}
                          {/* <button
                            className="cp-btn ghost"
                            onClick={() => removePayment(p.id)}
                          >
                            Delete
                          </button> */}
                          {/* {p.status !== "refunded" && (
                            <button
                              className="cp-btn ghost"
                              onClick={() => markPaymentStatus(p.id, "refunded")}
                            >
                              Mark refunded
                            </button>
                          )} */}
                          {/* {p.status !== "pending" && (
                            <button
                              className="cp-btn ghost"
                              onClick={() => markPaymentStatus(p.id, "pending")}
                            >
                              Mark pending
                            </button>
                          )} */}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  {/* <button
                    className="cp-btn"
                    onClick={() => {
                      alert("Use the Save action exposed in the parent if needed.");
                    }}
                  >
                    Save Order
                  </button> */}

                  {/* <button
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
                  </button> */}
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
              confirmAssignAssetsFromPicker("__CLOSE_ONLY__")
            }
          >
            <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
              <h4>Select assets for item #{assetPicker.itemIndex + 1}</h4>

              {assetPicker.loading && <div className="muted">Loading…</div>}

              {!assetPicker.loading && (
                <>
                  {/* Header info */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 8,
                      gap: 8,
                    }}
                  >
                    <div className="muted">
                      Assets: {assetPicker.assets.length}
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

                  {/* 🔹 Company filter */}
                  <div style={{ marginTop: 8 }}>
                    <select
                      className="cp-input"
                      value={assetCompanyFilter}
                      onChange={(e) => setAssetCompanyFilter(e.target.value)}
                    >
                      <option value="">All companies</option>
                      {assetCompanies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* 🔹 Asset list grouped by company */}
              <div style={{ maxHeight: 340, overflowY: "auto", marginTop: 10 }}>
                {Object.keys(groupedAssets).length === 0 && (
                  <div className="muted">No assets found.</div>
                )}

                {Object.entries(groupedAssets).map(([company, assets]) => {
                  const allSelected = assets.every(
                    (a) => assetPicker.selected[a.id]
                  );

                  return (
                    <div key={company} style={{ marginBottom: 12 }}>
                      {/* Company header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <strong>🏢 {company}</strong>
                        <button
                          className="cp-link"
                          onClick={() => {
                            setAssetPicker((s) => {
                              const sel = { ...(s.selected || {}) };
                              assets.forEach((a) => {
                                if (allSelected) delete sel[a.id];
                                else sel[a.id] = true;
                              });
                              return { ...s, selected: sel };
                            });
                          }}
                        >
                          {allSelected ? "Unselect all" : "Select all"}
                        </button>
                      </div>

                      {/* Assets */}
                      {assets.map((a) => (
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

                            {/* 🔶 Show reservation date range if reserved */}
                            {a.status === "reserved" &&
                              a.reservation?.from &&
                              a.reservation?.to && (
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: 12,
                                    color: "#92400e",
                                    background: "#fff7ed",
                                    padding: "2px 6px",
                                    borderRadius: 6,
                                    display: "inline-block",
                                  }}
                                >
                                  Reserved: {fmtDate(a.reservation.from)} →{" "}
                                  {fmtDate(a.reservation.to)}
                                </div>
                              )}
                          </div>

                          <div className="muted" style={{ fontSize: 12 }}>
                            <strong style={{ textTransform: "capitalize" }}>
                              {a.status}
                            </strong>
                          </div>
                        </div>
                      ))}

                    </div>
                  );
                })}
              </div>

              {/* Actions */}
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
        {extendService.open && (
          <div className="cp-modal" onClick={() => setExtendService({ open: false })}>
            <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>

              <h4>Extend Service</h4>

              <div style={{ marginTop: 12 }}>
                <div className="label muted">New End Date</div>

                <input
                  type="date"
                  className="cp-input"
                  value={extendService.newEndDate}
                  onChange={(e) =>
                    setExtendService(s => ({
                      ...s,
                      newEndDate: e.target.value
                    }))
                  }
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="label muted">Additional Price</div>

                <input
                  className="cp-input"
                  placeholder="Enter extension price"
                  value={extendService.extraPrice}
                  onChange={(e) =>
                    setExtendService(s => ({
                      ...s,
                      extraPrice: e.target.value
                    }))
                  }
                />
              </div>

              <div style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16
              }}>

                <button
                  className="cp-btn ghost"
                  onClick={() => setExtendService({ open: false })}
                >
                  Cancel
                </button>

                <button
                  className="cp-btn"
                  onClick={async () => {

                    const idx = extendService.itemIndex;
                    const item = selectedOrder.items[idx];

                    const extra = Number(extendService.extraPrice || 0);

                    const oldEnd = item.expectedEndDate;
                    const newEnd = extendService.newEndDate;

                    await updateOrderItem(idx, {
                      expectedEndDate: newEnd,
                      rate: Number(item.rate || 0) + extra,

                      extensionHistory: [
                        ...(item.extensionHistory || []),
                        {
                          previousEndDate: oldEnd,
                          newEndDate: newEnd,
                          extraPrice: extra,
                          date: new Date().toISOString()
                        }
                      ]
                    });
                    await updateDoc(doc(db, "orders", selectedOrder.id), {
                      lastExtendedAt: serverTimestamp()
                    });

                    /* 🔥 ACCOUNT REPORT UPDATE */

                    await updateAccountReport({

                      totalRevenue: increment(extra),
                      totalExtensions: increment(1),


                      /* ======================
                         EXTENSION REVENUE
                      ====================== */

                      totalExtensionRevenue: increment(extra),

                      equipmentRevenue: increment(extra),

                      pendingAmount: increment(extra),

                      equipmentExtensionsCount: increment(1),

                      equipmentExtensionsAmount: increment(extra),

                      extensions: arrayUnion({

                        orderId: selectedOrder.id,
                        orderNo: selectedOrder.orderNo,

                        serviceType: "equipment",

                        serviceName: item.name || "",

                        startDate: item.expectedStartDate,

                        oldEndDate: oldEnd,

                        newEndDate: newEnd,

                        extraAmount: extra,

                        date: new Date().toISOString()

                      })

                    });

                    setExtendService({ open: false });

                  }}
                >
                  Save Extension
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