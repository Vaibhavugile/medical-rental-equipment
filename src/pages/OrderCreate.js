// src/pages/OrderCreate.jsx
import React, { useEffect, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { listBranches, listAssets, reserveAsset } from "../utils/inventory";
import { makeHistoryEntry, propagateToLead } from "../utils/status";
import "./OrderCreate.css";

const safeNum = (v) => (typeof v === "number" ? v : Number(v || 0));
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
const parseNumberInput = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};


function calcTotals(
  items = [],
  discount = { type: "percent", value: 0 },
  taxes = []
) {
  const subtotal = (items || []).reduce(
    (s, it) => s + safeNum(it.qty) * safeNum(it.rate),
    0
  );
  let discountAmount = 0;
  if (discount) {
    if ((discount.type || "").toLowerCase() === "percent") {
      discountAmount = subtotal * (safeNum(discount.value) / 100);
    } else {
      discountAmount = safeNum(discount.value);
    }
  }
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxBreakdown = (taxes || []).map((t) => {
  const type = (t.type || "percent").toLowerCase();
  const value = safeNum(t.rate ?? t.value);

  let amount = 0;

  if (type === "fixed") {
    // Fixed tax = direct amount
    amount = value;
  } else {
    // Percent tax
    amount = taxable * (value / 100);
  }

  return {
    name: t.name || "",
    type,
    value,
    amount,
  };
});

  const totalTax = taxBreakdown.reduce((s, t) => s + safeNum(t.amount), 0);
  const total = Math.max(0, taxable + totalTax);
  return { subtotal, discountAmount, taxBreakdown, totalTax, total };
}

// days between two dates (inclusive)
const diffDaysInclusive = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round((e - s) / msPerDay) + 1;
  return diff > 0 ? diff : 0;
};

// --- helpers to normalize shape variations ---
const normAddress = (addr) => {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  const parts = [
    addr.line1 || addr.address1 || addr.street,
    addr.line2 || addr.address2,
    addr.city || addr.town,
    addr.state || addr.province,
    addr.postalCode || addr.zip,
    addr.country,
  ].filter(Boolean);
  return parts.join(", ");
};

// tolerant contact normalizer
const normContact = (c) => {
  if (!c) return null;
  if (typeof c === "string") return { name: c };
  return {
    name:
      c.name ||
      c.person ||
      c.contactPerson ||
      c.contactperson ||
      c.customerName ||
      "",
    phone:
      c.phone ||
      c.mobile ||
      c.contact ||
      c.customerPhone ||
      c.contactPhone ||
      c.whatsapp ||
      c.whatsApp ||
      "",
    email:
      c.email ||
      c.customerEmail ||
      c.contactEmail ||
      c.mail ||
      "",
  };
};

// builds name/phone/email from snapshot/requirement/quotation/lead
const buildDeliveryContact = (ls, requirement, quotation, lead) => {
  const snapName =
    ls?.contactPerson ||
    ls?.contactperson ||
    ls?.customerName ||
    ls?.customername ||
    ls?.customer ||
    "";
  const snapPhone =
    ls?.phone ||
    ls?.mobile ||
    ls?.customerPhone ||
    ls?.contactPhone ||
    ls?.whatsapp ||
    ls?.whatsApp ||
    "";
  const snapEmail =
    ls?.email || ls?.customerEmail || ls?.contactEmail || "";

  const reqName =
    requirement?.contactPerson ||
    requirement?.customerName ||
    requirement?.contactName ||
    "";
  const reqPhone =
    requirement?.phone ||
    requirement?.customerPhone ||
    requirement?.contactPhone ||
    "";
  const reqEmail =
    requirement?.email ||
    requirement?.customerEmail ||
    requirement?.contactEmail ||
    "";

  const qc = quotation?.deliveryContact || {};
  const qContact = normContact(qc);
  const qName = qContact?.name || quotation?.customerName || "";
  const qPhone = qContact?.phone || quotation?.customerPhone || "";
  const qEmail = qContact?.email || quotation?.customerEmail || "";

  const leadContactObj = normContact(lead?.contactPerson);
  const leadName =
    leadContactObj?.name || lead?.customerName || lead?.name || "";
  const leadPhone =
    leadContactObj?.phone ||
    lead?.phone ||
    lead?.mobile ||
    lead?.customerPhone ||
    "";
  const leadEmail =
    leadContactObj?.email ||
    lead?.email ||
    lead?.customerEmail ||
    "";

  const name = snapName || reqName || qName || leadName || "";
  const phone = snapPhone || reqPhone || qPhone || leadPhone || "";
  const email = snapEmail || reqEmail || qEmail || leadEmail || "";

  if (!name && !phone && !email) return null;
  return { name, phone, email };
};

