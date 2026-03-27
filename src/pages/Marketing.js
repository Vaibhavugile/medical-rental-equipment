// Marketing.js — Marketing Management (drawer UI like Drivers)
import React, { useEffect, useMemo, useState } from "react";
import {
  collection, addDoc, getDocs, updateDoc, setDoc, doc,
  serverTimestamp, deleteDoc, query, orderBy,where,onSnapshot
} from "firebase/firestore";
import { db ,auth} from "../firebase";
import "./Marketing.css";

export default function Marketing() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [showForm, setShowForm] = useState(false); // drawer
  const [editingId, setEditingId] = useState(null);
const [userRole, setUserRole] = useState(null);
  const empty = {
  name: "",
  loginEmail: "",
  phone: "",
  branchId: "",
  salaryMonthly: "",
  active: true,
  authUid: "",
};
  const [form, setForm] = useState(empty);

  // Load all marketing users
  const reload = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "marketing"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
    } catch (err) {
      console.error("fetch marketing", err);
      setError("Failed to load marketing users.");
    } finally {
      setLoading(false);
    }
  };
useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
    if (docSnap.exists()) {
      setUserRole(docSnap.data().role);
    }
  });

  return () => unsub();
}, []);
  useEffect(() => { reload(); }, []);

  // Drawer: auto-open when editing
  useEffect(() => { if (editingId) setShowForm(true); }, [editingId]);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setShowForm(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
const emailExists = async (email) => {

  const marketingQuery = query(
    collection(db, "marketing"),
    where("loginEmail", "==", email)
  );

  const staffQuery = query(
    collection(db, "staff"),
    where("loginEmail", "==", email)
  );

  const usersQuery = query(
    collection(db, "users"),
    where("email", "==", email)
  );

  const [marketingSnap, staffSnap, usersSnap] = await Promise.all([
    getDocs(marketingQuery),
    getDocs(staffQuery),
    getDocs(usersQuery)
  ]);

  return (
    !marketingSnap.empty ||
    !staffSnap.empty ||
    !usersSnap.empty
  );
};
  // Validate & normalize
  const validate = (p) => {

  /* NAME */
  if (!p.name.trim()) return "Name is required";
  if (!/^[A-Za-z\s]{3,50}$/.test(p.name))
    return "Name should contain only letters and spaces";

  /* EMAIL */
  if (!p.loginEmail.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.loginEmail))
    return "Invalid email format";

  /* PHONE */
  if (p.phone && !/^[6-9]\d{9}$/.test(p.phone))
    return "Invalid Indian phone number";

  /* BRANCH */
  if (p.branchId && p.branchId.length < 2)
    return "Branch ID too short";

  /* SALARY */
  if (p.salaryMonthly && p.salaryMonthly < 0)
    return "Salary cannot be negative";

  if (p.salaryMonthly && p.salaryMonthly > 500000)
    return "Salary seems unrealistic";

  return "";
};

  const normalize = (p) => ({
  name: p.name.trim(),
  loginEmail: p.loginEmail.trim().toLowerCase(),
  phone: p.phone.trim(),
  branchId: p.branchId.trim(),
  salaryMonthly: Number(p.salaryMonthly || 0),
  active: !!p.active,
  authUid: p.authUid.trim(),
  role: "marketing",
  updatedAt: serverTimestamp(),
});

  // Save (add or update)
  const save = async (e) => {

  e.preventDefault();
  setError("");

  const payload = normalize(form);

  const msg = validate(payload);
  if (msg) return setError(msg);

  try {

    /* CHECK DUPLICATE EMAIL */
    if (!editingId) {
      const exists = await emailExists(payload.loginEmail);

      if (exists) {
        setError("This email already exists in the system.");
        return;
      }
    }

    if (editingId) {

      await updateDoc(doc(db, "marketing", editingId), payload);

    } else {

      if (payload.authUid) {

        await setDoc(
          doc(db, "marketing", payload.authUid),
          {
            ...payload,
            uid: payload.authUid,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

      } else {

        await addDoc(collection(db, "marketing"), {
          ...payload,
          createdAt: serverTimestamp(),
        });

      }

    }

    setForm(empty);
    setEditingId(null);
    setShowForm(false);
    await reload();

  } catch (err) {

    console.error("save marketing", err);
    setError("Failed to save marketing user.");

  }

};

  const editRow = (r) => {
    setEditingId(r.id);
   setForm({
  name: r.name || "",
  loginEmail: r.loginEmail || r.email || "",
  phone: r.phone || "",
  branchId: r.branchId || "",
  salaryMonthly: r.salaryMonthly || "",
  active: r.active !== false,
  authUid: r.uid || r.authUid || "",
});
  };

 const deleteRow = async (user) => {

  if (!window.confirm("Delete this marketing user permanently?")) return;

  try {

    const res = await fetch(
      "https://us-central1-medrent-5d771.cloudfunctions.net/deleteUser",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uid: user.authUid || user.uid || user.id
        })
      }
    );

    const data = await res.json();

    console.log("delete response", data);

    setRows(prev => prev.filter(x => x.id !== user.id));

  } catch (err) {

    console.error(err);
    alert("Failed to delete marketing user");

  }

};
const handleEnter = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();

    const form = e.target.form;
    const index = Array.prototype.indexOf.call(form, e.target);

    if (form.elements[index + 1]) {
      form.elements[index + 1].focus();
    }
  }
};

  // Quick toggle active
  const toggleActive = async (r, next) => {
    try {
      await updateDoc(doc(db, "marketing", r.id), {
        active: next,
        updatedAt: serverTimestamp(),
      });
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, active: next } : x));
    } catch (err) {
      console.error("toggle active", err);
      setError("Failed to update active flag.");
    }
  };

  // Filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const text = [r.name, r.loginEmail, r.phone, r.branchId, r.uid]
        .filter(Boolean).join(" ").toLowerCase();
      const qOk = !q || text.includes(q);
      const aOk =
        activeFilter === "all" ? true :
        activeFilter === "active" ? r.active !== false :
        r.active === false;
      return qOk && aOk;
    });
  }, [rows, search, activeFilter]);

  return (
    <div className="marketing-page">
      <h2>Marketing Management</h2>

      {/* Toolbar */}
      <div className="marketing-toolbar">
        <input
          type="text"
          placeholder="Search by name, phone, email, branch, uid…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          title="Filter by active"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          className="cp-btn add-btn"
          type="button"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(empty);
          }}
        >
          Add Marketing
        </button>
      </div>

      {/* Mobile FAB */}
      <button className="fab-add" aria-label="Add Marketing" onClick={() => setShowForm(true)}>+</button>

      {/* Drawer */}
      {showForm && <div className="drawer-overlay" onClick={() => setShowForm(false)} />}
      <div className={`drawer ${showForm ? "open" : ""}`}>
        <div className="drawer-header">
          <h3>{editingId ? "Edit Marketing" : "Add Marketing"}</h3>
          <button className="cp-btn ghost" type="button" onClick={() => setShowForm(false)}>Close</button>
        </div>

        <form onSubmit={save} className="marketing-form" onKeyDown={handleEnter}>
          <input
            type="text" placeholder="Full Name *"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
          />
          <input
            type="email" placeholder="Login Email *"
            value={form.loginEmail} onChange={(e) => setForm({ ...form, loginEmail: e.target.value })} required
          />
          <input
            type="text" placeholder="Phone"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            type="text" placeholder="Branch ID"
            value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}
          />
          <input
  type="number"
  placeholder="Monthly Salary (₹)"
  value={form.salaryMonthly || ""}
  onChange={(e) =>
    setForm({ ...form, salaryMonthly: e.target.value })
  }
