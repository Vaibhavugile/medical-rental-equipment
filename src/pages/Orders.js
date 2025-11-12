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

// Extracted drawer component
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

  let discountAmount = 0;
  try {
    if (discount && Number(discount.value)) {
      if ((discount.type || "").toLowerCase() === "percent") {
        discountAmount = subtotal * (Number(discount.value) / 100);
      } else {
        discountAmount = Number(discount.value || 0);
      }
    }
  } catch {
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

// ---------- Derived status helpers ----------
function normalizeDateStr(v) {
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
    .map((it) => normalizeDateStr(it.expectedStartDate || it.startDate))
    .filter(Boolean)
    .sort();
  return dates[0] || null;
}

function getEndDate(order) {
  const items = order?.items || [];
  const dates = items
    .map((it) => normalizeDateStr(it.expectedEndDate || it.endDate))
    .filter(Boolean)
    .sort();
  return dates[dates.length - 1] || null;
}

function todayYMD() {
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
    const assigned = Array.isArray(it?.assignedAssets)
      ? it.assignedAssets.length
      : 0;
    if (assigned > 0) any = true;
    if (qty > 0 && assigned < qty) all = false;
  }
  if (!any) return "none";
  return all ? "full" : "partial";
}

function isDriverAssigned(order) {
  return Boolean(
    order?.delivery?.driverId ||
      order?.delivery?.deliveryId ||
      (order?.deliveryStatus || "").toLowerCase() === "assigned"
  );
}

/* ------------- MAIN derived status (priority) -------------
   1) cancelled / completed
   2) starts_today (earliest start date === today)
   3) ending_today (latest end date === today)
   4) delivery pipeline (in_transit, delivered, picked_up, accepted)
   5) ready_to_dispatch (assets full + driver)
   6) driver / assets
   7) base (created/active/etc) or "created"
----------------------------------------------------------- */
export function deriveDetailedStatus(order) {
  const base = (order?.status || "").toLowerCase();
  if (base === "cancelled") return "cancelled";
  if (base === "completed") return "completed";

  const start = getStartDate(order);
  const end = getEndDate(order);
  const today = todayYMD();

  if (start && start === today) return "starts_today";
  if (end && end === today) return "ending_today";

  const dstat = (order?.deliveryStatus || order?.delivery?.status || "")
    .toLowerCase();
  if (dstat === "in_transit") return "in_transit";
  if (dstat === "delivered") return "delivered";
  if (dstat === "picked_up") return "picked_up";
  if (dstat === "accepted") return "driver_accepted";

  const astate = assetsAssignmentState(order);
  const driver = isDriverAssigned(order);

  if (astate === "full" && driver) return "ready_to_dispatch";
  if (driver && astate !== "full") return "driver_assigned";
  if (astate === "partial") return "assets_partial";
  if (astate === "full") return "assets_assigned";

  if (base === "active") return "active";
  if (base === "created") return "created";
  return base || "created";
}

export const detailedStatusColor = (s) => {
  switch ((s || "").toLowerCase()) {
    case "created":
      return "#6b7280";
    case "assets_partial":
      return "#2563eb";
    case "assets_assigned":
      return "#1d4ed8";
    case "driver_assigned":
      return "#7c3aed";
    case "ready_to_dispatch":
      return "#4f46e5";
    case "starts_today":
      return "#0ea5e9";
    case "in_transit":
      return "#f59e0b";
    case "picked_up":
      return "#fb923c";
    case "delivered":
      return "#10b981";
    case "active":
      return "#14b8a6";
    case "ending_today":
      return "#065f46";
    case "completed":
      return "#047857";
    case "cancelled":
      return "#b91c1c";
    default:
      return "#6b7280";
  }
};

