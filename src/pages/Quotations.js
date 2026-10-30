// src/pages/Quotations.js
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  getDoc, // ✅ added
  increment,
    deleteDoc  ,
    getDocs,
limit,
startAfter,
where,
} from "firebase/firestore";
import { updateAccountReport } from "../utils/accountReport";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Quotations.css";
import { makeHistoryEntry, propagateToLead } from "../utils/status";
import OrderCreate from "./OrderCreate";
import NursingOrderCreate from "./NursingOrderCreate";
// NEW: PDF generation + Firebase Storage upload
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const fmtCurrency = (v) => {
  try {
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return v ?? "0.00";
  }
};

const parseDate = (ts) => {
  if (!ts) return "—";
  if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleString();
  if (typeof ts === "string") { const d = new Date(ts); if (!isNaN(d)) return d.toLocaleString(); }
  if (ts instanceof Date) return ts.toLocaleString();
  if (typeof ts === "number") return new Date(ts).toLocaleString();
  return "—";
};

const calcAmounts = (items, discount, taxes) => {
  const subtotal = (items || []).reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.rate || 0),
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

  // ✅ Taxes (fixed + percent)
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
      type, // ✅ DON'T override
    };
  });

  const totalTax = taxBreakdown.reduce((s, t) => s + (t.amount || 0), 0);
  const total = Math.max(0, taxable + totalTax);

  return { subtotal, discountAmount, taxBreakdown, totalTax, total };
};

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editQuotation, setEditQuotation] = useState(null);
  const [versions, setVersions] = useState([]);
  const [viewingVersion, setViewingVersion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [shareReady, setShareReady] = useState(false);
const [userRole, setUserRole] = useState(null);
  // NEW: WhatsApp send state
  const [waPhone, setWaPhone] = useState("");
  const [sendingWa, setSendingWa] = useState(false);
const [typeFilter, setTypeFilter] = useState("all");
const PAGE_SIZE = 50;

const [lastDoc, setLastDoc] =
  useState(null);

const [hasMore, setHasMore] =
  useState(true);

const [loadingMore, setLoadingMore] =
  useState(false);
  const [orderModalQuote, setOrderModalQuote] = useState(null);
  const navigate = useNavigate();
  const isNursingQuote = (q) =>
  q?.meta?.serviceType === "nursing" ||
  q?.meta?.serviceType === "caretaker" ||
  q?.serviceType === "nursing" ||
  q?.serviceType === "caretaker";

  const loadInitialQuotations = async () => {

  try {

    setLoading(true);

    const base = collection(
      db,
      "quotations"
    );

    const constraints = [];

    // TYPE FILTER
    if (typeFilter !== "all") {

      constraints.push(
        where(
          "serviceType",
          "==",
          typeFilter
        )
      );

    }

    // STATUS FILTER
    if (statusFilter !== "all") {

      constraints.push(
        where(
          "status",
          "==",
          statusFilter
        )
      );

    }

    constraints.push(
      orderBy("createdAt", "desc")
    );

    constraints.push(
      limit(PAGE_SIZE)
    );

    const qy = query(
      base,
      ...constraints
    );

    const snap = await getDocs(qy);

    const docs = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() || {}),
    }));

    setQuotations(docs);

    setLastDoc(
      snap.docs[
        snap.docs.length - 1
      ] || null
    );

    setHasMore(
      snap.docs.length === PAGE_SIZE
    );

  } catch (err) {

    console.error(err);

    setError(
      err.message ||
      "Failed to load quotations"
    );

  } finally {

    setLoading(false);

  }

};
useEffect(() => {
  loadInitialQuotations();
}, [typeFilter, statusFilter]);
const loadMoreQuotations = async () => {

  if (!lastDoc || loadingMore)
    return;

  try {

    setLoadingMore(true);

    const base = collection(
      db,
      "quotations"
    );

    const constraints = [];

    // TYPE FILTER
    if (typeFilter !== "all") {

      constraints.push(
        where(
          "serviceType",
          "==",
          typeFilter
        )
      );

    }

    // STATUS FILTER
    if (statusFilter !== "all") {

      constraints.push(
        where(
          "status",
          "==",
          statusFilter
        )
      );

    }

    constraints.push(
      orderBy("createdAt", "desc")
    );

    constraints.push(
      startAfter(lastDoc)
    );

    constraints.push(
      limit(PAGE_SIZE)
    );

    const qy = query(
      base,
      ...constraints
    );

    const snap = await getDocs(qy);

    const docs = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() || {}),
    }));

    setQuotations((prev) => [
      ...prev,
      ...docs,
    ]);

    setLastDoc(
      snap.docs[
        snap.docs.length - 1
      ] || null
    );

    setHasMore(
      snap.docs.length === PAGE_SIZE
    );

  } catch (err) {

    console.error(err);

  } finally {

    setLoadingMore(false);

  }

};

  const statusCounts = useMemo(() => {
    const m = { all: quotations.length };
    for (const q of quotations) {
      const s = String(q.status || "draft").toLowerCase();
      m[s] = (m[s] || 0) + 1;
    }
    for (const key of ["draft", "sent", "accepted", "rejected", "order_created"]) {
      if (m[key] == null) m[key] = 0;
    }
    return m;
  }, [quotations]);

  const filtered = useMemo(() => {
  let list = quotations;

  // Service type filter
  if (typeFilter !== "all") {
    list = list.filter(
      (q) => (q.serviceType || "rental") === typeFilter
    );
  }

  // Status filter
  if (statusFilter !== "all") {
    list = list.filter(
      (q) =>
        String(q.status || "draft").toLowerCase() ===
        statusFilter
    );
  }

  if (!search.trim()) return list;

  const term = search.trim().toLowerCase();

  return list.filter((q) => {
    const fields = [
      q.quoNo,
      q.quotationId,
      q.requirementId,
      q.createdByName,
      q.createdBy,
      q.notes,
      q.customerName,
      q.customerPhone,
    ].map((x) => String(x || "").toLowerCase());

    return fields.some((f) => f.includes(term));
  });
}, [quotations, statusFilter, typeFilter, search]);
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
  // ===== Helpers to fetch from requirement -> leadssnapshop / leadSnapshot
  const pickFromRequirement = (req = {}) => {
    const ls = req.leadssnapshop || req.leadSnapshot || {};
    const customerName =
      req.customerName ||
      ls.customerName ||
      req.contactPerson ||
      ls.contactPerson ||
      req.contactName ||
      "";
    const customerPhone =
      ls.phone ||
      ls.mobile ||
      req.phone ||
      req.customerPhone ||
      req.contactPhone ||
      "";
    return { customerName, customerPhone };
  };
  const deleteQuotation = async (quote) => {
  if (!quote) return;

  if (!window.confirm(`Delete quotation ${quote.quoNo || quote.id}?`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, "quotations", quote.id));
    setQuotations((prev) =>
  prev.filter((q) => q.id !== quote.id)
);
    closeDetails();
  } catch (err) {
    console.error("deleteQuotation", err);
    setError(err.message || "Failed to delete quotation");
  }
};

  const openDetails = async (qDoc) => {
    setError("");
    setDetails(qDoc);
    setShareReady(false);
    setIsEditing(false);
    setEditQuotation(null);
    setViewingVersion(null);
    setWaPhone(""); // clear on open

    try {
      // ① Fetch requirement to populate customer name & phone
      if (qDoc?.requirementId) {
        try {
          const reqRef = doc(db, "requirements", qDoc.requirementId);
          const reqSnap = await getDoc(reqRef);
          if (reqSnap.exists()) {
            const req = reqSnap.data() || {};
            const { customerName, customerPhone } = pickFromRequirement(req);

            // Merge onto details
            setDetails((prev) => ({
              ...(prev || qDoc),
              customerName: customerName || prev?.customerName || "",
              customerPhone: customerPhone || prev?.customerPhone || "",
            }));

            // Autofill WhatsApp if user hasn't typed
            setWaPhone((prev) => prev || (customerPhone || ""));
          }
        } catch (e) {
          console.warn("Requirement fetch failed", e);
        }
      }

      // ② Versions subscription
      const versionsQuery = query(
        collection(db, "quotations", qDoc.id, "versions"),
        orderBy("createdAt", "desc")
      );
      const unsubVersions = onSnapshot(
        versionsQuery,
        (snap) => {
          const vs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
          setVersions(vs);
        },
        () => setVersions([])
      );
      setDetails((prev) => ({ ...(prev || qDoc), __unsubVersions: unsubVersions }));
    } catch (err) {
      console.error("openDetails versions", err);
      setVersions([]);
    }
  };

  const closeDetails = () => {
    if (details && details.__unsubVersions) {
      try { details.__unsubVersions(); } catch { }
    }
    setDetails(null);
    setIsEditing(false);
    setEditQuotation(null);
    setVersions([]);
    setViewingVersion(null);
    setShareReady(false);
    setWaPhone(""); // clear on close
  };

  // ----- Editing helpers -----
  const startEdit = () => {
    setIsEditing(true);
    setShareReady(false);

    // normalize older item keys
    const clone = JSON.parse(JSON.stringify(details || {}));
    clone.taxes = (clone.taxes || []).map((t, i) => ({
  id: t.id || `t-${i}`,
  name: t.name || "Tax",
  type: t.type || "percent",
  value: Number(t.value ?? t.rate ?? 0),
}));
    clone.items = (clone.items || []).map((it) => {
      const qty = Number(it.qty ?? it.quantity ?? 1);
      const rate = Number(it.rate ?? 0);
      return {
        ...it,
        name: it.name || it.itemName || it.productName || "",
        qty,
        rate,
        amount: Number(it.amount ?? qty * rate),
        notes: it.notes || it.unitNotes || "",
        days: it.days ?? it.expectedDurationDays ?? 0,
        expectedStartDate: it.expectedStartDate || it.startDate || "",
        expectedEndDate: it.expectedEndDate || it.endDate || "",
        productId: it.productId || "",
      };
    });

    setEditQuotation(clone);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditQuotation(null);
  };

  const updateEditField = (path, value) => {
    setEditQuotation((q) => {
      if (!q) return q;
      const clone = JSON.parse(JSON.stringify(q));
      const parts = path.split(".");
      let cur = clone;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!(p in cur)) cur[p] = {};
        cur = cur[p];
      }
      cur[parts[parts.length - 1]] = value;
      return clone;
    });
  };

  const updateEditItem = (idx, patch) => {
    setEditQuotation((q) => {
      if (!q) return q;
      const clone = JSON.parse(JSON.stringify(q));
      clone.items = clone.items || [];
      clone.items[idx] = { ...clone.items[idx], ...patch };
      const qi = clone.items[idx];
      qi.amount = Number(qi.qty || 0) * Number(qi.rate || 0);
      return clone;
    });
  };

  const addEditItem = () => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.items = clone.items || [];
      clone.items.push({
        id: Date.now() + "-i",
        name: "",
        qty: 1,
        rate: 0,
        amount: 0,
        notes: "",
        days: 0,
        expectedStartDate: "",
        expectedEndDate: "",
        productId: "",
      });
      return clone;
    });
  };

  const removeEditItem = (idx) => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.items = (clone.items || []).filter((_, i) => i !== idx);
      return clone;
    });
  };

  const updateEditTax = (idx, patch) => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.taxes = clone.taxes || [];
      clone.taxes[idx] = { ...clone.taxes[idx], ...patch };
      return clone;
    });
  };
  const addEditTax = () => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.taxes = clone.taxes || [];
      clone.taxes.push({ id: `t-${Date.now()}`, name: "New Tax", type: "percent", value: 0 });
      return clone;
    });
  };
  const removeEditTax = (idx) => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.taxes = (clone.taxes || []).filter((_, i) => i !== idx);
      return clone;
    });
  };

  const updateEditDiscount = (patch) => {
    setEditQuotation((q) => {
      const clone = JSON.parse(JSON.stringify(q || {}));
      clone.discount = { ...(clone.discount || {}), ...patch };
      return clone;
    });
  };

  const editAmounts = useMemo(() => {
    if (!isEditing || !editQuotation) return null;
    return calcAmounts(editQuotation.items || [], editQuotation.discount || {}, editQuotation.taxes || []);
  }, [isEditing, editQuotation]);

  // ----- Save edits -----
  const saveEdits = async () => {
    if (!details || !editQuotation) return;
    setSaving(true);
    setError("");
    try {
      const user = auth.currentUser || {};
      const qRef = doc(db, "quotations", details.id);

      const previousSnapshot = { ...details };
      delete previousSnapshot.__unsubVersions;
      await addDoc(collection(db, "quotations", details.id, "versions"), {
        snapshot: previousSnapshot,
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || "",
        note: "Edit snapshot - before update",
      });

      const amounts = calcAmounts(editQuotation.items || [], editQuotation.discount || {}, editQuotation.taxes || []);

      const toUpdate = {
        quoNo: editQuotation.quoNo || editQuotation.quotationId || details.quoNo,
        quotationId: editQuotation.quotationId || details.quotationId || "",
        items: (editQuotation.items || []).map((it) => ({
          name: it.name || "",
          qty: Number(it.qty || 0),
          rate: Number(it.rate || 0),
          amount: Number(it.amount || 0),
          notes: it.notes || "",
          days: it.days || 0,
          expectedStartDate: it.expectedStartDate || "",
          expectedEndDate: it.expectedEndDate || "",
          productId: it.productId || "",
        })),
        discount: editQuotation.discount || { type: "percent", value: 0 },
        taxes: editQuotation.taxes || [],
        notes: editQuotation.notes || "",
        status: editQuotation.status || details.status || "draft",
        totals: {
          subtotal: amounts.subtotal,
          discountAmount: amounts.discountAmount,
          taxBreakdown: amounts.taxBreakdown,
          totalTax: amounts.totalTax,
          total: amounts.total,
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
      };

      await updateDoc(qRef, toUpdate);
      setQuotations((prev) =>
  prev.map((q) =>
    q.id === details.id
      ? {
          ...q,
          ...toUpdate,
        }
      : q
  )
);

      if (details.requirementId) {
        const reqRef = doc(db, "requirements", details.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "quotation",
          field: "edit",
          oldValue: details.status || "",
          newValue: toUpdate.status || "",
          note: `Quotation ${details.quoNo || details.id} edited by ${user.displayName || user.email || ""}`,
        });
        await updateDoc(reqRef, {
          history: arrayUnion(entry),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        });

        propagateToLead(details.requirementId, "quotation", details.status || "", toUpdate.status || "", entry.note);
      }

      setDetails((d) => ({ ...d, ...toUpdate }));
      setIsEditing(false);
      setEditQuotation(null);
      setShareReady(true);
    } catch (err) {
      console.error("saveEdits", err);
      setError(err.message || "Failed to save edits");
    } finally {
      setSaving(false);
    }
  };

  const viewVersion = (v) => setViewingVersion(v);

  const revertToVersion = async (version) => {
    if (!details || !version) return;
    setSaving(true);
    setError("");
    try {
      const user = auth.currentUser || {};
      const qRef = doc(db, "quotations", details.id);

      const currentSnapshot = { ...details };
      delete currentSnapshot.__unsubVersions;
      await addDoc(collection(db, "quotations", details.id, "versions"), {
        snapshot: currentSnapshot,
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || "",
        note: `Snapshot before revert to version ${version.id}`,
      });

      const snap = version.snapshot || {};
      const amounts = calcAmounts(snap.items || [], snap.discount || {}, snap.taxes || []);
      const payload = {
        quoNo: snap.quoNo,
        quotationId: snap.quotationId,
        items: snap.items || [],
        discount: snap.discount || {},
        taxes: snap.taxes || [],
        notes: snap.notes || "",
        totals: {
          subtotal: amounts.subtotal,
          discountAmount: amounts.discountAmount,
          taxBreakdown: amounts.taxBreakdown,
          totalTax: amounts.totalTax,
          total: amounts.total,
        },
        status: snap.status || "draft",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
      };

      await updateDoc(qRef, payload);
      setQuotations((prev) =>
  prev.map((q) =>
    q.id === details.id
      ? {
          ...q,
          ...payload,
        }
      : q
  )
);

      if (details.requirementId) {
        const reqRef = doc(db, "requirements", details.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "quotation",
          field: "revert",
          oldValue: details.status || "",
          newValue: payload.status || "",
          note: `Quotation ${details.quoNo || details.id} reverted to version ${version.id}`,
        });
        await updateDoc(reqRef, {
          history: arrayUnion(entry),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        });

        propagateToLead(details.requirementId, "quotation", details.status || "", payload.status || "", entry.note);
      }

      setDetails((d) => ({ ...d, ...payload }));
      setViewingVersion(null);
      setIsEditing(false);
      setEditQuotation(null);
      setShareReady(false);
    } catch (err) {
      console.error("revertToVersion", err);
      setError(err.message || "Failed to revert to version");
    } finally {
      setSaving(false);
    }
  };

  const updateQuotationStatus = async (quote, newStatus, note = "") => {
    if (quote.status === newStatus) return;
    setError("");
    try {
      const user = auth.currentUser || {};
      const qRef = doc(db, "quotations", quote.id);
      await updateDoc(qRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
      });
      setQuotations((prev) =>
  prev.map((q) =>
    q.id === quote.id
      ? {
          ...q,

          status: newStatus,

         updatedAt: new Date(),

          updatedBy: user.uid || "",

          updatedByName:
            user.displayName ||
            user.email ||
            "",
        }
      : q
  )
);
      // 📊 Update account report counters
if (newStatus === "accepted") {
  await updateAccountReport({
    quotationAccepted: increment(1)
  });
}

if (newStatus === "rejected") {
  await updateAccountReport({
    quotationRejected: increment(1)
  });
}
      if (quote.requirementId) {
        const reqRef = doc(db, "requirements", quote.requirementId);
        const entry = makeHistoryEntry(user, {
          type: "status",
          field: "quotation",
          oldValue: quote.status || "",
          newValue: newStatus,
          note: note || `Quotation ${quote.quoNo || quote.id} marked ${newStatus}`,
        });
        const updates = {
          history: arrayUnion(entry),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        };
        if (newStatus === "accepted") updates.status = "order_created";
        await updateDoc(reqRef, updates);

        propagateToLead(quote.requirementId, "quotation", quote.status || "", newStatus, entry.note);
      }
      if (details && details.id === quote.id) {
        setDetails((d) => ({ ...d, status: newStatus }));
      }
    } catch (err) {
      console.error("updateQuotationStatus", err);
      setError(err.message || "Failed to update quotation status");
    }
  };

