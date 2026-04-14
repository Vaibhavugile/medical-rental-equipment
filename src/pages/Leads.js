// src/pages/Leads.jsx
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
  where,
  increment,
} from "firebase/firestore";
import { updateAccountReport } from "../utils/accountReport";
import { db, auth } from "../firebase";
import "./Leads.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { writeBatch } from "firebase/firestore";
// Requirement form integration
import RequirementForm from "../data/RequirementForm";

// Shared helpers
import { makeHistoryEntry } from "../utils/status";

// ---------- Helpers ----------
const norm = (v = "") => String(v || "").toLowerCase();
const fmtDate = (ts) => {
  try {
    if (!ts) return "—";
    if (typeof ts === "string") return new Date(ts).toLocaleString();
    if (ts?.toDate) return ts.toDate().toLocaleString();
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
};

// Stages used for status chips
const STAGES = ["new", "contacted", "req shared", "followup", "lost"];
const STATUS_TREE = {
  new: ["valid", "invalid"],

  valid: ["interested", "not interested"],

  interested: ["req shared", "followup"],

  "not interested": [
    "out of service",
    "high price",
    "out of area",
    "urgent visit"
  ]
};

const getNextStatus = (status) => {
  const options = STATUS_TREE[status] || [];
  return options.length === 1 ? options[0] : null;
};
const getNextStatuses = (status) => {
  return STATUS_TREE[status] || [];
};
const normStatus = (s = "") => s.toLowerCase();
const statusClass = (s = "") =>
  s
    .split(" ")
    .map((t) => (t ? t[0].toUpperCase() + t.slice(1) : ""))
    .join("");

// ---------- Default form ----------
const defaultForm = {
  id: null,
  customerName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  leadSource: "",
  notes: "",
  status: "new",
  // NEW
  type: "equipment", // "equipment" | "nursing"
  createdBy: "",
  createdByName: "",
  history: [],
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [userRole, setUserRole] = useState(null);
  // Drawer/edit form
  const [showForm, setShowForm] = useState(false);
  const [closing, setClosing] = useState(false);
  const CLOSE_MS = 180;
  const [form, setForm] = useState(defaultForm);
  const [followupFilter, setFollowupFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notInterestedFilter, setNotInterestedFilter] = useState("all");
  const [statusBranch, setStatusBranch] = useState(null);
  const [statusLevel1, setStatusLevel1] = useState(null)
  const [statusLevel2, setStatusLevel2] = useState(null)
  // Status modal (next stage + note)
  const [statusModal, setStatusModal] = useState({
    open: false,
    lead: null,

    validation: "",
    interest: "",
    reason: "",
    action: "",

    note: "",
    followupDate: ""
  });

  // Right-side details
  const [detailsLead, setDetailsLead] = useState(null);

  // Requirement drawer
  const [openReq, setOpenReq] = useState(false);
  const [reqLead, setReqLead] = useState(null);
  const [templateReq, setTemplateReq] = useState(null);

  // Requirements index: latest requirement per leadId
  const [reqByLead, setReqByLead] = useState({}); // { [leadId]: requirementObj }

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");   // PRIMARY FILTER (drives Firestore query)
  const [statusFilter, setStatusFilter] = useState("all"); // Secondary filter (client-side)
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
  // ---------- Realtime leads (TYPE-DRIVEN QUERY) ----------
  useEffect(() => {
    setLoading(true);
    setError("");

    const base = collection(db, "leads");
    const qy =
      typeFilter === "all"
        ? query(base, orderBy("createdAt", "desc"))
        : query(base, where("type", "==", typeFilter), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            customerName: data.customerName || "",
            contactPerson: data.contactPerson || "",
            phone: data.phone || "",
            email: data.email || "",
            address: data.address || "",
            leadSource: data.leadSource || "",
            notes: data.notes || "",
            status: data.status || "new",
            // NEW
            type: data.type || "equipment",
            createdAt: data.createdAt || null,
            createdBy: data.createdBy || "",
            createdByName: data.createdByName || "",
            updatedAt: data.updatedAt || null,
            updatedBy: data.updatedBy || "",
            updatedByName: data.updatedByName || "",
            history: Array.isArray(data.history) ? data.history : [],
            followupDate: data.followupDate || null,
          };
        });
        setLeads(docs);

        /* mark leads as seen */
        const batch = writeBatch(db);

        snap.docs.forEach((d) => {
          const data = d.data();

          if (!data.seen) {
            batch.update(doc(db, "leads", d.id), {
              seen: true
            });
          }
        });

        batch.commit();

        setLoading(false);
      },
      (err) => {
        console.error("leads onSnapshot error", err);
        setError(err.message || "Failed to load leads.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [typeFilter]);

  // ---------- Realtime requirements → latest per leadId ----------
  useEffect(() => {
    const qy = query(collection(db, "requirements"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const r = { id: d.id, ...(d.data() || {}) };
          const leadId = r.leadId || r.lead?.id || "";
          if (!leadId) return;
          if (!map[leadId]) map[leadId] = r; // first seen is latest (desc)
        });
        setReqByLead(map);
      },
      (err) => console.error("requirements onSnapshot error", err)
    );
    return () => unsub();
  }, []);

  // ---------- Counts for STATUS chips (within current TYPE selection) ----------
  const statusCounts = useMemo(() => {

    const map = {
  all: leads.length,

  new: 0,
  valid: 0,
  invalid: 0,

  interested: 0,
  "not interested": 0,

  "req shared": 0,
  followup: 0,

  "out of service": 0,
  "high price": 0,
  "out of area": 0,
  "urgent visit": 0,

  others: 0
};

    for (const l of leads) {

      const s = normStatus(l.status);
      if (s === "new") {
  map.new++;
  continue;
}

      if (s === "invalid") {
        map.invalid++;
        continue;
      }

      if (s === "valid") {
        map.valid++;
        continue;
      }

      if (s === "interested") {
        map.interested++;
        map.valid++;
        continue;
      }

      if (s === "req shared") {
        map["req shared"]++;
        map.interested++;
        map.valid++;
        continue;
      }

      if (s === "followup") {
        map.followup++;
        map.interested++;
        map.valid++;
        continue;
      }

      if (s === "not interested") {
        map["not interested"]++;
        map.valid++;
        continue;
      }

      if (["out of service", "high price", "out of area", "urgent visit"].includes(s)) {

        map[s]++;
        map["not interested"]++;
        map.valid++;
        continue;

      }

      map.others++;

    }

    return map;

  }, [leads]);
  // ---------- Search + STATUS filter (TYPE already applied by Firestore) ----------
  const filtered = useMemo(() => {

    let list = [...leads];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // STATUS FILTER
    if (statusFilter !== "all") {

      const mainStatuses = [
        "new",
        "valid",
        "invalid",
        "interested",
        "not interested",
        "req shared",
        "followup",
        "out of service",
        "high price",
        "out of area",
        "urgent visit"
      ];
      list = list.filter((l) => {

        const s = normStatus(l.status);

        if (statusFilter === "others") {
          return !mainStatuses.includes(s);
        }

        if (statusFilter === "followup") {

          if (s !== "followup") return false;
          if (!l.followupDate) return false;

          const fDate = new Date(l.followupDate);
          fDate.setHours(0, 0, 0, 0);

          if (followupFilter === "today") {
            return fDate.getTime() === today.getTime();
          }

          if (followupFilter === "overdue") {
            return fDate < today;
          }

          if (followupFilter === "upcoming") {
            return fDate > today;
          }

          return true;
        }

        if (statusFilter === "valid") {
          return [
            "valid",
            "interested",
            "not interested",
            "req shared",
            "followup",
            "out of service",
            "high price",
            "out of area",
            "urgent visit"
          ].includes(s);
        }

        if (statusFilter === "interested") {
          return ["interested", "req shared", "followup"].includes(s);
        }

      if (statusFilter === "not interested") {

  const reasons = [
    "out of service",
    "high price",
    "out of area",
    "urgent visit"
  ];

  if (notInterestedFilter === "all") {
    return ["not interested", ...reasons].includes(s);
  }

  return s === notInterestedFilter;

}

        return s === statusFilter;

      });

    }

    // SEARCH FILTER
    const q = search.trim().toLowerCase();

    if (q) {
      list = list.filter((l) => {

        return (
          (l.customerName || "").toLowerCase().includes(q) ||
          (l.contactPerson || "").toLowerCase().includes(q) ||
          (l.phone || "").toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.leadSource || "").toLowerCase().includes(q) ||
          (l.notes || "").toLowerCase().includes(q)
        );

      });
    }

    // SORTING
    if (sortBy === "followup") {

      list.sort((a, b) => {

        if (!a.followupDate) return 1;
        if (!b.followupDate) return -1;

        return new Date(a.followupDate) - new Date(b.followupDate);

      });

    }

    if (sortBy === "created") {

      list.sort((a, b) => {

        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;

        return b.createdAt.toMillis() - a.createdAt.toMillis();

      });

    }

    return list;

}, [leads, search, statusFilter, followupFilter, notInterestedFilter, sortBy]);

  // ---------- Drawer helpers ----------
  const openDrawer = (initial = defaultForm) => {
    setForm(initial);
    setShowForm(true);
  };
  const closeDrawer = () => {
    setClosing(true);
    setTimeout(() => {
      setShowForm(false);
      setClosing(false);
      setForm(defaultForm);
    }, CLOSE_MS);
  };

  const editLead = (l) => {
    openDrawer({
      id: l.id,
      customerName: l.customerName || "",
      contactPerson: l.contactPerson || "",
      phone: l.phone || "",
      email: l.email || "",
      address: l.address || "",
      leadSource: l.leadSource || "",
      notes: l.notes || "",
      status: l.status || "new",
      // NEW
      type: l.type || "equipment",
      createdBy: l.createdBy || "",
      createdByName: l.createdByName || "",
      history: l.history || [],
    });
  };

  // ---------- Create or update lead ----------
  const handleSave = async (e) => {
    e?.preventDefault();
    setError("");
    if (!form.customerName.trim() || !form.contactPerson.trim() || !form.phone.trim()) {
      setError("Customer, Contact and Phone are required.");
      return;
    }
    setSaving(true);
    try {
      const payloadFields = {
        customerName: form.customerName.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || "",
        address: form.address?.trim() || "",
        leadSource: form.leadSource?.trim() || "",
        notes: form.notes?.trim() || "",
        status: form.status || "new",
        // NEW
        type: form.type || "equipment",
      };

      const user = auth.currentUser || {};
      if (form.id) {
        // UPDATE
        const existing = leads.find((x) => x.id === form.id) || {};
        const changes = [];
        const keys = [
          "customerName",
          "contactPerson",
          "phone",
          "email",
          "address",
          "leadSource",
          "notes",
          "status",
          // NEW
          "type",
        ];
        for (const key of keys) {
          const oldV = existing[key] ?? "";
          const newV = payloadFields[key] ?? "";
          if (String(oldV) !== String(newV)) {
            changes.push(
              makeHistoryEntry(user, {
                type: key === "status" ? "status" : "update",
                field: key,
                oldValue: oldV,
                newValue: newV,
                note: key === "notes" ? payloadFields.notes || "" : null,
              })
            );
          }
        }

        const docRef = doc(db, "leads", form.id);
        const meta = {
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || user.uid || "",
        };

        if (changes.length > 0) {
          await updateDoc(docRef, {
            ...payloadFields,
            ...meta,
            history: arrayUnion(...changes),
          });
        } else {
          await updateDoc(docRef, {
            ...payloadFields,
            ...meta,
          });
        }
      } else {
        // CREATE
        const userForCreate = auth.currentUser || {};
        const createEntry = makeHistoryEntry(userForCreate, {
          type: "create",
          field: null,
          oldValue: null,
          newValue: JSON.stringify({
            customerName: payloadFields.customerName,
            contactPerson: payloadFields.contactPerson,
            phone: payloadFields.phone,
          }),
          note: "Lead created",
        });

        await addDoc(collection(db, "leads"), {
          ...payloadFields,
          createdAt: serverTimestamp(),
          createdBy: userForCreate.uid || "",
          createdByName:
            userForCreate.displayName ||
            userForCreate.email ||
            userForCreate.uid ||
            "",
          updatedAt: serverTimestamp(),
          updatedBy: userForCreate.uid || "",
          updatedByName:
            userForCreate.displayName ||
            userForCreate.email ||
            userForCreate.uid ||
            "",
          history: [createEntry],
        });
        await updateAccountReport({
          leadsAdded: increment(1)
        });
      }

      closeDrawer();
    } catch (err) {
      console.error("save lead error", err);
      setError(err.message || "Failed to save lead.");
    } finally {
      setSaving(false);
    }
  };
  const handleNext = (lead) => {
    openStatusModal(lead);
  };
  // ---------- Status modal helpers ----------
  const openStatusModal = (lead) => {

    const s = lead.status || "";

    setStatusModal({
      open: true,
      lead,

      validation:
        [
          "valid",
          "interested",
          "req shared",
          "followup",
          "not interested",
          "out of service",
          "high price",
          "out of area",
          "urgent visit"
        ].includes(s)
          ? "valid"
          : s === "invalid"
            ? "invalid"
            : "",

      interest:
        ["interested", "req shared", "followup"].includes(s)
          ? "interested"
          : ["not interested", "out of service", "high price", "out of area", "urgent visit"].includes(s)
            ? "not interested"
            : "",

      reason:
        ["out of service", "high price", "out of area", "urgent visit"].includes(s)
          ? s
          : "",

      action:
        s === "req shared" || s === "followup"
          ? s
          : "",

      note: "",
      followupDate: lead.followupDate || ""
    });

  };
  const closeStatusModal = () =>
    setStatusModal({
      open: false,
      lead: null,
      validation: "",
      interest: "",
      reason: "",
      action: "",
      note: "",
      followupDate: ""
    });
  const confirmStatusChange = async () => {
    const { lead, validation, interest, reason, action, note } = statusModal;
    if (!lead) return closeStatusModal();
    if (!note || !note.trim()) {
      setError("Please provide a note for the status change.");
      return;
    }
    setError("");
    try {
      const user = auth.currentUser || {};
      let nextStatus = validation;

      if (interest) nextStatus = interest;
      if (reason) nextStatus = reason;
      if (action) nextStatus = action;

      const entry = makeHistoryEntry(user, {
        type: "status",
        field: "status",
        oldValue: lead.status,
        newValue: nextStatus,
        note: note.trim(),
      });

      await updateDoc(doc(db, "leads", lead.id), {
        status: nextStatus,
        followupDate: statusModal.followupDate || null,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || user.uid || "",
        history: arrayUnion(entry),

      });
      if (nextStatus === "contacted") {
        await updateAccountReport({
          leadsContacted: increment(1)
        });
      }

      closeStatusModal();
    } catch (err) {
      console.error("confirmStatusChange error", err);
      setError(err.message || "Failed to change status.");
    }
  };

  // ---------- Details drawer ----------
  const openDetails = (lead) => setDetailsLead(lead);
  const closeDetails = () => setDetailsLead(null);
  const openWhatsApp = (phone) => {
    if (!phone) return;

    // Remove spaces, dashes, brackets etc
    let clean = phone.replace(/[^\d]/g, "");

    // Force India country code (+91)
    if (!clean.startsWith("91")) {
      clean = "91" + clean;
    }

    // Prefilled message
    const message = encodeURIComponent("Hi");

    // Official WhatsApp API
    const url = `https://wa.me/${clean}?text=${message}`;

    window.open(url, "_blank");
  };


  // ---------- Delete ----------
  const handleDelete = async (l) => {
    try {
      await deleteDoc(doc(db, "leads", l.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error("delete error", err);
      setError(err.message || "Failed to delete lead.");
    }
  };

  // lock body scroll when drawer/modal open
  useEffect(() => {
    if (showForm || detailsLead || statusModal.open || openReq)
      document.body.classList.add("coupons-drawer-open");
    else document.body.classList.remove("coupons-drawer-open");
    return () => document.body.classList.remove("coupons-drawer-open");
  }, [showForm, detailsLead, statusModal.open, openReq]);

  // esc to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (statusModal.open) closeStatusModal();
        else if (detailsLead) closeDetails();
        else if (showForm && !closing) closeDrawer();
        else if (openReq) setOpenReq(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [statusModal, detailsLead, showForm, closing, openReq]);

  if (loading) {
    return (
      <div className="coupons-wrap">
        <div className="coupons-loading">Loading leads…</div>
      </div>
    );
  }

  return (
    <div className="coupons-wrap">
      {error && <div className="coupons-error">{error}</div>}

      <header className="leads-header">
        <div className="leads-header-left">
          <div className="leads-title-row">
            <span className="leads-icon">📋</span>
            <h1 className="leads-title">Leads</h1>
          </div>

          <p className="leads-subtitle">
            Filter by <strong>Type</strong> and refine using <strong>Status</strong>.
          </p>
        </div>

        <div className="leads-header-actions">
          <button
            className="cp-btn ghost"
            onClick={() => openDrawer(defaultForm)}
          >
            + New Lead
          </button>

          <button
            className="cp-btn primary"
            onClick={() => {
              setDetailsLead(null);
              setReqLead(null);
              setTemplateReq(null);
              setOpenReq(true);
            }}
          >
            +Add Req
          </button>
        </div>
      </header>

      {/* Toolbar: TYPE chips (server filter) + search + STATUS chips (client filter) */}
      {/* ===== PREMIUM FILTER BAR ===== */}
      <section className="filter-bar">

        <div className="filter-left">

          {/* TYPE SEGMENT */}
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
              className={`seg-btn equipment ${typeFilter === "equipment" ? "active" : ""}`}
              onClick={() => {
                setTypeFilter("equipment");
                setStatusFilter("all");
              }}
            >
              Equipment
            </button>

            <button
              className={`seg-btn nursing ${typeFilter === "nursing" ? "active" : ""}`}
              onClick={() => {
                setTypeFilter("nursing");
                setStatusFilter("all");
              }}
            >
              Nursing
            </button>
            <button
              className={`seg-btn caretaker ${typeFilter === "caretaker" ? "active" : ""}`}
              onClick={() => {
                setTypeFilter("caretaker");
                setStatusFilter("all");
              }}
            >
              Caretaker
            </button>
          </div>

          {/* STATUS SEGMENT */}
          <div className="segmented status-segment">

  {/* ALL */}
  <button
    className={`seg-btn ${statusFilter === "all" ? "active" : ""}`}
    onClick={() => setStatusFilter("all")}
  >
    All ({statusCounts.all})
  </button>
    <button
    className={`seg-btn ${statusFilter === "new" ? "active" : ""}`}
    onClick={() => setStatusFilter("new")}
  >
    New ({statusCounts.new})
  </button>


  {/* REQ SHARED */}
  <button
    className={`seg-btn ${statusFilter === "req shared" ? "active" : ""}`}
    onClick={() => setStatusFilter("req shared")}
  >
    Req Shared ({statusCounts["req shared"]})
  </button>

  {/* FOLLOWUP */}
  <button
    className={`seg-btn ${statusFilter === "followup" ? "active" : ""}`}
    onClick={() => {
      setStatusFilter("followup");
      setFollowupFilter("all");
    }}
  >
    Followup ({statusCounts.followup})
  </button>

  {/* NOT INTERESTED */}
<button
  className={`seg-btn ${statusFilter === "not interested" ? "active" : ""}`}
  onClick={() => {
    setStatusFilter("not interested");
    setNotInterestedFilter("all");
  }}
>
  Not Interested ({statusCounts["not interested"]})
</button>

  {/* INVALID */}
  <button
    className={`seg-btn ${statusFilter === "invalid" ? "active" : ""}`}
    onClick={() => setStatusFilter("invalid")}
  >
    Invalid ({statusCounts.invalid})
  </button>

  {/* OTHERS */}
  <button
    className={`seg-btn ${statusFilter === "others" ? "active" : ""}`}
    onClick={() => setStatusFilter("others")}
  >
    Others ({statusCounts.others})
  </button>

</div>


{/* FOLLOWUP SUBFILTERS */}
{statusFilter === "followup" && (

  <div className="followup-subfilters">

    <button
      className={`seg-btn ${followupFilter === "all" ? "active" : ""}`}
      onClick={() => {
        setStatusFilter("followup");
        setFollowupFilter("all");
      }}
    >
      All
    </button>

    <button
      className={`seg-btn ${followupFilter === "today" ? "active" : ""}`}
      onClick={() => {
        setStatusFilter("followup");
        setFollowupFilter("today");
      }}
    >
      Today ({statusCounts.today})
    </button>

    <button
      className={`seg-btn ${followupFilter === "upcoming" ? "active" : ""}`}
      onClick={() => {
        setStatusFilter("followup");
        setFollowupFilter("upcoming");
      }}
    >
      Upcoming
    </button>

    <button
      className={`seg-btn overdue ${followupFilter === "overdue" ? "active" : ""}`}
      onClick={() => {
        setStatusFilter("followup");
        setFollowupFilter("overdue");
      }}
    >
      Overdue 🔴 ({statusCounts.overdue})
    </button>

  </div>

)}
{statusFilter === "not interested" && (

  <div className="notInterestedFilters">

    <select
      className="notInterestedDropdown"
      value={notInterestedFilter}
      onChange={(e) => setNotInterestedFilter(e.target.value)}
    >

      <option value="all">All</option>
      <option value="high price">High Price</option>
      <option value="out of service">Out Of Service</option>
      <option value="out of area">Out Of Area</option>
      <option value="urgent visit">Urgent Visit</option>

    </select>

  </div>

)}



        </div>

        {/* SEARCH */}
        <div className="filter-search">
          <input
            className="search-input"
            placeholder="Search customer, phone, source..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >

          <option value="created">Sort: Latest</option>
          <option value="followup">Sort: Followup Date</option>

        </select>

        {/* SUMMARY */}
        <div className="filter-summary">
          {filtered.length} / {leads.length}
        </div>

      </section>
      {/* Table */}
      <section className="leads-card">
        <div className="leads-table-wrap">
          <table className="leads-table">

            <thead>
              <tr>
                <th>Customer</th>
                {/* <th>Contact</th> */}
                <th>Phone</th>
                <th>Source</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Updated</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((l) => {
                const latestReq = reqByLead[l.id];
                const canCreateReq =
                  normStatus(l.status) === "req shared";

                return (
                  <tr key={l.id} className="leads-row">

                    <td className="cell-strong">
                      {l.customerName}
                    </td>

                    {/* <td className="cell-muted">
                {l.contactPerson}
                {l.email ? ` · ${l.email}` : ""}
              </td> */}

                    <td>{l.phone}</td>

                    <td className="cell-muted">
                      {l.leadSource || "—"}
                    </td>

                    <td className="cell-muted">
                      {(l.type || "equipment")
                        .charAt(0)
                        .toUpperCase() + (l.type || "equipment").slice(1)}
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className={`chip ${statusClass(l.status)}`}>
                          {l.status}
                        </span>

                        {l.status === "followup" && l.followupDate && (
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            {fmtDate(l.followupDate)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="cell-muted">
                      {l.createdByName || l.createdBy || "—"}
                    </td>

                    <td className="cell-muted updated-cell">
                      <div className="updated-date">
                        {l.updatedAt
                          ? fmtDate(l.updatedAt)
                          : l.createdAt
                            ? fmtDate(l.createdAt)
                            : "—"}
                      </div>

                      {l.updatedByName && (
                        <div className="updated-user">
                          {l.updatedByName}
                        </div>
                      )}
                    </td>

                    <td>
                      <div className="row-actions">

                        {/* Edit */}
                        <button
                          title="Edit lead"
                          className="row-btn icon"
                          onClick={() => editLead(l)}
                        >
                          ✎
                        </button>

                        {/* Requirement */}
                        {latestReq ? (
                          <button
                            className="row-btn req"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReqLead(l);
                              setTemplateReq(latestReq);
                              setDetailsLead(null);
                              setOpenReq(true);
                            }}
                          >
                            Add Req
                          </button>
                        ) : canCreateReq ? (
                          <button
                            className="row-btn req"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReqLead(l);
                              setTemplateReq(null);
                              setDetailsLead(null);
                              setOpenReq(true);
                            }}
                          >
                            + Req
                          </button>
                        ) : null}

                        {/* View */}
                        <button
                          className="row-btn view"
                          onClick={() => openDetails(l)}
                        >
                          View
                        </button>

                        {/* Next */}
                      
  <button
    className="row-btn next"
    onClick={() => handleNext(l)}
  >
    Next
  </button>

                        <button
                          title="WhatsApp"
                          className="row-btn whatsapp"
                          onClick={() => openWhatsApp(l.phone)}
                        >
                          <FontAwesomeIcon icon={faWhatsapp} />
                        </button>
                        {userRole === "superadmin" && (
                          <button
                            title="Delete Lead"
                            className="row-btn delete"
                            onClick={() => setConfirmDelete(l)}
                          >
                            🗑
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td colSpan="9">
                    <div className="table-empty">
                      No leads found.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>
      </section>

      {/* Edit drawer */}
      {showForm && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDrawer();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={handleSave}
            style={{
              width: "640px",
              maxWidth: "100%",
              height: "100%",
              background: "#ffffff",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.18)",
              padding: "28px 32px",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            {/* HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 28,
              }}
            >
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>
                {form.id ? "Edit Lead" : "New Lead"}
              </h2>

              <button
                type="button"
                onClick={closeDrawer}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fee2e2";
                  e.currentTarget.style.color = "#dc2626";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.color = "#475569";
                }}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#f1f5f9",
                  color: "#475569",
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
              >
                ✕
              </button>
            </div>

            {/* GRID */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "22px 24px",
                marginBottom: 28,
              }}
            >
              {/* Field Template */}
              {[
                { label: "Customer / Hospital", key: "customerName", required: true },
                { label: "Contact Person", key: "contactPerson", required: true },
                { label: "Phone", key: "phone", required: true },
                { label: "Email", key: "email" },
                { label: "Address / City", key: "address" },
                { label: "Lead Source", key: "leadSource" },
              ].map((field) => (
                <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                    {field.label}
                  </label>
                  <input
                    value={form[field.key]}
                    required={field.required}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [field.key]: e.target.value }))
                    }
                    style={{
                      height: 44,
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      fontSize: 14,
                    }}
                  />
                </div>
              ))}

              {/* TYPE */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Type</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  <option value="equipment">equipment</option>
                  <option value="nursing">nursing</option>
                  <option value="caretaker">caretaker</option>
                </select>
              </div>

              {/* NOTES FULL WIDTH */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 600 }}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={4}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    fontSize: 14,
                    resize: "vertical",
                  }}
                />
              </div>

              {/* STATUS */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
                  }
                  style={{
                    height: 44,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    fontSize: 14,
                  }}
                >
                  <option value="new">new</option>
                  <option value="contacted">contacted</option>
                  <option value="req shared">req shared</option>
                  <option value="lost">lost</option>
                </select>
              </div>

              {/* CREATED BY */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Created By</label>
                <input
                  value={form.createdByName || form.createdBy || ""}
                  readOnly
                  style={{
                    height: 44,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f1f5f9",
                    fontSize: 14,
                  }}
                />
                <small style={{ fontSize: 12, color: "#64748b" }}>
                  Automatically recorded
                </small>
              </div>
            </div>

            {/* ACTIONS */}
            <div
              style={{
                marginTop: "auto",
                paddingTop: 24,
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "flex-end",
                gap: 14,
              }}
            >
              <button
                type="button"
                onClick={closeDrawer}
                disabled={saving}
                style={{
                  padding: "9px 20px",
                  borderRadius: 999,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "#f8fafc";
                }}
              >
                Cancel
              </button>

              <button
                disabled={saving}
                style={{
                  padding: "8px 22px",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(135deg,#4f46e5,#6366f1)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(79,70,229,0.35)",
                }}
              >
                {saving
                  ? "Saving…"
                  : form.id
                    ? "Update Lead"
                    : "Create Lead"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Status modal */}
     {statusModal.open && statusModal.lead && (
  <div
    className="leadStatusOverlay"
    onClick={(e) => {
      if (e.target.classList.contains("leadStatusOverlay")) closeStatusModal();
    }}
  >
    <div className="leadStatusModal">

      <h3 className="leadStatusTitle">
        Change status for “{statusModal.lead.customerName}”
      </h3>

      <div className="leadStatusSection">

        <label className="leadStatusLabel">Select Outcome</label>

        {/* VALIDATION */}
        <h4 className="leadStatusHeading">Validation</h4>

        <div className="leadStatusRow">

          <button
            className={`leadStatusChip ${statusModal.validation === "valid" ? "active" : ""}`}
            onClick={() =>
              setStatusModal((s) => ({
                ...s,
                validation: "valid",
                interest: "",
                reason: "",
                action: "",
              }))
            }
          >
            Valid
          </button>

          <button
            className={`leadStatusChip ${statusModal.validation === "invalid" ? "active" : ""}`}
            onClick={() =>
              setStatusModal((s) => ({
                ...s,
                validation: "invalid",
                interest: "",
                reason: "",
                action: "",
              }))
            }
          >
            Invalid
          </button>

        </div>


        {/* INTEREST */}
        {statusModal.validation === "valid" && (
          <>
            <h4 className="leadStatusHeading">Interest</h4>

            <div className="leadStatusRow">

              <button
                className={`leadStatusChip ${statusModal.interest === "interested" ? "active" : ""}`}
                onClick={() =>
                  setStatusModal((s) => ({
                    ...s,
                    interest: "interested",
                    reason: "",
                    action: "",
                  }))
                }
              >
                Interested
              </button>

              <button
                className={`leadStatusChip ${statusModal.interest === "not interested" ? "active" : ""}`}
                onClick={() =>
                  setStatusModal((s) => ({
                    ...s,
                    interest: "not interested",
                    action: "",
                  }))
                }
              >
                Not Interested
              </button>

            </div>
          </>
        )}


        {/* REASONS */}
        {statusModal.interest === "not interested" && (
          <>
            <h4 className="leadStatusHeading">Reason</h4>

            <div className="leadStatusRow">

              <button
                className={`leadStatusChip ${statusModal.reason === "out of service" ? "active" : ""}`}
                onClick={() =>
                  setStatusModal((s) => ({ ...s, reason: "out of service" }))
                }
              >
                Out Of Service
              </button>

              <button
                className={`leadStatusChip ${statusModal.reason === "high price" ? "active" : ""}`}
                onClick={() =>
                  setStatusModal((s) => ({ ...s, reason: "high price" }))
                }
              >
                High Price
              </button>

              <button
                className={`leadStatusChip ${statusModal.reason === "out of area" ? "active" : ""}`}
                onClick={() =>
                  setStatusModal((s) => ({ ...s, reason: "out of area" }))
                }
              >
                Out Of Area
              </button>

              <button
                className={`leadStatusChip ${statusModal.reason === "urgent visit" ? "active" : ""}`}
                onClick={() =>
                  setStatusModal((s) => ({ ...s, reason: "urgent visit" }))
                }
              >
                Urgent Visit
              </button>

            </div>
          </>
        )}


        {/* NEXT ACTION */}
        {statusModal.interest === "interested" && (
          <>
            <h4 className="leadStatusHeading">Next Action</h4>

            <div className="leadStatusRow">

              <button
                className={`leadStatusChip ${statusModal.action === "req shared" ? "active" : ""}`}
                onClick={() =>
                  setStatusModal((s) => ({ ...s, action: "req shared" }))
                }
              >
                Req Shared
              </button>

              <button
                className={`leadStatusChip ${statusModal.action === "followup" ? "active" : ""}`}
                onClick={() =>
                  setStatusModal((s) => ({ ...s, action: "followup" }))
                }
              >
                Followup
              </button>

            </div>
          </>
        )}

      </div>


      {/* FOLLOWUP DATE */}
      {statusModal.action === "followup" && (
        <div className="leadStatusInputGroup">

          <label className="leadStatusLabel">Follow-up Date</label>

          <input
            type="date"
            className="leadStatusInput"
            value={statusModal.followupDate || ""}
            onChange={(e) =>
              setStatusModal((s) => ({
                ...s,
                followupDate: e.target.value,
              }))
            }
          />

        </div>
      )}


      {/* NOTE */}
      <div className="leadStatusInputGroup">

        <label className="leadStatusLabel">Note / Reason</label>

        <textarea
          className="leadStatusTextarea"
          rows={4}
          value={statusModal.note}
          onChange={(e) =>
            setStatusModal((s) => ({ ...s, note: e.target.value }))
          }
          placeholder="Enter a note explaining the status change (required)"
        />

      </div>


      {/* ACTIONS */}
      <div className="leadStatusActions">

        <button
          className="leadStatusBtn ghost"
          onClick={closeStatusModal}
        >
          Cancel
        </button>

        <button
          className="leadStatusBtn primary"
          onClick={confirmStatusChange}
          disabled={
            !(statusModal.validation ||
              statusModal.interest ||
              statusModal.reason ||
              statusModal.action) ||
            !statusModal.note.trim()
          }
        >
          Confirm
        </button>

      </div>

    </div>
  </div>
)}

      {/* Details drawer */}
      {detailsLead && (
        <div
          className="cp-drawer"
          onClick={(e) => {
            if (e.target.classList.contains("cp-drawer")) closeDetails();
          }}
        >
          <div className="cp-form details">
            <div className="cp-form-head">
              <h2>Lead Details</h2>
              <button type="button" className="cp-icon" onClick={closeDetails}>
                ✕
              </button>
            </div>

            <div className="details-grid">
              <div className="details-left">
                <div className="details-row">
                  <div className="label muted">Customer</div>
                  <div className="value strong">{detailsLead.customerName}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Contact</div>
                  <div className="value">
                    {detailsLead.contactPerson}
                    {detailsLead.email ? ` · ${detailsLead.email}` : ""}
                  </div>
                </div>

                <div className="details-row">
                  <div className="label muted">Phone</div>
                  <div className="value">{detailsLead.phone}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Address</div>
                  <div className="value">{detailsLead.address || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Notes</h3>
                  <div className="details-notes">{detailsLead.notes || "—"}</div>
                </div>
              </div>

              <div>
                <div className="details-meta">
                  <div className="meta-row">
                    <div className="label muted">Status</div>
                    <div className="value">
                      <span className={`chip ${statusClass(detailsLead.status)}`}>
                        {detailsLead.status}
                      </span>
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Lead Source</div>
                    <div className="value">{detailsLead.leadSource || "—"}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Type</div>
                    <div className="value">{detailsLead.type || "equipment"}</div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Created</div>
                    <div className="value">
                      {fmtDate(detailsLead.createdAt)} ·{" "}
                      {detailsLead.createdByName || detailsLead.createdBy || "—"}
                    </div>
                  </div>

                  <div className="meta-row">
                    <div className="label muted">Last Updated</div>
                    <div className="value">
                      {detailsLead.updatedAt
                        ? `${fmtDate(detailsLead.updatedAt)} · ${detailsLead.updatedByName || detailsLead.updatedBy
                        }`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="hr" />

            <div style={{ marginTop: 8 }}>
              <h3>Full History</h3>
              <div className="history-list" style={{ marginTop: 8 }}>
                {(detailsLead.history && detailsLead.history.length
                  ? detailsLead.history.slice().reverse()
                  : []
                ).map((h, i) => (
                  <div key={i} className="history-item">
                    <div className="meta">
                      <div className="who">
                        <span className="type">{h.type?.toUpperCase()}</span>
                        {h.field ? `${h.field}` : ""}
                      </div>
                      <div className="time muted">{fmtDate(h.ts)}</div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 700 }}>
                        {h.changedByName || h.changedBy}
                      </div>
                      {h.note ? <div className="note">{h.note}</div> : null}

                      {h.oldValue || h.newValue ? (
                        <div className="changes" style={{ marginTop: 10 }}>
                          <div className="change-pill">
                            <div className="k">From</div>
                            <div className="v">{h.oldValue ?? "—"}</div>
                          </div>
                          <div className="change-pill">
                            <div className="k">To</div>
                            <div className="v">{h.newValue ?? "—"}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(!detailsLead.history || !detailsLead.history.length) && (
                  <div className="muted" style={{ padding: 8 }}>
                    No history available.
                  </div>
                )}
              </div>
            </div>

            <div
              className="details-footer"
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                {reqByLead[detailsLead.id] ? (
                  <button
                    className="cp-btn"
                    onClick={() => {
                      setReqLead(detailsLead);
                      setTemplateReq(reqByLead[detailsLead.id]);
                      setOpenReq(true);
                    }}
                  >
                    Add another req
                  </button>
                ) : normStatus(detailsLead.status) === "req shared" ? (
                  <button
                    className="cp-btn"
                    onClick={() => {
                      setReqLead(detailsLead);
                      setTemplateReq(null);
                      setOpenReq(true);
                    }}
                  >
                    Create Requirement
                  </button>
                ) : null}
              </div>
              <div>
                <button className="cp-btn ghost" onClick={closeDetails}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requirement drawer (create new or clone from latest) */}
      {openReq && (
        <RequirementForm
          lead={
            reqLead || detailsLead || {
              id: "",
              customerName: "",
              contactPerson: "",
              phone: "",
              address: "",
            }
          }
          templateRequirement={templateReq}
          onCancel={() => {
            setOpenReq(false);
            setReqLead(null);
            setTemplateReq(null);
          }}
          onSaved={() => {
            setOpenReq(false);
            const leadToUse = reqLead || detailsLead;
            setReqLead(null);
            setTemplateReq(null);

            if (leadToUse && leadToUse.id) {
              const user = auth.currentUser || {};
              const entry = makeHistoryEntry(user, {
                type: "status",
                field: "status",
                oldValue: leadToUse.status,
                newValue: "req shared",
                note: "Requirement created and shared",
              });
              updateDoc(doc(db, "leads", leadToUse.id), {
                status: "req shared",
                updatedAt: serverTimestamp(),
                updatedBy: user.uid || "",
                updatedByName: user.displayName || user.email || "",
                history: arrayUnion(entry),
              }).catch((e) => console.error("set req shared status error", e));
            }
          }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="cp-modal">
          <div className="cp-modal-card">
            <h3>Delete lead “{confirmDelete.customerName}”?</h3>
            <p className="muted">This will permanently remove the lead.</p>
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
    </div>
  );
}
