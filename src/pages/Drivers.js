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
} from "firebase/firestore";
import { db } from "../firebase";
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

  const validate = (payload) => {
    if (!payload.name.trim()) return "Name is required.";
    if (!payload.loginEmail.trim()) return "Email is required.";
    const email = payload.loginEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email.";
    if (payload.salary !== "" && Number(payload.salary) < 0) return "Salary cannot be negative.";
    if (payload.licenseExpiry && payload.joinDate && payload.licenseExpiry < payload.joinDate) {
      return "License expiry cannot be before join date.";
    }
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

  const deleteDriverById = async (id) => {
    if (!window.confirm("Delete this driver?")) return;
    try {
      await deleteDoc(doc(db, "drivers", id));
      setDrivers((prev) => prev.filter((d) => d.id !== id));
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

  return (
    <div className="drivers-page">
      <h2>Drivers Management</h2>

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
        <button
          className="cp-btn add-btn"
          type="button"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setNewDriver(emptyDriver);
          }}
        >
          Add Driver
        </button>
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
        <form onSubmit={saveDriver} className="driver-form">
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
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Vehicle/Equip</th>
                <th>Status</th>
                <th>Salary</th>
                <th>Period</th>
                <th>Join Date</th>
                <th>License #</th>
                <th>Expiry</th>
                <th>Shift</th>
                <th>Address</th>
                <th>Emergency Contact</th>
                <th>Auth UID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td>{d.name || "-"}</td>
                  <td>{d.phone || "-"}</td>
                  <td>{d.loginEmail || "-"}</td>
                  <td>{d.vehicle || "-"}</td>
                  <td>{d.status || "-"}</td>
                  <td>{d.salary === "" || d.salary === undefined ? "-" : toCurrency(d.salary)}</td>
                  <td>{d.salaryPeriod || "-"}</td>
                  <td>{d.joinDate || "-"}</td>
                  <td>{d.licenseNumber || "-"}</td>
                  <td>{d.licenseExpiry || "-"}</td>
                  <td>{d.shift || "-"}</td>
                  <td style={{ maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.address || "-"}</td>
                  <td>
                    {d.emergencyContactName || d.emergencyContactPhone
                      ? `${d.emergencyContactName || ""}${d.emergencyContactName && d.emergencyContactPhone ? " — " : ""}${d.emergencyContactPhone || ""}`
                      : "-"}
                  </td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>{d.authUid ? String(d.authUid).slice(0, 8) + "…" : "-"}</td>
                  <td>
                    <button className="cp-btn ghost" onClick={() => editDriver(d)}>Edit</button>
                    <button className="cp-btn ghost" onClick={() => deleteDriverById(d.id)}>Delete</button>
                    <button className="cp-btn ghost" onClick={() => navigate(`/attendance?driverId=${d.id}`)}>
  Attendance
</button>
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
