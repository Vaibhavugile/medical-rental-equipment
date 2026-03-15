import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./roles-users.css";

/* =========================
   SIDEBAR PERMISSIONS
========================= */
const SIDEBAR_OPTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "requirements", label: "Requirements" },
  { key: "quotations", label: "Quotations" },
  { key: "orders", label: "Orders" },
  { key: "nursing_orders", label: "Nursing Orders" },
  { key: "staff", label: "Staff" },
  { key: "nurses", label: "Nurses" },
  { key: "caretakers", label: "Caretakers" },

  { key: "marketing", label: "Marketing" },
  { key: "runners", label: "Runners" },
  { key: "payroll", label: "Payroll" },
  { key: "caretakers_report", label: "Caretakers Report" },
  { key: "reports", label: "Reports" },
 
    { key: "Nurse_caretakerpay", label: "Nurse Caretaker Basepay" },

    { key: "Payment_Increase_Request", label: "Payment Increase Requests" },
  { key: "caretaker-orders", label: "Caretaker Orders" },

  { key: "branches", label: "Branches" },
  { key: "inventory", label: "Inventory" },
  { key: "tracking", label: "Tracking" },
  { key: "visits", label: "Visits" },
  {key:"appointments",label: "Appointments"},
  { key: "roles_users", label: "Roles & Users" },
];

export default function RolesUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* 🔍 Search */
  const [userSearch, setUserSearch] = useState("");

  /* Drawer */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  const [roleId, setRoleId] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [roleSidebar, setRoleSidebar] = useState([]);

  /* =========================
     LOAD USERS & ROLES
  ========================= */
  useEffect(() => {
    const load = async () => {
      const [userSnap, roleSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "roles")),
      ]);

      setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRoles(
        roleSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => !r.deleted)
      );

      setLoading(false);
    };

    load();
  }, []);

  /* =========================
     DERIVED DATA
  ========================= */
  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  });

  const usersByRole = useMemo(() => {
    const map = {};
    users.forEach(u => {
      const r = u.role || "none";
      map[r] = (map[r] || 0) + 1;
    });
    return map;
  }, [users]);

  /* =========================
     USER ROLE UPDATE
  ========================= */
  const updateUserRole = async (userId, role) => {
    if (!userId) return;

    try {
      setSaving(true);

      await updateDoc(doc(db, "users", userId), {
        role: role || null,
        updatedAt: new Date(),
      });

      setUsers(prev =>
        prev.map(u =>
          u.id === userId ? { ...u, role } : u
        )
      );
    } catch (err) {
      console.error("Failed to update role", err);
      alert(err.message || "Permission denied");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     ROLE DRAWER
  ========================= */
  const openCreateDrawer = () => {
    setEditingRole(null);
    setRoleId("");
    setRoleLabel("");
    setRoleSidebar([]);
    setDrawerOpen(true);
  };

  const openEditDrawer = (role) => {
    setEditingRole(role);
    setRoleId(role.id);
    setRoleLabel(role.label || "");
    setRoleSidebar(role.sidebar || []);
    setDrawerOpen(true);
  };

  /* =========================
     SAVE ROLE
  ========================= */
  const saveRole = async () => {
    if (!roleId || !roleLabel) {
      alert("Role ID and Label required");
      return;
    }

    try {
      setSaving(true);

      await setDoc(
        doc(db, "roles", roleId),
        {
          label: roleLabel,
          sidebar: roleSidebar,
          system: editingRole?.system || false,
        },
        { merge: true }
      );

      setRoles(prev => {
        const exists = prev.find(r => r.id === roleId);
        if (exists) {
          return prev.map(r =>
            r.id === roleId
              ? { ...r, label: roleLabel, sidebar: roleSidebar }
              : r
          );
        }
        return [...prev, { id: roleId, label: roleLabel, sidebar: roleSidebar }];
      });

      setDrawerOpen(false);
    } catch (e) {
      alert("Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     DELETE ROLE (SAFE)
  ========================= */
  const deleteRole = async (role) => {
    if (role.system) {
      alert("System roles cannot be deleted");
      return;
    }

    const used = users.some(u => u.role === role.id);
    if (used) {
      alert("This role is assigned to users. Remove it from users first.");
      return;
    }

    if (!window.confirm(`Delete role "${role.label}"?`)) return;

    try {
      setSaving(true);

      await updateDoc(doc(db, "roles", role.id), {
        deleted: true,
      });

      setRoles(prev => prev.filter(r => r.id !== role.id));
    } catch (e) {
      alert("Failed to delete role");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page">Loading…</div>;

  return (
    <div className="page">
      <h1>Roles & Users</h1>

      {/* ================= SUMMARY ================= */}
      <div className="ru-summary">
        <div className="ru-card">
          <div className="ru-value">{users.length}</div>
          <div className="ru-label">Users</div>
        </div>

        <div className="ru-card">
          <div className="ru-value">{roles.length}</div>
          <div className="ru-label">Roles</div>
        </div>

        <div className="ru-card">
          <div className="ru-value">{usersByRole.none || 0}</div>
          <div className="ru-label">Unassigned</div>
        </div>
      </div>

      {/* ================= ROLES ================= */}
      <div className="ru-header">
        <h2>Roles</h2>
        <button className="cp-btn" onClick={openCreateDrawer}>
          + Add Role
        </button>
      </div>

      <table className="cp-table">
        <thead>
          <tr>
            <th>Role ID</th>
            <th>Label</th>
            <th>Sidebar Access</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roles.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.label}</td>
              <td>
                <span className="ru-badge">
                  {(r.sidebar || []).length} items
                </span>
              </td>
              <td className="ru-actions">
                <button className="cp-link" onClick={() => openEditDrawer(r)}>
                  Edit
                </button>
                {!r.system && (
                  <button
                    className="cp-link danger"
                    onClick={() => deleteRole(r)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ================= USERS ================= */}
      <h2 style={{ marginTop: 32 }}>Users</h2>

      <div className="ru-toolbar">
        <input
          className="cp-input"
          placeholder="Search users by name or email…"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
      </div>

      <table className="cp-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map(u => (
            <tr key={u.id}>
              <td>{u.name || "—"}</td>
              <td>{u.email || "—"}</td>
              <td>
                <select
                  value={u.role || ""}
                  disabled={saving}
                  onChange={(e) =>
                    updateUserRole(u.id, e.target.value)
                  }
                >
                  <option value="">No role</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ================= DRAWER ================= */}
      {drawerOpen && (
        <div className="cp-drawer" onClick={() => setDrawerOpen(false)}>
          <div
            className="cp-form"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420 }}
          >
            <h3>{editingRole ? "Edit Role" : "Create Role"}</h3>

            <div className="label">Role ID</div>
            <input
              className="cp-input"
              disabled={!!editingRole}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            />

            <div className="label">Label</div>
            <input
              className="cp-input"
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
            />

            <div className="label">Sidebar Access</div>
            <div className="ru-checkbox-grid">
              {SIDEBAR_OPTIONS.map(opt => (
               <label key={opt.key} className="ru-check">
  <input
    type="checkbox"
    checked={roleSidebar.includes(opt.key)}
    onChange={(e) =>
      setRoleSidebar(prev =>
        e.target.checked
          ? [...prev, opt.key]
          : prev.filter(x => x !== opt.key)
      )
    }
  />
  <span className="ru-check-box" />
  <span className="ru-check-label">{opt.label}</span>
</label>

              ))}
            </div>

            <div className="ru-actions">
              <button className="cp-btn" onClick={saveRole} disabled={saving}>
                Save
              </button>
              <button className="cp-btn ghost" onClick={() => setDrawerOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
