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
import OrderCreate from "./OrderCreate"; // adjust path if needed


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
function isReturnOverdue(order) {
  const base = (order?.status || "").toLowerCase();
  if (base === "completed" || base === "cancelled") return false;

  const end = getEndDate(order);
  if (!end) return false;

  const today = todayYMD();
  if (end >= today) return false;

  const dstat = (order?.deliveryStatus || "").toLowerCase();
  if (dstat === "completed" || dstat === "delivered") return false;

  return true;
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
    (order?.delivery?.assignedDrivers?.length ?? 0) > 0 ||
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

  if (end && end === today) return "ending_today";
  if (start && start === today) return "starts_today";

  const dstat = (order?.deliveryStatus || "").toLowerCase();
  if (["picked_up", "in_transit"].includes(dstat)) return "in_transit";
  if (dstat === "delivered") return "delivered";

  const astate = assetsAssignmentState(order);
  const driver = isDriverAssigned(order);

  if (astate === "full" && driver) return "ready_to_dispatch";

  if (base === "active") return "active";
  if (base === "created") return "created";

  return "created";
}

export const detailedStatusColor = (s) => {
  switch (s) {
    case "ending_today":
      return "#dc2626"; // red
    case "starts_today":
      return "#2563eb"; // blue
    case "ready_to_dispatch":
      return "#7c3aed"; // purple
    case "in_transit":
      return "#f59e0b"; // amber
    case "delivered":
      return "#10b981"; // green
    case "completed":
      return "#6b7280"; // gray
    case "cancelled":
      return "#991b1b"; // dark red
    default:
      return "#64748b";
  }
};


// ---------- secondary resource badges under main badge ----------

