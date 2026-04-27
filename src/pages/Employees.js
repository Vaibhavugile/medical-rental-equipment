import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,

} from "firebase/firestore";
import { db ,auth} from "../firebase";
import "./Marketing.css"; // reuse same styling

export default function Employees() {

  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingId, setEditingId] = useState(null);

const [userRole, setUserRole] = useState(null);
  const empty = {
    name: "",
    email: "",
    phone: "",
    branchId: "",
    salaryMonthly: "",
    role: "",
    active: true
  };

  const [form, setForm] = useState(empty);

  /* =========================
     LOAD EMPLOYEES
  ========================= */

 const reload = async () => {

  setLoading(true);

  const [userSnap, roleSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "roles"))
  ]);

  const WORKFORCE_ROLES = ["driver", "marketing", "staff"];

  const users = userSnap.docs
    .map(d => ({
      id: d.id,
      ...(d.data() || {})
    }))
    .filter(u => !WORKFORCE_ROLES.includes(u.role));

  setRows(users);

  setRoles(
    roleSnap.docs.map(d => ({
      id: d.id,
      ...(d.data() || {})
    }))
  );

  setLoading(false);
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
  useEffect(() => {
    reload();
  }, []);

  /* =========================
     SEARCH FILTER
  ========================= */

  const filtered = useMemo(() => {

    const q = search.toLowerCase();

    return rows.filter(r => {

      const text = [
        r.name,
        r.email,
        r.phone,
        r.branchId,
        r.role
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !q || text.includes(q);
    });

  }, [rows, search]);
 async function deleteEmployee(user) {

  if (!window.confirm("Delete this employee permanently?")) return;

  try {

    const uid = user.authUid || user.uid || user.id;

    const res = await fetch(
      "https://us-central1-medrent-5d771.cloudfunctions.net/deleteUser",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ uid })
      }
    );

    const data = await res.json();

    if (!data.success) {
      throw new Error("Delete failed");
    }

    setRows(prev => prev.filter(x => x.id !== user.id));

  } catch (err) {

    console.error(err);
    alert("Failed to delete employee");

  }

}

  /* =========================
     EDIT EMPLOYEE
  ========================= */

  const editRow = (r) => {

    setEditingId(r.id);

    setForm({
      name: r.name || "",
      email: r.email || "",
      phone: r.phone || "",
      branchId: r.branchId || "",
      salaryMonthly: r.salaryMonthly || "",
      role: r.role || "",
      active: r.active !== false
    });

    setShowDrawer(true);
  };

  /* =========================
     SAVE EMPLOYEE
  ========================= */

  const save = async (e) => {

    e.preventDefault();

    try {

      await updateDoc(doc(db, "users", editingId), {
        ...form,
        salaryMonthly: Number(form.salaryMonthly || 0),
        updatedAt: serverTimestamp()
      });

      setShowDrawer(false);
      setEditingId(null);
      setForm(empty);

      reload();

    } catch (err) {

      console.error(err);
      alert("Failed to update employee");

    }

  };

  /* =========================
     ACTIVE TOGGLE
  ========================= */

  const toggleActive = async (r) => {

    const next = !(r.active !== false);

    await updateDoc(doc(db, "users", r.id), {
      active: next,
      updatedAt: serverTimestamp()
    });

    setRows(prev =>
      prev.map(x =>
        x.id === r.id ? { ...x, active: next } : x
      )
    );
  };
const exportEmployees = () => {

  const rowsExport = filtered.map((r, i) => ({

    No: i + 1,

    Name: r.name || "",

    Email: r.email || "",

    Phone: r.phone || "",

    Branch: r.branchId || "",

    Salary: r.salaryMonthly || 0,

    Role: r.role || "",

    Active: r.active !== false ? "Active" : "Inactive"

  }));

  if (!rowsExport.length) return;

  const headers = Object.keys(rowsExport[0]);

  const escapeCSV = (v) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const csv = [
    headers.join(","),
    ...rowsExport.map(r =>
      headers.map(h => escapeCSV(r[h])).join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "employees_export.csv";
  a.click();

  URL.revokeObjectURL(url);

};
  return (
    <div className="marketing-page">

      <h2>Employees</h2>
     

      {/* Toolbar */}

      <div className="marketing-toolbar">

        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
         <button
  className="cp-btn ghost"
  onClick={exportEmployees}
>
  Export
</button>
        

      </div>

      {/* Drawer */}

      {showDrawer && (
        <div
          className="drawer-overlay"
          onClick={() => setShowDrawer(false)}
        />
      )}

      <div className={`drawer ${showDrawer ? "open" : ""}`}>

        <div className="drawer-header">

          <h3>Edit Employee</h3>

          <button
            className="cp-btn ghost"
            onClick={() => setShowDrawer(false)}
          >
            Close
          </button>

        </div>

        <form onSubmit={save} className="marketing-form">

          <input
            type="text"
            placeholder="Full Name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
          />

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <input
            type="text"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) =>
              setForm({ ...form, phone: e.target.value })
            }
          />

          <input
            type="text"
            placeholder="Branch"
            value={form.branchId}
            onChange={(e) =>
              setForm({ ...form, branchId: e.target.value })
            }
          />

          <input
            type="number"
            placeholder="Monthly Salary (₹)"
            value={form.salaryMonthly}
            onChange={(e) =>
              setForm({ ...form, salaryMonthly: e.target.value })
            }
          />

          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value })
            }
          >
            <option value="">No role</option>

            {roles.map(r => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}

          </select>

          <label className="switch-row">

            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm({
                  ...form,
                  active: e.target.checked
                })
              }
            />

            Active

          </label>

          <div className="actions-row">

            <button className="cp-btn" type="submit">
              Save
            </button>

            <button
              type="button"
              className="cp-btn ghost"
              onClick={() => setShowDrawer(false)}
            >
              Cancel
            </button>

          </div>

        </form>

      </div>

      {/* Table */}

      <div className="marketing-table">

        {loading ? (

          <p>Loading employees...</p>

        ) : (

          <table>

            <thead>

              <tr>
                  <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Branch</th>
                <th>Salary</th>
                <th>Role</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>

            </thead>

            <tbody>

              {filtered.map((r, i) => (

<tr key={r.id}>

  <td>{i + 1}</td>
                  

                  <td>{r.name || "-"}</td>
                  <td>{r.email || "-"}</td>
                  <td>{r.phone || "-"}</td>
                  <td>{r.branchId || "-"}</td>
                  <td>₹{r.salaryMonthly || 0}</td>
                  <td>{r.role || "-"}</td>

                  <td>

                    <button
                      className="cp-btn ghost"
                      onClick={() => toggleActive(r)}
                    >
                      {r.active !== false ? "Active" : "Inactive"}
                    </button>

                  </td>

                  <td>

                    <div className="marketing-actions">

                      <button
                        className="mk-btn edit"
                        onClick={() => editRow(r)}
                      >
                        Edit
                      </button>

                      <button
                        className="mk-btn attendance"
                        onClick={() =>
                          window.location.href =
                            `/crm/attendance?role=users&driverId=${r.id}`
                        }
                      >
                        Attendance
                      </button>

                      <button
                        className="mk-btn track"
                        onClick={() =>
                          window.location.href =
                            `/crm/tracking?role=users&driverId=${r.id}`
                        }
                      >
                        Track
                      </button>
                      {userRole === "superadmin" && (
                       <button
    className="mk-btn delete"
    onClick={() => deleteEmployee(r)}
  >
    Delete
  </button>
)}
                    </div>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        )}

      </div>

    </div>
  );
}