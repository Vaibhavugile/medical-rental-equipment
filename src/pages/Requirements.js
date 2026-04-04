// src/pages/Requirements.js
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import { updateAccountReport } from "../utils/accountReport";
import { db, auth } from "../firebase";
import "./Requirements.css";
import { makeHistoryEntry, propagateToLead } from "../utils/status";
import RequirementForm from "../data/RequirementForm";

/* Quotation object — default */
const defaultQuotation = {
  id: null,
  requirementId: "",
  quoNo: "",
  quotationId: "",
  items: [
    {
      id: Date.now() + "-i1",
      name: "",
      qty: 1,
      rate: 0,
      amount: 0,
      notes: "",
      days: 0,
      expectedStartDate: "",
      expectedEndDate: "",
      productId: "",
    },
  ],
  discount: { type: "percent", value: 0 },
  taxes: [
  {
    id: "t1",
    name: "GST",
    type: "percent",
    value: 18
  }
],
  notes: "",
  status: "sent",
  createdAt: null,
  createdBy: "",
  createdByName: "",
};

const fmtCurrency = (v) => {
  try {
    return Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return String(v ?? "0.00");
  }
};

const calcAmounts = (items, discount, taxes) => {
  const subtotal = (items || []).reduce(
  (s, it) => s + Number(it.amount || 0),
  0
);

  // ✅ Discount
  let discountAmount = 0;
  if (discount) {
    if ((discount.type || "").toLowerCase() === "percent") {
      discountAmount = subtotal * (Number(discount.value || 0) / 100);
    } else {
      discountAmount = Number(discount.value || 0);
    }
  }

  const taxable = Math.max(0, subtotal - discountAmount);

  // ✅ Taxes (fixed + percent support)
  const taxBreakdown = (taxes || []).map((t) => {
    const type = (t.type || "percent").toLowerCase();
    const value = Number(t.value ?? t.rate ?? 0);

    let amount = 0;

    if (type === "fixed") {
      amount = value;
    } else {
      amount = taxable * (value / 100);
    }

    return {
      ...t,
      value,
      amount: Number(amount.toFixed(2)),
        // 🔥 lock like order
      locked: true,
    };
  });

  const totalTax = taxBreakdown.reduce((s, t) => s + (t.amount || 0), 0);
  const total = Math.max(0, taxable + totalTax);

  return { subtotal, discountAmount, taxBreakdown, totalTax, total };
};
const parseDateForDisplay = (ts) => {
  try {
    if (!ts) return "—";
    if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    if (typeof ts === "string") {
      const d = new Date(ts);
      if (!isNaN(d)) return d.toLocaleString();
    }
    if (ts instanceof Date) return ts.toLocaleString();
    if (typeof ts === "number") return new Date(ts).toLocaleString();
    return "—";
  } catch {
    return "—";
  }
};

/* Requirement statuses shown in chips */
const REQ_STATUSES = ["ready_for_quotation", "quotation shared"];
const norm = (s = "") => String(s || "").toLowerCase();
const statusClass = (s = "") =>
  s
    .split(" ")
    .map((t) => (t ? t[0].toUpperCase() + t.slice(1) : ""))
    .join("");

export default function Requirements() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const [userRole, setUserRole] = useState(null); 
  // Toolbar state
  const [statusFilter, setStatusFilter] = useState("all");
const [editRequirement, setEditRequirement] = useState(null);
  // UI: details + quotation
  const [detailsReq, setDetailsReq] = useState(null);
  const [openQuotation, setOpenQuotation] = useState(false);
  const [quotation, setQuotation] = useState(defaultQuotation);
  const [confirmDelete, setConfirmDelete] = useState(null);
const [typeFilter, setTypeFilter] = useState("all");
const [search, setSearch] = useState("");
  // Track last focused item index for "+ Add Item below current"
  const [activeItemIdx, setActiveItemIdx] = useState(null);