const convertToOrder = (quote) => {
  setError("");

  // 🔥 Convert taxes to FIXED before sending
  const fixedTaxes = (quote.taxes || []).map((t, i) => {
    const amount =
      quote.totals?.taxBreakdown?.[i]?.amount || 0;

    return {
      id: t.id || `t-${i}`,
      name: t.name,
      value: amount,     // ✅ FINAL AMOUNT
      type: "fixed",     // ✅ IMPORTANT
      locked: true       // 🔒 prevent recalculation
    };
  });

  const isNursing =
    quote?.serviceType === "nursing" ||
    quote?.serviceType === "caretaker" ||
    quote?.items?.some((it) =>
      /nurse|caretaker|care staff/i.test(it.name || "")
    );

  setOrderModalQuote({
    ...quote,
    taxes: fixedTaxes,   // ✅ OVERRIDE TAXES
    __orderType: isNursing ? "nursing" : "rental",
    serviceType: quote.serviceType || "rental",
  });
};

  const shareUpdated = async () => {
    if (!details) return;
    try {
      await updateQuotationStatus(details, "sent", "Updated quotation shared");
      if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(details, null, 2));
        alert("Updated quotation marked sent and copied to clipboard.");
      } else {
        alert("Updated quotation marked sent. Clipboard not available.");
      }
      setShareReady(false);
    } catch (err) {
      console.error("shareUpdated", err);
      alert("Failed to share updated quotation: " + (err.message || err));
    }
  };

  // =====================
  // NEW: WhatsApp PDF helpers
  // =====================
  const normalizePhone = (raw) => {
    let digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    // If it's 11 digits starting with 0 (local format), drop the leading 0
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    // Assume India by default if 10 digits
    if (digits.length === 10) return `91${digits}`;
    return digits; // already includes country code
  };

  const buildQuotationPdf = async (q) => {
    if (!q) throw new Error("Quotation details are not available.");

    const COMPANY = {
      name: "BOOKMYMEDICARE PRIVATE LIMITED",
      address: "Shop No. 10, Sun and Moon CHS, Rajendra Nagar, Datta Pada Road, Borivali (East), Mumbai - 400068",
      registration: "CDSCO-MFG/MD/2023/000462",
      cin: "U74999MH2021PTC353543",
      licences: "MH-MZ7-561792 | MH-MZ7-561793 | MH-MZ7-561794 | MH-MZ7-561795",
      phone: "7777066885",
      gstin: "27AAJCB5669E1ZF",
      state: "Maharashtra",
      stateCode: "27",
      email: "bookmymedicare@gmail.com",
      pan: "AAJCB5669E",
      bankName: "Indian Overseas Bank (IOB) (0119)",
      account: "020933000000119",
      branchIfsc: "Andheri West & IOBA0000209",
    };

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
    const money = (value) => Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    const toDate = (value) => {
      if (!value) return null;
      if (typeof value?.toDate === "function") return value.toDate();
      if (value?.seconds) return new Date(value.seconds * 1000);
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const dateText = (value) => {
      const date = toDate(value);
      return date ? date.toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "2-digit",
      }) : "—";
    };
    const numberWords = (number) => {
      const n = Math.floor(Math.abs(Number(number) || 0));
      if (!n) return "Zero";
      const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
      const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
      const underThousand = (num) => {
        let out = "";
        if (num >= 100) out += `${ones[Math.floor(num / 100)]} Hundred `;
        num %= 100;
        if (num >= 20) {
          out += `${tens[Math.floor(num / 10)]} `;
          if (num % 10) out += `${ones[num % 10]} `;
        } else if (num > 0) out += `${ones[num]} `;
        return out.trim();
      };
      const units = [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"], [1, ""]];
      let remaining = n;
      const parts = [];
      units.forEach(([size, label]) => {
        const chunk = Math.floor(remaining / size);
        if (chunk) {
          parts.push(`${underThousand(chunk)}${label ? ` ${label}` : ""}`.trim());
          remaining %= size;
        }
      });
      return parts.join(" ").trim();
    };
    const amountInWords = (amount) => {
      const value = Number(amount || 0);
      const rupees = Math.floor(Math.abs(value));
      const paise = Math.round((Math.abs(value) - rupees) * 100);
      return `INR ${numberWords(rupees)}${paise ? ` and ${numberWords(paise)} Paise` : ""} Only`;
    };
    const durationLabel = (item) => {
      const start = toDate(item.expectedStartDate || item.startDate);
      const end = toDate(item.expectedEndDate || item.endDate);
      if (!start || !end) return "";
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const days = Math.max(1, Math.floor((endDay - startDay) / 86400000) + 1);
      return `${dateText(start)} to ${dateText(end)} (${days} ${days === 1 ? "Day" : "Days"})`;
    };

    const items = Array.isArray(q.items) ? q.items : [];
    const calculated = calcAmounts(items, q.discount || {}, q.taxes || []);
    const totals = q.totals || {};
    const subtotal = Number(totals.subtotal ?? calculated.subtotal);
    const discount = Number(totals.discountAmount ?? calculated.discountAmount ?? 0);
    const taxList = Array.isArray(totals.taxBreakdown) ? totals.taxBreakdown
      : Array.isArray(totals.taxes) ? totals.taxes : calculated.taxBreakdown;
    const totalTax = Number(totals.totalTax ?? taxList.reduce((sum, tax) => sum + Number(tax.amount || 0), 0));
    const total = Number(totals.total ?? Math.max(0, subtotal - discount + totalTax));

    const quotationNo = q.quoNo || q.quotationId || q.id || "—";
    const quotationDate = dateText(q.createdAt || new Date());
    const customerName = q.customerName || q.contactPerson || q.customer?.name || "—";
    const address = q.customerAddress || q.deliveryAddress || q.address || q.customer?.address || "—";
    const phone = q.customerPhone || q.phone || q.customer?.phone || "";
    const email = q.customerEmail || q.email || q.customer?.email || "";
    const requirementNo = q.requirementNumber || q.requirementId || "—";
    const serviceLabel = q.serviceType === "nursing" ? "Nursing Service"
      : q.serviceType === "caretaker" ? "Caretaker Service"
      : q.serviceType === "rental" || !q.serviceType ? "Medical Equipment Rental"
      : "Medical Equipment / Services";

    const starts = items.map((item) => toDate(item.expectedStartDate || item.startDate)).filter(Boolean).sort((a, b) => a - b);
    const ends = items.map((item) => toDate(item.expectedEndDate || item.endDate)).filter(Boolean).sort((a, b) => a - b);
    const servicePeriod = starts.length && ends.length
      ? `${dateText(starts[0])} to ${dateText(ends[ends.length - 1])}` : "—";

    const itemRows = items.length ? items.map((item, index) => {
      const qty = Number(item.qty ?? item.quantity ?? 1);
      const amount = Number(item.amount ?? qty * Number(item.rate || 0));
      const rate = Number(item.rate ?? (qty ? amount / qty : amount));
      const description = item.name || item.itemName || item.productName || item.productId || "Quotation Item";
      const detail = item.notes || item.description || item.unitNotes || "";
      const duration = durationLabel(item);
      return `<tr>
        <td class="center">${index + 1}</td>
        <td><strong>${escapeHtml(description)}</strong>
          ${detail ? `<div class="subline">${escapeHtml(detail)}</div>` : ""}
          ${duration ? `<div class="subline">Period: ${escapeHtml(duration)}</div>` : ""}
        </td>
        <td class="center">${escapeHtml(item.hsnSac || item.sac || "")}</td>
        <td class="center">${qty}</td>
        <td class="number">${money(rate)}</td>
        <td class="center">Unit</td>
        <td class="number">${money(amount)}</td>
      </tr>`;
    }).join("") : `<tr><td class="center">1</td><td>${escapeHtml(serviceLabel)}</td><td></td><td></td><td></td><td></td><td class="number">${money(total)}</td></tr>`;

    const taxRows = taxList.map((tax) => `<tr class="tax-summary-row">
      <td colspan="6" class="tax-label">${escapeHtml(tax.name || tax.label || tax.type || "Tax")}</td>
      <td class="number">${money(tax.amount)}</td>
    </tr>`).join("");

    const buildPage = (copyLabel) => `
      <section class="invoice-page">
        <div class="invoice-title"><strong>Quotation</strong><em>(${escapeHtml(copyLabel)})</em></div>
        <div class="top-grid">
          <div class="company-block">
            <strong class="company-name">${escapeHtml(COMPANY.name)}</strong>
            <div>${escapeHtml(COMPANY.address)}</div>
            <div>${escapeHtml(COMPANY.registration)}</div>
            <div>CIN: ${escapeHtml(COMPANY.cin)}</div>
            <div>DL LIC: ${escapeHtml(COMPANY.licences)}</div>
            <div>CONTACT NO. ${escapeHtml(COMPANY.phone)}</div>
            <div>GSTIN/UIN: ${escapeHtml(COMPANY.gstin)}</div>
            <div>State Name: ${escapeHtml(COMPANY.state)}, Code: ${escapeHtml(COMPANY.stateCode)}</div>
            <div>E-Mail: ${escapeHtml(COMPANY.email)}</div>
          </div>
          <div class="meta-grid">
            <div><span>Quotation No.</span><strong>${escapeHtml(quotationNo)}</strong></div>
            <div><span>Dated</span><strong>${escapeHtml(quotationDate)}</strong></div>
            <div><span>Requirement No.</span><strong>${escapeHtml(requirementNo)}</strong></div>
            <div><span>Validity / Terms</span><strong>${escapeHtml(q.validity || q.paymentTerms || "As per agreed terms")}</strong></div>
            <div><span>Reference No. & Date</span><strong>${escapeHtml(requirementNo)}<br>${escapeHtml(quotationDate)}</strong></div>
            <div><span>Service Type</span><strong>${escapeHtml(serviceLabel)}</strong></div>
            <div><span>Prepared By</span><strong>${escapeHtml(q.createdByName || q.createdBy || "—")}</strong></div>
            <div><span>Status</span><strong>${escapeHtml(q.status || "Draft")}</strong></div>
          </div>
        </div>
        <div class="address-grid">
          ${["Consignee (Service Location)", "Buyer (Bill to)"].map((label) => `
            <div><b>${label}</b><strong>${escapeHtml(customerName)}</strong>
              <div>${escapeHtml(address)}</div>
              ${phone ? `<div>Phone: ${escapeHtml(phone)}</div>` : ""}
              ${email ? `<div>Email: ${escapeHtml(email)}</div>` : ""}
              <div>State Name: ${escapeHtml(q.customerState || COMPANY.state)}, Code: ${escapeHtml(q.customerStateCode || COMPANY.stateCode)}</div>
            </div>`).join("")}
        </div>
        <div class="terms"><b>Terms of Delivery</b><strong>${escapeHtml(serviceLabel)}</strong>
          <div>Period: ${escapeHtml(servicePeriod)}</div>
          <div>${escapeHtml(q.notes || q.terms || "This quotation is subject to the terms agreed with the customer.")}</div>
        </div>
        <table class="items-table">
          <thead><tr><th>Sl No.</th><th>Description of Goods / Services</th><th>HSN/SAC</th><th>Quantity</th><th>Rate</th><th>Per</th><th>Amount (₹)</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr><td colspan="6" class="summary-label">Subtotal</td><td class="number">${money(subtotal)}</td></tr>
            ${discount ? `<tr><td colspan="6" class="summary-label">Discount</td><td class="number">-${money(discount)}</td></tr>` : ""}
            ${taxRows}
            <tr><td colspan="6" class="summary-label">Total</td><td class="number">₹ ${money(total)}</td></tr>
          </tfoot>
        </table>
        <div class="amount-words"><b>Amount Chargeable (in words)</b><strong>${escapeHtml(amountInWords(total))}</strong><em>E. & O.E.</em></div>
        <div class="bottom-grid">
          <div class="declaration"><b>Company's PAN: ${escapeHtml(COMPANY.pan)}</b><h4>Declaration</h4>
            <p>We hereby certify that the particulars given above are true and correct and that the amount indicated represents the charges for the items and services described in this quotation.</p>
            <p>This is a computer-generated quotation and is subject to acceptance.</p>
          </div>
          <div class="bank"><h4>Company's Bank Details</h4>
            <div>Bank Name: <strong>${escapeHtml(COMPANY.bankName)}</strong></div>
            <div>A/c No.: <strong>${escapeHtml(COMPANY.account)}</strong></div>
            <div>Branch & IFSC Code: <strong>${escapeHtml(COMPANY.branchIfsc)}</strong></div>
            <div class="signatory">for ${escapeHtml(COMPANY.name)}<br><br><br>Authorised Signatory</div>
          </div>
        </div>
        <div class="footer-note">${escapeHtml(COMPANY.name)} · This is a computer-generated quotation</div>
      </section>`;

    const style = `
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 9px; }
      .invoice-page {
        width: 718px; height: 1040px; min-height: 1040px;
        display: flex; flex-direction: column; gap: 0;
        page-break-after: always; border: 1px solid #555;
        padding: 14px; background: #fff; overflow: hidden;
      }
      .invoice-title { flex: 0 0 auto; display: flex; justify-content: space-between; border-bottom: 1px solid #444; padding: 0 0 7px; font-size: 14px; }
      .invoice-title em { font-size: 10px; }
      .top-grid { flex: 0 0 auto; display: grid; grid-template-columns: 1.08fr 1fr; border-bottom: 1px solid #555; min-width: 0; }
      .company-block { min-width: 0; padding: 7px 6px; border-right: 1px solid #555; line-height: 1.45; overflow-wrap: anywhere; font-size: 8.5px; }
      .company-name { display: block; font-size: 11px; margin-bottom: 3px; }
      .meta-grid { min-width: 0; display: grid; grid-template-columns: 1fr 1fr; }
      .meta-grid > div { min-width: 0; min-height: 30px; padding: 4px 5px; border-bottom: 1px solid #bbb; border-left: 1px solid #bbb; overflow-wrap: anywhere; }
      .meta-grid span { display: block; color: #444; margin-bottom: 2px; font-size: 8px; }
      .meta-grid strong { display: block; font-size: 8.5px; overflow-wrap: anywhere; }
      .address-grid { flex: 0 0 auto; display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #555; }
      .address-grid > div { min-width: 0; padding: 7px; line-height: 1.4; min-height: 72px; overflow-wrap: anywhere; }
      .address-grid > div + div { border-left: 1px solid #555; }
      .address-grid b, .address-grid strong { display: block; }
      .address-grid strong { margin-top: 4px; }
      .terms { flex: 0 0 auto; padding: 6px 7px; border-bottom: 1px solid #555; line-height: 1.4; overflow-wrap: anywhere; }
      .terms b, .terms strong { display: block; }
      table { width: 100%; border-collapse: collapse; }
      .items-table { width: 100%; table-layout: fixed; flex: 0 0 auto; min-height: 0; margin: 0; }\n      .items-table tbody { height: auto !important; }\n      .items-table tfoot { display: table-row-group; }\n      .items-table tfoot tr { page-break-inside: avoid; break-inside: avoid; }
      .items-table th, .items-table td { border: 1px solid #555; padding: 4px 3px; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; white-space: normal; }
      .items-table th { text-align: center; font-weight: bold; background: #f4f4f4; font-size: 8px; }
      .items-table td { font-size: 8px; }
      .items-table th:nth-child(1), .items-table td:nth-child(1) { width: 5%; }
      .items-table th:nth-child(2), .items-table td:nth-child(2) { width: 43%; }
      .items-table th:nth-child(3), .items-table td:nth-child(3) { width: 10%; }
      .items-table th:nth-child(4), .items-table td:nth-child(4) { width: 8%; }
      .items-table th:nth-child(5), .items-table td:nth-child(5) { width: 12%; }
      .items-table th:nth-child(6), .items-table td:nth-child(6) { width: 8%; }
      .items-table th:nth-child(7), .items-table td:nth-child(7) { width: 14%; }
      .items-table .number { text-align: right; white-space: normal; overflow-wrap: anywhere; }
      .center { text-align: center; }
      .subline { margin-top: 3px; font-size: 7.5px; color: #333; overflow-wrap: anywhere; }
      .summary-label { text-align: right; font-weight: bold; white-space: normal !important; overflow-wrap: anywhere !important; word-break: break-word !important; line-height: 1.25; }
      .items-table td.tax-label {
        text-align: left !important;
        padding-left: 8px !important;
        font-weight: 600;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        line-height: 1.25;
      }
      .items-table tr.tax-summary-row td {
        vertical-align: middle;
      }\n      .items-table tfoot td { padding-top: 5px; padding-bottom: 5px; }\n      .items-table tfoot .number { white-space: nowrap; overflow-wrap: normal; word-break: normal; }
      .amount-words { flex: 0 0 auto; padding: 7px; border-bottom: 1px solid #555; position: relative; min-height: 46px; overflow-wrap: anywhere; }
      .amount-words b, .amount-words strong { display: block; margin-bottom: 4px; }
      .amount-words em { position: absolute; right: 7px; bottom: 6px; }
      .bottom-grid { flex: 0 0 auto; display: grid; grid-template-columns: 1fr 1fr; min-height: 132px; }
      .declaration, .bank { min-width: 0; padding: 8px; line-height: 1.4; overflow-wrap: anywhere; font-size: 8px; }
      .declaration { border-right: 1px solid #555; }
      .declaration h4, .bank h4 { margin: 5px 0; font-size: 9px; }
      .declaration p { margin: 4px 0; }
      .signatory { text-align: right; border-top: 1px solid #aaa; margin-top: 8px; padding-top: 5px; font-weight: bold; line-height: 1.35; }
      .footer-note { flex: 0 0 auto; text-align: center; margin-top: auto; padding-top: 6px; font-size: 7.5px; }
    `;

    // Render fixed 718 x 1040 page artwork and fit it inside the A4 printable area.
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;width:718px;background:#fff;overflow:hidden;";
    host.innerHTML = `<style>${style}</style>${buildPage("ORIGINAL FOR CUSTOMER")}${buildPage("DUPLICATE FOR OFFICE")}`;
    document.body.appendChild(host);

    try {
      const pages = Array.from(host.querySelectorAll(".invoice-page"));
      if (!pages.length) throw new Error("Could not prepare the quotation PDF pages.");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      for (let index = 0; index < pages.length; index += 1) {
        const canvas = await html2canvas(pages[index], {
          scale: 2, useCORS: true, backgroundColor: "#ffffff",
          width: 718, height: 1040, windowWidth: 718, windowHeight: 1040,
          scrollX: 0, scrollY: 0, logging: false,
        });
        if (index > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 10, 10, 190, 275, undefined, "FAST");
        canvas.width = 1;
        canvas.height = 1;
      }
      return pdf.output("blob");
    } finally {
      host.remove();
    }
  };

  const sendWhatsappPdf = async () => {
    if (!details) return;
    const phone = normalizePhone(waPhone || details?.customerPhone); // ✅ uses fetched phone if input empty
    if (!phone) {
      alert("Please enter a WhatsApp phone number (with country code or 10-digit Indian number).");
      return;
    }
    try {
      setSendingWa(true);
      const pdfBlob = await buildQuotationPdf(details);

      // Upload to Firebase Storage
      const storage = getStorage();
      const filename = `quotation-${details.quoNo || details.id}-${Date.now()}.pdf`;
      const fileRef = ref(storage, `quotations/${details.id}/${filename}`);
      await uploadBytes(fileRef, pdfBlob, { contentType: "application/pdf" });
      const url = await getDownloadURL(fileRef);

      // Pre-fill WhatsApp message with a link to the PDF
      const msg = `Hello, sharing quotation ${details.quoNo || details.id}.\nTotal: ${fmtCurrency(details.totals?.total || 0)}\n\nDownload PDF: ${url}`;
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
    } catch (err) {
      console.error("sendWhatsappPdf", err);
      alert("Failed to prepare WhatsApp message: " + (err?.message || err));
    } finally {
      setSendingWa(false);
    }
  };
