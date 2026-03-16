// src/pages/NursingOrderCreate.jsx
import React, { useEffect, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { updateAccountReport } from "../utils/accountReport";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { makeHistoryEntry, propagateToLead } from "../utils/status";
import "./OrderCreate.css"; // reuse same CSS

/* ============================
   Helpers (UNCHANGED)
============================ */

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
    (s, it) => s + safeNum(it.amount),
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

    const amount =
      type === "fixed"
        ? value
        : taxable * (value / 100);

    return {
      name: t.name || "",
      type,
      value,
      amount,
    };
  });

  const totalTax = taxBreakdown.reduce(
    (s, t) => s + safeNum(t.amount),
    0
  );

  const total = Math.max(0, taxable + totalTax);

  return {
    subtotal,
    discountAmount,
    taxBreakdown,
    totalTax,
    total,
  };
}

// days between two dates (inclusive)
const diffDaysInclusive = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((e - s) / msPerDay) + 1);
};
const calcDuration = (start, end, rateType) => {
  if (!start || !end) return 0;

  const s = new Date(start);
  const e = new Date(end);

  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;

  const diffMs = e - s;

  if (rateType === "hourly") {
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
  }

  const days = Math.max(
    0,
    Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
  );

  if (rateType === "monthly") {
    return Math.max(1, Math.round(days / 30));
  }

  return days;
};

/* ============================
   Component
============================ */

export default function NursingOrderCreate({
  open,
  quotation: incomingQuotation,
  serviceType = "nursing",
  onClose,
  onCreated,
}) {
  const navigate = useNavigate();

  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);

  /* ============================
     Load quotation + requirement
  ============================ */

 useEffect(() => {
  if (!open) return;

  const loadAll = async () => {
    setLoadingInitial(true);
    setError("");

    try {
      /* ============================
         1️⃣ Load fresh quotation
      ============================ */
      let freshQuotation = incomingQuotation;

      if (incomingQuotation?.id) {
        const qSnap = await getDoc(
          doc(db, "quotations", incomingQuotation.id)
        );
        if (qSnap.exists()) {
          freshQuotation = {
            id: qSnap.id,
            ...(qSnap.data() || {}),
          };
        }
      }

      /* ============================
         2️⃣ Load requirement
      ============================ */
      let requirement = null;

      if (freshQuotation?.requirementId) {
        const rSnap = await getDoc(
          doc(db, "requirements", freshQuotation.requirementId)
        );
        if (rSnap.exists()) {
          requirement = {
            id: rSnap.id,
            ...(rSnap.data() || {}),
          };
        }
      }

      /* ============================
         3️⃣ Load lead
      ============================ */
      let lead = null;

      const leadId =
        requirement?.leadId ||
        freshQuotation?.leadId ||
        null;

      if (leadId) {
        const lSnap = await getDoc(doc(db, "leads", leadId));
        if (lSnap.exists()) {
          lead = {
            id: lSnap.id,
            ...(lSnap.data() || {}),
          };
        }
      }

      /* ============================
         4️⃣ Lead snapshot (IMPORTANT)
      ============================ */
      const ls =
        requirement?.leadSnapshot ||
        requirement?.leadsnapshot ||
        null;

      /* ============================
         5️⃣ Resolve customer + contact
      ============================ */
     const customerName =
  freshQuotation?.deliveryContact?.name ||
  freshQuotation?.customerName ||
  requirement?.deliveryContact?.name ||
  requirement?.leadSnapshot?.customerName ||
  lead?.customerName ||
  "";

     const deliveryAddress =
  freshQuotation?.deliveryAddress ||
  requirement?.deliveryAddress ||
  lead?.address ||
  "";

      const deliveryContact = {
        name:
  freshQuotation?.deliveryContact?.name ||
  requirement?.deliveryContact?.name ||
  ls?.contactPerson ||
  lead?.contactPerson ||
  freshQuotation?.customerName ||
  "",
        phone:
  freshQuotation?.deliveryContact?.phone ||
  requirement?.deliveryContact?.phone ||
  requirement?.leadSnapshot?.phone ||
  lead?.phone ||
  "",
        email:
          ls?.email ||
          requirement?.email ||
          freshQuotation?.deliveryContact?.email ||
          lead?.email ||
          "",
      };

      /* ============================
         6️⃣ Build nursing items
      ============================ */
      const items = (freshQuotation?.items || []).map((it, idx) => {
 const start = it.expectedStartDate
  ? `${it.expectedStartDate}T00:00`
  : "";

const end = it.expectedEndDate
  ? `${it.expectedEndDate}T00:00`
  : "";
  const rateType = it.rateType || "daily";

  const duration = calcDuration(start, end, rateType);

       const qty = Number(it.qty || 1);


// quotation total
const subtotal = Number(it.amount || 0);

// auto calculate daily rate
const rate =
  duration > 0
    ? subtotal / (qty * duration)
    : 0;

return {
  id: it.id || `n-${Date.now()}-${idx}`,

  name:
    it.name ||
    (serviceType === "caretaker"
      ? "Caretaker Service"
      : "Nursing Service"),

  qty,

  // daily rate calculated from quotation total
  rate: Math.round(rate),

  rateType,

  duration,

  // keep quotation subtotal
  amount: subtotal,

  notes: it.notes || "",

  expectedStartDate: start,
  expectedEndDate: end,
};
});

      const discount =
        freshQuotation?.discount || { type: "percent", value: 0 };

      const taxes = freshQuotation?.taxes || [];

      const totals = calcTotals(items, discount, taxes);

      /* ============================
         7️⃣ Final draft
      ============================ */
      setDraft({
        quotationId: freshQuotation?.id || null,
        quotationNo: freshQuotation?.quoNo || "",
        requirementId: requirement?.id || "",
        orderNo: `NO-${Math.floor(Date.now() / 1000)}`,
 serviceType,
        customerName,
        deliveryAddress,
        deliveryContact,

        leadId: lead?.id || requirement?.leadId || null,

        items,
        discount,
        taxes,
        totals,
        notes: freshQuotation?.notes || "",
      });
    } catch (err) {
      console.error("NursingOrderCreate init error", err);
      setError(err.message || "Failed to load nursing order");
    } finally {
      setLoadingInitial(false);
    }
  };

  loadAll();
}, [open, incomingQuotation]);


  // updater
  const updateDraft = (patch) => {
    setDraft((d) => ({ ...(d || {}), ...(patch || {}) }));
  };

