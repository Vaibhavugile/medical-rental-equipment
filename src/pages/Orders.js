// src/pages/Orders.jsx
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

const safeNum = (v) => (typeof v === "number" ? v : Number(v || 0));

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

  // load products (one-time) so selects show names
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

  // Update a field on the open order doc (optimistic local update + firestore)
  const updateOrderField = async (path, value) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      // update locally
      setSelectedOrder((s) => {
        const clone = JSON.parse(JSON.stringify(s || {}));
        const parts = path.split(".");
        let cur = clone;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in cur)) cur[parts[i]] = {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
        return clone;
      });

      // persist to firestore
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        [path]: value,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
      });
    } catch (err) {
      console.error("updateOrderField", err);
      setError(err.message || "Failed to update order");
    } finally {
      setSaving(false);
    }
  };

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
      const totals = computeTotalsFromItems(clone.items, clone.discount, clone.taxes);

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

  const computeTotalsFromItems = (items = [], discount = { type: "percent", value: 0 }, taxes = []) => {
    const subtotal = (items || []).reduce((s, it) => s + Number((it.qty || 0) * (it.rate || 0)), 0);
    let discountAmount = 0;
    if (discount) {
      if ((discount.type || "").toLowerCase() === "percent") discountAmount = subtotal * (Number(discount.value || 0) / 100);
      else discountAmount = Number(discount.value || 0);
    }
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxBreakdown = (taxes || []).map((t) => ({ ...t, amount: taxable * (Number(t.rate || 0) / 100) }));
    const totalTax = taxBreakdown.reduce((s, t) => s + (t.amount || 0), 0);
    const total = Math.max(0, taxable + totalTax);
    return { subtotal, discountAmount, taxBreakdown, totalTax, total };
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

  // Confirm asset assignment from picker: attach asset ids to the order item and optionally checkout assets
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
      // local update
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      clone.items = clone.items || [];
      clone.items[idx].assignedAssets = [...(clone.items[idx].assignedAssets || []), ...selectedIds];

      // persist
      const totals = computeTotalsFromItems(clone.items, clone.discount, clone.taxes);
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      // optionally checkout assets immediately (mark out_for_rental)
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

  // Checkout currently assigned assets for an item (no new assignment)
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

      // refresh assets metadata and update assetsById
      const unique = Array.from(new Set(item.assignedAssets));
      const snaps = await Promise.all(unique.map(aid => getDoc(doc(db, "assets", aid))));
      const map = {};
      snaps.forEach(s => { if (s.exists()) map[s.id] = { id: s.id, ...(s.data() || {}) }; });
      setAssetsById(prev => ({ ...(prev || {}), ...map }));

      // reload order from server to reflect latest statuses
      const snap = await getDoc(doc(db, "orders", selectedOrder.id));
      if (snap.exists()) setSelectedOrder({ id: snap.id, ...(snap.data() || {}) });
    } catch (err) {
      console.error("checkoutAssignedAssetsForItem", err);
      setError(err.message || "Checkout failed");
    } finally {
      setSaving(false);
    }
  };

  // Auto-assign N assets for an item
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

      // persist
      const totals = computeTotalsFromItems(clone.items, clone.discount, clone.taxes);
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

      // refresh assets metadata for picked ids
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

  // Unassign an asset from an item (optionally check it in / mark in_stock)
  const unassignAsset = async (itemIndex, assetId, checkin = false) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      clone.items = clone.items || [];
      clone.items[itemIndex].assignedAssets = (clone.items[itemIndex].assignedAssets || []).filter((a) => a !== assetId);

      // persist
      const totals = computeTotalsFromItems(clone.items, clone.discount, clone.taxes);
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      // optionally checkin the asset
      if (checkin) {
        try {
          await checkinAsset(assetId, { note: `Unassigned from order ${selectedOrder.orderNo}` });
        } catch (err) {
          console.warn("checkinAsset failed", assetId, err);
        }
      }

      // remove asset meta from map if it's no longer assigned anywhere
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

  // Checkin a single asset (mark returned)
  const checkinAssignedAsset = async (assetId, itemIndex) => {
    setSaving(true);
    setError("");
    try {
      await checkinAsset(assetId, { note: `Returned from order ${selectedOrder.orderNo}` });
      // remove from assignedAssets array for item
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

      // update requirement history if linked
      if (selectedOrder.requirementId) {
        const entry = makeHistoryEntry(auth.currentUser || {}, {
          type: "order",
          field: "status",
          oldValue: selectedOrder.status || "",
          newValue: newStatus,
          note: `Order ${selectedOrder.orderNo} marked ${newStatus}`,
        });
        await updateDoc(doc(db, "requirements", selectedOrder.requirementId), {
          status: newStatus,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || "",
          updatedByName: auth.currentUser?.displayName || auth.currentUser?.email || "",
          history: arrayUnion ? arrayUnion(entry) : entry,
        });

        propagateToLead(selectedOrder.requirementId, "order", selectedOrder.status || "", newStatus, entry.note);
      }

      // update local
      setSelectedOrder((s) => ({ ...s, status: newStatus }));
    } catch (err) {
      console.error("changeOrderStatus", err);
      setError(err.message || "Failed to change status");
    } finally {
      setSaving(false);
    }
  };

  // Render
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
          {filtered.length === 0 && <tr><td colSpan="7" className="orders-empty">No orders found.</td></tr>}
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18 }}>
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
                                  <div className="muted">Days</div>
                                  <input className="cp-input" style={{ width: 100 }} value={it.days || 0} onChange={(e) => updateOrderItem(idx, { days: Number(e.target.value || 0) })} />
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
                                            {/* If asset meta shows it's out_for_rental, show Check-in */}
                                            {(meta && ((meta.status || "").toLowerCase() === "out_for_rental" || (meta.status || "").toLowerCase() === "checked_out")) ? (
                                              <button className="cp-btn ghost" onClick={() => checkinAssignedAsset(aid, idx)}>Check-in</button>
                                            ) : (
                                              // If not checked out yet, allow Checkout (single asset) or Check-in won't make sense
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
                    <h4>Totals</h4>
                    <div className="meta-row"><div className="label">Subtotal</div><div className="value">{fmtCurrency(selectedOrder.totals?.subtotal || 0)}</div></div>
                    <div className="meta-row"><div className="label">Discount</div><div className="value">{selectedOrder.discount?.type === "percent" ? `${selectedOrder.discount?.value || 0}%` : fmtCurrency(selectedOrder.discount?.value || 0)}</div></div>
                    <div className="meta-row"><div className="label">Tax</div><div className="value">{fmtCurrency(selectedOrder.totals?.totalTax || 0)}</div></div>
                    <div className="meta-row"><div className="label strong">Total</div><div className="value strong">{fmtCurrency(selectedOrder.totals?.total || 0)}</div></div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <button className="cp-btn" onClick={() => {
                      (async () => {
                        setSaving(true);
                        try {
                          const totals = computeTotalsFromItems(selectedOrder.items || [], selectedOrder.discount, selectedOrder.taxes);
                          await updateDoc(doc(db, "orders", selectedOrder.id), {
                            items: selectedOrder.items || [],
                            totals,
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
                      })();
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