export default function OrderCreate({
  open,
  quotation: incomingQuotation,
  onClose,
  onCreated,
}) {
  const navigate = useNavigate();

  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [draft, setDraft] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [pickerAssets, setPickerAssets] = useState([]);
  const [pickerSelected, setPickerSelected] = useState({});
  const [pickerLoading, setPickerLoading] = useState(false);
  const [assetsById, setAssetsById] = useState({});
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [pickerCompanyFilter, setPickerCompanyFilter] = useState("");


  // fetch products & branches when open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const init = async () => {
      setLoadingInitial(true);
      setError("");
      try {
        const prodSnap = await getDocs(collection(db, "products"));
        const prods = prodSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }));
        if (!cancelled) setProducts(prods);

        try {
          const b = await listBranches();
          if (!cancelled) setBranches(b || []);
        } catch (err) {
          console.warn("listBranches failed", err);
        }
      } catch (err) {
        console.error("OrderCreate init (products) failed", err);
        if (!cancelled)
          setError(err.message || "Failed to load products/branches");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // build full draft (merge quotation + requirement + lead)
  useEffect(() => {
    if (!open) return;
    const loadAll = async () => {
      setLoadingInitial(true);
      setError("");
      try {
        let freshQuotation = incomingQuotation;
        if (incomingQuotation?.id) {
          try {
            const qSnap = await getDoc(
              doc(db, "quotations", incomingQuotation.id)
            );
            if (qSnap.exists())
              freshQuotation = { id: qSnap.id, ...(qSnap.data() || {}) };
          } catch (err) {
            console.warn("Failed to fetch fresh quotation", err);
          }
        }

        let requirement = null;
        if (freshQuotation?.requirementId) {
          try {
            const rSnap = await getDoc(
              doc(db, "requirements", freshQuotation.requirementId)
            );
            if (rSnap.exists())
              requirement = { id: rSnap.id, ...(rSnap.data() || {}) };
          } catch (err) {
            console.warn("Failed to fetch requirement", err);
          }
        }

        let lead = null;
        const leadId = requirement?.leadId || freshQuotation?.leadId;
        if (leadId) {
          try {
            const lSnap = await getDoc(doc(db, "leads", leadId));
            if (lSnap.exists())
              lead = { id: lSnap.id, ...(lSnap.data() || {}) };
          } catch (err) {
            console.warn("Failed to fetch lead", err);
          }
        }

        const ls =
          requirement?.leadSnapshot ||
          requirement?.leadsnapshot ||
          requirement?.leadssnapshot ||
          null;

        const snapCustomerName =
          (ls &&
            (ls.customerName ?? ls.customername ?? ls.customer)) ||
          null;
        const customerName =
          snapCustomerName ||
          requirement?.customerName ||
          freshQuotation?.customerName ||
          lead?.customerName ||
          lead?.companyName ||
          lead?.organization ||
          lead?.orgName ||
          "";

        const deliveryAddress =
          normAddress(ls?.address) ||
          normAddress(
            freshQuotation?.deliveryAddress || freshQuotation?.address
          ) ||
          normAddress(
            requirement?.deliveryAddress ||
              requirement?.address ||
              requirement?.deliveryCity
          ) ||
          normAddress(lead?.address) ||
          "";

        const deliveryContact = buildDeliveryContact(
          ls,
          requirement,
          freshQuotation,
          lead
        );

        const taxes =
          freshQuotation?.taxes &&
          Array.isArray(freshQuotation.taxes) &&
          freshQuotation.taxes.length
            ? freshQuotation.taxes
            : requirement?.taxes &&
              Array.isArray(requirement.taxes) &&
              requirement.taxes.length
            ? requirement.taxes
            : ls?.taxes &&
              Array.isArray(ls.taxes) &&
              ls.taxes.length
            ? ls.taxes
            : lead?.taxes &&
              Array.isArray(lead.taxes) &&
              lead.taxes.length
            ? lead.taxes
            : freshQuotation?.taxes || [];

        const discount =
          freshQuotation?.discount ||
          requirement?.discount || { type: "percent", value: 0 };

        let itemsSource =
          freshQuotation?.items &&
          Array.isArray(freshQuotation.items) &&
          freshQuotation.items.length
            ? freshQuotation.items
            : requirement?.equipment &&
              Array.isArray(requirement.equipment) &&
              requirement.equipment.length
            ? requirement.equipment
            : requirement?.requirementItems &&
              Array.isArray(requirement.requirementItems) &&
              requirement.requirementItems.length
            ? requirement.requirementItems
            : [];

        const items = (itemsSource.length
          ? itemsSource
          : [{ name: "", qty: 1, rate: 0 }]
        ).map((it, idx) => {
          const name =
            it.name ||
            it.itemName ||
            it.productName ||
            it.productTitle ||
            "";
          const qty = Number(it.qty ?? it.quantity ?? 1);
          const rate = Number(it.rate ?? it.price ?? 0);
          const amount = Number(it.amount ?? qty * rate);
          const notes =
            it.notes || it.unitNotes || it.specialInstructions || "";
          const days =
            it.expectedDurationDays ?? it.days ?? requirement?.expectedDurationDays ?? 0;
          const expectedStartDate =
            it.expectedStartDate || it.startDate || requirement?.expectedStartDate || "";
          const expectedEndDate =
            it.expectedEndDate || it.endDate || requirement?.expectedEndDate || "";
          const productId = it.productId || it.product || "";
          return {
            id: it.id || `i-${Date.now()}-${idx}`,
            name,
            qty,
            rate,
            amount,
            notes,
            days,
            expectedStartDate,
            expectedEndDate,
            productId,
            branchId: "",
            assignedAssets: [],
            autoAssigned: false,
          };
        });

        const totals =
          freshQuotation?.totals || calcTotals(items, discount, taxes);

        const draftObj = {
          quotationId: freshQuotation?.id || incomingQuotation?.id || null,
          quotationNo:
            freshQuotation?.quoNo ||
            freshQuotation?.quotationId ||
            incomingQuotation?.quoNo ||
            "",
          requirementId:
            freshQuotation?.requirementId || requirement?.id || "",
          orderNo: `O-${Math.floor(Date.now() / 1000)}`,
          customerName,
          deliveryAddress,
          deliveryContact,
          leadId:
            requirement?.leadId ||
            freshQuotation?.leadId ||
            (lead?.id || null),
          items,
          discount,
          taxes,
          notes: freshQuotation?.notes || requirement?.notes || "",
          totals,
        };

        if (!open) return;
        setDraft(draftObj);
      } catch (err) {
        console.error("OrderCreate init error", err);
        setError(err.message || "Failed to prepare order draft");
      } finally {
        setTimeout(() => setLoadingInitial(false), 80);
      }
    };
    loadAll();
    return () => {};
  }, [open, incomingQuotation]);

  // top-level draft updater
  const updateDraft = (patch) => {
    setDraft((d) => (d ? { ...d, ...(patch || {}) } : { ...(patch || {}) }));
  };
const pickerCompanies = React.useMemo(() => {
  const set = new Set();
  (pickerAssets || []).forEach((a) => {
    if (a.company) set.add(a.company);
  });
  return Array.from(set).sort();
}, [pickerAssets]);
const visiblePickerAssets = React.useMemo(() => {
  if (!pickerCompanyFilter) return pickerAssets || [];
  return (pickerAssets || []).filter(
    (a) => a.company === pickerCompanyFilter
  );
}, [pickerAssets, pickerCompanyFilter]);
const groupedPickerAssets = React.useMemo(() => {
  const g = {};
  visiblePickerAssets.forEach((a) => {
    const key = a.company || "Unknown company";
    if (!g[key]) g[key] = [];
    g[key].push(a);
  });
  return g;
}, [visiblePickerAssets]);
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


  // --- discount & taxes helpers ---
  const updateDiscount = (patch) => {
    setDraft((d) => {
      const nd = JSON.parse(JSON.stringify(d || {}));
      nd.discount = { ...(nd.discount || { type: "percent", value: 0 }), ...(patch || {}) };
      nd.totals = calcTotals(nd.items || [], nd.discount, nd.taxes || []);
      return nd;
    });
  };

  const addTax = () => {
    setDraft((d) => {
      const nd = JSON.parse(JSON.stringify(d || {}));
      nd.taxes = Array.isArray(nd.taxes) ? [...nd.taxes] : [];
      nd.taxes.push({ id: `t-${Date.now()}`, name: "", type: "percent", rate: 0 });
      nd.totals = calcTotals(nd.items || [], nd.discount || { type: "percent", value: 0 }, nd.taxes);
      return nd;
    });
  };

  const updateTaxAt = (index, patch) => {
    setDraft((d) => {
      const nd = JSON.parse(JSON.stringify(d || {}));
      nd.taxes = Array.isArray(nd.taxes) ? [...nd.taxes] : [];
      const t = { ...(nd.taxes[index] || {}), ...(patch || {}) };
      nd.taxes[index] = t;
      nd.totals = calcTotals(nd.items || [], nd.discount || { type: "percent", value: 0 }, nd.taxes);
      return nd;
    });
  };

  const removeTaxAt = (index) => {
    setDraft((d) => {
      const nd = JSON.parse(JSON.stringify(d || {}));
      nd.taxes = Array.isArray(nd.taxes) ? [...nd.taxes] : [];
      if (index >= 0 && index < nd.taxes.length) nd.taxes.splice(index, 1);
      nd.totals = calcTotals(nd.items || [], nd.discount || { type: "percent", value: 0 }, nd.taxes);
      return nd;
    });
  };

  // open asset picker for an item
  const openAssetPicker = async (itemIndex) => {
    if (!draft) return;
      setPickerCompanyFilter("");
    const it = draft.items[itemIndex];
    if (!it.productId) {
      setError(
        "Please select a Product for this item before assigning assets."
      );
      return;
    }
    setPickerAssets([]);
    setPickerSelected({});
    setPickerFor({ itemIndex });
    setPickerOpen(true);
    setPickerLoading(true);
    setError("");
    try {
     const assets = await listAssets({
  productId: it.productId || null,
  branchId: it.branchId || null,
  from: it.expectedStartDate || null,
  to: it.expectedEndDate || null,
});

      setPickerAssets(assets || []);

      // local map so we can show assetId + model on chips
      setAssetsById((prev) => {
        const m = { ...(prev || {}) };
        (assets || []).forEach((a) => {
          if (a && a.id) m[a.id] = a;
        });
        return m;
      });
    } catch (err) {
      console.error("openAssetPicker", err);
      setError(err.message || "Failed to load assets");
      setPickerAssets([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const togglePickerSelect = (assetId) => {
    setPickerSelected((p) => ({ ...(p || {}), [assetId]: !p[assetId] }));
  };

  // confirm selection: don't exceed qty, no duplicates
  const confirmPickerSelection = () => {
    if (!pickerFor) return;
    const idx = pickerFor.itemIndex;

    setDraft((d) => {
      const nd = JSON.parse(JSON.stringify(d));
      const item = nd.items[idx];
      const qty = Number(item.qty || 0);
      const existing = Array.isArray(item.assignedAssets)
        ? item.assignedAssets
        : [];

      const desired = Object.keys(pickerSelected).filter(
        (k) => pickerSelected[k]
      );

      // remove already-assigned from new list
      const fresh = desired.filter((id) => !existing.includes(id));

      const remainingCapacity = Math.max(0, qty - existing.length);
      const toAdd =
        remainingCapacity > 0 ? fresh.slice(0, remainingCapacity) : [];

      if (fresh.length > remainingCapacity && remainingCapacity >= 0) {
        setError(
          `You can assign max ${qty} assets for this item (already ${existing.length} assigned).`
        );
      }

      item.assignedAssets = [...existing, ...toAdd];
      nd.items[idx] = item;
      nd.totals = calcTotals(nd.items, nd.discount, nd.taxes);
      return nd;
    });

    setPickerOpen(false);
    setPickerFor(null);
    setPickerAssets([]);
    setPickerSelected({});
  };

  // auto-assign: don't exceed qty, avoid duplicates
  const autoAssignAssetsForItem = async (itemIndex, count = 1) => {
    try {
      const it = draft.items[itemIndex];
      if (!it.productId) {
        setError("Select product before auto-assign");
        return;
      }

      const qty = Number(it.qty || 0);
      const existing = Array.isArray(it.assignedAssets)
        ? it.assignedAssets
        : [];
      const remainingCapacity = Math.max(0, qty - existing.length);

      if (remainingCapacity <= 0) {
        setError("This item already has enough assets assigned.");
        return;
      }

    const assets = await listAssets({
  productId: it.productId || null,
  branchId: it.branchId || null,
  from: it.expectedStartDate || null,
  to: it.expectedEndDate || null,
});


      const available = (assets || []).filter(
        (a) => !existing.includes(a.id)
      );
      if (!available.length) {
        setError("No more assets available to auto-assign");
        return;
      }

      const wanted = Math.min(
        remainingCapacity,
        Number(count || 1)
      );
      const pick = available.slice(0, wanted).map((a) => a.id);

      setDraft((d) => {
        const nd = JSON.parse(JSON.stringify(d));
        const item = nd.items[itemIndex];
        const ex = Array.isArray(item.assignedAssets)
          ? item.assignedAssets
          : [];
        item.assignedAssets = [...ex, ...pick];
        item.autoAssigned = true;
        nd.items[itemIndex] = item;
        nd.totals = calcTotals(nd.items, nd.discount, nd.taxes);
        return nd;
      });

      // update asset map for chip labels
      setAssetsById((prev) => {
        const m = { ...(prev || {}) };
        (assets || []).forEach((a) => {
          if (a && a.id) m[a.id] = a;
        });
        return m;
      });
    } catch (err) {
      console.error("autoAssign failed", err);
      setError(err.message || "Auto-assign failed");
    }
  };

  // item updater with auto-days from date range
  const updateDraftItem = (idx, patch) => {
    setDraft((d) => {
      const nd = JSON.parse(JSON.stringify(d));
      let item = { ...(nd.items[idx] || {}), ...patch };

      // auto-calc days if dates changed
      if (
        Object.prototype.hasOwnProperty.call(patch, "expectedStartDate") ||
        Object.prototype.hasOwnProperty.call(patch, "expectedEndDate")
      ) {
        const start =
          patch.expectedStartDate ?? item.expectedStartDate;
        const end = patch.expectedEndDate ?? item.expectedEndDate;
        item.days = diffDaysInclusive(start, end);
      }

      item.amount = safeNum(item.qty) * safeNum(item.rate);
      nd.items[idx] = item;

      if (patch.productId !== undefined) {
        nd.items[idx].assignedAssets = [];
      }

      nd.totals = calcTotals(nd.items, nd.discount, nd.taxes);
      return nd;
    });
  };

  // add / remove items
  const addItem = () => {
    setDraft((d) => {
      const base = d || {};
      const items = Array.isArray(base.items) ? [...base.items] : [];
      const nextIndex = items.length;

      items.push({
        id: `i-${Date.now()}-${nextIndex}`,
        name: "",
        qty: 1,
        rate: 0,
        amount: 0,
        notes: "",
        days: 0,
        expectedStartDate: "",
        expectedEndDate: "",
        productId: "",
        branchId: "",
        assignedAssets: [],
        autoAssigned: false,
      });

      const totals = calcTotals(items, base.discount, base.taxes);
      return { ...base, items, totals };
    });
  };

  const removeItem = (idx) => {
    setDraft((d) => {
      if (!d) return d;
      const items = Array.isArray(d.items) ? [...d.items] : [];
      if (items.length <= 1) return d;
      items.splice(idx, 1);
      const totals = calcTotals(items, d.discount, d.taxes);
      return { ...d, items, totals };
    });
  };

  const computeSubtotal = () => {
    if (!draft) return 0;
    return draft.items.reduce(
      (s, it) => s + safeNum(it.qty) * safeNum(it.rate),
      0
    );
  };

const createOrder = async () => {
  setError("");
  if (!draft) return;

  // 🔒 VALIDATION: assets must be assigned before creating order
  const missingAssets = draft.items
    .map((it, idx) => ({
      idx,
      name: it.name || `Item ${idx + 1}`,
      qty: Number(it.qty || 0),
      assigned: Array.isArray(it.assignedAssets)
        ? it.assignedAssets.length
        : 0,
      productId: it.productId,
    }))
    .filter(
      (it) =>
        it.productId &&
        it.qty > 0 &&
        it.assigned < it.qty
    );

  if (missingAssets.length > 0) {
    const msg = missingAssets
      .map(
        (it) =>
          `• ${it.name}: ${it.assigned}/${it.qty} assets assigned`
      )
      .join("\n");

    setError(
      `Please assign assets for all items before creating the order:\n${msg}`
    );
    return;
  }

  setCreating(true);

  try {
    const user = auth.currentUser || {};
    const totals = calcTotals(draft.items, draft.discount, draft.taxes);

    const itemsPayload = draft.items.map((it) => ({
      name: it.name,
      qty: Number(it.qty || 0),
      rate: Number(it.rate || 0),
      amount: Number(it.amount || 0),
      notes: it.notes || "",
      days: it.days || 0,
      expectedStartDate: it.expectedStartDate || "",
      expectedEndDate: it.expectedEndDate || "",
      productId: it.productId || "",
      assignedAssets: it.assignedAssets || [],
      branchId: it.branchId || "",
    }));

    const orderPayload = {
      quotationId: draft.quotationId,
      requirementId: draft.requirementId || "",
      orderNo: draft.orderNo,
      customerName: draft.customerName || "",
      customerPhone: draft.deliveryContact?.phone || "",
      customerEmail: draft.deliveryContact?.email || "",
      deliveryAddress: draft.deliveryAddress || "",
      deliveryContact: draft.deliveryContact || null,
      leadId: draft.leadId || null,
      items: itemsPayload,
      discount: draft.discount || { type: "percent", value: 0 },
      taxes: draft.taxes || [],
      totals,
      status: "created",
      createdAt: serverTimestamp(),
      createdBy: user.uid || "",
      createdByName: user.displayName || user.email || "",
    };

    // 1️⃣ Create order
    const ref = await addDoc(collection(db, "orders"), orderPayload);
    const orderId = ref.id;

    // 2️⃣ Reserve assigned assets WITH DATE RANGE
    for (const it of itemsPayload) {
      if (!Array.isArray(it.assignedAssets) || !it.assignedAssets.length) {
        continue;
      }

      for (const assetDocId of it.assignedAssets) {
        try {
          await reserveAsset(assetDocId, {
            reservationId: orderId,
            orderId: orderId,
            customer: draft.customerName || "",
            from: it.expectedStartDate || null,
            to: it.expectedEndDate || null,
            note: `Reserved for order ${draft.orderNo}`,
          });
        } catch (err) {
          console.warn("reserveAsset failed", assetDocId, err);
        }
      }
    }

    // 3️⃣ Update quotation
    if (draft.quotationId) {
      await updateDoc(doc(db, "quotations", draft.quotationId), {
        orderId: orderId,
        status: "order_created",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
      });
    }

    // 4️⃣ Update requirement + propagate
    if (draft.requirementId) {
      const entry = makeHistoryEntry(user, {
        type: "order",
        field: "status",
        oldValue: "",
        newValue: "order_created",
        note: `Order ${orderPayload.orderNo} created from quotation ${
          draft.quotationId || draft.quotationNo
        }`,
      });

      await updateDoc(doc(db, "requirements", draft.requirementId), {
        status: "order_created",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
        history: arrayUnion(entry),
      });

      propagateToLead(
        draft.requirementId,
        "order",
        "",
        "order_created",
        entry.note
      );
    }

    if (onCreated) onCreated(orderId);
    if (onClose) onClose();
    navigate("/orders");

  } catch (err) {
    console.error("createOrder error", err);
    setError(err.message || "Failed to create order");
  } finally {
    setCreating(false);
  }
};



  if (!open) return null;

  return (
    <div className="cp-drawer" onClick={() => onClose && onClose()}>
      <div
        className="cp-form details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cp-form-head">
          <h2>Create Order — {draft?.orderNo || "…"}</h2>
          <div>
            <button
              className="cp-btn ghost"
              onClick={() => onClose && onClose()}
            >
              Cancel
            </button>
            <button
              className="cp-btn"
              onClick={createOrder}
              disabled={creating || loadingInitial}
            >
              {creating ? "Creating…" : "Create Order"}
            </button>
          </div>
        </div>

        {loadingInitial && <div className="muted">Loading details…</div>}
        {error && (
          <div
            style={{
              background: "#fff5f5",
              color: "#9b1c1c",
              padding: 8,
              borderRadius: 6,
              marginTop: 8,
            }}
          >
            {error}
          </div>
        )}

        {!loadingInitial && draft && (
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              {/* Customer / contact (editable) */}
              <div style={{ marginBottom: 12 }}>
                <div className="label muted">Customer name</div>
                <input
                  className="cp-input"
                  style={{ maxWidth: 320 }}
                  value={draft.customerName || ""}
                  onChange={(e) =>
                    updateDraft({ customerName: e.target.value })
                  }
                  placeholder="Customer / company name"
                />

                <div
                  className="label muted"
                  style={{ marginTop: 8 }}
                >
                  Delivery address
                </div>
                <textarea
                  className="cp-input"
                  style={{ minHeight: 60, maxWidth: 420 }}
                  value={draft.deliveryAddress || ""}
                  onChange={(e) =>
                    updateDraft({ deliveryAddress: e.target.value })
                  }
                  placeholder="Address"
                />

                <div
                  style={{
                    marginTop: 8,
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(140px, 1fr))",
                  }}
                >
                  <div>
                    <div className="label muted">Contact person</div>
                    <input
                      className="cp-input"
                      value={draft.deliveryContact?.name || ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...(d || {}),
                          deliveryContact: {
                            ...(d?.deliveryContact || {}),
                            name: e.target.value,
                          },
                        }))
                      }
                      placeholder="Name"
                    />
                  </div>

                  <div>
                    <div className="label muted">Contact phone</div>
                    <input
                      className="cp-input"
                      value={draft.deliveryContact?.phone || ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...(d || {}),
                          deliveryContact: {
                            ...(d?.deliveryContact || {}),
                            phone: e.target.value,
                          },
                        }))
                      }
                      placeholder="Phone"
                    />
                  </div>

                  <div>
                    <div className="label muted">Contact email</div>
                    <input
                      className="cp-input"
                      value={draft.deliveryContact?.email || ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...(d || {}),
                          deliveryContact: {
                            ...(d?.deliveryContact || {}),
                            email: e.target.value,
                          },
                        }))
                      }
                      placeholder="Email"
                    />
                  </div>
                </div>
              </div>

              {/* Items section */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <h3 style={{ margin: 0 }}>Items</h3>
                  <button
                    type="button"
                    className="cp-btn ghost"
                    onClick={addItem}
                  >
                    + Add item
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {draft.items.map((it, idx) => (
                    <div
                      key={it.id}
                      style={{
                        border: "1px solid #eef2f7",
                        padding: 10,
                        borderRadius: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {it.name || "—"}
                          </div>
                          <div
                            className="muted"
                            style={{ fontSize: 13, marginTop: 4 }}
                          >
                            Product
                          </div>

                          <select
                            className="cp-input"
                            value={it.productId || ""}
                            onChange={(e) =>
                              updateDraftItem(idx, {
                                productId: e.target.value,
                              })
                            }
                            style={{ marginTop: 6, width: 280 }}
                          >
                            <option value="">
                              Select product (required before asset assign)
                            </option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                                {p.sku ? ` · ${p.sku}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div
                          style={{
                            width: 220,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <div>
                            <div className="muted">Branch</div>
                            <select
                              className="cp-input"
                              value={it.branchId || ""}
                              onChange={(e) =>
                                updateDraftItem(idx, {
                                  branchId: e.target.value,
                                })
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

                          <button
                            type="button"
                            className="cp-btn ghost"
                            style={{
                              alignSelf: "flex-end",
                              padding: "4px 8px",
                              fontSize: 12,
                            }}
                            onClick={() => removeItem(idx)}
                            disabled={draft.items.length <= 1}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <input
                          className="cp-input"
                          style={{ width: 90 }}
                          value={it.qty}
                          onChange={(e) =>
                            updateDraftItem(idx, {
                             qty: parseNumberInput(e.target.value, 0),
                            })
                          }
                          placeholder="Qty"
                        />
                        <input
                          className="cp-input"
                          style={{ width: 140 }}
                          value={it.rate}
                          onChange={(e) =>
                            updateDraftItem(idx, {
                              rate: parseNumberInput(e.target.value, 0),

                            })
                          }
                          placeholder="Rate"
                        />
                        <input
                          className="cp-input"
                          style={{ width: 140 }}
                          value={it.days}
                          onChange={(e) =>
                            updateDraftItem(idx, {
                              days: parseNumberInput(e.target.value, 0),

                            })
                          }
                          placeholder="Days"
                        />
                        <input
                          type="date"
                          className="cp-input"
                          value={it.expectedStartDate || ""}
                          onChange={(e) =>
                            updateDraftItem(idx, {
                              expectedStartDate: e.target.value,
                            })
                          }
                        />
                        <input
                          type="date"
                          className="cp-input"
                          value={it.expectedEndDate || ""}
                          onChange={(e) =>
                            updateDraftItem(idx, {
                              expectedEndDate: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 8,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontSize: 13 }}>
                          <strong>Assigned:</strong>{" "}
                          {(it.assignedAssets || []).length} /{" "}
                          {Number(it.qty || 0)}
                        </div>
                        <button
                          className="cp-btn ghost"
                          onClick={() => openAssetPicker(idx)}
                        >
                          Assign Product
                        </button>
                        <button
                          className="cp-btn ghost"
                          onClick={() =>
                            autoAssignAssetsForItem(idx, it.qty || 1)
                          }
                        >
                          Auto-assign
                        </button>
                        <div
                          style={{
                            marginLeft: "auto",
                            fontWeight: 700,
                          }}
                        >
                          Amount: {fmtCurrency(it.amount || 0)}
                        </div>
                      </div>

                      {(it.assignedAssets || []).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div className="muted">Assigned assets</div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              marginTop: 6,
                            }}
                          >
                            {it.assignedAssets.map((id) => {
                              const asset = assetsById[id];
                              const labelId = asset?.assetId || id;
                              const labelName =
                                asset?.metadata?.model ||
                                asset?.name ||
                                "";
                              return (
                                <div key={id} className="chip">
                                  {labelId}
                                  {labelName ? ` · ${labelName}` : ""}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right pane — totals (editable discount + taxes) */}
            <div style={{ width: 320 }}>
              <div className="label muted">Totals</div>
              <div style={{ marginTop: 8 }}>
                <div className="meta-row">
                  <div className="label">Subtotal</div>
                  <div className="value">
                    {fmtCurrency(draft.totals?.subtotal || computeSubtotal())}
                  </div>
                </div>

                {/* Discount (editable) */}
                <div style={{ marginTop: 8 }}>
                  <div className="label muted">Discount</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                    <select
                      className="cp-input"
                      style={{ width: 120 }}
                      value={(draft.discount?.type) || "percent"}
                      onChange={(e) => updateDiscount({ type: e.target.value })}
                    >
                      <option value="percent">Percent</option>
                      <option value="fixed">Fixed</option>
                    </select>

                    <input
                      className="cp-input"
                      style={{ width: 140 }}
                      value={draft.discount?.value ?? 0}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const num = parseNumberInput(e.target.value, 0);
                        updateDiscount({ value: num });

                      }}
                      placeholder="Value"
                    />
                    <div style={{ minWidth: 60, textAlign: "right" }}>
                      {(draft.discount?.type === "percent")
                        ? `${draft.discount?.value || 0}%`
                        : fmtCurrency(draft.discount?.value || 0)}
                    </div>
                  </div>
                </div>

                {/* Taxes (editable list) */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="label muted">Taxes</div>
                    <button className="cp-btn ghost" onClick={addTax} type="button">+ Add tax</button>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    {(draft.taxes || []).map((t, i) => (
                      <div key={t.id || i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <input
                          className="cp-input"
                          style={{ width: 120 }}
                          placeholder="Name"
                          value={t.name || ""}
                          onChange={(e) => updateTaxAt(i, { name: e.target.value })}
                        />
                        <select
                          className="cp-input"
                          style={{ width: 100 }}
                          value={(t.type || "percent")}
                          onChange={(e) => updateTaxAt(i, { type: e.target.value })}
                        >
                          <option value="percent">Percent</option>
                          <option value="fixed">Fixed</option>
                        </select>
                        <input
                          className="cp-input"
                          style={{ width: 80 }}
                          value={t.rate ?? t.value ?? 0}
                          onChange={(e) => {
                           const num = parseNumberInput(e.target.value, 0);
                            updateTaxAt(i, { rate: num, value: num });

                          }}
                        />
                        <button
                          className="cp-btn ghost"
                          style={{ padding: "4px 8px" }}
                          onClick={() => removeTaxAt(i)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {(draft.taxes || []).length === 0 && <div className="muted" style={{ marginTop: 6 }}>No taxes defined</div>}
                  </div>
                </div>

                <div className="meta-row" style={{ marginTop: 12 }}>
                  <div className="label">Total Tax</div>
                  <div className="value">{fmtCurrency(draft.totals?.totalTax || 0)}</div>
                </div>

                <div className="meta-row">
                  <div className="label strong">Total</div>
                  <div className="value strong">{fmtCurrency(draft.totals?.total || computeSubtotal())}</div>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <button className="cp-btn" onClick={createOrder} disabled={creating || loadingInitial}>
                  {creating ? "Creating…" : "Create Order"}
                </button>
                <button className="cp-btn ghost" style={{ marginLeft: 8 }} onClick={() => onClose && onClose()}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Asset picker modal */}
       {pickerOpen && pickerFor !== null && (
  <div
    className="cp-modal"
    onClick={() => {
      setPickerOpen(false);
      setPickerFor(null);
      setPickerAssets([]);
      setPickerSelected({});
      setPickerCompanyFilter("");
    }}
  >
    <div
      className="cp-modal-card"
      onClick={(e) => e.stopPropagation()}
    >
      <h4>Select assets for item #{pickerFor.itemIndex + 1}</h4>

      {pickerLoading && <div className="muted">Loading…</div>}

      {!pickerLoading && (
        <>
          {/* Header info */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <div className="muted">
              In stock: {(pickerAssets || []).length}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              {(() => {
                const it = draft?.items?.[pickerFor.itemIndex];
                if (!it) return "";
                const prod = products.find(
                  (p) => p.id === it.productId
                );
                return prod ? `Product: ${prod.name}` : "Product: —";
              })()}
            </div>
          </div>

          {/* 🔹 Company filter */}
          <div style={{ marginTop: 8 }}>
            <select
              className="cp-input"
              value={pickerCompanyFilter}
              onChange={(e) =>
                setPickerCompanyFilter(e.target.value)
              }
            >
              <option value="">All companies</option>
              {pickerCompanies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {!pickerLoading &&
        Object.keys(groupedPickerAssets).length === 0 && (
          <div className="muted" style={{ marginTop: 8 }}>
            No assets in stock for this product / branch.
          </div>
        )}

      {/* 🔹 Assets grouped by company */}
      <div
        style={{
          maxHeight: 300,
          overflowY: "auto",
          marginTop: 10,
        }}
      >
        {Object.entries(groupedPickerAssets).map(
          ([company, assets]) => {
            const allSelected = assets.every(
              (a) => pickerSelected[a.id]
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
                      setPickerSelected((prev) => {
                        const next = { ...(prev || {}) };
                        assets.forEach((a) => {
                          if (allSelected) delete next[a.id];
                          else next[a.id] = true;
                        });
                        return next;
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
      checked={!!pickerSelected[a.id]}
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

      {/* 🔶 Reservation date range */}
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
          }
        )}
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
          onClick={() => {
            setPickerOpen(false);
            setPickerFor(null);
            setPickerAssets([]);
            setPickerSelected({});
            setPickerCompanyFilter("");
          }}
        >
          Cancel
        </button>
        <button
          className="cp-btn"
          onClick={confirmPickerSelection}
        >
          Assign selected
        </button>
      </div>
    </div>
  </div>
)}

      </div>
    </div>
  );
}