/* ============================
   Item helpers (NURSING)
============================ */

// update item + auto-calc days
const updateDraftItem = (idx, patch) => {
  setDraft((d) => {
    const nd = JSON.parse(JSON.stringify(d));
    let item = { ...(nd.items[idx] || {}), ...patch };

   if (
  Object.prototype.hasOwnProperty.call(patch, "expectedStartDate") ||
  Object.prototype.hasOwnProperty.call(patch, "expectedEndDate") ||
  Object.prototype.hasOwnProperty.call(patch, "rateType")
) {
      const start = patch.expectedStartDate ?? item.expectedStartDate;
const end = patch.expectedEndDate ?? item.expectedEndDate;
const type = patch.rateType ?? item.rateType ?? "daily";

item.duration = calcDuration(start, end, type);

    }

item.amount =
  safeNum(item.qty) *
  safeNum(item.rate) *
  safeNum(item.duration);    nd.items[idx] = item;
    nd.totals = calcTotals(nd.items, nd.discount, nd.taxes);
    return nd;
  });
};

// add nursing item
const addItem = () => {
  setDraft((d) => {
    const base = d || {};
    const items = Array.isArray(base.items) ? [...base.items] : [];

    items.push({
      id: `n-${Date.now()}`,
     name:
  base?.serviceType === "caretaker"
    ? "Caretaker Service"
    : "Nursing Service",
      qty: 1,                 // staff count
      rate: "", 
      rateType: "daily",   // NEW
     duration: 0,               // daily rate
      amount: "",
         // NEW
      notes: "",
      expectedStartDate: "",
      expectedEndDate: "",
    });

    const totals = calcTotals(items, base.discount, base.taxes);
    return { ...base, items, totals };
  });
};