// ---------- secondary resource badges under main badge ----------
const getResourceBadges = (order) => {
  const hints = [];

  // assets
  const items = order?.items || [];
  let any = false;
  let all = true;
  for (const it of items) {
    const qty = Number(it?.qty || 0);
    const assigned = Array.isArray(it?.assignedAssets)
      ? it.assignedAssets.length
      : 0;
    if (assigned > 0) any = true;
    if (qty > 0 && assigned < qty) all = false;
  }
  if (all && any) hints.push({ key: "assets_assigned", label: "assets assigned" });
  else if (any) hints.push({ key: "assets_partial", label: "assets partial" });

  // driver
  const driverAssigned =
    !!(order?.delivery?.driverId || order?.delivery?.deliveryId) ||
    (order?.deliveryStatus || "").toLowerCase() === "assigned";
  if (driverAssigned) hints.push({ key: "driver_assigned", label: "driver assigned" });

  // delivery stages — include assigned too (you asked for this)
  const d = (order?.deliveryStatus || order?.delivery?.status || "").toLowerCase();
  if (d === "assigned") hints.push({ key: "delivery_assigned", label: "delivery assigned" });
  if (["accepted", "picked_up", "in_transit", "delivered", "completed"].includes(d)) {
    hints.push({ key: `delivery_${d}`, label: d.replaceAll("_", " ") });
  }

  return hints;
};

