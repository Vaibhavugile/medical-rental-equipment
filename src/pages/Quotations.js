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
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Quotations.css";
import { makeHistoryEntry, propagateToLead } from "../utils/status";
import OrderCreate from "./OrderCreate";
import NursingOrderCreate from "./NursingOrderCreate";
// NEW: PDF generation + Firebase Storage upload
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // ✅ correct v3 import

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
    (s, it) => s + Number(Number(it.qty || 0) * Number(it.rate || 0)),
    0
  );
  let discountAmount = 0;
  if (discount) {
    if (discount.type === "percent") discountAmount = subtotal * (Number(discount.value || 0) / 100);
    else discountAmount = Number(discount.value || 0);
  }
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxBreakdown = (taxes || []).map((t) => ({ ...t, amount: taxable * (Number(t.rate || 0) / 100) }));
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

  // NEW: WhatsApp send state
  const [waPhone, setWaPhone] = useState("");
  const [sendingWa, setSendingWa] = useState(false);

  const [orderModalQuote, setOrderModalQuote] = useState(null);
  const navigate = useNavigate();
  const isNursingQuote = (q) =>
    q?.meta?.serviceType === "nursing" ||
    q?.serviceType === "nursing";


  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "quotations"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setQuotations(docs);
        setLoading(false);
      },
      (err) => {
        console.error("quotations snapshot", err);
        setError(err.message || "Failed to load quotations");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

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
    const list = statusFilter === "all"
      ? quotations
      : quotations.filter((q) => String(q.status || "draft").toLowerCase() === statusFilter);

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
        q.customerName,   // ✅ searchable
        q.customerPhone,  // ✅ searchable
      ].map((x) => String(x || "").toLowerCase());
      return fields.some((f) => f.includes(term));
    });
  }, [quotations, statusFilter, search]);

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
      clone.taxes.push({ name: "New Tax", rate: 0 });
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

  const isNursing =
    quote?.items?.some((it) =>
      /nurse|caretaker|care staff/i.test(it.name || "")
    ) ||
    quote?.serviceType === "nursing";

  setOrderModalQuote({
    ...quote,

    // internal flag only for UI routing
    __orderType: isNursing ? "nursing" : "rental",
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
    const doc = new jsPDF();
    const marginLeft = 14;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.text("Quotation", marginLeft, 20);
    doc.setFontSize(11);
    doc.text(`Quotation No: ${q.quoNo || q.quotationId || q.id}`, marginLeft, 28);
    doc.text(`Status: ${q.status || "draft"}`, marginLeft, 34);
    doc.text(`Created: ${parseDate(q.createdAt)}`, marginLeft, 40);
    if (q.createdByName || q.createdBy) doc.text(`By: ${q.createdByName || q.createdBy}`, marginLeft, 46);

    // NEW: Customer lines
    const custY = 52;
    if (q.customerName) doc.text(`Customer: ${q.customerName}`, marginLeft, custY);
    if (q.customerPhone) doc.text(`Mobile: ${q.customerPhone}`, marginLeft, custY + 6);

    // Items table
    const rows = (q.items || []).map((it, idx) => [
      idx + 1,
      it.name || it.itemName || it.productName || it.productId || "—",
      String(it.qty ?? it.quantity ?? 0),
      fmtCurrency(it.rate ?? 0),
      fmtCurrency(it.amount ?? ((it.qty ?? it.quantity ?? 0) * (it.rate ?? 0)))
    ]);

    // ✅ use autoTable(doc, {...}) for v3
    autoTable(doc, {
      head: [["#", "Item", "Qty", "Rate", "Amount"]],
      body: rows,
      startY: (q.customerName || q.customerPhone) ? (custY + 14) : 54, // push down if customer block present
      styles: { fontSize: 10 },
      headStyles: { fillColor: [240, 240, 240] },
      theme: "grid",
      columnStyles: {
        0: { cellWidth: 10 },
        2: { halign: "right", cellWidth: 18 },
        3: { halign: "right", cellWidth: 24 },
        4: { halign: "right", cellWidth: 28 }
      }
    });

    // Totals
    const y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : 64;
    const totalLines = [
      ["Subtotal", fmtCurrency(q.totals?.subtotal || 0)],
      ["Discount", fmtCurrency(q.totals?.discountAmount || 0)],
      ["Tax", fmtCurrency(q.totals?.totalTax || 0)],
      ["Total", fmtCurrency(q.totals?.total || 0)]
    ];
    let lineY = y;
    totalLines.forEach(([label, val], idx) => {
      const isStrong = idx === totalLines.length - 1;
      if (isStrong) doc.setFont(undefined, "bold");
      doc.text(label, pageWidth - 80, lineY);
      doc.text(val, pageWidth - 30, lineY, { align: "right" });
      if (isStrong) doc.setFont(undefined, "normal");
      lineY += 6;
    });

    // Notes
    const notes = q.notes ? String(q.notes) : "";
    if (notes) {
      doc.setFontSize(11);
      doc.text("Notes:", marginLeft, lineY + 8);
      doc.setFontSize(10);
      doc.text(doc.splitTextToSize(notes, pageWidth - marginLeft * 2), marginLeft, lineY + 14);
    }

    // Return Blob so we can upload
    return doc.output("blob");
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

  if (loading) return <div className="qp-wrap"><div className="qp-loading">Loading quotations…</div></div>;

  return (
    <div className="qp-wrap">
      <header className="qp-header">
        <h1>Quotations</h1>

        <div className="coupons-toolbar" style={{ marginTop: 8, width: "100%" }}>
          <input
            className="cp-input"
            placeholder="Search quo no / requirement / created by / notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 240 }}
          />

          <div className="visits-chip-row" style={{ marginLeft: 8, flex: 1 }}>
            <button className={`chip ${statusFilter === "all" ? "is-active" : ""}`} onClick={() => setStatusFilter("all")}>
              All <span className="count">({statusCounts.all || 0})</span>
            </button>
            <button className={`chip ${statusFilter === "draft" ? "is-active" : ""}`} onClick={() => setStatusFilter("draft")}>
              draft <span className="count">({statusCounts.draft || 0})</span>
            </button>
            <button className={`chip ${statusFilter === "sent" ? "is-active" : ""}`} onClick={() => setStatusFilter("sent")}>
              sent <span className="count">({statusCounts.sent || 0})</span>
            </button>
            <button className={`chip ${statusFilter === "accepted" ? "is-active" : ""}`} onClick={() => setStatusFilter("accepted")}>
              accepted <span className="count">({statusCounts.accepted || 0})</span>
            </button>
            <button className={`chip ${statusFilter === "rejected" ? "is-active" : ""}`} onClick={() => setStatusFilter("rejected")}>
              rejected <span className="count">({statusCounts.rejected || 0})</span>
            </button>
            <button className={`chip ${statusFilter === "order_created" ? "is-active" : ""}`} onClick={() => setStatusFilter("order_created")}>
              order created <span className="count">({statusCounts.order_created || 0})</span>
            </button>
          </div>

          <div className="muted">Showing {filtered.length} of {quotations.length}</div>
        </div>
      </header>

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
                  <td>{q.requirementId || "—"}</td>
                  <td>{q.createdByName || q.createdBy || "—"}</td>
                  <td><span className={`chip ${sClass}`}>{q.status || "draft"}</span></td>
                  <td>{parseDate(q.createdAt)}</td>
                  <td>{fmtCurrency(q.totals?.total || 0)}</td>
                  <td>
                    <div className="qp-actions">
                      <button className="qp-link" onClick={() => openDetails(q)}>View</button>

                      {(q.status || "").toLowerCase() === "draft" && (
                        <button className="qp-link" onClick={() => updateQuotationStatus(q, "sent", "Sent to customer")}>
                          Mark Sent
                        </button>
                      )}

                      {(q.status || "").toLowerCase() === "sent" && (
                        <>
                          <button className="qp-link" onClick={() => updateQuotationStatus(q, "accepted", "Accepted by customer")}>Accept</button>
                          <button className="qp-link" onClick={() => updateQuotationStatus(q, "rejected", "Rejected by customer")}>Reject</button>
                        </>
                      )}

                      {(q.status || "").toLowerCase() === "accepted" && !q.orderId && (
                        <button className="qp-link" onClick={() => convertToOrder(q)}>Convert to Order</button>
                      )}

                      {(q.orderId || (q.status || "").toLowerCase() === "order_created") && (
                        <button className="qp-link" onClick={() => navigate("/orders")}>View Orders</button>
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
                  <div className="value">{details.requirementId || "—"}</div>
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
                            <input className="cp-input" value={t.name || ""} onChange={(e) => updateEditTax(i, { name: e.target.value })} />
                            <input className="cp-input" value={t.rate || 0} onChange={(e) => updateEditTax(i, { rate: Number(e.target.value || 0) })} />
                            <button className="cp-btn ghost" onClick={() => removeEditTax(i)}>Remove</button>
                          </div>
                        ))}
                        <button className="cp-btn ghost" onClick={addEditTax}>+ Add Tax</button>
                      </div>
                    ) : (
                      <div className="value">
                        {(details.taxes || []).map((t, i) => <div key={i}>{t.name} — {t.rate}%</div>)}
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
                        {(details.orderId || (details.status || "").toLowerCase() === "order_created") && (
                          <button className="cp-btn ghost" onClick={() => navigate("/orders")}>View Orders</button>
                        )}

                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <button className="cp-btn ghost" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(details)); alert("Copied JSON to clipboard"); }}>Copy JSON</button>
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
      if (details && details.id === orderModalQuote.id) {
        setDetails((d) => ({
          ...d,
          orderId,
          status: "order_created",
        }));
      }
      setOrderModalQuote(null);
    }}
  />
)}

{/* Nursing Order */}
{orderModalQuote?.__orderType === "nursing" && (
  <NursingOrderCreate
    open
    quotation={orderModalQuote}
    onClose={() => setOrderModalQuote(null)}
    onCreated={(orderId) => {
      if (details && details.id === orderModalQuote.id) {
        setDetails((d) => ({
          ...d,
          orderId,
          status: "order_created",
        }));
      }
      setOrderModalQuote(null);
    }}
  />
)}

    </div>
  );
}