const removeItem = (idx) => {
  setDraft((d) => {
    if (!d) return d;
    const items = [...d.items];
    if (items.length <= 1) return d;
    items.splice(idx, 1);
    return {
      ...d,
      items,
      totals: calcTotals(items, d.discount, d.taxes),
    };
  });
};

const computeSubtotal = () => {
  if (!draft) return 0;
  return draft.items.reduce(
    (s, it) => s + safeNum(it.amount),
    0
  );
};
/* ============================
   Discount & Tax helpers
============================ */

const updateDiscount = (patch) => {
  setDraft((d) => {
    const nd = JSON.parse(JSON.stringify(d || {}));
    nd.discount = {
      ...(nd.discount || { type: "percent", value: 0 }),
      ...(patch || {}),
    };
    nd.totals = calcTotals(nd.items || [], nd.discount, nd.taxes || []);
    return nd;
  });
};

const addTax = () => {
  setDraft((d) => {
    const nd = JSON.parse(JSON.stringify(d || {}));
    nd.taxes = Array.isArray(nd.taxes) ? [...nd.taxes] : [];
    nd.taxes.push({
      id: `t-${Date.now()}`,
      name: "",
      type: "percent",
      rate: 0,
    });
    nd.totals = calcTotals(nd.items || [], nd.discount, nd.taxes);
    return nd;
  });
};

const updateTaxAt = (index, patch) => {
  setDraft((d) => {
    const nd = JSON.parse(JSON.stringify(d || {}));
    nd.taxes = [...(nd.taxes || [])];
    nd.taxes[index] = { ...(nd.taxes[index] || {}), ...(patch || {}) };
    nd.totals = calcTotals(nd.items || [], nd.discount, nd.taxes);
    return nd;
  });
};

const removeTaxAt = (index) => {
  setDraft((d) => {
    const nd = JSON.parse(JSON.stringify(d || {}));
    nd.taxes = [...(nd.taxes || [])];
    nd.taxes.splice(index, 1);
    nd.totals = calcTotals(nd.items || [], nd.discount, nd.taxes);
    return nd;
  });
};


/* ============================
   CREATE NURSING ORDER
============================ */