const hintColor = (key) => {
  switch (key) {
    case "assets_assigned":
      return { bg: "rgba(29,78,216,.10)", border: "#1d4ed8", text: "#1d4ed8" };
    case "assets_partial":
      return { bg: "rgba(37,99,235,.08)", border: "#2563eb", text: "#2563eb" };
    case "driver_assigned":
      return { bg: "rgba(124,58,237,.10)", border: "#7c3aed", text: "#7c3aed" };
    case "delivery_assigned":
      return { bg: "rgba(2,132,199,.10)", border: "#0284c7", text: "#0284c7" };
    case "delivery_accepted":
      return { bg: "rgba(2,132,199,.10)", border: "#0284c7", text: "#0284c7" };
    case "delivery_picked_up":
      return { bg: "rgba(245,158,11,.10)", border: "#f59e0b", text: "#b45309" };
    case "delivery_in_transit":
      return { bg: "rgba(250,204,21,.12)", border: "#ca8a04", text: "#a16207" };
    case "delivery_delivered":
      return { bg: "rgba(16,185,129,.12)", border: "#10b981", text: "#047857" };
    case "delivery_completed":
      return { bg: "rgba(34,197,94,.12)", border: "#22c55e", text: "#15803d" };
    default:
      return { bg: "rgba(107,114,128,.10)", border: "#6b7280", text: "#374151" };
  }
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // sidebar filters
  const [filterDerived, setFilterDerived] = useState("all");
  const [filterDelivery, setFilterDelivery] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [branches, setBranches] = useState([]);
  const [productsMap, setProductsMap] = useState({});
  const [productsList, setProductsList] = useState([]);
  const [assetPicker, setAssetPicker] = useState({
    open: false,
    itemIndex: null,
    assets: [],
    selected: {},
    loading: false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assetsById, setAssetsById] = useState({});
  const [drivers, setDrivers] = useState([]);

  // Payments
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

  // branches
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

  const derivedCounts = useMemo(() => {
    const m = {
      all: orders.length,
      created: 0,
      assets_partial: 0,
      assets_assigned: 0,
      driver_assigned: 0,
      ready_to_dispatch: 0,
      starts_today: 0,
      ending_today: 0,
      in_transit: 0,
      delivered: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const o of orders) {
      const k = deriveDetailedStatus(o) || "created";
      if (m[k] != null) m[k] += 1;
    }
    return m;
  }, [orders]);

  const deliveryCounts = useMemo(() => {
    const m = {
      all: orders.length,
      assigned: 0,
      accepted: 0,
      picked_up: 0,
      in_transit: 0,
      delivered: 0,
      completed: 0,
    };
    for (const o of orders) {
      const k = (o.deliveryStatus || o.delivery?.status || "").toLowerCase();
      if (m[k] != null) m[k] += 1;
    }
    return m;
  }, [orders]);

  // products & drivers
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        const prods = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        const map = {};
        prods.forEach((p) => (map[p.id] = p));
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

  function computePaymentsSummary(payments = [], totalOrderAmount = 0) {
    const totalPaid = (payments || []).reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );
    const balance = Math.max(0, Number(totalOrderAmount || 0) - totalPaid);
    return { totalPaid, balance };
  }

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

  const openOrder = async (order) => {
    setError("");
    try {
      let fresh = order;
      if (order?.id) {
        const snap = await getDoc(doc(db, "orders", order.id));
        if (snap.exists()) fresh = { id: snap.id, ...(snap.data() || {}) };
      }

      const payments = fresh?.id ? await fetchPaymentsForOrder(fresh.id) : [];
      fresh.payments = payments || [];

      setSelectedOrder(fresh);

      const assetIds = (fresh.items || []).flatMap((it) => it.assignedAssets || []);
      const uniqueIds = Array.from(new Set(assetIds.filter(Boolean)));
      if (uniqueIds.length) {
        try {
          const promises = uniqueIds.map((aid) => getDoc(doc(db, "assets", aid)));
          const snaps = await Promise.all(promises);
          const map = {};
          snaps.forEach((s) => {
            if (s.exists()) map[s.id] = { id: s.id, ...(s.data() || {}) };
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

  const filtered = useMemo(() => {
    let arr = [...orders];

    if (filterDerived !== "all") {
      arr = arr.filter((o) => deriveDetailedStatus(o) === filterDerived);
    }

    if (filterDelivery !== "all") {
      arr = arr.filter(
        (o) =>
          (o.deliveryStatus || o.delivery?.status || "").toLowerCase() ===
          filterDelivery.toLowerCase()
      );
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(
        (o) =>
          (o.orderNo || "").toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          (o.deliveryAddress || "").toLowerCase().includes(q)
      );
    }

    return arr;
  }, [orders, filterDerived, filterDelivery, search]);

  // Item updates
  const updateOrderItem = async (index, patch) => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      const clone = JSON.parse(JSON.stringify(selectedOrder));
      clone.items = clone.items || [];
      const prevProductId = clone.items[index]?.productId;
      clone.items[index] = { ...(clone.items[index] || {}), ...patch };

      if (patch.productId !== undefined && patch.productId !== prevProductId) {
        clone.items[index].assignedAssets = [];
      }

      clone.items[index].amount =
        Number(clone.items[index].qty || 0) * Number(clone.items[index].rate || 0);

      const totals = calcTotals(
        clone.items || [],
        clone.discount || selectedOrder?.discount || { type: "percent", value: 0 },
        clone.taxes || selectedOrder?.taxes || []
      );

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
        updatedByName:
          auth.currentUser?.displayName || auth.currentUser?.email || "",
      });

      setSelectedOrder((s) => ({ ...(s || {}), items: clone.items, totals }));
    } catch (err) {
      console.error("updateOrderItem", err);
      setError(err.message || "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  // Asset picker
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

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        items: clone.items,
        updatedAt: serverTimestamp(),
      });

      if (chosen.length) {
        try {
          const snaps = await Promise.all(
            chosen.map((aid) => getDoc(doc(db, "assets", aid)))
          );
          const map = {};
          snaps.forEach((s) => {
            if (s.exists()) map[s.id] = { id: s.id, ...(s.data() || {}) };
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
      if (ids.length) {
        const snaps = await Promise.all(ids.map((aid) => getDoc(doc(db, "assets", aid))));
        const map = {};
        snaps.forEach((s) => {
          if (s.exists()) map[s.id] = { id: s.id, ...(s.data() || {}) };
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

      const keepIds = new Set((clone.items || []).flatMap((it) => it.assignedAssets || []));
      const remaining = {};
      Object.keys(assetsById).forEach((k) => {
        if (keepIds.has(k)) remaining[k] = assetsById[k];
      });
      setAssetsById(remaining);

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

        await updateDoc(doc(db, "requirements", selectedOrder.requirementId), {
          status: newStatus,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || "",
          updatedByName:
            auth.currentUser?.displayName || auth.currentUser?.email || "",
        });

        propagateToLead(
          selectedOrder.requirementId,
          "order",
          selectedOrder.status || "",
          newStatus,
          entry.note
        );
      }

      if (newStatus === "active") {
        try {
          const freshSnap = await getDoc(doc(db, "orders", selectedOrder.id));
          const freshOrder = freshSnap.exists()
            ? { id: freshSnap.id, ...(freshSnap.data() || {}) }
            : selectedOrder;
          const items = freshOrder.items || [];

          for (const it of items) {
            if (Array.isArray(it.assignedAssets) && it.assignedAssets.length) {
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
                } catch (err) {}
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
                if (s.exists()) map[s.id] = { id: s.id, ...(s.data() || {}) };
              });
              setAssetsById((prev) => ({ ...(prev || {}), ...map }));
            } catch {}
          }

          const postSnap = await getDoc(doc(db, "orders", selectedOrder.id));
          if (postSnap.exists()) {
            const fresh = { id: postSnap.id, ...(postSnap.data() || {}) };
            fresh.payments = await fetchPaymentsForOrder(fresh.id);
            setSelectedOrder(fresh);
          } else setSelectedOrder((s) => ({ ...(s || {}), status: newStatus }));
        } catch {}
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

  // Delivery
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
    const driverSnap = await getDoc(doc(db, "drivers", driverId));
    if (!driverSnap.exists()) return setError("Choose a valid driver");
    const driver = { id: driverSnap.id, ...(driverSnap.data() || {}) };

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
        await updateDoc(doc(db, "requirements", selectedOrder.requirementId), {
          history: arrayUnion(entry),
          updatedAt: serverTimestamp(),
        });
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
      const deliveryRef = doc(db, "deliveries", selectedOrder.delivery.deliveryId);
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
        await updateDoc(doc(db, "requirements", selectedOrder.requirementId), {
          history: arrayUnion(entry),
          updatedAt: serverTimestamp(),
        });
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

  // Payments CRUD
  const openPaymentModal = (editingPaymentId = null) => {
    if (!selectedOrder) return;
    if (editingPaymentId) {
      const editing =
        (selectedOrder.payments || []).find((p) => p.id === editingPaymentId) ||
        null;
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
  function formatYMDForDisplay(ymd) {
  if (!ymd) return "—";
  // expect "YYYY-MM-DD"
  const parts = (ymd + "").split("-");
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts.map(Number);
  try {
    const dt = new Date(y, m - 1, d);
    // locale formatting; change options if you prefer different style
    return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return ymd;
  }
}


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
    <div
      className="orders-layout"
      style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}
    >
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
        onClearAll={() => {
          setFilterDerived("all");
          setFilterDelivery("all");
          setSearch("");
        }}
      />

      {/* RIGHT MAIN */}
      <main className="orders-main">
        <header
          className="orders-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
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
              <th>Status</th>
              <th>Delivery</th>
              <th>Start Date</th> 
              <th>Created</th>
              <th>Items</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((o) => {
              const derived = deriveDetailedStatus(o);
              const badgeBg = detailedStatusColor(derived);
              const hints = getResourceBadges(o);

              return (
                <tr key={o.id}>
                  <td className="strong">{o.orderNo || o.id}</td>
                  <td>{o.customerName || "—"}</td>

                  {/* Status + secondary resource hints */}
                  <td style={{ minWidth: 240 }}>
                    <div style={{ textTransform: "capitalize", marginBottom: 6 }}>
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
                        {derived.replaceAll("_", " ")}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {hints.map(({ key, label }) => {
                        const c = hintColor(key);
                        return (
                          <span
                            key={key}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                              background: c.bg,
                              border: `1px solid ${c.border}`,
                              color: c.text,
                              lineHeight: 1.4,
                              textTransform: "capitalize",
                            }}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </td>

                  {/* Delivery status (raw) */}
                  <td style={{ textTransform: "capitalize" }}>
                    {o.deliveryStatus || o.delivery?.status || "—"}
                  </td>
                  <td>{formatYMDForDisplay(getStartDate(o))}</td>


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
                        onClick={() => {
                          setSelectedOrder(o);
                          changeOrderStatus("completed");
                        }}
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
            autoAssignAssets={async (idx, qty, checkoutNow) =>
              await (async () => {
                setSaving(true);
                setError("");
                try {
                  const it = selectedOrder.items?.[idx];
                  const productId = it?.productId || "";
                  const branchId = it?.branchId || "";
                  const assets = await listAssets({ productId, branchId });

                  const available = (assets || []).filter(
                    (a) => (a.status || "").toLowerCase() === "available"
                  );
                  const pick = available
                    .slice(0, Number(qty || 1))
                    .map((a) => a.id);
                  const clone = JSON.parse(JSON.stringify(selectedOrder));
                  clone.items[idx] = {
                    ...(clone.items[idx] || {}),
                    assignedAssets: pick,
                  };

                  await updateDoc(doc(db, "orders", selectedOrder.id), {
                    items: clone.items,
                    updatedAt: serverTimestamp(),
                  });

                  setSelectedOrder(clone);

                  if (checkoutNow && pick.length) {
                    await checkoutAssignedAssetsForItem(idx);
                  }
                } catch (err) {
                  console.error("autoAssignAssets", err);
                  setError(err.message || "Failed to auto-assign");
                } finally {
                  setSaving(false);
                }
              })()
            }
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
            paymentSummary={paymentSummary}
          />
        )}
      </main>
    </div>
  );
}
