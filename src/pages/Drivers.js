// src/pages/Drivers.js — Drawer version
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
    where,query,onSnapshot
} from "firebase/firestore";
import { db ,auth} from "../firebase";
import "./Drivers.css";
import { useNavigate } from "react-router-dom";
/**
 * Drivers Management Module (Eqp Rental) — Side Drawer UI
 */
export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false); // drawer toggle
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  const emptyDriver = {
    name: "",
    phone: "",
    vehicle: "",
    loginEmail: "",
    status: "available",
    salary: "",
    salaryPeriod: "monthly",
    joinDate: "",
    licenseNumber: "",
    licenseExpiry: "",
    shift: "day",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
  };

  const [newDriver, setNewDriver] = useState(emptyDriver);

  // Fetch all drivers
  useEffect(() => {
    const fetchDrivers = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "drivers"));
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setDrivers(rows);
      } catch (err) {
        console.error("Error fetching drivers", err);
        setError("Failed to load drivers");
      } finally {
        setLoading(false);
      }
    };
    fetchDrivers();
  }, []);
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
  // Open the form automatically when editing
  useEffect(() => {
    if (editingId) setShowForm(true);
  }, [editingId]);

  // Close drawer on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowForm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Helpers
  const toCurrency = (val) => {
    if (val === undefined || val === null || val === "") return "-";
    const num = Number(val);
    if (Number.isNaN(num)) return String(val);
    try {
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } catch {
      return String(num);
    }
  };
  const emailExists = async (email) => {

  const driversQuery = query(
    collection(db, "drivers"),
    where("loginEmail", "==", email)
  );

  const staffQuery = query(
    collection(db, "staff"),
    where("loginEmail", "==", email)
  );

  const marketingQuery = query(
    collection(db, "marketing"),
    where("loginEmail", "==", email)
  );

  const usersQuery = query(
    collection(db, "users"),
    where("email", "==", email)
  );

  const [driversSnap, staffSnap, marketingSnap, usersSnap] =
    await Promise.all([
      getDocs(driversQuery),
      getDocs(staffQuery),
      getDocs(marketingQuery),
      getDocs(usersQuery),
    ]);

  return (
    !driversSnap.empty ||
    !staffSnap.empty ||
    !marketingSnap.empty ||
    !usersSnap.empty
  );
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

 const validate = (payload) => {

  /* NAME */
  if (!payload.name.trim())
    return "Name is required";

  if (!/^[A-Za-z\s]{3,50}$/.test(payload.name))
    return "Name should contain only letters";

  /* EMAIL */
  if (!payload.loginEmail.trim())
    return "Email is required";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.loginEmail))
    return "Invalid email format";

  /* PHONE */
  if (payload.phone && !/^[6-9]\d{9}$/.test(payload.phone))
    return "Invalid Indian phone number";

  /* SALARY */
  if (payload.salary !== "" && payload.salary < 0)
    return "Salary cannot be negative";

  if (payload.salary > 500000)
    return "Salary seems unrealistic";

  /* LICENSE */
  if (payload.licenseNumber && payload.licenseNumber.length < 5)
    return "License number too short";

  if (
    payload.licenseExpiry &&
    payload.joinDate &&
    payload.licenseExpiry < payload.joinDate
  )
    return "License expiry cannot be before join date";

  /* EMERGENCY CONTACT */
  if (
    payload.emergencyContactPhone &&
    !/^[6-9]\d{9}$/.test(payload.emergencyContactPhone)
  )
    return "Invalid emergency contact phone";

  return "";
};

  // Add or update driver
  const saveDriver = async (e) => {
    e.preventDefault();
    setError("");

    const normalized = {
      ...newDriver,
      name: newDriver.name.trim(),
      phone: newDriver.phone.trim(),
      vehicle: newDriver.vehicle.trim(),
      loginEmail: newDriver.loginEmail.trim().toLowerCase(),
      status: newDriver.status || "available",
      salary: newDriver.salary === "" ? "" : Number(newDriver.salary),
      salaryPeriod: newDriver.salaryPeriod || "monthly",
      joinDate: newDriver.joinDate || "",
      licenseNumber: newDriver.licenseNumber.trim(),
      licenseExpiry: newDriver.licenseExpiry || "",
      shift: newDriver.shift || "day",
      address: newDriver.address.trim(),
      emergencyContactName: newDriver.emergencyContactName.trim(),
      emergencyContactPhone: newDriver.emergencyContactPhone.trim(),
      notes: newDriver.notes.trim(),
      updatedAt: serverTimestamp(),
    };

    const msg = validate(normalized);
    if (msg) {
      setError(msg);
      return;
    }
    if (!editingId) {

  const exists = await emailExists(normalized.loginEmail);

  if (exists) {
    setError("This email already exists in the system.");
    return;
  }

}

    try {
      if (editingId) {
        await updateDoc(doc(db, "drivers", editingId), normalized);
      } else {
        await addDoc(collection(db, "drivers"), {
          ...normalized,
          createdAt: serverTimestamp(),
        });
      }

      // reset form
      setNewDriver(emptyDriver);
      setEditingId(null);
      setShowForm(false);

      // reload
      const snap = await getDocs(collection(db, "drivers"));
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
    } catch (err) {
      console.error("saveDriver", err);
      setError("Failed to save driver.");
    }
  };

  const editDriver = (driver) => {
    setEditingId(driver.id);
    setNewDriver({
      ...emptyDriver,
      ...driver,
      salary: driver.salary === undefined || driver.salary === null ? "" : driver.salary,
    });
  };

  const deleteDriverById = async (driver) => {

  if (!window.confirm("Delete this driver permanently?")) return;

  try {

    const uid = driver.authUid;
const docId = driver.id;

const res = await fetch(
  "https://us-central1-medrent-5d771.cloudfunctions.net/deleteUser",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      uid,
      docId
    })
  }
);