const createOrder = async () => {
  setError("");
  if (!draft) return;

  setCreating(true);

  try {
    const user = auth.currentUser || {};
    const totals = calcTotals(draft.items, draft.discount, draft.taxes);

    const itemsPayload = draft.items.map((it) => ({
      name: it.name,
  qty: Number(it.qty || 0),
  rate: Number(it.rate || 0),
  rateType: it.rateType || "daily",
  duration: Number(it.duration || 0),
  amount: Number(it.amount || 0),
      notes: it.notes || "",
      days: it.days || 0,
      expectedStartDate: it.expectedStartDate || "",
      expectedEndDate: it.expectedEndDate || "",
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

     serviceType: draft.serviceType || "nursing",
      items: itemsPayload,
      discount: draft.discount,
      taxes: draft.taxes,
      totals,

      status: "created",
      createdAt: serverTimestamp(),
      createdBy: user.uid || "",
      createdByName: user.displayName || user.email || "",
      reportDate: new Date().toISOString().slice(0,10),
    };

    // 1️⃣ Create order
   const ref = await addDoc(
  collection(db, "nursingOrders"),
  orderPayload
);

    const orderId = ref.id;
  await updateAccountReport({

/* ORDERS */

ordersCreated: increment(1),

nursingOrders: draft.serviceType === "nursing"
  ? increment(1)
  : increment(0),

caretakerOrders: draft.serviceType === "caretaker"
  ? increment(1)
  : increment(0),

/* REVENUE */

totalRevenue: increment(totals.total),

[`${draft.serviceType}Revenue`]: increment(totals.total),

subtotalTotal: increment(totals.subtotal || 0),

taxTotal: increment(totals.totalTax || 0),

discountTotal: increment(totals.discountAmount || 0),

/* ORDER SNAPSHOT */

orders: arrayUnion({

  orderId: orderId,
  orderNo: draft.orderNo,

  customer: draft.customerName,

  serviceType: draft.serviceType,

  subtotal: totals.subtotal || 0,
  tax: totals.totalTax || 0,
  discount: totals.discountAmount || 0,

  total: totals.total || 0,

  items: draft.items.map(it => ({
    name: it.name,
    qty: it.qty,
    rate: it.rate,
    duration: it.duration,
    rateType: it.rateType,
    startDate: it.expectedStartDate,
    endDate: it.expectedEndDate
  })),

  createdAt: new Date()

})

});

    // 2️⃣ Update quotation
    if (draft.quotationId) {
      await updateDoc(doc(db, "quotations", draft.quotationId), {
        orderId,
        status: "order_created",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
      });
    }

    // 3️⃣ Update requirement + propagate
    if (draft.requirementId) {
      const entry = makeHistoryEntry(user, {
        type: "order",
        field: "status",
        oldValue: "",
        newValue: "order_created",
        note: `Nursing order ${draft.orderNo} created`,
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

    onCreated?.(orderId);
    onClose?.();
    navigate("/crm/nursing-orders");

  } catch (err) {
    console.error("Nursing createOrder error", err);
    setError(err.message || "Failed to create nursing order");
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
      {/* Header */}
      <div className="cp-form-head">
<h2>
  Create {draft?.serviceType === "caretaker" ? "Caretaker" : "Nursing"} Order — {draft?.orderNo || "…"}
</h2>        <div>
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
          {/* LEFT SIDE */}
          <div style={{ flex: 1 }}>
            {/* Customer / contact */}
            <div style={{ marginBottom: 12 }}>
              <div className="label muted">Customer name</div>
              <input
                className="cp-input"
                style={{ maxWidth: 320 }}
                value={draft.customerName || ""}
                onChange={(e) =>
                  updateDraft({ customerName: e.target.value })
                }
                placeholder="Customer / patient name"
              />

              <div className="label muted" style={{ marginTop: 8 }}>
                Service address
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
                  />
                </div>

                <div>
                  <div className="label muted">Phone</div>
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
                  />
                </div>

                <div>
                  <div className="label muted">Email</div>
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
                  />
                </div>
              </div>
            </div>

            {/* Nursing Items */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
<h3 style={{ margin: 0 }}>
  {draft?.serviceType === "caretaker" ? "Caretaker Services" : "Nursing Services"}
</h3>               <button
  type="button"
  className="cp-btn ghost"
  onClick={addItem}
>
  + Add {draft?.serviceType === "caretaker" ? "Caretaker" : "Nurse"}
</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                        alignItems: "center",
                      }}
                    >
                      <strong>{it.name || "Nursing Service"}</strong>
                      <button
                        className="cp-btn ghost"
                        style={{ padding: "4px 8px", fontSize: 12 }}
                        onClick={() => removeItem(idx)}
                        disabled={draft.items.length <= 1}
                      >
                        Remove
                      </button>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <select
  className="cp-input"
  style={{ width: 200 }}
  value={
    it.name ||
    (draft?.serviceType === "caretaker"
      ? "Caretaker Service"
      : "Nursing Service")
  }
  onChange={(e) =>
    updateDraftItem(idx, { name: e.target.value })
  }
>
  <option value="">Select Service</option>
  <option value="Nursing Service">Nursing Service</option>
  <option value="Caretaker Service">Caretaker Service</option>
</select>

                      <input
                        className="cp-input"
                        style={{ width: 90 }}
                        value={it.qty}
                        onChange={(e) =>
                          updateDraftItem(idx, {
                            qty: parseNumberInput(e.target.value, 0),
                          })
                        }
                        placeholder="Count"
                      />

                      <input
                        className="cp-input"
                        style={{ width: 120 }}
                        value={it.rate}
                        onChange={(e) =>
                          updateDraftItem(idx, {
                            rate: parseNumberInput(e.target.value, 0),
                          })
                        }
                        placeholder="rate"
                      />
                      <select
  className="cp-input"
  style={{ width: 110 }}
  value={it.rateType || "daily"}
  onChange={(e) =>
    updateDraftItem(idx, { rateType: e.target.value })
  }
>
  <option value="hourly">Hourly</option>
  <option value="daily">Daily</option>
  <option value="monthly">Monthly</option>
</select>

                      <input
                        type="datetime-local"
                        className="cp-input"
                        value={it.expectedStartDate || ""}
                        onChange={(e) =>
                          updateDraftItem(idx, {
                            expectedStartDate: e.target.value,
                          })
                        }
                      />

                      <input
                        type="datetime-local"
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
                        justifyContent: "flex-end",
                        marginTop: 8,
                        fontWeight: 700,
                      }}
                    >
                      Amount: {fmtCurrency(it.amount || 0)}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
  Duration: {it.duration || 0} {it.rateType}
</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE — TOTALS */}
         {/* RIGHT SIDE — TOTALS */}
<div style={{ width: 320 }}>
  <div className="label muted">Totals</div>

  {/* Subtotal */}
  <div className="meta-row">
    <div className="label">Subtotal</div>
    <div className="value">
      {fmtCurrency(draft.totals?.subtotal || computeSubtotal())}
    </div>
  </div>

  {/* Discount */}
  <div style={{ marginTop: 8 }}>
    <div className="label muted">Discount</div>
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      <select
        className="cp-input"
        style={{ width: 120 }}
        value={draft.discount?.type || "percent"}
        onChange={(e) =>
          updateDiscount({ type: e.target.value })
        }
      >
        <option value="percent">Percent</option>
        <option value="fixed">Fixed</option>
      </select>

      <input
        className="cp-input"
        style={{ width: 120 }}
        value={draft.discount?.value ?? 0}
        onChange={(e) =>
          updateDiscount({
            value: parseNumberInput(e.target.value, 0),
          })
        }
        placeholder="Value"
      />
    </div>
  </div>

  {/* Taxes */}
  <div style={{ marginTop: 12 }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div className="label muted">Taxes</div>
      <button
        className="cp-btn ghost"
        type="button"
        onClick={addTax}
      >
        + Add tax
      </button>
    </div>

    <div style={{ marginTop: 8 }}>
      {(draft.taxes || []).map((t, i) => (
        <div
          key={t.id || i}
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <input
            className="cp-input"
            style={{ width: 90 }}
            placeholder="Name"
            value={t.name || ""}
            onChange={(e) =>
              updateTaxAt(i, { name: e.target.value })
            }
          />

          <select
            className="cp-input"
            style={{ width: 90 }}
            value={t.type || "percent"}
            onChange={(e) =>
              updateTaxAt(i, { type: e.target.value })
            }
          >
            <option value="percent">Perc</option>
            <option value="fixed">Fixed</option>
          </select>

          <input
            className="cp-input"
            style={{ width: 70 }}
            value={t.rate ?? t.value ?? 0}
            onChange={(e) =>
              updateTaxAt(i, {
                rate: parseNumberInput(e.target.value, 0),
                value: parseNumberInput(e.target.value, 0),
              })
            }
          />

          <button
            className="cp-btn ghost"
            style={{ padding: "4px 8px" }}
            onClick={() => removeTaxAt(i)}
          >
            Remove
          </button>
        </div>
      ))}

      {(draft.taxes || []).length === 0 && (
        <div className="muted" style={{ marginTop: 6 }}>
          No taxes added
        </div>
      )}
    </div>
  </div>

  {/* Total Tax */}
  <div className="meta-row" style={{ marginTop: 12 }}>
    <div className="label">Total Tax</div>
    <div className="value">
      {fmtCurrency(draft.totals?.totalTax || 0)}
    </div>
  </div>

  {/* Grand Total */}
  <div className="meta-row">
    <div className="label strong">Total</div>
    <div className="value strong">
      {fmtCurrency(draft.totals?.total || computeSubtotal())}
    </div>
  </div>

  <div style={{ marginTop: 18 }}>
    <button
      className="cp-btn"
      onClick={createOrder}
      disabled={creating || loadingInitial}
    >
      {creating ? "Creating…" : "Create Order"}
    </button>
    <button
      className="cp-btn ghost"
      style={{ marginLeft: 8 }}
      onClick={() => onClose && onClose()}
    >
      Cancel
    </button>
  </div>
</div>

        </div>
      )}
    </div>
  </div>
);

}  