const exportQuotations = async () => {

  const rows = [];

  for (const q of filtered) {

    let customerName = "";
    let customerPhone = "";

    try {

      if (q.requirementId) {

        const reqRef = doc(db, "requirements", q.requirementId);
        const reqSnap = await getDoc(reqRef);

        if (reqSnap.exists()) {

          const req = reqSnap.data();

          const ls = req.leadssnapshop || req.leadSnapshot || {};

          customerName =
            req.customerName ||
            ls.customerName ||
            req.contactPerson ||
            ls.contactPerson ||
            req.contactName ||
            "";

          customerPhone =
            ls.phone ||
            ls.mobile ||
            req.phone ||
            req.customerPhone ||
            req.contactPhone ||
            "";

        }

      }

    } catch (e) {
      console.warn("Requirement fetch failed", e);
    }

    rows.push({
      QuotationNo: q.quoNo || q.quotationId || q.id,
      Requirement: q.requirementNumber || q.requirementId || "",
      ServiceType: q.serviceType || "rental",
      Customer: customerName,
      Phone: customerPhone,
      Status: q.status || "draft",
      Total: q.totals?.total || 0,
      CreatedBy: q.createdByName || q.createdBy || "",
      CreatedAt: parseDate(q.createdAt),
    });

  }

  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "quotations_export.csv";
  a.click();

  URL.revokeObjectURL(url);
};

  if (loading) return <div className="qp-wrap"><div className="qp-loading">Loading quotations…</div></div>;

  return (
    <div className="qp-wrap">
      <header className="qp-header">
        <h1>Quotations</h1>
      

         </header>

       <div className="filter-bar">

  <div className="filter-left">

  {/* SERVICE TYPE FILTER */}
  <div className="segmented type-segment">

    <button
      className={`seg-btn ${
        typeFilter === "all"
          ? "active"
          : ""
      }`}
      onClick={() => {
        setTypeFilter("all");
        setStatusFilter("all");
      }}
    >
      All
    </button>

    <button
      className={`seg-btn equipment ${
        typeFilter === "rental"
          ? "active"
          : ""
      }`}
      onClick={() => {
        setTypeFilter("rental");
        setStatusFilter("all");
      }}
    >
      📦 Equipment
    </button>

    <button
      className={`seg-btn nursing ${
        typeFilter === "nursing"
          ? "active"
          : ""
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
        typeFilter === "caretaker"
          ? "active"
          : ""
      }`}
      onClick={() => {
        setTypeFilter("caretaker");
        setStatusFilter("all");
      }}
    >
      🧑‍⚕️ Caretaker
    </button>

  </div>

  {/* STATUS SEGMENT */}
  <div className="segmented status-segment">

    <button
      className={`seg-btn ${
        statusFilter === "all"
          ? "active"
          : ""
      }`}
      onClick={() =>
        setStatusFilter("all")
      }
    >
      All

      {statusFilter === "all" && (
        <span className="badge">
          {filtered.length}
        </span>
      )}
    </button>

    <button
      className={`seg-btn draft ${
        statusFilter === "draft"
          ? "active"
          : ""
      }`}
      onClick={() =>
        setStatusFilter("draft")
      }
    >
      Draft

      {statusFilter === "draft" && (
        <span className="badge">
          {filtered.length}
        </span>
      )}
    </button>

    <button
      className={`seg-btn sent ${
        statusFilter === "sent"
          ? "active"
          : ""
      }`}
      onClick={() =>
        setStatusFilter("sent")
      }
    >
      Sent

      {statusFilter === "sent" && (
        <span className="badge">
          {filtered.length}
        </span>
      )}
    </button>

    <button
      className={`seg-btn accepted ${
        statusFilter === "accepted"
          ? "active"
          : ""
      }`}
      onClick={() =>
        setStatusFilter("accepted")
      }
    >
      Accepted

      {statusFilter ===
        "accepted" && (
        <span className="badge">
          {filtered.length}
        </span>
      )}
    </button>

    <button
      className={`seg-btn rejected ${
        statusFilter === "rejected"
          ? "active"
          : ""
      }`}
      onClick={() =>
        setStatusFilter("rejected")
      }
    >
      Rejected

      {statusFilter ===
        "rejected" && (
        <span className="badge">
          {filtered.length}
        </span>
      )}
    </button>

    <button
      className={`seg-btn order ${
        statusFilter ===
        "order_created"
          ? "active"
          : ""
      }`}
      onClick={() =>
        setStatusFilter(
          "order_created"
        )
      }
    >
      Order Created

      {statusFilter ===
        "order_created" && (
        <span className="badge">
          {filtered.length}
        </span>
      )}
    </button>

  </div>

</div>

  {/* SEARCH */}
  <div className="filter-search">
    <input
      className="search-input"
      placeholder="Search quo no, requirement, customer, notes..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>

  {/* SUMMARY */}
  <div className="filter-summary">
    {filtered.length} / {quotations.length}
  </div>
      <button
    className="cp-btn ghost"
    onClick={exportQuotations}
  >
    Export
  </button>

        </div>
        
     

      {error && <div className="qp-error">{error}</div>}

      <div className="qp-card">
        <table className="qp-table">
          <thead>
            <tr>
              <th>Q No</th>
              <th>Requirement</th>
              <th>Created By</th>
              <th>Status</th>
              <th>Created</th>
              <th>Totals</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => {
              const sClass = (q.status || "draft")
                .split(" ")
                .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : ""))
                .join("");
              return (
                <tr key={q.id}>
                  <td className="strong">{q.quoNo || q.quotationId || q.id}</td>
<td>
  {q.requirementNumber || q.requirementId || "—"}
</td>                  <td>{q.createdByName || q.createdBy || "—"}</td>
                  <td><span className={`chip ${sClass}`}>{q.status || "draft"}</span></td>
                  <td>{parseDate(q.createdAt)}</td>
                  <td>{fmtCurrency(q.totals?.total || 0)}</td>
                  <td>
                <div className="qp-actions">

  <button
    className="qp-btn view"
    onClick={() => openDetails(q)}
  >
    View
  </button>
  

  {(q.status || "").toLowerCase() === "draft" && (
    <button
      className="qp-btn sent"
      onClick={() =>
        updateQuotationStatus(q, "sent", "Sent to customer")
      }
    >
      Mark Sent
    </button>
  )}

  {(q.status || "").toLowerCase() === "sent" && (
    <>
      <button
        className="qp-btn accept"
        onClick={() =>
          updateQuotationStatus(q, "accepted", "Accepted by customer")
        }
      >
        Accept
      </button>

      <button
        className="qp-btn reject"
        onClick={() =>
          updateQuotationStatus(q, "rejected", "Rejected by customer")
        }
      >
        Reject
      </button>
    </>
  )}

  {(q.status || "").toLowerCase() === "accepted" && !q.orderId && (
    <button
      className="qp-btn convert"
      onClick={() => convertToOrder(q)}
    >
      Convert to Order
    </button>
  )}

  {/* {(q.orderId ||
    (q.status || "").toLowerCase() === "order_created") && (
    <button
      className="qp-btn orders"
      onClick={() => navigate("/crm/orders")}
    >
      View Orders
    </button>
  )} */}
  {userRole === "superadmin" && (
  <button
  className="qp-btn danger"
  onClick={() => deleteQuotation(q)}
>
  Delete
</button>
  )}

</div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan="7" className="qp-empty">No quotations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      marginTop: 16,
    }}
  >
    <button
      className="cp-btn"
      onClick={loadMoreQuotations}
      disabled={loadingMore}
    >
      {loadingMore
        ? "Loading..."
        : "Load More"}
    </button>
  </div>
)}

      {/* Details drawer */}
      {details && (
        <div className="qp-drawer" onClick={(e) => { if (e.target.classList.contains("qp-drawer")) closeDetails(); }}>
          <div className="qp-form" onClick={(e) => e.stopPropagation()}>
            <div className="qp-form-head">
              <h2>Quotation: {details.quoNo || details.id}</h2>
              <div>
                {!isEditing && <button className="cp-btn ghost" onClick={startEdit}>Edit</button>}
                {isEditing && <button className="cp-btn ghost" onClick={cancelEdit}>Cancel</button>}
                <button className="qp-close" onClick={closeDetails}>✕</button>
              </div>
            </div>

            <div className="qp-grid">
              <div className="qp-left">
                <div className="qp-section">
                  <div className="label">Requirement</div>
<div className="value">
  {details.requirementNumber || details.requirementId || "—"}
</div>                </div>
<div className="qp-section">
  <div className="label">Service</div>
  <div className="value">
    {details.serviceType === "caretaker"
      ? "Caretaker"
      : details.serviceType === "nursing"
      ? "Nursing"
      : "Equipment Rental"}
  </div>
</div>

                <div className="qp-section">
                  <div className="label">Created</div>
                  <div className="value">{parseDate(details.createdAt)} · {details.createdByName || details.createdBy}</div>
                </div>
                {isNursingQuote(details) && (
                  <div className="qp-nursing-summary" style={{ marginBottom: 12 }}>
                    <div><strong>Service:</strong> {details.items?.[0]?.name || "Nursing"}</div>
                    <div>
                      <strong>Staff:</strong> {details.meta?.staffCount || details.nursing?.count || 1}
                      {" · "}
                      <strong>Shift:</strong> {details.meta?.shift || details.nursing?.shift || "—"}
                      {" · "}
                      <strong>Days:</strong> {details.meta?.days || details.expectedDurationDays || "—"}
                    </div>
                  </div>
                )}


                <div className="qp-section">
                  <div className="label">Items</div>

                  {isEditing ? (
                    <div style={{ marginTop: 8 }}>
                      {(editQuotation.items || []).map((it, i) => (
                        <div key={it.id || i} className="quotation-item">

                          {/* ROW 1 → Name | Qty | Rate */}
                          <div className="row-1">
                            <input
                              className="cp-input"
                              placeholder="Item name"
                              value={it.name || it.itemName || it.productName || ""}
                              onChange={(e) => updateEditItem(i, { name: e.target.value })}
                            />
                            <input
                              className="cp-input"
                              type="number"
                              placeholder={isNursingQuote(editQuotation) ? "Auto (Days × Staff)" : "Qty"}
                              value={it.qty ?? it.quantity ?? 1}
                              disabled={isNursingQuote(editQuotation)}
                              onChange={(e) =>
                                !isNursingQuote(editQuotation) &&
                                updateEditItem(i, { qty: Number(e.target.value || 0) })
                              }
                            />

                            <input
                              className="cp-input"
                              type="number"
                              placeholder="Rate"
                              value={it.rate ?? 0}
                              onChange={(e) => updateEditItem(i, { rate: Number(e.target.value || 0) })}
                            />
                          </div>

                          {/* ROW 2 → Days | Start | End */}
                          <div className="row-2">
                            <input
                              className="cp-input"
                              type="number"
                              placeholder="Days"
                              value={it.days ?? it.expectedDurationDays ?? 0}
                              onChange={(e) => updateEditItem(i, { days: Number(e.target.value || 0) })}
                            />
                            <input
                              className="cp-input"
                              type="date"
                              placeholder="Start date"
                              value={it.expectedStartDate || it.startDate || ""}
                              onChange={(e) => updateEditItem(i, { expectedStartDate: e.target.value })}
                            />
                            <input
                              className="cp-input"
                              type="date"
                              placeholder="End date"
                              value={it.expectedEndDate || it.endDate || ""}
                              onChange={(e) => updateEditItem(i, { expectedEndDate: e.target.value })}
                            />
                          </div>

                          {/* ROW 3 → Product ID | Notes | Remove */}
                          <div className="row-3">
                            <input
                              className="cp-input"
                              placeholder="Product ID"
                              value={it.productId || ""}
                              onChange={(e) => updateEditItem(i, { productId: e.target.value })}
                            />
                            <input
                              className="cp-input"
                              placeholder="Notes"
                              value={it.notes || it.unitNotes || ""}
                              onChange={(e) => updateEditItem(i, { notes: e.target.value })}
                            />
                            <button className="cp-btn ghost" onClick={() => removeEditItem(i)}>Remove</button>
                          </div>

                          <div className="extra-details">
                            Amount: {fmtCurrency((it.amount ?? ((it.qty ?? it.quantity ?? 0) * (it.rate ?? 0))) || 0)}
                          </div>
                        </div>
                      ))}
                      {isNursingQuote(editQuotation) && (
      <div
        className="qp-nursing-summary"
        style={{
          marginTop: 8,
          padding: 8,
          background: "#f8fafc",
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        <div>
          <strong>Staff:</strong>{" "}
          {editQuotation.meta?.staffCount ||
            editQuotation.nursing?.count ||
            1}
        </div>
        <div>
          <strong>Shift:</strong>{" "}
          {editQuotation.meta?.shift ||
            editQuotation.nursing?.shift ||
            "—"}
        </div>
        <div>
          <strong>Days:</strong>{" "}
          {editQuotation.meta?.days ||
            editQuotation.expectedDurationDays ||
            "—"}
        </div>
        <div className="muted">
          Qty is auto-calculated (days × staff)
        </div>
      </div>
    )}

                      <div style={{ marginTop: 8 }}>
                        <button className="cp-btn" onClick={addEditItem}>+ Add item</button>
                      </div>
                    </div>
                  ) : (
                    /* keep your read-only block as-is */
                    <div style={{ marginTop: 8 }}>
                      {(details.items || []).map((it, idx) => (
                        <div key={idx} style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ fontWeight: 700 }}>
                            {it.name || it.itemName || it.productName || it.productId || "—"}
                          </div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>
                            {isNursingQuote(details)
                              ? `(${details.meta?.staffCount || details.nursing?.count || 1} staff × ${details.meta?.days || details.expectedDurationDays || 1
                              } days) × ${fmtCurrency(it.rate ?? 0)}`
                              : `${it.qty ?? it.quantity ?? 0} × ${fmtCurrency(it.rate ?? 0)}`
                            }
                            {" = "}
                            {fmtCurrency(it.amount ?? ((it.qty ?? it.quantity ?? 0) * (it.rate ?? 0)))}
                          </div>

                          {(it.notes || it.unitNotes) ? <div style={{ marginTop: 6 }}>{it.notes || it.unitNotes}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                <div className="qp-section">
                  <div className="label">Notes</div>
                  {isEditing ? (
                    <textarea className="cp-input" value={editQuotation.notes || ""} onChange={(e) => updateEditField("notes", e.target.value)} />
                  ) : (
                    <div className="value">{details.notes || "—"}</div>
                  )}
                </div>

                {/* Versions */}
                <div className="qp-section">
                  <div className="label">Versions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {versions.length === 0 && <div className="qp-empty">No previous versions.</div>}
                    {versions.map((v) => (
                      <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, border: "1px solid #eef2f7", padding: 8, borderRadius: 6 }}>
                        <div style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 700 }}>{v.createdByName || v.createdBy || "Unknown"}</div>
                          <div style={{ color: "#6b7280", fontSize: 12 }}>{parseDate(v.createdAt)}</div>
                          {v.note ? <div style={{ fontSize: 12, color: "#374151", marginTop: 6 }}>{v.note}</div> : null}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="qp-link" onClick={() => viewVersion(v)}>View</button>
                          <button className="qp-link" onClick={() => {
                            if (window.confirm("Revert the current quotation to this saved version? This will create a snapshot of the current quotation before revert.")) {
                              revertToVersion(v);
                            }
                          }}>Revert</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="qp-right">
                <div className="qp-meta">
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div className="label">Quotation No</div>
                      {isEditing ? <input className="cp-input" value={editQuotation.quoNo || ""} onChange={(e) => updateEditField("quoNo", e.target.value)} /> : <div className="value">{details.quoNo}</div>}
                    </div>
                    <div style={{ width: 160 }}>
                      <div className="label">Status</div>
                      {isEditing ? (
                        <select className="cp-input" value={editQuotation.status || "draft"} onChange={(e) => updateEditField("status", e.target.value)}>
                          <option value="draft">draft</option>
                          <option value="sent">sent</option>
                          <option value="accepted">accepted</option>
                          <option value="rejected">rejected</option>
                          <option value="order_created">order_created</option>
                        </select>
                      ) : (
                        <div className="value">
                          <span className={`chip ${(details.status || "draft").split(" ").map(s => s ? s[0].toUpperCase() + s.slice(1) : "").join("")}`}>
                            {details.status || "draft"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* NEW: Customer summary */}
                  <div style={{ marginTop: 12 }}>
                    <div className="label">Customer</div>
                    <div className="value">
                      {(details?.customerName || "—")}
                      {details?.customerPhone ? ` · ${details.customerPhone}` : ""}
                    </div>
                  </div>

                  {/* Discount */}
                  <div style={{ marginTop: 12 }}>
                    <div className="label">Discount</div>
                    {isEditing ? (
                      <div className="qp-discount-row" style={{ marginTop: 6 }}>
                        <select value={editQuotation.discount?.type || "percent"} onChange={(e) => updateEditDiscount({ type: e.target.value })}>
                          <option value="percent">% Percent</option>
                          <option value="fixed">Fixed</option>
                        </select>
                        <input
                          type="number"
                          value={editQuotation.discount?.value ?? 0}
                          onChange={(e) => updateEditDiscount({ value: Number(e.target.value || 0) })}
                          placeholder="Value"
                        />
                      </div>
                    ) : (
                      <div className="value">
                        {details.discount?.type === "percent"
                          ? `${details.discount?.value || 0}%`
                          : fmtCurrency(details.discount?.value || 0)}
                      </div>
                    )}
                  </div>

                  {/* Taxes */}
                  <div style={{ marginTop: 12 }}>
                    <div className="label">Taxes</div>
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(editQuotation.taxes || []).map((t, i) => (
                          <div key={i} style={{ display: "flex", gap: 8 }}>
<input
  className="cp-input"
  value={t.name || ""}
  onChange={(e) => updateEditTax(i, { name: e.target.value })}
/>

<select
  className="cp-input"
  value={t.type || "percent"}
  onChange={(e) => updateEditTax(i, { type: e.target.value })}
>
  <option value="percent">%</option>
  <option value="fixed">Fixed</option>
</select>

<input
  className="cp-input"
  value={t.value ?? t.rate ?? 0}
  onChange={(e) =>
    updateEditTax(i, {
      value: Number(e.target.value || 0),
    })
  }
/>

<button className="cp-btn ghost" onClick={() => removeEditTax(i)}>
  Remove
</button>                            
                          </div>
                        ))}
                        <button className="cp-btn ghost" onClick={addEditTax}>+ Add Tax</button>
                      </div>
                    ) : (
                      <div className="value">
                        {(details.taxes || []).map((t, i) => <div key={i}>{t.name} — {
  t.type === "fixed"
    ? `₹${fmtCurrency(t.value)}`
    : `${t.value}%`
}</div>)}
                      </div>
                    )}
                  </div>

                  {/* Totals */}
                  <div style={{ marginTop: 12 }}>
                    <div className="meta-row"><div className="label">Subtotal</div><div className="value">{fmtCurrency(isEditing ? (editAmounts?.subtotal ?? 0) : (details.totals?.subtotal || 0))}</div></div>
                    <div className="meta-row"><div className="label">Discount Amount</div><div className="value">{fmtCurrency(isEditing ? (editAmounts?.discountAmount ?? 0) : (details.totals?.discountAmount || 0))}</div></div>
                    <div className="meta-row"><div className="label">Total Tax</div><div className="value">{fmtCurrency(isEditing ? (editAmounts?.totalTax ?? 0) : (details.totals?.totalTax || 0))}</div></div>
                    <div className="meta-row"><div className="label strong">Total</div><div className="value strong">{fmtCurrency(isEditing ? (editAmounts?.total ?? 0) : (details.totals?.total || 0))}</div></div>
                  </div>

                  {/* Save/Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {isEditing ? (
                      <>
                        <button className="cp-btn ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
                        <button className="cp-btn primary" onClick={saveEdits} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
                      </>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(details.status || "").toLowerCase() === "draft" && <button className="cp-btn primary" onClick={() => updateQuotationStatus(details, "sent", "Sent by ops")}>Mark Sent</button>}
                        {(details.status || "").toLowerCase() === "sent" && <>
                          <button className="cp-btn primary" onClick={() => updateQuotationStatus(details, "accepted", "Accepted by ops")}>Mark Accepted</button>
                          <button className="cp-btn ghost" onClick={() => updateQuotationStatus(details, "rejected", "Rejected by ops")}>Mark Rejected</button>
                        </>}
                        {(details.status || "").toLowerCase() === "accepted" && !details.orderId && <>
                          <button className="cp-btn primary" onClick={() => convertToOrder(details)}>Create Order</button>
                        </>}
                        {/* {(details.orderId || (details.status || "").toLowerCase() === "order_created") && (
                          <button className="cp-btn ghost" onClick={() => navigate("/orders")}>View Orders</button>
                        )} */}

                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {/* <button className="cp-btn ghost" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(details)); alert("Copied JSON to clipboard"); }}>Copy JSON</button> */}
                          {shareReady && (
                            <button className="cp-btn primary" onClick={() => {
                              if (window.confirm("Share the updated quotation and mark it as 'sent'?")) {
                                shareUpdated();
                              }
                            }}>
                              Share Updated &amp; Mark Sent
                            </button>
                          )}
                          {/* NEW: WhatsApp share (PDF link) */}
                          <input
                            className="cp-input"
                            style={{ width: 220 }}
                            placeholder="WhatsApp phone (e.g. 9876543210 or +919876543210)"
                            value={waPhone || details?.customerPhone || ""}  // ✅ fallback to fetched phone
                            onChange={(e) => setWaPhone(e.target.value)}
                          />
                          <button className="cp-btn" onClick={sendWhatsappPdf} disabled={sendingWa} title="Send PDF via WhatsApp">
                            {sendingWa ? "Preparing…" : (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07.02C5.5.02.18 5.33.18 11.9c0 2.1.55 4.15 1.6 5.96L.02 24l6.3-1.64a11.86 11.86 0 0 0 5.75 1.47h.01c6.57 0 11.89-5.31 11.89-11.88 0-3.18-1.24-6.17-3.45-8.47zM12.07 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.74.97 1-3.64-.24-.37a9.89 9.89 0 0 1-1.53-5.27c0-5.46 4.45-9.9 9.92-9.9 2.65 0 5.14 1.03 7.02 2.9a9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.45 9.88-9.92 9.88zm5.63-7.37c-.31-.15-1.83-.9-2.12-1-.28-.1-.49-.16-.7.16-.2.31-.8 1-.98 1.2-.18.2-.36.22-.66.07-.31-.15-1.3-.48-2.47-1.54-.9-.8-1.51-1.8-1.69-2.1-.18-.3-.02-.46.13-.6.14-.14.3-.37.45-.55.15-.18.2-.31.31-.52.1-.2.06-.38-.02-.54-.08-.16-.7-1.68-.96-2.3-.25-.6-.51-.52-.7-.53h-.6c-.2 0-.53.08-.8.38-.28.3-1.06 1.04-1.06 2.52s1.09 2.93 1.25 3.13c.15.2 2.14 3.26 5.2 4.57.73.31 1.3.49 1.74.63.73.23 1.4.2 1.92.12.59-.09 1.83-.74 2.09-1.46.26-.72.26-1.33.18-1.46-.07-.13-.28-.2-.59-.35z" />
                                </svg>
                                Send on WhatsApp
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {viewingVersion && (
              <div style={{ marginTop: 12, borderTop: "1px solid #eef2f7", paddingTop: 12 }}>
                <h3>Viewing Version: {viewingVersion.id}</h3>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{viewingVersion.createdByName || viewingVersion.createdBy} · {parseDate(viewingVersion.createdAt)}</div>
                <div style={{ marginTop: 8 }}>
                  <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 6, maxHeight: 280, overflow: "auto" }}>
                    {JSON.stringify(viewingVersion.snapshot || viewingVersion, null, 2)}
                  </pre>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="cp-btn ghost" onClick={() => setViewingVersion(null)}>Close</button>
                    <button className="cp-btn" onClick={() => {
                      if (window.confirm("Revert to this version? This will snapshot the current quotation first.")) {
                        revertToVersion(viewingVersion);
                      }
                    }}>Revert to this version</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* OrderCreate drawer/modal */}
      {/* Rental Order */}
{orderModalQuote?.__orderType === "rental" && (
  <OrderCreate
    open
    quotation={orderModalQuote}
    onClose={() => setOrderModalQuote(null)}
   onCreated={(orderId) => {

  // Update details drawer if open
  if (
    details &&
    details.id === orderModalQuote.id
  ) {

    setDetails((d) => ({
      ...d,
      orderId,
      status: "order_created",
    }));

  }

  // ALWAYS update quotations list
  setQuotations((prev) =>
    prev.map((q) =>
      q.id === orderModalQuote.id
        ? {
            ...q,
            orderId,
            status: "order_created",
          }
        : q
    )
  );

  setOrderModalQuote(null);

}}
  />
)}

{/* Nursing Order */}
{orderModalQuote?.__orderType === "nursing" && (
  <NursingOrderCreate
    open
    quotation={orderModalQuote}
     serviceType={orderModalQuote.serviceType}
    onClose={() => setOrderModalQuote(null)}
    onCreated={(orderId) => {

  // Update details drawer if open
  if (
    details &&
    details.id === orderModalQuote.id
  ) {

    setDetails((d) => ({
      ...d,
      orderId,
      status: "order_created",
    }));

  }

  // ALWAYS update quotations list
  setQuotations((prev) =>
    prev.map((q) =>
      q.id === orderModalQuote.id
        ? {
            ...q,
            orderId,
            status: "order_created",
          }
        : q
    )
  );

  setOrderModalQuote(null);

}}
  />
)}

    </div>
  );
}