if (!res.ok) {
  throw new Error("Delete failed");
}

    setDrivers(prev =>
      prev.filter(d => d.id !== driver.id)
    );

  } catch (err) {

    console.error("deleteDriver", err);
    setError("Failed to delete driver.");

  }

};

  // Filtering & search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      const matchText = [
        d.name,
        d.phone,
        d.loginEmail,
        d.vehicle,
        d.licenseNumber,
        d.address,
        d.emergencyContactName,
        d.emergencyContactPhone,
        d.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const statusOk = statusFilter === "all" ? true : (d.status || "").toLowerCase() === statusFilter;
      const queryOk = !q || matchText.includes(q);
      return statusOk && queryOk;
    });
  }, [drivers, search, statusFilter]);
const exportDrivers = () => {

  const rows = filtered.map((d, i) => ({

    No: i + 1,

    Name: d.name || "",

    Phone: d.phone || "",

    Vehicle: d.vehicle || "",

    Status: d.status || "",

    Salary:
      d.salary === "" || d.salary === undefined
        ? ""
        : `${d.salary}/${d.salaryPeriod || ""}`,

    Shift: d.shift || "",

    Email: d.loginEmail || "",

    JoinDate: d.joinDate || "",

    LicenseNumber: d.licenseNumber || "",

    LicenseExpiry: d.licenseExpiry || "",

    Address: d.address || "",

    EmergencyContactName: d.emergencyContactName || "",

    EmergencyContactPhone: d.emergencyContactPhone || ""

  }));

  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const escapeCSV = (v) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => escapeCSV(r[h])).join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "drivers_export.csv";
  a.click();

  URL.revokeObjectURL(url);

};
  return (
    <div className="drivers-page">
      <h2>Runners Management</h2>

      {/* Toolbar */}
      <div className="drivers-toolbar">
        <input
          type="text"
          placeholder="Search by name, phone, email, license, address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          title="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </select>
        <div className="leads-header-actions">
        <button
          className="cp-btn ghost"
          type="button"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setNewDriver(emptyDriver);
          }}
        >
          Add Driver
        </button>
        <button
  className="cp-btn ghost"
  onClick={exportDrivers}
>
  Export
