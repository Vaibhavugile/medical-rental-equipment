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
  addDoc,
  deleteDoc,
  arrayUnion,
  deleteField,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Orders.css";
import OrdersSidebar from "../components/OrdersSidebar";


import {
  listAssets,
  listBranches,
  checkoutAsset,
  checkinAsset,
} from "../utils/inventory";
import { makeHistoryEntry, propagateToLead } from "../utils/status";

// NEW: extracted drawer component
import OrderDrawer from "../components/OrderDrawer";

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


function calcTotals(
  items = [],
  discount = { type: "percent", value: 0 },
  taxes = []
) {
  const subtotal = (items || []).reduce((s, it) => {
    const q = Number(it?.qty || 0);
    const r = Number(it?.rate || 0);
    return s + q * r;
  }, 0);

  // compute discount amount
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

  // compute tax breakdown
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

  const totalTax = taxBreakdown.reduce(
    (s, tt) => s + Number(tt.amount || 0),
    0
  );
  const total = Number((taxableAmount + totalTax).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount: discountAmount,
    taxes: taxBreakdown,
    totalTax: Number(totalTax.toFixed(2)),
    total,
  };
}

// ---------- Detailed status derivation (computed, non-destructive) ----------
function normalizeDateStr(v) {
  // accepts "YYYY-MM-DD", Date, Firestore Timestamp, or falsy
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  try {
    const d = v?.seconds ? new Date(v.seconds * 1000) : new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

function getStartDate(order) {
  const items = order?.items || [];
  const dates = items
    .map(it => normalizeDateStr(it.expectedStartDate))
    .filter(Boolean)
    .sort();
  return dates[0] || null; // earliest
}

function getEndDate(order) {
  const items = order?.items || [];
  const dates = items
    .map(it => normalizeDateStr(it.expectedEndDate))
    .filter(Boolean)
    .sort();
  return dates[dates.length - 1] || null; // latest
}

function todayYMD() {
  // compute local "today" in browser (Asia/Kolkata for your users)
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function assetsAssignmentState(order) {
  const items = order?.items || [];
  if (items.length === 0) return "none";
  let any = false;
  let all = true;
  for (const it of items) {
    const qty = Number(it?.qty || 0);
    const assigned = Array.isArray(it?.assignedAssets) ? it.assignedAssets.length : 0;
    if (assigned > 0) any = true;
    if (qty > 0 && assigned < qty) all = false;
  }
  if (!any) return "none";
  return all ? "full" : "partial";
}

function isDriverAssigned(order) {
  return Boolean(order?.delivery?.deliveryId || order?.deliveryStatus === "assigned" || order?.delivery?.driverId);
}
// Derived status counts (computed)


// Highest-priority rule first; returns a single status string
export function deriveDetailedStatus(order) {
  const base = (order?.status || "").toLowerCase();
  if (base === "cancelled") return "cancelled";
  if (base === "completed") return "completed";

  // Delivery-driven states take precedence while moving
  const dstat = (order?.deliveryStatus || order?.delivery?.status || "").toLowerCase();
  if (dstat === "in_transit") return "in_transit";
  if (dstat === "delivered") return "delivered";
  if (dstat === "picked_up") return "picked_up";
  if (dstat === "accepted") return "driver_accepted";

  // Assignment states
  const astate = assetsAssignmentState(order);
  const driver = isDriverAssigned(order);

  // Date-aware states
  const start = getStartDate(order);
  const end = getEndDate(order);
  const today = todayYMD();

  // If rental is active, surface day-based hints
  if (base === "active") {
    if (end && end === today) return "ending_today";
    return "active";
  }

  // Before active: dispatch readiness
  if (astate === "full" && driver) {
    if (start && start === today) return "starts_today";
    if (end && end === today) return "ending_today";
    return "ready_to_dispatch";
  }

  if (driver && astate !== "full") return "driver_assigned";
  if (astate === "partial") return "assets_partial";
  if (astate === "full") return "assets_assigned";

  if (start && start === today) return "starts_today";
  if (end && end === today) return "ending_today";

  // Fallbacks
  if (base === "created") return "created";
  return base || "created";
}

// Optional: badge color map you can reuse in list + drawer
export const detailedStatusColor = (s) => {
  switch ((s || "").toLowerCase()) {
    case "created": return "#6b7280";            // gray
    case "assets_partial": return "#2563eb";     // blue
    case "assets_assigned": return "#1d4ed8";    // blue-700
    case "driver_assigned": return "#7c3aed";    // purple
    case "ready_to_dispatch": return "#4f46e5";  // indigo
    case "starts_today": return "#0ea5e9";       // sky
    case "in_transit": return "#f59e0b";         // amber
    case "picked_up": return "#fb923c";          // orange
    case "delivered": return "#10b981";          // emerald
    case "active": return "#14b8a6";             // teal
    case "ending_today": return "#065f46";       // dark green
    case "completed": return "#047857";          // green
    case "cancelled": return "#b91c1c";          // red
    default: return "#6b7280";
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
  const [assetPicker, setAssetPicker] = useState({
    open: false,
    itemIndex: null,
    assets: [],
    selected: {},
    loading: false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assetsById, setAssetsById] = useState({}); // assetId -> asset doc data map
  const [drivers, setDrivers] = useState([]); // driver list for assignment
// Filters
const [filterDerived, setFilterDerived] = useState("all");   // detailed (computed) status
const [filterDelivery, setFilterDelivery] = useState("all"); // deliveryStatus

  // Payment modal state (uses paymentId for edits)
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    editingPaymentId: null,
    saving: false,
    form: null,
  });

  const navigate = useNavigate();

  // realtime orders
  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qy,
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
// Derived status counts (computed)
const derivedCounts = useMemo(() => {
  const m = {
    all: orders.length,
    created: 0, assets_partial: 0, assets_assigned: 0, driver_assigned: 0,
    ready_to_dispatch: 0, starts_today: 0, ending_today: 0,
    in_transit: 0, delivered: 0, active: 0, completed: 0, cancelled: 0,
  };
  for (const o of orders) {
    const k = deriveDetailedStatus(o) || "created";
    if (m[k] != null) m[k] += 1;
  }
  return m;
}, [orders]);

// Delivery counts (raw)
const deliveryCounts = useMemo(() => {
  const m = {
    all: orders.length,
    assigned: 0, accepted: 0, picked_up: 0, in_transit: 0, delivered: 0, completed: 0,
  };
  for (const o of orders) {
    const k = (o.deliveryStatus || o.delivery?.status || "").toLowerCase();
    if (m[k] != null) m[k] += 1;
  }
  return m;
}, [orders]);

  // load products & drivers (one-time)
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        const prods = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        const map = {};
        prods.forEach((p) => {
          map[p.id] = p;
        });
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
    const assigned = Array.isArray(item.assignedAssets)
      ? item.assignedAssets.length
      : 0;
    return qty > 0 && assigned >= qty;
  }

  // uses assetsById map if available
  function anyAssignedCheckedOut(item) {
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
  }

  // Payment totals helper
  function computePaymentsSummary(payments = [], totalOrderAmount = 0) {
    const totalPaid = (payments || []).reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );
    const balance = Math.max(
      0,
      Number(totalOrderAmount || 0) - totalPaid
    );
    return { totalPaid, balance };
  }

  // helper: fetch payments from subcollection for an order
  const fetchPaymentsForOrder = async (orderId) => {
    try {
      const paymentsCol = collection(db, "orders", orderId, "payments");
      const qy = query(paymentsCol, orderBy("createdAt", "asc"));
      const snap = await getDocs(qy);
      const payments = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() || {}),
      }));
      return payments;
    } catch (err) {
      console.error("fetchPaymentsForOrder", err);
      return [];
    }
  };

  // ----------------------
  // open order and prefetch assigned assets metadata + payments
  // ----------------------
  const openOrder = async (order) => {
    setError("");
    try {
      let fresh = order;
      if (order?.id) {
        const snap = await getDoc(doc(db, "orders", order.id));
        if (snap.exists()) fresh = { id: snap.id, ...(snap.data() || {}) };
      }

      // fetch payments from the payments subcollection
      const payments = fresh?.id ? await fetchPaymentsForOrder(fresh.id) : [];
      fresh.payments = payments || [];

      setSelectedOrder(fresh);

      // load assigned asset docs metadata into assetsById map
      const assetIds = (fresh.items || []).flatMap(
        (it) => it.assignedAssets || []
      );
      const uniqueIds = Array.from(new Set(assetIds.filter(Boolean)));
      if (uniqueIds.length) {
        try {
          const promises = uniqueIds.map((aid) =>
            getDoc(doc(db, "assets", aid))
          );
          const snaps = await Promise.all(promises);
          const map = {};
          snaps.forEach((s) => {
            if (s.exists())
              map[s.id] = { id: s.id, ...(s.data() || {}) };
          });
          setAssetsById((prev) => ({ ...(prev || {}), ...map }));
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
    setAssetPicker({
      open: false,
      itemIndex: null,
      assets: [],
      selected: {},
      loading: false,
    });
    setError("");
    setAssetsById({});
    setPaymentModal({
      open: false,
      editingPaymentId: null,
      saving: false,
      form: null,
    });
  };

  // Search + filter
  const filtered = useMemo(() => {
  let arr = [...orders];

  // 1) Detailed (computed) order status filter
  if (filterDerived !== "all") {
    arr = arr.filter((o) => deriveDetailedStatus(o) === filterDerived);
  }

  // 2) Delivery status filter (raw deliveryStatus)
  if (filterDelivery !== "all") {
    const d = (o) => (o.deliveryStatus || o.delivery?.status || "").toLowerCase();
    arr = arr.filter((o) => d(o) === filterDelivery.toLowerCase());
  }

  // 3) Search
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
}, [orders, filterDerived, filterDelivery, search]);


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
      clone.items[index].amount =
        Number(clone.items[index].qty || 0) *
        Number(clone.items[index].rate || 0);

      // compute totals using canonical calcTotals
      const totals = calcTotals(
        clone.items || [],
        clone.discount || selectedOrder?.discount || {
          type: "percent",
          value: 0,
        },
        clone.taxes || selectedOrder?.taxes || []
      );

      // persist
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName:
          auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      // update UI
      setSelectedOrder((s) => ({ ...(s || {}), items: clone.items, totals }));
    } catch (err) {
      console.error("updateOrderItem", err);
      setError(err.message || "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  // -------- Asset assignment / picker helpers (existing logic) --------
  const openAssetPickerForItem = async (itemIndex) => {
    setAssetPicker((s) => ({ ...s, open: true, itemIndex, loading: true }));
    try {
      const it = selectedOrder?.items?.[itemIndex];
      const productId = it?.productId || "";
      const branchId = it?.branchId || "";
      const assets = await listAssets({ productId, branchId });
      const selected = {};
      (it?.assignedAssets || []).forEach((aid) => (selected[aid] = true));
      setAssetPicker({
        open: true,
        itemIndex,
        assets: assets || [],
        selected,
        loading: false,
      });
    } catch (err) {
      console.error("openAssetPickerForItem", err);
      setAssetPicker((s) => ({ ...s, loading: false }));
      setError(err.message || "Failed to load assets");
    }
  };

  const togglePickerSelect = (assetId) => {
    setAssetPicker((s) => {
      const sel = { ...(s.selected || {}) };
      if (sel[assetId]) delete sel[assetId];
      else sel[assetId] = true;
      return { ...s, selected: sel };
    });
  };

  const confirmAssignAssetsFromPicker = async (alsoCheckout = false) => {
    if (assetPicker.itemIndex == null) return;
    setSaving(true);
    setError("");
    try {
      const idx = assetPicker.itemIndex;
      const chosen = Object.keys(assetPicker.selected || {});
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      clone.items[idx] = { ...(clone.items[idx] || {}), assignedAssets: chosen };

      // persist chosen assets
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        updatedAt: serverTimestamp(),
      });

      // update UI assets map for quick status checks
      if (chosen.length) {
        try {
          const snaps = await Promise.all(
            chosen.map((aid) => getDoc(doc(db, "assets", aid)))
          );
          const map = {};
          snaps.forEach((s) => {
            if (s.exists())
              map[s.id] = { id: s.id, ...(s.data() || {}) };
          });
          setAssetsById((prev) => ({ ...(prev || {}), ...map }));
        } catch (err) {
          console.warn("fetch assigned assets after assign failed", err);
        }
      }

      setSelectedOrder(clone);
      setAssetPicker({
        open: false,
        itemIndex: null,
        assets: [],
        selected: {},
        loading: false,
      });

      // optional: checkout immediately
      if (alsoCheckout && chosen.length) {
        await checkoutAssignedAssetsForItem(idx);
      }
    } catch (err) {
      console.error("confirmAssignAssetsFromPicker", err);
      setError(err.message || "Failed to assign assets");
    } finally {
      setSaving(false);
    }
  };

  const checkoutAssignedAssetsForItem = async (itemIndex) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      const it = selectedOrder.items?.[itemIndex];
      const ids = it?.assignedAssets || [];
      for (const aid of ids) {
        await checkoutAsset(aid, {
          rentalId: selectedOrder.id,
          orderNo: selectedOrder.orderNo || "",
          customer: selectedOrder.customerName || "",
          expectedReturn: it?.expectedEndDate || null,
          until: it?.expectedEndDate || null,
          note: `Checked out for order ${selectedOrder.orderNo || selectedOrder.id}`,
        });
      }
      // refresh asset statuses into map
      if (ids.length) {
        const snaps = await Promise.all(
          ids.map((aid) => getDoc(doc(db, "assets", aid)))
        );
        const map = {};
        snaps.forEach((s) => {
          if (s.exists())
            map[s.id] = { id: s.id, ...(s.data() || {}) };
        });
        setAssetsById((prev) => ({ ...(prev || {}), ...map }));
      }
    } catch (err) {
      console.error("checkoutAssignedAssetsForItem", err);
      setError(err.message || "Failed to checkout assets");
    } finally {
      setSaving(false);
    }
  };

  const autoAssignAssets = async (itemIndex, qty = 1, checkoutNow = false) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      const it = selectedOrder.items?.[itemIndex];
      const productId = it?.productId || "";
      const branchId = it?.branchId || "";
      const assets = await listAssets({ productId, branchId });

      const available = (assets || []).filter(
        (a) => (a.status || "").toLowerCase() === "available"
      );
      const pick = available.slice(0, Number(qty || 1)).map((a) => a.id);
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      clone.items[itemIndex] = {
        ...(clone.items[itemIndex] || {}),
        assignedAssets: pick,
      };

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        updatedAt: serverTimestamp(),
      });

      setSelectedOrder(clone);

      if (checkoutNow && pick.length) {
        await checkoutAssignedAssetsForItem(itemIndex);
      }
    } catch (err) {
      console.error("autoAssignAssets", err);
      setError(err.message || "Failed to auto-assign");
    } finally {
      setSaving(false);
    }
  };

  const unassignAsset = async (itemIndex, assetId, skipPersist = false) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      const arr = (clone.items?.[itemIndex]?.assignedAssets || []).filter(
        (id) => id !== assetId
      );
      clone.items[itemIndex].assignedAssets = arr;

      if (!skipPersist) {
        await updateDoc(doc(db, "orders", selectedOrder.id), {
          items: clone.items,
          updatedAt: serverTimestamp(),
        });
      }

      // keep assetsById entries that are still referenced
      const keepIds = new Set(
        (clone.items || []).flatMap((it) => it.assignedAssets || [])
      );
      const remaining = {};
      Object.keys(assetsById).forEach((k) => {
        if (keepIds.has(k)) remaining[k] = assetsById[k];
      });
      setAssetsById(remaining);

      // refresh payments too
      clone.payments = await fetchPaymentsForOrder(selectedOrder.id);

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
      await checkinAsset(assetId, {
        note: `Returned from order ${selectedOrder.orderNo}`,
      });
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
        updatedByName:
          auth.currentUser?.displayName || auth.currentUser?.email || "",
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

        await updateDoc(
          doc(db, "requirements", selectedOrder.requirementId),
          {
            status: newStatus,
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.uid || "",
            updatedByName:
              auth.currentUser?.displayName || auth.currentUser?.email || "",
          }
        );

        propagateToLead(
          selectedOrder.requirementId,
          "order",
          selectedOrder.status || "",
          newStatus,
          entry.note
        );
      }

      // If activating, checkout assets (compat path)
      if (newStatus === "active") {
        try {
          const freshSnap = await getDoc(
            doc(db, "orders", selectedOrder.id)
          );
          const freshOrder = freshSnap.exists()
            ? { id: freshSnap.id, ...(freshSnap.data() || {}) }
            : selectedOrder;
          const items = freshOrder.items || [];

          for (const it of items) {
            if (
              Array.isArray(it.assignedAssets) &&
              it.assignedAssets.length
            ) {
              for (const aid of it.assignedAssets) {
                try {
                  await checkoutAsset(aid, {
                    rentalId: freshOrder.id,
                    orderNo: freshOrder.orderNo || "",
                    customer: freshOrder.customerName || "",
                    expectedReturn: it.expectedEndDate || null,
                    until: it.expectedEndDate || null,
                    note: `Checked out when order ${
                      freshOrder.orderNo || freshOrder.id
                    } activated`,
                  });
                } catch (err) {
                  console.warn(
                    "activate -> checkoutAsset failed for",
                    aid,
                    err
                  );
                }
              }
            }
          }

          const unique = Array.from(
            new Set(items.flatMap((it) => it.assignedAssets || []))
          );
          if (unique.length) {
            try {
              const snaps = await Promise.all(
                unique.map((aid) => getDoc(doc(db, "assets", aid)))
              );
              const map = {};
              snaps.forEach((s) => {
                if (s.exists())
                  map[s.id] = { id: s.id, ...(s.data() || {}) };
              });
              setAssetsById((prev) => ({ ...(prev || {}), ...map }));
            } catch (err) {
              console.warn(
                "Failed to refresh assets metadata after activate",
                err
              );
            }
          }

          const postSnap = await getDoc(
            doc(db, "orders", selectedOrder.id)
          );
          if (postSnap.exists()) {
            const fresh = { id: postSnap.id, ...(postSnap.data() || {}) };
            fresh.payments = await fetchPaymentsForOrder(fresh.id);
            setSelectedOrder(fresh);
          } else setSelectedOrder((s) => ({ ...(s || {}), status: newStatus }));
        } catch (err) {
          console.warn("activate checkout flow failed", err);
        }
      } else {
        setSelectedOrder((s) => ({ ...(s || {}), status: newStatus }));
      }
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
    const ref = await addDoc(deliveriesCol, {
      ...payload,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || "",
    });
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
        pickupAddress:
          selectedOrder.pickupAddress || selectedOrder.deliveryAddress || "",
        dropAddress: selectedOrder.deliveryAddress || "",
        items: selectedOrder.items || [],
        status: "assigned",
        fetchedBy: auth.currentUser?.uid || "",
        fetchedByName:
          auth.currentUser?.displayName || auth.currentUser?.email || "",
        createdAt: serverTimestamp(),
      };
      const deliveryId = await createDeliveryDoc(payload);
      const deliveryObj = {
        deliveryId,
        driverId,
        driverName: driver.name || "",
        status: "assigned",
        createdAt: serverTimestamp(),
      };

      // history entry (client timestamp)
      const orderHistoryEntry = {
        at: new Date().toISOString(),
        by: auth.currentUser?.uid || "",
        stage: "assigned",
        note: `Driver ${driver.name} assigned`,
      };

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        delivery: deliveryObj,
        deliveryStatus: "assigned",
        deliveryHistory: arrayUnion(orderHistoryEntry),
        updatedAt: serverTimestamp(),
      });

      if (selectedOrder.requirementId) {
        const entry = makeHistoryEntry(auth.currentUser || {}, {
          type: "delivery",
          field: "driverAssigned",
          oldValue: "",
          newValue: driverId,
          note: `Driver ${driver.name} assigned`,
        });
        entry.at = new Date();
        try {
          await updateDoc(
            doc(db, "requirements", selectedOrder.requirementId),
            {
              history: (selectedOrder.history || []).concat([entry]),
              updatedAt: serverTimestamp(),
            }
          );
        } catch (err) {
          console.warn("updating requirement history failed", err);
        }
        propagateToLead(
          selectedOrder.requirementId,
          "delivery",
          "",
          "assigned",
          entry.note
        );
      }

      const snap = await getDoc(doc(db, "orders", selectedOrder.id));
      if (snap.exists()) {
        const fresh = { id: snap.id, ...(snap.data() || {}) };
        fresh.payments = await fetchPaymentsForOrder(fresh.id);
        setSelectedOrder(fresh);
      }
    } catch (err) {
      console.error("assignDriverToOrder", err);
      setError(err.message || "Failed to assign driver");
    } finally {
      setSaving(false);
    }
  };

  const updateDeliveryStage = async (newStage, note = "") => {
    if (!selectedOrder) return setError("No order open");
    if (!selectedOrder.delivery?.deliveryId)
      return setError("No delivery linked to this order");
    setSaving(true);
    try {
      const deliveryRef = doc(
        db,
        "deliveries",
        selectedOrder.delivery.deliveryId
      );
      const orderRef = doc(db, "orders", selectedOrder.id);

      const hist = {
        at: new Date().toISOString(),
        by: auth.currentUser?.uid || "",
        stage: newStage,
        note,
      };

      await updateDoc(deliveryRef, {
        status: newStage,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName:
          auth.currentUser?.displayName || auth.currentUser?.email || "",
        history: arrayUnion(hist),
      });

      await updateDoc(orderRef, {
        deliveryStatus: newStage,
        deliveryHistory: arrayUnion(hist),
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
        await updateDoc(
          doc(db, "requirements", selectedOrder.requirementId),
          {
            history: (selectedOrder.history || []).concat([entry]),
            updatedAt: serverTimestamp(),
          }
        );
        propagateToLead(
          selectedOrder.requirementId,
          "delivery",
          selectedOrder.delivery?.status || "",
          newStage,
          entry.note
        );
      }

      const snap = await getDoc(orderRef);
      if (snap.exists()) {
        const fresh = { id: snap.id, ...(snap.data() || {}) };
        fresh.payments = await fetchPaymentsForOrder(fresh.id);
        setSelectedOrder(fresh);
      }
    } catch (err) {
      console.error("updateDeliveryStage", err);
      setError(err.message || "Failed to update delivery stage");
    } finally {
      setSaving(false);
    }
  };

  const driverAcceptDelivery = async () =>
    updateDeliveryStage("accepted", "Driver accepted");
  const markPickedUp = async () =>
    updateDeliveryStage("picked_up", "Driver picked up items");
  const markInTransit = async () =>
    updateDeliveryStage("in_transit", "In transit");
  const markDelivered = async () =>
    updateDeliveryStage("delivered", "Delivered to customer");
  const confirmDeliveryAccepted = async () =>
    updateDeliveryStage("completed", "Customer accepted delivery");

  // ----------------
  // Payments management (subcollection)
  // ----------------

  const openPaymentModal = (editingPaymentId = null) => {
    if (!selectedOrder) return;
    if (editingPaymentId) {
      const editing =
        (selectedOrder.payments || []).find(
          (p) => p.id === editingPaymentId
        ) || null;
      setPaymentModal({
        open: true,
        editingPaymentId,
        saving: false,
        form: editing ? { ...editing } : null,
      });
    } else {
      setPaymentModal({
        open: true,
        editingPaymentId: null,
        saving: false,
        form: {
          amount: "",
          method: "cash",
          date: new Date().toISOString().slice(0, 10),
          reference: "",
          note: "",
          status: "completed",
        },
      });
    }
  };

  const closePaymentModal = () =>
    setPaymentModal({
      open: false,
      editingPaymentId: null,
      saving: false,
      form: null,
    });

  const updatePaymentForm = (patch) => {
    setPaymentModal((s) => ({ ...s, form: { ...(s.form || {}), ...patch } }));
  };

  const savePayment = async () => {
    if (!selectedOrder || !paymentModal.form) return;
    const form = paymentModal.form;
    const amount = Number(form.amount || 0);
    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount");
      return;
    }
    setPaymentModal((s) => ({ ...s, saving: true }));
    setError("");
    try {
      const paymentsCol = collection(db, "orders", selectedOrder.id, "payments");

      if (paymentModal.editingPaymentId) {
        const paymentDocRef = doc(
          db,
          "orders",
          selectedOrder.id,
          "payments",
          paymentModal.editingPaymentId
        );
        await updateDoc(paymentDocRef, {
          amount,
          method: form.method || "cash",
          date: form.date || new Date().toISOString(),
          reference: form.reference || "",
          note: form.note || "",
          status: form.status || "completed",
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || "",
          updatedByName:
            auth.currentUser?.displayName || auth.currentUser?.email || "",
        });
      } else {
        await addDoc(paymentsCol, {
          amount,
          method: form.method || "cash",
          date: form.date || new Date().toISOString(),
          reference: form.reference || "",
          note: form.note || "",
          status: form.status || "completed",
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.uid || "",
          createdByName:
            auth.currentUser?.displayName || auth.currentUser?.email || "",
        });
      }

      const snap = await getDoc(doc(db, "orders", selectedOrder.id));
      if (snap.exists()) {
        const fresh = { id: snap.id, ...(snap.data() || {}) };
        fresh.payments = await fetchPaymentsForOrder(fresh.id);
        setSelectedOrder(fresh);
      }

      closePaymentModal();
    } catch (err) {
      console.error("savePayment", err);
      setError(err.message || "Failed to save payment");
    } finally {
      setPaymentModal((s) => ({ ...s, saving: false }));
    }
  };

  const removePayment = async (paymentId) => {
    if (!selectedOrder) return;
    if (!window.confirm("Remove this payment? This cannot be undone.")) return;
    setSaving(true);
    setError("");
    try {
      const paymentDocRef = doc(
        db,
        "orders",
        selectedOrder.id,
        "payments",
        paymentId
      );
      await deleteDoc(paymentDocRef);

      const snap = await getDoc(doc(db, "orders", selectedOrder.id));
      if (snap.exists()) {
        const fresh = { id: snap.id, ...(snap.data() || {}) };
        fresh.payments = await fetchPaymentsForOrder(fresh.id);
        setSelectedOrder(fresh);
      }
    } catch (err) {
      console.error("removePayment", err);
      setError(err.message || "Failed to remove payment");
    } finally {
      setSaving(false);
    }
  };

  const markPaymentStatus = async (paymentId, status) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      const paymentDocRef = doc(
        db,
        "orders",
        selectedOrder.id,
        "payments",
        paymentId
      );
      await updateDoc(paymentDocRef, {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName:
          auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      const snap = await getDoc(doc(db, "orders", selectedOrder.id));
      if (snap.exists()) {
        const fresh = { id: snap.id, ...(snap.data() || {}) };
        fresh.payments = await fetchPaymentsForOrder(fresh.id);
        setSelectedOrder(fresh);
      }
    } catch (err) {
      console.error("markPaymentStatus", err);
      setError(err.message || "Failed to update payment status");
    } finally {
      setSaving(false);
    }
  };

  // ----------------
  // UI render
  // ----------------
  if (loading)
    return (
      <div className="orders-wrap">
        <div className="orders-card">Loading orders…</div>
      </div>
    );

  const paymentSummary = selectedOrder
    ? computePaymentsSummary(
        selectedOrder.payments || [],
        selectedOrder.totals?.total || 0
      )
    : { totalPaid: 0, balance: 0 };

  return (

    <div className="orders-layout" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
  {/* LEFT SIDEBAR */}
  <OrdersSidebar
    search={search}
    setSearch={setSearch}
    filterDerived={filterDerived}
    setFilterDerived={setFilterDerived}
    filterDelivery={filterDelivery}
    setFilterDelivery={setFilterDelivery}
    derivedCounts={derivedCounts}
    deliveryCounts={deliveryCounts}
    onClearAll={() => { setFilterDerived("all"); setFilterDelivery("all"); setSearch(""); }}
  />

  {/* RIGHT MAIN CONTENT */}
  <main className="orders-main">
    <header className="orders-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <h1>Orders / Rentals</h1>
      <div className="muted" style={{ fontSize: 13 }}>
        Showing <strong>{filtered.length}</strong> of {orders.length}
      </div>
    </header>

    {error && <div className="orders-error">{error}</div>}

    <table className="orders-table">
      <thead>
        <tr>
          <th>Order No</th>
          <th>Customer</th>
          <th>Status</th>      {/* detailed (computed) */}
          <th>Delivery</th>    {/* deliveryStatus */}
          <th>Created</th>
          <th>Items</th>
          <th>Total</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        {filtered.map((o) => {
          const pretty = deriveDetailedStatus(o); // computed smart status
          const badgeBg = detailedStatusColor(pretty);

          return (
            <tr key={o.id}>
              <td className="strong">{o.orderNo || o.id}</td>
              <td>{o.customerName || "—"}</td>

              {/* Detailed Status */}
              <td style={{ textTransform: "capitalize" }}>
                <span
                  title={`Base: ${o.status || "—"}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: badgeBg,
                    color: "#fff",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.85)",
                    }}
                  />
                  {pretty || (o.status || "—")}
                </span>
              </td>

              {/* Delivery status */}
              <td style={{ textTransform: "capitalize" }}>
                {o.deliveryStatus || o.delivery?.status || "—"}
              </td>

              <td>
                {o.createdAt?.seconds
                  ? new Date(o.createdAt.seconds * 1000).toLocaleString()
                  : "—"}
              </td>
              <td>{(o.items || []).length}</td>
              <td>{fmtCurrency(o.totals?.total || 0)}</td>

              <td>
                <button className="cp-link" onClick={() => openOrder(o)}>
                  View
                </button>
                {o.status !== "completed" && (
                  <button
                    className="cp-link"
                    onClick={() => changeOrderStatus("completed")}
                  >
                    Mark Completed
                  </button>
                )}
                <button
                  className="cp-link"
                  onClick={() => navigate(`/orders/${o.id}`)}
                >
                  Open
                </button>
              </td>
            </tr>
          );
        })}

        {filtered.length === 0 && (
          <tr>
            <td colSpan="8" className="orders-empty">
              No orders found.
            </td>
          </tr>
        )}
      </tbody>
    </table>

    {/* Extracted Drawer */}
    {selectedOrder && (
      <OrderDrawer
        /* state */
        selectedOrder={selectedOrder}
        branches={branches}
        productsMap={productsMap}
        productsList={productsList}
        drivers={drivers}
        assetsById={assetsById}
        assetPicker={assetPicker}
        paymentModal={paymentModal}
        error={error}
        saving={saving}
        /* actions */
        closeOrder={closeOrder}
        detailedStatus={selectedOrder ? deriveDetailedStatus(selectedOrder) : null}
        detailedStatusColor={detailedStatusColor}
        changeOrderStatus={changeOrderStatus}
        updateOrderItem={updateOrderItem}
        openAssetPickerForItem={openAssetPickerForItem}
        togglePickerSelect={togglePickerSelect}
        confirmAssignAssetsFromPicker={(arg) => {
          if (arg === "__CLOSE_ONLY__") {
            setAssetPicker({
              open: false,
              itemIndex: null,
              assets: [],
              selected: {},
              loading: false,
            });
            return;
          }
          return confirmAssignAssetsFromPicker(arg);
        }}
        checkoutAssignedAssetsForItem={checkoutAssignedAssetsForItem}
        autoAssignAssets={autoAssignAssets}
        unassignAsset={unassignAsset}
        checkinAssignedAsset={checkinAssignedAsset}
        assignDriverToOrder={assignDriverToOrder}
        driverAcceptDelivery={driverAcceptDelivery}
        markPickedUp={markPickedUp}
        markInTransit={markInTransit}
        markDelivered={markDelivered}
        confirmDeliveryAccepted={confirmDeliveryAccepted}
        openPaymentModal={openPaymentModal}
        closePaymentModal={closePaymentModal}
        updatePaymentForm={updatePaymentForm}
        savePayment={savePayment}
        removePayment={removePayment}
        markPaymentStatus={markPaymentStatus}
        /* misc */
        navigate={navigate}
      />
    )}
  </main>
</div>

  );
}