const isNursingReq = (r) =>
  r?.serviceType === "nursing" || r?.serviceType === "caretaker";
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "requirements"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setRequirements(docs);
        setLoading(false);
      },
      (err) => {
        console.error("requirements onSnapshot", err);
        setError(err.message || "Failed to load requirements");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const openDetails = (r) => setDetailsReq(r);
  const closeDetails = () => setDetailsReq(null);

  /* Create Quotation drawer */
const openCreateQuotation = async (req) => {
  setError("");
  const user = auth.currentUser || {};

  // Optional: auto-assign to current user when opening
  if (req && !req.assignedTo && user?.uid) {
    try {
      const reqDoc = doc(db, "requirements", req.id);
      const entry = makeHistoryEntry(user, {
        type: "assign",
        field: "assignedTo",
        oldValue: req.assignedTo || "",
        newValue: user.uid,
        note: "Assigned when opening quotation",
      });

      updateDoc(reqDoc, {
        assignedTo: user.uid,
        assignedToName: user.displayName || user.email || user.uid || "",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || user.uid || "",
        history: arrayUnion(entry),
      }).catch(() => {});
    } catch {}
  }

  // ===============================
  // 🧠 BUILD QUOTATION ITEMS
  // ===============================
  let items = [];

  if (isNursingReq(req)) {
    // 🩺 NURSING / CARETAKER (FINAL FIXED LOGIC)

    const days = Number(req.expectedDurationDays) || 1;
    const count = Number(req.nursing?.count || 1);
    const rate = Number(req.dailyRate || 0);

    const staffType = req.nursing?.staffType || "Care Staff";
    const shift = req.nursing?.shift || "day";

    items = [
      {
        id: Date.now() + "-nursing",
        name: `${staffType} (${shift})`,
        qty: count,                    // ✅ STAFF COUNT (FIXED)
        rate: rate,                    // per staff per day
        amount: count * days * rate,   // ✅ correct total
        notes: req.nursing?.notes || "",
        days: days,                    // ✅ duration shown separately
        expectedStartDate: req.expectedStartDate || "",
        expectedEndDate: req.expectedEndDate || "",
        productId: "",                 // ❌ no product for nursing
      },
    ];
  } else {
    // 📦 RENTAL (UNCHANGED)

    const sourceItems =
      req?.equipment && Array.isArray(req.equipment) && req.equipment.length
        ? req.equipment
        : req?.requirementItems && Array.isArray(req.requirementItems)
        ? req.requirementItems
        : [];

    items = (sourceItems.length
      ? sourceItems
      : [{ name: "", qty: 1, expectedDurationDays: 0 }]
    ).map((it, idx) => {
      const name = it.name || it.itemName || it.productName || "";
      const qty = Number(it.qty || it.quantity || 1);
      const rate = Number(it.rate || 0);
      const amount = Number(qty * rate);
      const notes =
        it.unitNotes || it.notes || it.specialInstructions || "";
      const days =
        it.expectedDurationDays ??
        it.days ??
        req?.expectedDurationDays ??
        0;
      const expectedStartDate =
        it.expectedStartDate || it.startDate || req?.expectedStartDate || "";
      const expectedEndDate =
        it.expectedEndDate || it.endDate || req?.expectedEndDate || "";
      const productId = it.productId || "";

      return {
        id: Date.now() + "-" + idx,
        name,
        qty,
        rate,
        amount,
        notes,
        days,
        expectedStartDate,
        expectedEndDate,
        productId,
      };
    });
  }
  // ✅ Normalize taxes (FIX OLD rate → value issue)
const normalizeTaxes = (taxes = []) =>
  taxes.map((t, i) => ({
    id: t.id || `t-${i}`,
    name: t.name || "Tax",
    type: t.type || "percent",
    value: Number(t.value ?? t.rate ?? 0),
  }));

  // ===============================
  // 📄 FINAL QUOTATION OBJECT
  // ===============================
  const base = {
    ...defaultQuotation,
     taxes: normalizeTaxes(
    req?.taxes ||
    defaultQuotation.taxes
  ),
    requirementId: req?.id || "",
    requirementNumber: req?.requirementNumber || "",
    quoNo: `Q-${Date.now()}`,
    quotationId: `QT-${Math.floor(Date.now() / 1000)}`,
    items,
    notes: `Quotation for requirement ${req?.requirementNumber || req?.requirementId || req?.id}`,
    status: "sent",
    createdAt: null,
    createdBy: user.uid || "",
    createdByName: user.displayName || user.email || "",
    serviceType: req?.serviceType || "rental",
  };

  setQuotation(base);
  setActiveItemIdx(null);
  setOpenQuotation(true);
};
useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (snap.exists()) {
      setUserRole(snap.data().role);
    }
  });

  return () => unsub();
}, []);

  const closeQuotation = () => {
    setOpenQuotation(false);
    setQuotation(defaultQuotation);
    setActiveItemIdx(null);
  };

  const updateQuotationItem = (idx, patch) => {
  setQuotation((q) => {
    const items = (q.items || []).slice();
    items[idx] = { ...items[idx], ...patch };

    if (q.serviceType === "nursing" || q.serviceType === "caretaker") {
      const qty = Number(items[idx].qty || 0);
      const rate = Number(items[idx].rate || 0);
      const days = Number(items[idx].days || 1);

      items[idx].amount = qty * rate * days;
    } else {
      const qty = Number(items[idx].qty || 0);
      const rate = Number(items[idx].rate || 0);

      items[idx].amount = qty * rate;
    }

    return { ...q, items };
  });
};

  // Insert NEW item right BELOW the last focused row; copy its dates/days
  const addQuotationItem = () =>
    setQuotation((q) => {
      const items = (q.items || []).slice();
      const idx =
        typeof activeItemIdx === "number" && activeItemIdx >= 0
          ? activeItemIdx
          : items.length - 1;
      const base = items[idx] || {};
      const newItem = {
        id: Date.now() + "-i" + Math.random().toString(36).slice(2, 7),
        name: "",
        qty: 1,
        rate: 0,
        amount: 0,
        days: base.days ?? 0,
        expectedStartDate: base.expectedStartDate || "",
        expectedEndDate: base.expectedEndDate || "",
        notes: "",
        productId: "",
      };
      const insertAt = Math.max(0, Math.min((idx ?? items.length - 1) + 1, items.length));
      items.splice(insertAt, 0, newItem);
      return { ...q, items };
    });

  const removeQuotationItem = (idx) =>
    setQuotation((q) => ({
      ...q,
      items: q.items.filter((_, i) => i !== idx),
    }));

  const amounts = useMemo(
    () =>
      calcAmounts(
        quotation.items || [],
        quotation.discount,
        quotation.taxes || []
      ),
    [quotation.items, quotation.discount, quotation.taxes]
  );

  const saveQuotation = async () => {
    setError("");
    try {
      const user = auth.currentUser || {};
      const payload = {
  requirementId: quotation.requirementId || "",
  requirementNumber:
    detailsReq?.requirementNumber ||
    quotation.requirementNumber ||
    "",

  serviceType:
  detailsReq?.serviceType ||
  quotation?.serviceType ||
  "rental",

  quoNo: quotation.quoNo || `Q-${Date.now()}`,
  quotationId:
    quotation.quotationId || `QT-${Math.floor(Date.now() / 1000)}`,

  items: (quotation.items || []).map((it) => ({
    name: it.name,
    qty: Number(it.qty || 0),
    rate: Number(it.rate || 0),
    amount: Number(it.amount || 0),
    notes: it.notes || "",
    days: it.days || 0,
    expectedStartDate: it.expectedStartDate || "",
    expectedEndDate: it.expectedEndDate || "",
    productId: it.productId || "",
  })),

  discount: quotation.discount || { type: "percent", value: 0 },
  taxes: quotation.taxes || [],
  notes: quotation.notes || "",
  status: quotation.status || "sent",

  totals: {
    subtotal: amounts.subtotal,
    discountAmount: amounts.discountAmount,
    taxBreakdown: amounts.taxBreakdown,
    totalTax: amounts.totalTax,
    total: amounts.total,
  },

  createdAt: serverTimestamp(),
  createdBy: user.uid || "",
  createdByName: user.displayName || user.email || "",
};

      const ref = await addDoc(collection(db, "quotations"), payload);
      await updateAccountReport({
  quotationsSent: increment(1)
})

      // Mark requirement as "quotation shared"
      if (quotation.requirementId) {
        const reqDoc = doc(db, "requirements", quotation.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "status",
          field: "status",
          oldValue: detailsReq?.status || "",
          newValue: "quotation shared",
          note: `Quotation ${payload.quoNo} created (id ${ref.id})`,
        });
        await updateDoc(reqDoc, {
          status: "quotation shared",
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName:
            user.displayName || user.email || user.uid || "",
          history: arrayUnion(entry),
        });

        propagateToLead(
          quotation.requirementId,
          "quotation",
          detailsReq?.status || "",
          "quotation shared",
          entry.note
        );
      }

      closeQuotation();
    } catch (err) {
      console.error("saveQuotation error", err);
      setError(err.message || "Failed to save quotation");
    }
  };

  // Delete a requirement
  const handleDelete = async (req) => {
    try {
      await deleteDoc(doc(db, "requirements", req.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error("delete requirement", err);
      setError(err.message || "Failed to delete requirement");
    }
  };

  const changeReqStatus = async (req, newStatus, note = "") => {
    try {
      const user = auth.currentUser || {};
      const entry = makeHistoryEntry(user, {
        type: "status",
        field: "status",
        oldValue: req.status,
        newValue: newStatus,
        note,
      });
      await updateDoc(doc(db, "requirements", req.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || user.uid || "",
        history: arrayUnion(entry),
      });
      propagateToLead(
        req.id,
        "requirement",
        req.status || "",
        newStatus,
        note || entry.note
      );
    } catch (err) {
      console.error("changeReqStatus", err);
      setError(err.message || "Failed to change status");
    }
  };

  const assignToMe = async (req) => {
    setError("");
    try {
      const user = auth.currentUser || {};
      if (!user?.uid) {
        setError("You must be signed in to assign.");
        return;
      }
      const reqDoc = doc(db, "requirements", req.id);
      const entry = makeHistoryEntry(user, {
        type: "assign",
        field: "assignedTo",
        oldValue: req.assignedTo || "",
        newValue: user.uid,
        note: `Assigned to ${user.displayName || user.email || user.uid}`,
      });
      await updateDoc(reqDoc, {
        assignedTo: user.uid,
        assignedToName: user.displayName || user.email || user.uid || "",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || user.uid || "",
        history: arrayUnion(entry),
      });
    } catch (err) {
      console.error("assignToMe", err);
      setError(err.message || "Failed to assign");
    }
  };

  // Counts & filter for chips
const statusCounts = useMemo(() => {

  const mainStatuses = [
    "ready_for_quotation",
    "quotation shared",
    "order_created"
  ];

  const counts = {
    all: requirements.length,
    ready_for_quotation: 0,
    "quotation shared": 0,
    order_created: 0,
    others: 0
  };

  requirements.forEach((r) => {

    const s = (r.status || "").toLowerCase();

    if (mainStatuses.includes(s)) {
      counts[s]++;
    } else {
      counts.others++;
    }

  });

  return counts;

}, [requirements]);
  const filtered = useMemo(() => {
  return requirements.filter((r) => {
    const service = r.serviceType || "rental";

    const matchesType =
      typeFilter === "all" || service === typeFilter;

    const mainStatuses = [
  "ready_for_quotation",
  "quotation shared",
  "order_created"
];

let matchesStatus = true;

if (statusFilter !== "all") {

  const s = (r.status || "").toLowerCase();

  if (statusFilter === "others") {
    matchesStatus = !mainStatuses.includes(s);
  } else {
    matchesStatus = s === statusFilter.toLowerCase();
  }

}

    const searchText = search.toLowerCase();

    const matchesSearch =
      !searchText ||
      (r.requirementNumber || "").toLowerCase().includes(searchText) ||
      (r.leadSnapshot?.customerName || "")
        .toLowerCase()
        .includes(searchText) ||
      (r.leadSnapshot?.phone || "")
        .toLowerCase()
        .includes(searchText);

    return matchesType && matchesStatus && matchesSearch;
  });
}, [requirements, typeFilter, statusFilter, search]);

  if (loading)
    return (
      <div className="coupons-wrap">
        <div className="coupons-loading">Loading requirements…</div>
      </div>
    );

  return (
    <div className="coupons-wrap">
      {error && <div className="coupons-error">{error}</div>}

      <header className="coupons-header">
        <div>
          <h1>📑 Requirements</h1>
          <p>
            Operations → move requirements from <strong>ready for quotation</strong> to{" "}
            <strong>quotation shared</strong>.
          </p>
        </div>
      </header>

      {/* Status chips toolbar */}
      <section className="filter-bar">

  <div className="filter-left">

    {/* TYPE FILTER */}
    <div className="segmented type-segment">
      <button
        className={`seg-btn ${typeFilter === "all" ? "active" : ""}`}
        onClick={() => {
          setTypeFilter("all");
          setStatusFilter("all");
        }}
      >
        All
      </button>

      <button
        className={`seg-btn equipment ${
          typeFilter === "rental" ? "active" : ""
        }`}
        onClick={() => {
          setTypeFilter("rental");
          setStatusFilter("all");
        }}
      >
        📦 Rental
      </button>

      <button
        className={`seg-btn nursing ${
          typeFilter === "nursing" ? "active" : ""
        }`}
        onClick={() => {
          setTypeFilter("nursing");
          setStatusFilter("all");
        }}
      >
        🩺 Nursing
      </button>
      <button
  className={`seg-btn caretaker ${
    typeFilter === "caretaker" ? "active" : ""
  }`}
  onClick={() => {
    setTypeFilter("caretaker");
    setStatusFilter("all");
  }}
>
  🧑‍⚕️ Caretaker
</button>
    </div>

    {/* STATUS FILTER */}
  <div className="segmented status-segment">

  <button
    className={`seg-btn ${statusFilter === "all" ? "active" : ""}`}
    onClick={() => setStatusFilter("all")}
  >
    All <span className="badge">{statusCounts.all}</span>
  </button>

  <button
    className={`seg-btn ${
      statusFilter === "ready_for_quotation" ? "active" : ""
    }`}
    onClick={() => setStatusFilter("ready_for_quotation")}
  >
    Ready
    <span className="badge">
      {statusCounts.ready_for_quotation}
    </span>
  </button>

  <button
    className={`seg-btn ${
      statusFilter === "quotation shared" ? "active" : ""
    }`}
    onClick={() => setStatusFilter("quotation shared")}
  >
    Shared
    <span className="badge">
      {statusCounts["quotation shared"]}
    </span>
  </button>

  <button
    className={`seg-btn ${
      statusFilter === "order_created" ? "active" : ""
    }`}
    onClick={() => setStatusFilter("order_created")}
  >
    Order Created
    <span className="badge">
      {statusCounts.order_created}
    </span>
  </button>
  <button
  className={`seg-btn ${statusFilter === "others" ? "active" : ""}`}
  onClick={() => setStatusFilter("others")}
>
  Others
  <span className="badge">
    {statusCounts.others}
  </span>
</button>

</div>

  </div>

  {/* SEARCH */}
  <div className="filter-search">
    <input
      className="search-input"
      placeholder="Search requirement no, customer, phone..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>

  {/* SUMMARY */}
  <div className="filter-summary">
    {filtered.length} / {requirements.length}
  </div>

</section>

      <section className="coupons-card">
        <div className="tbl-wrap">
          <table className="cp-table">
            <thead>
              <tr>
               <th>Req No</th>
<th>Service</th>
<th>Customer</th>
<th>Contact</th>
<th>Phone</th>
<th>Status</th>
<th>Created</th>
<th>Actions</th>

              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const customer =
  r.leadSnapshot?.customerName ||
  r.customerName ||
  r.deliveryContact?.name ||
  r.name ||
  "—";
               const contact =
  r.leadSnapshot?.contactPerson ||
  r.contactPerson ||
  r.deliveryContact?.name ||
  "—";
                const phone =
  r.leadSnapshot?.phone ||
  r.phone ||
  r.deliveryContact?.phone ||
  "—";
                const sClass = statusClass(r.status || "");
                return (
                  <tr key={r.id}>
<td className="strong">
  {r.requirementNumber || r.requirementId || r.id}
</td>                 <td>
  {r.serviceType === "caretaker" ? (
    <span className="chip">🧑‍⚕️ Caretaker</span>
  ) : r.serviceType === "nursing" ? (
    <span className="chip">🩺 Nursing</span>
  ) : (
    <span className="chip">📦 Rental</span>
  )}
</td>

                    <td className="muted">{customer}</td>
                    <td className="muted">{contact}</td>
                    <td>{phone}</td>
                    <td>
                      <span className={`chip ${sClass}`}>{r.status || "—"}</span>
                    </td>
                    <td className="muted">{parseDateForDisplay(r.createdAt)}</td>
                    <td>
                      <div className="row-actions">

  {/* View */}
  <button
    type="button"
    className="row-btn view"
    onClick={() => openDetails(r)}
  >
    View
  </button>

  {/* Create Quotation */}
  {norm(r.status) !== "quotation shared" && (
    <button
      type="button"
      className="row-btn req"
      onClick={() => openCreateQuotation(r)}
    >
      Create Quotation
    </button>
  )}
 <button
    type="button"
    className="row-btn edit"
    onClick={() => setEditRequirement(r)}
  >
    Edit
  </button>
  {/* Delete */}
  {userRole === "superadmin" && (
  <button
    type="button"
    className="row-btn danger"
    onClick={() => setConfirmDelete(r)}
  >
    Delete
  </button>
)}
</div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan="7">
                    <div className="empty">No requirements found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Details drawer */}
      {detailsReq && (
        <div
          className="cp-drawer"
          onClick={(e) => {
            if (e.target.classList.contains("cp-drawer")) closeDetails();
          }}
        >
          <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
            <div className="cp-form-head">
              <h2>
<h2>
  Requirement: {detailsReq.requirementNumber || detailsReq.requirementId || detailsReq.id}
</h2>              </h2>
            <button type="button" className="cp-icon" onClick={closeDetails}>✕</button>
            </div>

            <div className="details-grid">
              <div className="details-left">
                <div className="details-row">
                  <div className="label muted">Requester</div>
                  <div className="value strong">
                   {detailsReq.name ||
  detailsReq.customerName ||
  detailsReq.leadSnapshot?.customerName ||
  detailsReq.deliveryContact?.name ||
  "—"}
                  </div>
                </div>

                <div className="details-row">
                  <div className="label muted">Contact</div>
                  <div className="value">
                    {detailsReq.contactPerson ||
                      detailsReq.leadSnapshot?.contactPerson ||
                      detailsReq.name ||
                      "—"}{" "}
                    {detailsReq.email ? `· ${detailsReq.email}` : ""}
                  </div>
                </div>

                <div className="details-row">
                  <div className="label muted">Phone</div>
                  <div className="value">
                   {detailsReq.phone ||
  detailsReq.leadSnapshot?.phone ||
  detailsReq.deliveryContact?.phone ||
  "—"}
                  </div>
                </div>

                <div className="details-row">
                  <div className="label muted">Delivery Address</div>
                  <div className="value">
                    {detailsReq.deliveryAddress ||
                      detailsReq.address ||
                      detailsReq.deliveryCity ||
                      "—"}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Requirement Details</h3>
                  <div className="details-notes">
                    {detailsReq.specialInstructions ||
                      detailsReq.requirementDetails ||
                      "—"}
                  </div>
                </div>
{isNursingReq(detailsReq) && (
  <div style={{ marginTop: 12 }}>
    <h3>Nursing Details</h3>

    <div className="details-row">
      <div className="label muted">Staff Type</div>
      <div className="value">
        {detailsReq.nursing?.staffType || "—"}
      </div>
    </div>

    <div className="details-row">
      <div className="label muted">Staff Count</div>
      <div className="value">
        {detailsReq.nursing?.count || "—"}
      </div>
    </div>

    <div className="details-row">
      <div className="label muted">Shift</div>
      <div className="value">
        {detailsReq.nursing?.shift || "—"}
      </div>
    </div>

    <div className="details-row">
      <div className="label muted">Duration</div>
      <div className="value">
        {detailsReq.expectedDurationDays || "—"} days
      </div>
    </div>

    <div className="details-row">
      <div className="label muted">Start Date</div>
      <div className="value">
        {parseDateForDisplay(detailsReq.expectedStartDate)}
      </div>
    </div>

    <div className="details-row">
      <div className="label muted">End Date</div>
      <div className="value">
        {parseDateForDisplay(detailsReq.expectedEndDate)}
      </div>
    </div>

    {detailsReq.nursing?.notes && (
      <div style={{ marginTop: 8 }}>
        <strong>Notes</strong>
        <div className="details-notes">
          {detailsReq.nursing.notes}
        </div>
      </div>
    )}
  </div>
)}

{!isNursingReq(detailsReq) && (

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Items Requested</h3>

                  <table className="items-table" aria-label="Items requested">
                    <thead>
                      <tr>
                        <th className="col-name">Item</th>
                        <th className="col-qty">Qty</th>
                        <th className="col-days">Days</th>
                        <th className="col-start">Start</th>
                        <th className="col-end">End</th>
                        <th className="col-notes">Notes</th>
                        <th className="col-pid">Product ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailsReq.equipment || detailsReq.requirementItems || []).map(
                        (it, i) => {
                          const name = it.name || it.itemName || it.productName || "";
                          const qty = it.qty || it.quantity || 1;
                          const days =
                            it.expectedDurationDays ??
                            it.days ??
                            detailsReq?.expectedDurationDays ??
                            "—";
                          const start =
                            it.expectedStartDate ||
                            it.startDate ||
                            detailsReq?.expectedStartDate ||
                            "";
                          const end =
                            it.expectedEndDate ||
                            it.endDate ||
                            detailsReq?.expectedEndDate ||
                            "";
                          const notes = it.unitNotes || it.notes || "";
                          const productId = it.productId || "";
                          return (
                            <tr key={i}>
                              <td>{name || "—"}</td>
                              <td>{qty}</td>
                              <td>{days ?? "—"}</td>
                              <td className="item-date">
                                {start ? parseDateForDisplay(start) : "—"}
                              </td>
                              <td className="item-date">
                                {end ? parseDateForDisplay(end) : "—"}
                              </td>
                              <td className="item-notes">{notes || "—"}</td>
                              <td>{productId || "—"}</td>
                            </tr>
                          );
                        }
                      )}
                      {((detailsReq.equipment || detailsReq.requirementItems || [])
                        .length === 0) && (
                        <tr>
                          <td colSpan="7" className="muted">
                            No items listed.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <div className="details-row">
                    <div className="label muted">Urgency</div>
                    <div className="value">{detailsReq.urgency || "normal"}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="details-meta">
                  <div className="meta-row">
                    <div className="label muted">Status</div>
                    <div className="value">
                      <span className={`chip ${statusClass(detailsReq.status || "")}`}>
                        {detailsReq.status || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Assigned To</div>
                    <div className="value">
                      {detailsReq.assignedToName
                        ? detailsReq.assignedToName
                        : detailsReq.assignedTo
                        ? detailsReq.assignedTo
                        : "—"}
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Lead</div>
                    <div className="value">
                      {detailsReq.leadId ||
                        detailsReq.leadSnapshot?.customerName ||
                        "—"}
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Delivery Contact</div>
                    <div className="value">
                      {detailsReq.deliveryContact?.name
                        ? `${detailsReq.deliveryContact.name} · ${
                            detailsReq.deliveryContact.phone || ""
                          }`
                        : detailsReq.deliveryContact?.phone || "—"}
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Created</div>
                    <div className="value">
                      {parseDateForDisplay(detailsReq.createdAt)} ·{" "}
                      {detailsReq.createdByName || detailsReq.createdBy || "—"}
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Operations</div>
                    <div className="value">
                      {norm(detailsReq.status) !== "quotation shared" ? (
                        <button className="cp-btn" onClick={() => openCreateQuotation(detailsReq)}>
                          Create Quotation
                        </button>
                      ) : (
                        <div className="muted">Quotation already shared</div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button className="cp-btn ghost" onClick={() => assignToMe(detailsReq)}>
                      Assign to me
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <hr className="hr" />

            <div style={{ marginTop: 8 }}>
  <h3>Full History</h3>

  <div className="history-list compact">
    {(detailsReq.history && detailsReq.history.length
      ? detailsReq.history.slice().reverse()
      : []
    ).map((h, i) => (
      <div key={i} className="history-item compact">
        {/* Top row */}
        <div className="history-top">
          <span className="history-title">
            {h.type?.toUpperCase()}
            {h.field ? ` · ${h.field}` : ""}
          </span>

          <span className="history-time">
            {parseDateForDisplay(h.ts)}
          </span>
        </div>

        {/* User */}
        <div className="history-user">
          {h.changedByName || h.changedBy}
        </div>

        {/* Note */}
        {h.note && (
          <div className="history-note">
            {h.note}
          </div>
        )}

        {/* Change */}
        {(h.oldValue || h.newValue) && (
          <div className="history-change">
            <span className="from">{h.oldValue ?? "—"}</span>
            <span className="arrow">→</span>
            <span className="to">{h.newValue ?? "—"}</span>
          </div>
        )}
      </div>
    ))}

    {(!detailsReq.history || !detailsReq.history.length) && (
      <div className="muted" style={{ padding: 6 }}>
        No history available.
      </div>
    )}
  </div>
</div>


            <div
              className="details-footer"
              style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 8 }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                {norm(detailsReq.status) !== "quotation shared" && (
                  <button
                    className="cp-btn"
                    onClick={() =>
                      changeReqStatus(
                        detailsReq,
                        "quotation shared",
                        "Manual mark as quotation shared"
                      )
                    }
                  >
                    Mark Quotation Shared
                  </button>
                )}
                <button className="cp-btn ghost" onClick={closeDetails}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quotation drawer */}
      {openQuotation && (
        <div
          className="cp-drawer"
          onClick={(e) => {
            if (e.target.classList.contains("cp-drawer")) closeQuotation();
          }}
        >
          <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
            <div className="cp-form-head">
<h2>
  Quotation for {detailsReq?.requirementNumber || quotation.requirementId || "—"}
</h2>              <button type="button" className="cp-icon" onClick={closeQuotation}>
                ✕
              </button>
            </div>

            <div className="quotation-grid">
              <div>
                <div className="cp-field">
                  <label>Quotation No</label>
                  <input
                    className="cp-input"
                    value={quotation.quoNo}
                    onChange={(e) =>
                      setQuotation((q) => ({ ...q, quoNo: e.target.value }))
                    }
                  />
                </div>

                <div className="cp-field">
                  <label>Quotation ID</label>
                  <input
                    className="cp-input"
                    value={quotation.quotationId}
                    onChange={(e) =>
                      setQuotation((q) => ({ ...q, quotationId: e.target.value }))
                    }
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <h3>Items</h3>
                  <div className="quotation-items">
                    {quotation.items.map((it, idx) => (
                      <div key={it.id} className="quotation-item">
                        {/* ONE ROW: Product name | Qty | Price | Total | Remove */}
                        <div className="req-quote-row">
                          <input
                            className="req-quote-input"
                            placeholder="Product name"
                            value={it.name || ""}
                            onFocus={() => setActiveItemIdx(idx)}
                            onChange={(e) =>
                              updateQuotationItem(idx, { name: e.target.value })
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            className="req-quote-input small"
                            placeholder="Qty"
                            value={it.qty ?? ""}
                            onFocus={() => setActiveItemIdx(idx)}
                            onChange={(e) =>
                              updateQuotationItem(idx, {
                                qty: Number(e.target.value || 0),
                              })
                            }
                          />
                          <input
                            type="number"
                            // min="0"
                            step="0.01"
                            className="req-quote-input small"
                            placeholder={isNursingReq(detailsReq) ? "Daily Price" : "Price"}
                            value={it.rate ?? ""}
                            onFocus={() => setActiveItemIdx(idx)}
                            onChange={(e) =>
                              updateQuotationItem(idx, {
                                rate: Number(e.target.value || 0),
                              })
                            }
                          />

                          {/* Line Total */}
                          <div className="req-quote-total">
                            {fmtCurrency(
                          
  quotation.serviceType === "nursing" || quotation.serviceType === "caretaker"
    ? Number(it.qty || 0) *
      Number(it.rate || 0) *
      Number(it.days || 1)
    : Number(it.qty || 0) *
      Number(it.rate || 0)

                            )}
                          </div>

                          {/* Remove */}
                      {!isNursingReq(detailsReq) && (
  <button
    type="button"
    className="cp-btn danger"
    onClick={() => removeQuotationItem(idx)}
  >
    ✕
  </button>
)}

                        </div>

                        {/* Extra details remain below */}
                        <div className="extra-details">
                          Days: {it.days ?? "—"} • Start:{" "}
                          {it.expectedStartDate
                            ? parseDateForDisplay(it.expectedStartDate)
                            : "—"}{" "}
                          • End:{" "}
                          {it.expectedEndDate
                            ? parseDateForDisplay(it.expectedEndDate)
                            : "—"}{" "}
                         • Notes: {it.notes || "—"}
{!isNursingReq(detailsReq) && <> • Product ID: {it.productId || "—"}</>}

                        </div>
                      </div>
                    ))}

                   {!isNursingReq(detailsReq) && (
  <div>
    <button type="button" className="cp-btn" onClick={addQuotationItem}>
      + Add Item
    </button>
  </div>
)}

                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3>Notes</h3>
                  <textarea
                    className="cp-input"
                    rows={4}
                    value={quotation.notes}
                    onChange={(e) =>
                      setQuotation((q) => ({ ...q, notes: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <div className="quotation-meta">
                  <div className="meta-row">
                    <div className="label muted">Subtotal</div>
                    <div className="value">{fmtCurrency(amounts.subtotal)}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Discount</div>
                    <div className="value">
                      <select
                        className="cp-input"
                        value={quotation.discount.type}
                        onChange={(e) =>
                          setQuotation((q) => ({
                            ...q,
                            discount: { ...q.discount, type: e.target.value },
                          }))
                        }
                      >
                        <option value="percent">% Percent</option>
                        <option value="fixed">Fixed</option>
                      </select>
                      <input
                        className="cp-input"
                        style={{ marginTop: 8 }}
                        value={quotation.discount.value}
                        onChange={(e) =>
                          setQuotation((q) => ({
                            ...q,
                            discount: {
                              ...q.discount,
                              value: Number(e.target.value || 0),
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Taxes</div>
                    <div className="value">
                      {(quotation.taxes || []).map((t, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            marginBottom: 6,
                          }}
                        >
                          <input
                            className="cp-input"
                            value={t.name}
                            onChange={(e) =>
                              setQuotation((q) => ({
                                ...q,
                                taxes: q.taxes.map((tt, ii) =>
                                  ii === i ? { ...tt, name: e.target.value } : tt
                                ),
                              }))
                            }
                          />
                         <select
  className="cp-input"
  value={t.type || "percent"}
  onChange={(e) =>
    setQuotation((q) => ({
      ...q,
      taxes: q.taxes.map((tt, ii) =>
        ii === i ? { ...tt, type: e.target.value } : tt
      ),
    }))
  }
>
  <option value="percent">%</option>
  <option value="fixed">Fixed</option>
</select>

<input
  className="cp-input"
  value={t.value ?? t.rate ?? 0}
  onChange={(e) =>
    setQuotation((q) => ({
      ...q,
      taxes: q.taxes.map((tt, ii) =>
        ii === i
          ? { ...tt, value: Number(e.target.value || 0) }
          : tt
      ),
    }))
  }
/>
                        </div>
                      ))}
                      <button
                        className="cp-btn ghost"
                        onClick={() =>
                          setQuotation((q) => ({
                            ...q,
                            taxes: [...(q.taxes || []), { id: `t-${Date.now()}`, name: "New Tax", type: "percent", value: 0 }],
                          }))
                        }
                        type="button"
                      >
                        + Add Tax
                      </button>
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Discount Amount</div>
                    <div className="value">{fmtCurrency(amounts.discountAmount)}</div>
                  </div>
                  <div className="meta-row">
                    <div className="label muted">Total Tax</div>
                    <div className="value">{fmtCurrency(amounts.totalTax)}</div>
                  </div>
                  <div className="meta-row">
                    <div className="label muted">Total</div>
                    <div className="value strong">{fmtCurrency(amounts.total)}</div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label className="muted">Quotation Status</label>
                    <select
                      className="cp-input"
                      value={quotation.status}
                      onChange={(e) =>
                        setQuotation((q) => ({ ...q, status: e.target.value }))
                      }
                    >
                      <option value="sent">sent</option>
                      <option value="accepted">accepted</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button className="cp-btn ghost" onClick={closeQuotation}>
                      Cancel
                    </button>
                    <button className="cp-btn primary" onClick={saveQuotation}>
                      Save & Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="cp-modal">
          <div className="cp-modal-card">
            <h3>
Delete requirement “{confirmDelete.requirementNumber || confirmDelete.customerName}”?          </h3>
            <p className="muted">
              This will permanently remove the requirement and its attachments (if any).
            </p>
            <div className="cp-form-actions">
              <button className="cp-btn ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="cp-btn danger" onClick={() => handleDelete(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    {editRequirement && (
  <RequirementForm
    lead={null}
    requirement={editRequirement}
    onSaved={() => setEditRequirement(null)}
    onCancel={() => setEditRequirement(null)}
  />
)}
    </div>
  );
}