</button>
</div>
      </div>

      {/* Floating add button for mobile */}
      <button
        className="fab-add"
        aria-label="Add Driver"
        onClick={() => setShowForm(true)}
      >
        +
      </button>

      {/* Drawer & Overlay */}
      {showForm && <div className="drawer-overlay" onClick={() => setShowForm(false)} />}
      <div className={`drawer ${showForm ? "open" : ""}`}>
        <div className="drawer-header">
          <h3>{editingId ? "Edit Driver" : "Add Driver"}</h3>
          <button className="cp-btn ghost" type="button" onClick={() => setShowForm(false)}>Close</button>
        </div>
        <form onSubmit={saveDriver} className="driver-form" onKeyDown={handleEnter}>
          <div className="grid-cols">
            <input type="text" placeholder="Full Name *" value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} required />
            <input type="email" placeholder="Login Email *" value={newDriver.loginEmail} onChange={(e) => setNewDriver({ ...newDriver, loginEmail: e.target.value })} required />
            <input type="text" placeholder="Phone" value={newDriver.phone} onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })} />
            <input type="text" placeholder="Vehicle / Equipment" value={newDriver.vehicle} onChange={(e) => setNewDriver({ ...newDriver, vehicle: e.target.value })} />

            <select value={newDriver.status} onChange={(e) => setNewDriver({ ...newDriver, status: e.target.value })} title="Current availability">
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>

            <div className="field-group">
              <input type="number" step="0.01" min="0" placeholder="Salary (base)" value={newDriver.salary} onChange={(e) => setNewDriver({ ...newDriver, salary: e.target.value })} />
              <select value={newDriver.salaryPeriod} onChange={(e) => setNewDriver({ ...newDriver, salaryPeriod: e.target.value })} title="Salary period">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <input type="date" placeholder="Join Date" value={newDriver.joinDate} onChange={(e) => setNewDriver({ ...newDriver, joinDate: e.target.value })} />
            <input type="text" placeholder="License Number" value={newDriver.licenseNumber} onChange={(e) => setNewDriver({ ...newDriver, licenseNumber: e.target.value })} />
            <input type="date" placeholder="License Expiry" value={newDriver.licenseExpiry} onChange={(e) => setNewDriver({ ...newDriver, licenseExpiry: e.target.value })} />
            <select value={newDriver.shift} onChange={(e) => setNewDriver({ ...newDriver, shift: e.target.value })} title="Preferred Shift">
              <option value="day">Day</option>
              <option value="night">Night</option>
              <option value="rotational">Rotational</option>
            </select>

            <input type="text" placeholder="Address" value={newDriver.address} onChange={(e) => setNewDriver({ ...newDriver, address: e.target.value })} />
            <input type="text" placeholder="Emergency Contact Name" value={newDriver.emergencyContactName} onChange={(e) => setNewDriver({ ...newDriver, emergencyContactName: e.target.value })} />
            <input type="text" placeholder="Emergency Contact Phone" value={newDriver.emergencyContactPhone} onChange={(e) => setNewDriver({ ...newDriver, emergencyContactPhone: e.target.value })} />
            <input type="text" placeholder="Notes" value={newDriver.notes} onChange={(e) => setNewDriver({ ...newDriver, notes: e.target.value })} />
          </div>

          <div className="actions-row">
            <button className="cp-btn" type="submit">{editingId ? "Update Driver" : "Add Driver"}</button>
            <button type="button" className="cp-btn ghost" onClick={() => { setEditingId(null); setNewDriver(emptyDriver); setShowForm(false); }}>Cancel</button>
          </div>
        </form>
      </div>

      <div className="drivers-table">
        
        {loading ? (
          <p>Loading drivers…</p>
        ) : (
          <table>
          <thead>
  <tr>
    <th>#</th>
    <th>Name</th>
    <th>Phone</th>
    <th>Vehicle</th>
    <th>Status</th>
    <th>Salary</th>
    <th>Shift</th>
    <th>Actions</th>
  </tr>
</thead>
            <tbody>
              {filtered.map((d,i) => (
                <tr key={d.id}>
                    <td>{i + 1}</td>
  <td className="driver-name">
    {d.name || "-"}
  </td>

  <td>{d.phone || "-"}</td>

  <td>{d.vehicle || "-"}</td>

  <td>
    <span className={`status-badge ${(d.status || "").toLowerCase()}`}>
      {d.status || "-"}
    </span>
  </td>

  <td>
    {d.salary === "" || d.salary === undefined
      ? "-"
      : `₹${toCurrency(d.salary)}/${d.salaryPeriod || ""}`}
  </td>

  <td style={{ textTransform: "capitalize" }}>
    {d.shift || "-"}
  </td>

  <td>
    <div className="driver-actions">

      <button
        className="dr-btn edit"
        onClick={() => editDriver(d)}
      >
        Edit
      </button>
{userRole === "superadmin" && (
      <button
        className="dr-btn delete"
        onClick={() => deleteDriverById(d)}
      >
        Delete
      </button>
      )}

      <button
        className="dr-btn attendance"
        onClick={() => navigate(`/crm/attendance?driverId=${d.id}`)}
      >
        Attendance
      </button>

    </div>
  </td>
</tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Tip: Salary is a base figure. If you track per-trip/per-hour allowances or bonuses, store them in Jobs/Trips and compute payouts in reports.
      </p>
    </div>
  );
}