/>
          <input
            type="text" placeholder="Auth UID (optional)"
            value={form.authUid} onChange={(e) => setForm({ ...form, authUid: e.target.value })}
            title="If you already created the Firebase Auth user, paste the UID to make the doc id match."
          />

          <label className="switch-row">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>

          <div className="actions-row">
            <button className="cp-btn" type="submit">
              {editingId ? "Update" : "Add Marketing"}
            </button>
            <button type="button" className="cp-btn ghost"
              onClick={() => { setEditingId(null); setForm(empty); setShowForm(false); }}>
              Cancel
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </form>
      </div>

      {/* Table */}
      <div className="marketing-table">
        {loading ? (
          <p>Loading marketing users…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Login Email</th>
                <th>Phone</th>
                <th>Branch</th>
                <th>Salary</th>
                <th>Active</th>
                <th>UID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.name || "-"}</td>
                  <td>{r.loginEmail || r.email || "-"}</td>
                  <td>{r.phone || "-"}</td>
                  <td>{r.branchId || "-"}</td>
<td>₹{r.salaryMonthly || 0}</td>
<td style={{whiteSpace:'nowrap'}}>
                    <button className="cp-btn ghost" onClick={() => toggleActive(r, !(r.active !== false))}>
                      {r.active !== false ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>
                    {r.uid || r.authUid || r.id}
                  </td>
     <td>
  <div className="marketing-actions">

    <button className="mk-btn edit" onClick={() => editRow(r)}>
      Edit
    </button>
{userRole === "superadmin" && (
    <button className="mk-btn delete" onClick={() => deleteRow(r)}>
      Delete
    </button>
)}

    <button
      className="mk-btn attendance"
      onClick={() =>
        window.location.href = `/crm/attendance?role=marketing&driverId=${r.id}`
      }
    >
      Attendance
    </button>

    <button
      className="mk-btn track"
      onClick={() =>
        window.location.href = `/crm/tracking?role=marketing&driverId=${r.id}`
      }
    >
      Track
    </button>

  </div>
</td>

                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{padding:12}}>No records.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