export const getResourceBadges = (order) => {
  const badges = [];

  /* 🔴 OVERDUE RETURN (highest priority secondary) */
  if (isReturnOverdue(order)) {
    badges.push({ key: "return_overdue", label: "Return Overdue" });
    return badges; // ⛔ stop further badges — urgency wins
  }

  /* 💰 PAYMENT */
  const total = Number(order?.totals?.total || 0);
  const paid = (order?.payments || []).reduce(
    (s, p) => s + Number(p.amount || 0),
    0
  );
  if (total - paid > 0) {
    badges.push({ key: "payment_due", label: "Payment Due" });
  }

  /* 📦 ASSETS */
  const astate = assetsAssignmentState(order);
  if (astate === "partial") {
    badges.push({ key: "assets_pending", label: "Assets Pending" });
  }

  /* 🚚 PICKUP */
  const dstat = (order?.deliveryStatus || "").toLowerCase();
  if (dstat === "picked_up" || dstat === "in_transit") {
    badges.push({ key: "pickup_done", label: "Pickup Done" });
  }

  /* ↩ RETURN PENDING */
  if (order?.returnDeliveryId && dstat !== "completed") {
    badges.push({ key: "return_pending", label: "Return Pending" });
  }

  return badges;
};
export const hintColor = (key) => {
  switch (key) {
    case "return_overdue":
      return {
        bg: "#fee2e2",
        text: "#991b1b",
      };

    case "payment_due":
      return { bg: "#fee2e2", text: "#b91c1c" };

    case "assets_pending":
      return { bg: "#e0e7ff", text: "#3730a3" };

    case "pickup_done":
      return { bg: "#ecfeff", text: "#155e75" };

    case "return_pending":
      return { bg: "#fff7ed", text: "#9a3412" };

    default:
      return { bg: "#f1f5f9", text: "#334155" };
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
  const [createOpen, setCreateOpen] = useState(false);
const [assetCompanyFilter, setAssetCompanyFilter] = useState("");


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
  const assetCompanies = useMemo(() => {
  const set = new Set();
  (assetPicker.assets || []).forEach((a) => {
    if (a.company) set.add(a.company);
  });
  return Array.from(set).sort();
}, [assetPicker.assets]);

const visibleAssets = useMemo(() => {
  if (!assetCompanyFilter) return assetPicker.assets || [];
  return (assetPicker.assets || []).filter(
    (a) => a.company === assetCompanyFilter
  );
}, [assetPicker.assets, assetCompanyFilter]);

  // Asset picker
const openAssetPickerForItem = async (itemIndex) => {
  // 🔹 reset company filter every time picker opens
  setAssetCompanyFilter("");

  setAssetPicker((s) => ({
    ...s,
    open: true,
    itemIndex,
    loading: true,
  }));

  try {
    const it = selectedOrder?.items?.[itemIndex];
    const productId = it?.productId || "";
    const branchId = it?.branchId || "";

    // 🔹 fetch assets for product + branch
    const assets = await listAssets({ productId, branchId });

    // 🔹 preselect already assigned assets
    const selected = {};
    (it?.assignedAssets || []).forEach((aid) => {
      selected[aid] = true;
    });

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
const groupedAssets = useMemo(() => {
  const g = {};
  (visibleAssets || []).forEach((a) => {
    const key = a.company || "Unknown company";
    if (!g[key]) g[key] = [];
    g[key].push(a);
  });
  return g;
}, [visibleAssets]);

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
  
const getActiveDelivery = (order) => {
  if (!order) return null;

  const deliveryType = order.deliveryType || "pickup";

  if (deliveryType === "pickup" && order.pickupDeliveryId) {
    return {
      deliveryId: order.pickupDeliveryId,
      deliveryType: "pickup",
    };
  }

  if (deliveryType === "return" && order.returnDeliveryId) {
    return {
      deliveryId: order.returnDeliveryId,
      deliveryType: "return",
    };
  }

  return null;
};



 // Replace existing assignDriverToOrder in Orders.js with this:
const assignDriversToOrder = async (driverIds = []) => {
  console.log("🟡 assignDriversToOrder CALLED with:", driverIds);

  if (!selectedOrder) {
    console.error("❌ No order open");
    return setError("No order open");
  }

  setSaving(true);
  setError("");
  const prevOrder = selectedOrder;

  try {
    const deliveryType = selectedOrder.deliveryType || "pickup";
    console.log("🟡 deliveryType:", deliveryType);

    const activeDeliveryId =
      deliveryType === "pickup"
        ? selectedOrder.pickupDeliveryId
        : selectedOrder.returnDeliveryId;

    console.log("🟡 activeDeliveryId:", activeDeliveryId);

    /**
     * 🔥 BULLETPROOF NORMALIZATION
     * Handles:
     *  - "id"
     *  - ["id"]
     *  - [["id"]]
     */
    const normalizedDriverIds = (Array.isArray(driverIds)
      ? driverIds.flat(Infinity)
      : [driverIds]
    )
      .map((d) => (typeof d === "string" ? d : d?.id))
      .filter(Boolean);

    console.log("🟡 normalizedDriverIds:", normalizedDriverIds);

    if (!normalizedDriverIds.length) {
      console.error("❌ NO DRIVER IDS AFTER NORMALIZATION");
      throw new Error("No valid driver IDs received");
    }

    // 1️⃣ Load driver documents
    const drivers = [];
    for (const driverId of normalizedDriverIds) {
      console.log("🟠 Fetching driver:", driverId);

      const snap = await getDoc(doc(db, "drivers", driverId));
      if (!snap.exists()) {
        console.error("❌ Driver not found:", driverId);
        throw new Error("Driver not found");
      }

      const driverData = { id: snap.id, ...(snap.data() || {}) };
      console.log("🟢 Loaded driver:", driverData);

      drivers.push(driverData);
    }

    console.log("🟡 drivers loaded:", drivers);

    // 2️⃣ Load existing drivers from THIS delivery only
    let existingDrivers = [];
    if (activeDeliveryId) {
      console.log("🟠 Loading existing drivers from delivery:", activeDeliveryId);

      const snap = await getDoc(doc(db, "deliveries", activeDeliveryId));
      if (snap.exists()) {
        existingDrivers = snap.data().assignedDrivers || [];
      }
    }

    console.log("🟡 existingDrivers:", existingDrivers);

    // 3️⃣ Merge drivers (no duplicates)
    const mergedDrivers = [
      ...existingDrivers,
      ...drivers.filter(
        (d) => !existingDrivers.some((e) => e.id === d.id)
      ),
    ];

    const assignedDriverIds = mergedDrivers.map((d) => d.id);

    console.log("🟡 mergedDrivers:", mergedDrivers);
    console.log("🟡 assignedDriverIds:", assignedDriverIds);

    const driversKey =
      deliveryType === "return"
        ? "returnAssignedDrivers"
        : "pickupAssignedDrivers";

    console.log("🟡 driversKey:", driversKey);

    // 4️⃣ UPDATE existing delivery
    if (activeDeliveryId) {
      console.log("🟠 Updating existing delivery", {
        activeDeliveryId,
        mergedDrivers,
        assignedDriverIds,
      });

      await updateDoc(doc(db, "deliveries", activeDeliveryId), {
        assignedDrivers: mergedDrivers,
        assignedDriverIds,
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        [driversKey]: mergedDrivers,
        updatedAt: serverTimestamp(),
      });

      setSelectedOrder((s) => ({
        ...s,
        [driversKey]: mergedDrivers,
      }));

      console.log("✅ Existing delivery updated successfully");
      return;
    }

    // 5️⃣ CREATE new delivery
    const payload = {
      orderId: selectedOrder.id,
      orderNo: selectedOrder.orderNo,
      deliveryType,

      assignedDrivers: mergedDrivers,
      assignedDriverIds,

      pickupAddress:
        deliveryType === "return"
          ? selectedOrder.deliveryAddress || ""
          : selectedOrder.pickupAddress ||
            selectedOrder.deliveryAddress ||
            "",

      dropAddress:
        deliveryType === "return"
          ? selectedOrder.pickupAddress || ""
          : selectedOrder.deliveryAddress || "",

      items: selectedOrder.items || [],
      expectedAssetIds: (selectedOrder.items || [])
        .flatMap((i) => i.assignedAssets || [])
        .filter(Boolean),

      scannedAssets: {},
      status: "assigned",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log("🟠 Creating delivery with payload:", payload);

    const ref = await addDoc(collection(db, "deliveries"), payload);

    console.log("🟢 Delivery created with ID:", ref.id);

    const deliveryKey =
      deliveryType === "return"
        ? "returnDeliveryId"
        : "pickupDeliveryId";

    await updateDoc(doc(db, "orders", selectedOrder.id), {
      [deliveryKey]: ref.id,
      [driversKey]: mergedDrivers,
      deliveryType,
      deliveryStatus: "assigned",
      updatedAt: serverTimestamp(),
    });

    setSelectedOrder((s) => ({
      ...s,
      [deliveryKey]: ref.id,
      [driversKey]: mergedDrivers,
      deliveryType,
      deliveryStatus: "assigned",
    }));

    console.log("✅ Order updated with delivery + drivers");
  } catch (err) {
    console.error("❌ assignDriversToOrder ERROR:", err);
    setSelectedOrder(prevOrder);
    setError(err.message || "Failed to assign drivers");
  } finally {
    setSaving(false);
  }
};







const createReturnDelivery = async () => {
  if (!selectedOrder) return setError("No order open");

  // 🚫 prevent duplicate return
  if (selectedOrder.returnDelivery?.deliveryId) {
    return setError("Return delivery already exists");
  }

  setSaving(true);
  setError("");

  const prevOrder = selectedOrder;

  try {
    // 1️⃣ Build expected assets from original order
    const expectedAssetIds = (selectedOrder.items || [])
      .flatMap((i) => i.assignedAssets || [])
      .filter(Boolean);

    if (expectedAssetIds.length === 0) {
      throw new Error("No assets found to return");
    }

    // 2️⃣ Create RETURN delivery payload
    const payload = {
      orderId: selectedOrder.id,
      orderNo: selectedOrder.orderNo,

      deliveryType: "return", // 🔑 IMPORTANT

      assignedDrivers: [],
      assignedDriverIds: [],

      // 🔁 reverse logical direction
      pickupAddress: selectedOrder.deliveryAddress || "",
      dropAddress:
        selectedOrder.pickupAddress ||
        selectedOrder.branchAddress ||
        "",

      items: selectedOrder.items || [],
      expectedAssetIds,
      scannedAssets: {},

      status: "assigned",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // 3️⃣ Create delivery document
    const ref = await addDoc(collection(db, "deliveries"), payload);

    // 4️⃣ Update order with returnDelivery reference
    await updateDoc(doc(db, "orders", selectedOrder.id), {
      returnDelivery: {
        deliveryId: ref.id,
        status: "assigned",
      },
      updatedAt: serverTimestamp(),
    });

    // 5️⃣ Update local state
    setSelectedOrder((s) => ({
      ...(s || {}),
      returnDelivery: {
        deliveryId: ref.id,
        status: "assigned",
      },
    }));
  } catch (err) {
    console.error("createReturnDelivery", err);
    setSelectedOrder(prevOrder);
    setError(err.message || "Failed to create return delivery");
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

  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <div className="muted" style={{ fontSize: 13 }}>
      Showing <strong>{filtered.length}</strong> of {orders.length}
    </div>
    <button
      className="cp-btn"
      onClick={() => setCreateOpen(true)}
    >
      + Add Order
    </button>
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
            setSelectedOrder={setSelectedOrder}
            branches={branches}
            productsMap={productsMap}
            productsList={productsList}
            createReturnDelivery={createReturnDelivery}
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
              assetCompanyFilter={assetCompanyFilter}
  setAssetCompanyFilter={setAssetCompanyFilter}
  assetCompanies={assetCompanies}
  groupedAssets={groupedAssets}
  setAssetPicker={setAssetPicker}
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
            assignDriverToOrder={(driverId) => assignDriversToOrder([driverId])}
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
        <OrderCreate
  open={createOpen}
  quotation={null}              // manual order (not from quotation)
  onClose={() => setCreateOpen(false)}
  onCreated={() => {
    setCreateOpen(false);       // close after successful create
  }}
/>

      </main>
    </div>
  );
}