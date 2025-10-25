// src/pages/Orders.js
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  arrayUnion,
  addDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Orders.css";

import {
  listAssets,
  listBranches,
  checkoutAsset,
  checkinAsset,
} from "../utils/inventory";
import { makeHistoryEntry, propagateToLead } from "../utils/status";

const fmtCurrency = (v) => {
  try {
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return v ?? "0.00";
  }
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null); // full order shown in drawer
  const [branches, setBranches] = useState([]);
  const [productsMap, setProductsMap] = useState({}); // productId => product object
  const [productsList, setProductsList] = useState([]); // array for selects
  const [assetPicker, setAssetPicker] = useState({ open: false, itemIndex: null, assets: [], selected: {}, loading: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assetsById, setAssetsById] = useState({}); // assetId -> asset doc data map
  const [drivers, setDrivers] = useState([]); // driver list for assignment

  const navigate = useNavigate();

  // realtime orders
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setOrders(docs);
        setLoading(false);
      },
      (err) => {
        console.error("orders snapshot", err);
        setError(err.message || "Failed to load orders");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // load branches (one-time)
  useEffect(() => {
    (async () => {
      try {
        const b = await listBranches();
        setBranches(b || []);
      } catch (err) {
        console.warn("listBranches failed", err);
      }
    })();
  }, []);

  // load products & drivers (one-time)
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        const prods = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        const map = {};
        prods.forEach((p) => { map[p.id] = p; });
        setProductsMap(map);
        setProductsList(prods);
      } catch (err) {
        console.error("Failed to load products", err);
      }

      try {
        const dsnap = await getDocs(collection(db, "drivers"));
        setDrivers(dsnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      } catch (err) {
        console.warn("Failed to load drivers", err);
      }
    })();
  }, []);

  // ----------------------
  // Helpers for assignment state
  // ----------------------
  function isFullyAssigned(item) {
    if (!item) return false;
    const qty = Number(item.qty || 0);
    const assigned = Array.isArray(item.assignedAssets) ? item.assignedAssets.length : 0;
    return qty > 0 && assigned >= qty;
  }

  // uses assetsById map if available
  function anyAssignedCheckedOut(item) {
    if (!item || !item.assignedAssets || item.assignedAssets.length === 0) return false;
    return item.assignedAssets.some((aid) => {
      const a = assetsById[aid];
      if (!a) return false;
      const st = (a.status || "").toLowerCase();
      return st === "out_for_rental" || st === "checked_out" || st === "rented";
    });
  }

  // ----------------------
  // open order and prefetch assigned assets metadata
  // ----------------------
  const openOrder = async (order) => {
    setError("");
    try {
      let fresh = order;
      if (order?.id) {
        const snap = await getDoc(doc(db, "orders", order.id));
        if (snap.exists()) fresh = { id: snap.id, ...(snap.data() || {}) };
      }
      setSelectedOrder(fresh);

      // load assigned asset docs metadata into assetsById map
      const assetIds = (fresh.items || []).flatMap((it) => it.assignedAssets || []);
      const uniqueIds = Array.from(new Set(assetIds.filter(Boolean)));
      if (uniqueIds.length) {
        try {
          const promises = uniqueIds.map((aid) => getDoc(doc(db, "assets", aid)));
          const snaps = await Promise.all(promises);
          const map = {};
          snaps.forEach((s) => { if (s.exists()) map[s.id] = { id: s.id, ...(s.data() || {}) }; });
          setAssetsById((prev) => ({ ...prev, ...map }));
        } catch (err) {
          console.warn("Failed to fetch asset metadata", err);
        }
      }
    } catch (err) {
      console.error("openOrder", err);
      setError(err.message || "Failed to open order");
      setSelectedOrder(order);
    }
  };

  const closeOrder = () => {
    setSelectedOrder(null);
    setAssetPicker({ open: false, itemIndex: null, assets: [], selected: {}, loading: false });
    setError("");
    setAssetsById({}); // optional: clear cached asset meta
  };

  // Search + filter
  const filtered = useMemo(() => {
    let arr = [...orders];
    if (filterStatus !== "all") arr = arr.filter((o) => (o.status || "").toLowerCase() === filterStatus.toLowerCase());
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((o) => {
        return (
          (o.orderNo || "").toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          (o.deliveryAddress || "").toLowerCase().includes(q)
        );
      });
    }
    return arr;
  }, [orders, filterStatus, search]);

  // Update an order item (qty, rate, dates, branch, productId)
  const updateOrderItem = async (index, patch) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      clone.items = clone.items || [];
      const prevProductId = clone.items[index]?.productId;
      clone.items[index] = { ...(clone.items[index] || {}), ...patch };

      // if productId changed, clear assignedAssets to avoid mismatches
      if (patch.productId !== undefined && patch.productId !== prevProductId) {
        clone.items[index].assignedAssets = [];
      }

      // recalc amount for item
      clone.items[index].amount = Number(clone.items[index].qty || 0) * Number(clone.items[index].rate || 0);

      // compute totals
      const subtotal = (clone.items || []).reduce((s, it) => s + Number((it.qty || 0) * (it.rate || 0)), 0);
      const totals = { subtotal, total: subtotal };

      // update in firestore
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      // update local
      setSelectedOrder(clone);
      // if we cleared assignedAssets, remove corresponding assets from assetsById map (optional)
      if (patch.productId !== undefined && patch.productId !== prevProductId) {
        // recalc assets map by removing any assets not present in the order anymore
        const remaining = {};
        const keepIds = new Set((clone.items || []).flatMap(it => it.assignedAssets || []));
        Object.keys(assetsById).forEach(k => { if (keepIds.has(k)) remaining[k] = assetsById[k]; });
        setAssetsById(remaining);
      }
    } catch (err) {
      console.error("updateOrderItem", err);
      setError(err.message || "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  // Asset picker open for a specific item: fetch assets filtered by productId + branchId + in_stock
  const openAssetPickerForItem = async (itemIndex) => {
    setError("");
    if (!selectedOrder) return;
    const item = selectedOrder.items?.[itemIndex];
    if (!item) { setError("Item not found"); return; }
    if (!item.productId) { setError("Select a product for this item before assigning assets."); return; }
    setAssetPicker((p) => ({ ...p, open: true, itemIndex, loading: true, assets: [], selected: {} }));
    try {
      const assets = await listAssets({ productId: item.productId, branchId: item.branchId || null, status: "in_stock" });
      setAssetPicker((p) => ({ ...p, assets: assets || [], loading: false }));
    } catch (err) {
      console.error("openAssetPickerForItem", err);
      setError(err.message || "Failed to load assets");
      setAssetPicker((p) => ({ ...p, loading: false, assets: [] }));
    }
  };

  const togglePickerSelect = (assetId) => {
    setAssetPicker((p) => ({ ...p, selected: { ...(p.selected || {}), [assetId]: !(p.selected || {})[assetId] } }));
  };

  const confirmAssignAssetsFromPicker = async (checkoutImmediately = false) => {
    if (!selectedOrder) return;
    const idx = assetPicker.itemIndex;
    const selectedIds = Object.keys(assetPicker.selected || {}).filter((k) => assetPicker.selected[k]);
    if (!selectedIds.length) {
      setError("Select at least one asset to assign.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      clone.items = clone.items || [];
      clone.items[idx].assignedAssets = [...(clone.items[idx].assignedAssets || []), ...selectedIds];

      const subtotal = (clone.items || []).reduce((s, it) => s + Number((it.qty || 0) * (it.rate || 0)), 0);
      const totals = { subtotal, total: subtotal };

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      if (checkoutImmediately) {
        for (const aid of selectedIds) {
          try {
            await checkoutAsset(aid, { rentalId: selectedOrder.id, customer: clone.customerName || "", until: clone.items[idx].expectedEndDate || null, note: `Assigned on order ${clone.orderNo}` });
          } catch (err) {
            console.warn("checkoutAsset failed", aid, err);
          }
        }
      }

      // refresh asset metadata for the new assigned assets (and preserve existing)
      try {
        const newAssets = selectedIds.length ? await Promise.all(selectedIds.map(aid => getDoc(doc(db, "assets", aid)))) : [];
        const map = {};
        newAssets.forEach(s => { if (s.exists()) map[s.id] = { id: s.id, ...(s.data() || {}) }; });
        setAssetsById(prev => ({ ...(prev || {}), ...map }));
      } catch (err) {
        console.warn("Failed to refresh assigned asset metadata", err);
      }

      setSelectedOrder(clone);
      setAssetPicker({ open: false, itemIndex: null, assets: [], selected: {}, loading: false });
    } catch (err) {
      console.error("confirmAssignAssetsFromPicker", err);
      setError(err.message || "Failed to assign assets");
    } finally {
      setSaving(false);
    }
  };

  const checkoutAssignedAssetsForItem = async (itemIndex) => {
    if (!selectedOrder) return;
    const item = selectedOrder.items?.[itemIndex];
    if (!item || !item.assignedAssets || item.assignedAssets.length === 0) {
      setError("No assigned assets to checkout.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      for (const aid of item.assignedAssets) {
        try {
          await checkoutAsset(aid, { rentalId: selectedOrder.id, customer: selectedOrder.customerName || "", until: item.expectedEndDate || null, note: `Checkout for order ${selectedOrder.orderNo}` });
        } catch (err) {
          console.warn("checkoutAssignedAssetsForItem: checkout failed for", aid, err);
        }
      }

      const unique = Array.from(new Set(item.assignedAssets));
      const snaps = await Promise.all(unique.map(aid => getDoc(doc(db, "assets", aid))));
      const map = {};
      snaps.forEach(s => { if (s.exists()) map[s.id] = { id: s.id, ...(s.data() || {}) }; });
      setAssetsById(prev => ({ ...(prev || {}), ...map }));

      const snap = await getDoc(doc(db, "orders", selectedOrder.id));
      if (snap.exists()) setSelectedOrder({ id: snap.id, ...(snap.data() || {}) });
    } catch (err) {
      console.error("checkoutAssignedAssetsForItem", err);
      setError(err.message || "Checkout failed");
    } finally {
      setSaving(false);
    }
  };

  const autoAssignAssets = async (itemIndex, count = 1, checkoutImmediately = false) => {
    if (!selectedOrder) return;
    const item = selectedOrder.items?.[itemIndex];
    if (!item) { setError("No item found"); return; }
    if (!item.productId) { setError("Select product first"); return; }
    setSaving(true);
    setError("");
    try {
      const assets = await listAssets({ productId: item.productId, branchId: item.branchId || null, status: "in_stock" });
      if (!assets || assets.length === 0) {
        setError("No available assets to auto-assign");
        setSaving(false);
        return;
      }
      const picked = assets.slice(0, Number(count || 1)).map((a) => a.id);
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      clone.items[itemIndex].assignedAssets = [...(clone.items[itemIndex].assignedAssets || []), ...picked];

      const subtotal = (clone.items || []).reduce((s, it) => s + Number((it.qty || 0) * (it.rate || 0)), 0);
      const totals = { subtotal, total: subtotal };

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      if (checkoutImmediately) {
        for (const aid of picked) {
          try {
            await checkoutAsset(aid, { rentalId: selectedOrder.id, customer: clone.customerName || "", until: clone.items[itemIndex].expectedEndDate || null, note: `Auto-assigned to order ${clone.orderNo}` });
          } catch (err) {
            console.warn("checkoutAsset failure", aid, err);
          }
        }
      }

      try {
        const snaps = await Promise.all(picked.map(aid => getDoc(doc(db, "assets", aid))));
        const map = {};
        snaps.forEach(s => { if (s.exists()) map[s.id] = { id: s.id, ...(s.data() || {}) }; });
        setAssetsById(prev => ({ ...(prev || {}), ...map }));
      } catch (err) {
        console.warn("Failed to refresh assets metadata after auto-assign", err);
      }

      setSelectedOrder(clone);
    } catch (err) {
      console.error("autoAssignAssets", err);
      setError(err.message || "Auto-assign failed");
    } finally {
      setSaving(false);
    }
  };

  const unassignAsset = async (itemIndex, assetId, checkin = false) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      clone.items = clone.items || [];
      clone.items[itemIndex].assignedAssets = (clone.items[itemIndex].assignedAssets || []).filter((a) => a !== assetId);

      const subtotal = (clone.items || []).reduce((s, it) => s + Number((it.qty || 0) * (it.rate || 0)), 0);
      const totals = { subtotal, total: subtotal };

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      if (checkin) {
        try {
          await checkinAsset(assetId, { note: `Unassigned from order ${selectedOrder.orderNo}` });
        } catch (err) {
          console.warn("checkinAsset failed", assetId, err);
        }
      }

      const keepIds = new Set((clone.items || []).flatMap(it => it.assignedAssets || []));
      const remaining = {};
      Object.keys(assetsById).forEach(k => { if (keepIds.has(k)) remaining[k] = assetsById[k]; });
      setAssetsById(remaining);

      setSelectedOrder(clone);
    } catch (err) {
      console.error("unassignAsset", err);
      setError(err.message || "Failed to unassign asset");
    } finally {
      setSaving(false);
    }
  };

  const checkinAssignedAsset = async (assetId, itemIndex) => {
    setSaving(true);
    setError("");
    try {
      await checkinAsset(assetId, { note: `Returned from order ${selectedOrder.orderNo}` });
      await unassignAsset(itemIndex, assetId, false);
    } catch (err) {
      console.error("checkinAssignedAsset", err);
      setError(err.message || "Failed to checkin asset");
      setSaving(false);
    }
  };

  // Change order status flow
  const changeOrderStatus = async (newStatus) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      if (selectedOrder.requirementId) {
        const entry = makeHistoryEntry(auth.currentUser || {}, {
          type: "order",
          field: "status",
          oldValue: selectedOrder.status || "",
          newValue: newStatus,
          note: `Order ${selectedOrder.orderNo} marked ${newStatus}`,
        });
        entry.at = new Date();

        await updateDoc(doc(db, "requirements", selectedOrder.requirementId), {
          status: newStatus,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || "",
          updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
          history: arrayUnion(entry),
        });

        propagateToLead(selectedOrder.requirementId, "order", selectedOrder.status || "", newStatus, entry.note);
      }

      setSelectedOrder((s) => ({ ...s, status: newStatus }));
    } catch (err) {
      console.error("changeOrderStatus", err);
      setError(err.message || "Failed to change status");
    } finally {
      setSaving(false);
    }
  };

  // ----------------
  // Delivery workflows
  // ----------------

  const createDeliveryDoc = async (payload) => {
    const deliveriesCol = collection(db, "deliveries");
    const ref = await addDoc(deliveriesCol, { ...payload, createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid || "" });
    return ref.id;
  };

  const assignDriverToOrder = async (driverId) => {
    if (!selectedOrder) return setError("No order open");
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return setError("Choose a valid driver");
    setSaving(true);
    try {
      const payload = {
        orderId: selectedOrder.id,
        orderNo: selectedOrder.orderNo,
        driverId,
        driverName: driver.name || "",
        pickupAddress: selectedOrder.pickupAddress || selectedOrder.deliveryAddress || "",
        dropAddress: selectedOrder.deliveryAddress || "",
        items: selectedOrder.items || [],
        status: "assigned",
      };
      const deliveryId = await createDeliveryDoc(payload);
      const deliveryObj = { deliveryId, driverId, driverName: driver.name || "", status: "assigned", createdAt: serverTimestamp() };

      // update order - use client Date inside arrayUnion for history
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        delivery: deliveryObj,
        deliveryStatus: "assigned",
        deliveryHistory: arrayUnion({ at: new Date(), by: auth.currentUser?.uid || "", stage: "assigned", note: `Driver ${driver.name} assigned` }),
        updatedAt: serverTimestamp(),
      });

      // requirement history if linked
      if (selectedOrder.requirementId) {
        const entry = makeHistoryEntry(auth.currentUser || {}, {
          type: "delivery",
          field: "driverAssigned",
          oldValue: "",
          newValue: driverId,
          note: `Driver ${driver.name} assigned`,
        });
        entry.at = new Date();
        await updateDoc(doc(db, "requirements", selectedOrder.requirementId), { history: arrayUnion(entry), updatedAt: serverTimestamp() });
        propagateToLead(selectedOrder.requirementId, "delivery", "", "assigned", entry.note);
      }

      const snap = await getDoc(doc(db, "orders", selectedOrder.id));
      if (snap.exists()) setSelectedOrder({ id: snap.id, ...(snap.data() || {}) });
    } catch (err) {
      console.error("assignDriverToOrder", err);
      setError(err.message || "Failed to assign driver");
    } finally {
      setSaving(false);
    }
  };

  const updateDeliveryStage = async (newStage, note = "") => {
    if (!selectedOrder) return setError("No order open");
    if (!selectedOrder.delivery?.deliveryId) return setError("No delivery linked to this order");
    setSaving(true);
    try {
      await updateDoc(doc(db, "deliveries", selectedOrder.delivery.deliveryId), {
        status: newStage,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
        history: arrayUnion({ at: new Date(), by: auth.currentUser?.uid || "", stage: newStage, note }),
      });

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        deliveryStatus: newStage,
        deliveryHistory: arrayUnion({ at: new Date(), by: auth.currentUser?.uid || "", stage: newStage, note }),
        updatedAt: serverTimestamp(),
      });

      if (selectedOrder.requirementId) {
        const entry = makeHistoryEntry(auth.currentUser || {}, {
          type: "delivery",
          field: "status",
          oldValue: selectedOrder.delivery?.status || "",
          newValue: newStage,
          note: note || `Delivery ${newStage}`,
        });
        entry.at = new Date();
        await updateDoc(doc(db, "requirements", selectedOrder.requirementId), { history: arrayUnion(entry), updatedAt: serverTimestamp() });
        propagateToLead(selectedOrder.requirementId, "delivery", selectedOrder.delivery?.status || "", newStage, entry.note);
      }

      const snap = await getDoc(doc(db, "orders", selectedOrder.id));
      if (snap.exists()) setSelectedOrder({ id: snap.id, ...(snap.data() || {}) });
    } catch (err) {
      console.error("updateDeliveryStage", err);
      setError(err.message || "Failed to update delivery stage");
    } finally {
      setSaving(false);
    }
  };

  const driverAcceptDelivery = async () => updateDeliveryStage("accepted", "Driver accepted");
  const markPickedUp = async () => updateDeliveryStage("picked_up", "Driver picked up items");
  const markInTransit = async () => updateDeliveryStage("in_transit", "In transit");
  const markDelivered = async () => updateDeliveryStage("delivered", "Delivered to customer");
  const confirmDeliveryAccepted = async () => updateDeliveryStage("completed", "Customer accepted delivery");

  // UI render
  if (loading) return <div className="orders-wrap"><div className="orders-card">Loading orders…</div></div>;

  return (
    <div className="orders-wrap">
      <header className="orders-header">
        <h1>Orders / Rentals</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="cp-input" style={{ width: 160 }}>
            <option value="all">All status</option>
            <option value="created">Created</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input placeholder="Search order no / customer / address" value={search} onChange={(e) => setSearch(e.target.value)} className="cp-input" style={{ width: 340 }} />
        </div>
      </header>

      {error && <div className="orders-error">{error}</div>}

      <table className="orders-table">
        <thead>
          <tr>
            <th>Order No</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Delivery</th>
            <th>Created</th>
            <th>Items</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((o) => (
            <tr key={o.id}>
              <td className="strong">{o.orderNo || o.id}</td>
              <td>{o.customerName || "—"}</td>
              <td style={{ textTransform: "capitalize" }}>{o.status || "created"}</td>
              <td style={{ textTransform: "capitalize" }}>{o.deliveryStatus || o.delivery?.status || "—"}</td>
              <td>{o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleString() : "—"}</td>
              <td>{(o.items || []).length}</td>
              <td>{fmtCurrency(o.totals?.total || 0)}</td>
              <td>
                <button className="cp-link" onClick={() => openOrder(o)}>View</button>
                {o.status !== "completed" && <button className="cp-link" onClick={() => changeOrderStatus("completed")}>Mark Completed</button>}
                <button className="cp-link" onClick={() => navigate(`/orders/${o.id}`)}>Open</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan="8" className="orders-empty">No orders found.</td></tr>}
        </tbody>
      </table>

      {/* Drawer */}
      {selectedOrder && (
        <div className="cp-drawer" onClick={(e) => { if (e.target.classList.contains("cp-drawer")) closeOrder(); }}>
          <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
            <div className="cp-form-head">
              <h2>Order — {selectedOrder.orderNo || selectedOrder.id}</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ textAlign: "right", marginRight: 12 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Status</div>
                  <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{selectedOrder.status}</div>
                </div>

                <button className="cp-btn ghost" onClick={() => changeOrderStatus("active")} disabled={selectedOrder.status === "active"}>Activate</button>
                <button className="cp-btn ghost" onClick={() => changeOrderStatus("completed")} disabled={selectedOrder.status === "completed"}>Complete</button>
                <button className="cp-btn ghost" onClick={() => changeOrderStatus("cancelled")} disabled={selectedOrder.status === "cancelled"}>Cancel</button>
                <button className="cp-btn" onClick={() => closeOrder()}>Close</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18 }}>
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div className="label">Customer</div>
                  <div style={{ fontWeight: 700 }}>{selectedOrder.customerName || "—"}</div>
                  <div className="muted">{selectedOrder.deliveryAddress || "—"}</div>
                </div>

                <div>
                  <h3>Items</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(selectedOrder.items || []).map((it, idx) => {
                      const fullyAssigned = isFullyAssigned(it);
                      const checkedOutPresent = anyAssignedCheckedOut(it);

                      return (
                        <div key={idx} style={{ border: "1px solid #eef2f7", padding: 10, borderRadius: 8 }}>
                          <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontWeight: 700 }}>{it.name || "—"}</div>
                                <div className="muted">Product: {productsMap[it.productId]?.name || it.productId || "—"}</div>
                              </div>

                              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                                <div>
                                  <div className="muted">Qty</div>
                                  <input className="cp-input" style={{ width: 84 }} value={it.qty} onChange={(e) => updateOrderItem(idx, { qty: Number(e.target.value || 0) })} />
                                </div>

                                <div>
                                  <div className="muted">Rate</div>
                                  <input className="cp-input" style={{ width: 120 }} value={it.rate} onChange={(e) => updateOrderItem(idx, { rate: Number(e.target.value || 0) })} />
                                </div>

                                <div>
                                  <div className="muted">From</div>
                                  <input className="cp-input" style={{ width: 140 }} value={it.expectedStartDate || ""} onChange={(e) => updateOrderItem(idx, { expectedStartDate: e.target.value })} />
                                </div>

                                <div>
                                  <div className="muted">To</div>
                                  <input className="cp-input" style={{ width: 140 }} value={it.expectedEndDate || ""} onChange={(e) => updateOrderItem(idx, { expectedEndDate: e.target.value })} />
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                                <div>
                                  <div className="muted">Branch</div>
                                  <select className="cp-input" value={it.branchId || ""} onChange={(e) => updateOrderItem(idx, { branchId: e.target.value })}>
                                    <option value="">Default branch</option>
                                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                  </select>
                                </div>

                                <div style={{ marginLeft: 8 }}>
                                  <div className="muted">Product</div>
                                  <select
                                    className="cp-input"
                                    value={it.productId || ""}
                                    onChange={(e) => updateOrderItem(idx, { productId: e.target.value })}
                                    style={{ width: 220 }}
                                  >
                                    <option value="">Select product</option>
                                    {productsList.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</option>)}
                                  </select>
                                </div>

                                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                  {/* New logic: show different actions depending on assignment state */}
                                  {fullyAssigned ? (
                                    <>
                                      <button className="cp-btn ghost" onClick={() => openAssetPickerForItem(idx)}>
                                        {checkedOutPresent ? "View / Reassign" : "View Assigned"}
                                      </button>

                                      {!checkedOutPresent && (
                                        <button className="cp-btn ghost" onClick={() => checkoutAssignedAssetsForItem(idx)}>
                                          Checkout Assigned
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <button className="cp-btn ghost" onClick={() => openAssetPickerForItem(idx)} disabled={!it.productId}>
                                        Assign Assets
                                      </button>
                                      <button className="cp-btn ghost" onClick={() => autoAssignAssets(idx, it.qty || 1, true)} disabled={!it.productId}>
                                        Auto-assign & Checkout
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* assigned assets list */}
                              {(it.assignedAssets || []).length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                  <div className="muted">Assigned assets</div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                                    {it.assignedAssets.map((aid) => {
                                      const meta = assetsById[aid];
                                      return (
                                        <div key={aid} className="asset-card">
                                          <div>
                                            <div style={{ fontWeight: 700 }}>{meta?.assetId || aid}</div>
                                            <div className="meta" style={{ fontSize: 12 }}>
                                              {meta ? `${meta.metadata?.model || meta.productId || ""} · ${(branches.find(b => b.id === meta.branchId) || {}).name || meta.branchId || ""}` : ""}
                                            </div>
                                          </div>

                                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            {(meta && ((meta.status || "").toLowerCase() === "out_for_rental" || (meta.status || "").toLowerCase() === "checked_out")) ? (
                                              <button className="cp-btn ghost" onClick={() => checkinAssignedAsset(aid, idx)}>Check-in</button>
                                            ) : (
                                              <button className="cp-btn ghost" onClick={() => checkoutAssignedAssetsForItem(idx)}>Checkout Assigned</button>
                                            )}

                                            <button className="cp-btn ghost" onClick={() => unassignAsset(idx, aid, false)}>Unassign</button>
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

              <div>
                <div className="details-right">
                  <div className="meta-row"><div className="label">Order No</div><div className="value">{selectedOrder.orderNo}</div></div>
                  <div className="meta-row"><div className="label">Created</div><div className="value">{selectedOrder.createdAt?.seconds ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString() : "—"}</div></div>
                  <div className="meta-row"><div className="label">Customer</div><div className="value">{selectedOrder.customerName || "—"}</div></div>

                  <div style={{ marginTop: 12 }}>
                    <h4>Delivery</h4>

                    <div style={{ marginTop: 8 }}>
                      <div className="label muted">Driver</div>
                      <select className="cp-input" value={selectedOrder.delivery?.driverId || ""} onChange={(e) => setSelectedOrder((s) => ({ ...s, delivery: { ...(s.delivery || {}), driverId: e.target.value } }))}>
                        <option value="">Select driver</option>
                        {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}{d.phone ? ` · ${d.phone}` : ""}</option>)}
                      </select>

                      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                        {/* Show Assign button only when no delivery has been created/linked yet */}
                        {(!selectedOrder.delivery?.deliveryId && (selectedOrder.deliveryStatus !== "assigned")) ? (
                          <button className="cp-btn" onClick={() => {
                            const did = selectedOrder.delivery?.driverId;
                            if (!did) { setError("Choose a driver first"); return; }
                            assignDriverToOrder(did);
                          }} disabled={!selectedOrder.delivery?.driverId}>Assign driver</button>
                        ) : (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{ padding: "6px 10px", background: "#ecfdf5", borderRadius: 8, color: "#065f46", fontWeight: 700 }}>
                              Assigned: {selectedOrder.delivery?.driverName || ((drivers.find(d => d.id === selectedOrder.delivery?.driverId) || {}).name || selectedOrder.delivery?.driverId || "—")}
                            </div>
                            {/* Reassign button appears only as a control if you want to allow reassignments */}
                            <button
                              className="cp-btn ghost"
                              onClick={() => {
                                // enable reassign flow by clearing delivery linkage locally (admin action)
                                // caution: this does not delete deliveries doc created earlier; adjust to your preference
                                setSelectedOrder((s) => ({ ...s, delivery: { ...(s.delivery || {}), deliveryId: null }, deliveryStatus: null }));
                                setError("");
                              }}
                            >
                              Reassign
                            </button>
                          </div>
                        )}

                        <button className="cp-btn ghost" onClick={() => navigate("/drivers")}>Manage drivers</button>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div className="label muted">Delivery Status</div>
                      <div style={{ fontWeight: 700, marginTop: 6, textTransform: "capitalize" }}>{selectedOrder.deliveryStatus || selectedOrder.delivery?.status || "—"}</div>

                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <button className="cp-btn ghost" onClick={driverAcceptDelivery} disabled={!selectedOrder.delivery?.deliveryId || (selectedOrder.deliveryStatus === "accepted")}>Driver Accept</button>
                        <button className="cp-btn ghost" onClick={markPickedUp} disabled={!selectedOrder.delivery?.deliveryId || (selectedOrder.deliveryStatus === "picked_up")}>Picked up</button>
                        <button className="cp-btn ghost" onClick={markInTransit} disabled={!selectedOrder.delivery?.deliveryId || (selectedOrder.deliveryStatus === "in_transit")}>In transit</button>
                        <button className="cp-btn ghost" onClick={markDelivered} disabled={!selectedOrder.delivery?.deliveryId || (selectedOrder.deliveryStatus === "delivered")}>Delivered</button>
                        <button className="cp-btn" onClick={confirmDeliveryAccepted} disabled={!selectedOrder.delivery?.deliveryId || (selectedOrder.deliveryStatus === "completed")}>Accept delivery</button>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div className="label muted">Delivery history</div>
                      <div style={{ marginTop: 8 }}>
                        {(selectedOrder.deliveryHistory || []).slice().reverse().map((h, i) => (
                          <div key={i} style={{ padding: 8, borderBottom: "1px solid #f3f6f9" }}>
                            <div style={{ fontSize: 13 }}>{h.stage || h.note}</div>
                            <div className="muted" style={{ fontSize: 12 }}>{h.by || ""} • {h.at?.seconds ? new Date(h.at.seconds * 1000).toLocaleString() : (h.at ? new Date(h.at).toLocaleString() : "")}</div>
                          </div>
                        ))}
                        {(!selectedOrder.deliveryHistory || selectedOrder.deliveryHistory.length === 0) && <div className="muted">No delivery events yet.</div>}
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <h4>Totals</h4>
                      <div className="meta-row"><div className="label">Subtotal</div><div className="value">{fmtCurrency(selectedOrder.totals?.subtotal || 0)}</div></div>
                      <div className="meta-row"><div className="label">Discount</div><div className="value">{selectedOrder.discount?.type === "percent" ? `${selectedOrder.discount?.value || 0}%` : fmtCurrency(selectedOrder.discount?.value || 0)}</div></div>
                      <div className="meta-row"><div className="label">Tax</div><div className="value">{fmtCurrency(selectedOrder.totals?.totalTax || 0)}</div></div>
                      <div className="meta-row"><div className="label strong">Total</div><div className="value strong">{fmtCurrency(selectedOrder.totals?.total || 0)}</div></div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <button className="cp-btn" onClick={async () => {
                        setSaving(true);
                        try {
                          const subtotal = (selectedOrder.items || []).reduce((s, it) => s + Number((it.qty || 0) * (it.rate || 0)), 0);
                          await updateDoc(doc(db, "orders", selectedOrder.id), {
                            items: selectedOrder.items || [],
                            totals: { subtotal, total: subtotal },
                            updatedAt: serverTimestamp(),
                            updatedBy: auth.currentUser?.uid || "",
                            updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
                          });
                          alert("Order saved");
                        } catch (err) {
                          console.error("saveOrder", err);
                          setError(err.message || "Failed to save order");
                        } finally {
                          setSaving(false);
                        }
                      }}>Save Order</button>

                      <button className="cp-btn ghost" style={{ marginLeft: 8 }} onClick={() => {
                        if (selectedOrder.orderNo) {
                          navigator.clipboard?.writeText(JSON.stringify(selectedOrder, null, 2));
                          alert("Copied order JSON to clipboard");
                        }
                      }}>Copy JSON</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Asset picker modal */}
            {assetPicker.open && assetPicker.itemIndex !== null && (
              <div className="cp-modal" onClick={() => setAssetPicker({ open: false, itemIndex: null, assets: [], selected: {}, loading: false })}>
                <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
                  <h4>Select assets for item #{assetPicker.itemIndex + 1}</h4>

                  {assetPicker.loading && <div className="muted">Loading…</div>}
                  {!assetPicker.loading && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <div className="muted">In stock: {assetPicker.assets.length}</div>
                    <div className="muted">Product: {productsMap[selectedOrder.items?.[assetPicker.itemIndex]?.productId]?.name || selectedOrder.items?.[assetPicker.itemIndex]?.productId || "—"}</div>
                  </div>}

                  <div style={{ maxHeight: 340, overflowY: "auto", marginTop: 10 }}>
                    {assetPicker.assets.map((a) => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderBottom: "1px solid #eef2f7" }}>
                        <input type="checkbox" checked={!!assetPicker.selected[a.id]} onChange={() => togglePickerSelect(a.id)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{a.assetId || a.id}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{a.metadata?.model || a.productId} · {(branches.find(b => b.id === a.branchId) || {}).name || a.branchId || "—"}</div>
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>Status: <strong style={{ textTransform: "capitalize" }}>{a.status}</strong></div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                    <button className="cp-btn ghost" onClick={() => setAssetPicker({ open: false, itemIndex: null, assets: [], selected: {}, loading: false })}>Cancel</button>
                    <button className="cp-btn" onClick={() => confirmAssignAssetsFromPicker(false)}>Assign selected</button>
                    <button className="cp-btn" onClick={() => confirmAssignAssetsFromPicker(true)}>Assign & Checkout</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
