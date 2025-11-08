// Marketing.js — Marketing Management (drawer UI like Drivers)
import React, { useEffect, useMemo, useState } from "react";
import {
  collection, addDoc, getDocs, updateDoc, setDoc, doc,
  serverTimestamp, deleteDoc, query, orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import "./Marketing.css";

export default function Marketing() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [showForm, setShowForm] = useState(false); // drawer
  const [editingId, setEditingId] = useState(null);

  const empty = {
    name: "",
    loginEmail: "",
    phone: "",
    branchId: "",
    active: true,
    authUid: "", // optional; if provided we will set doc id to this
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

  useEffect(() => { reload(); }, []);

  // Drawer: auto-open when editing
  useEffect(() => { if (editingId) setShowForm(true); }, [editingId]);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setShowForm(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Validate & normalize
  const validate = (p) => {
    if (!p.name.trim()) return "Name is required.";
    if (!p.loginEmail.trim()) return "Email is required.";
    const email = p.loginEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email.";
    return "";
  };

  const normalize = (p) => ({
    name: p.name.trim(),
    loginEmail: p.loginEmail.trim().toLowerCase(),
    phone: p.phone.trim(),
    branchId: p.branchId.trim(),
    active: !!p.active,
    authUid: p.authUid.trim(),   // optional
    role: "marketing",
    updatedAt: serverTimestamp(),
  });

  // Save (add or update)
  const save = async (e) => {
    e.preventDefault();
    setError("");

    const n = normalize(form);
    const msg = validate(n);
    if (msg) return setError(msg);

    try {
      if (editingId) {
        // Update existing
        await updateDoc(doc(db, "marketing", editingId), n);
      } else {
        if (n.authUid) {
          // Create/overwrite doc with provided Auth UID (so the app can route by uid immediately)
          await setDoc(doc(db, "marketing", n.authUid), {
            ...n,
            uid: n.authUid,
            createdAt: serverTimestamp(),
          }, { merge: true });
        } else {
          // Normal add (docId auto). You can fill authUid later after user signs in.
          await addDoc(collection(db, "marketing"), {
            ...n,
            createdAt: serverTimestamp(),
          });
        }
      }

      // Reset & reload
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
      active: r.active !== false,
      authUid: r.uid || r.authUid || "",
    });
  };

  const deleteRow = async (id) => {
    if (!window.confirm("Delete this marketing user?")) return;
    try {
      await deleteDoc(doc(db, "marketing", id));
      setRows((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error("delete marketing", err);
      setError("Failed to delete marketing user.");
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

        <form onSubmit={save} className="marketing-form">
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
                  <td style={{whiteSpace:'nowrap'}}>
                    <button className="cp-btn ghost" onClick={() => toggleActive(r, !(r.active !== false))}>
                      {r.active !== false ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>
                    {r.uid || r.authUid || r.id}
                  </td>
                  <td>
  <button className="cp-btn ghost" onClick={() => editRow(r)}>Edit</button>
  <button className="cp-btn ghost" onClick={() => deleteRow(r.id)}>Delete</button>

  {/* NEW: Attendance + Track (marketing) */}
  <button
    className="cp-btn ghost"
    onClick={() => window.location.href = `/attendance?role=marketing&driverId=${r.id}`}
  >
    Attendance
  </button>
  <button
    className="cp-btn ghost"
    onClick={() => window.location.href = `/tracking?role=marketing&driverId=${r.id}`}
  >
    Track
  </button>
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
