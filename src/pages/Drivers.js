// src/pages/Drivers.js
import React, { useEffect, useState } from "react";
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

/**
 * Drivers Management Module
 * - Add/edit drivers with name, phone, vehicle, and loginEmail
 * - Stored in Firestore collection "drivers"
 * - No invite or Firebase Auth linking — Signup auto-links by email later
 */
export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDriver, setNewDriver] = useState({
    name: "",
    phone: "",
    vehicle: "",
    loginEmail: "",
    status: "available",
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  // Fetch all drivers
  useEffect(() => {
    const fetchDrivers = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "drivers"));
        setDrivers(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      } catch (err) {
        console.error("Error fetching drivers", err);
        setError("Failed to load drivers");
      } finally {
        setLoading(false);
      }
    };
    fetchDrivers();
  }, []);

  // Add or update driver
  const saveDriver = async (e) => {
    e.preventDefault();
    setError("");

    if (!newDriver.name.trim() || !newDriver.loginEmail.trim()) {
      setError("Name and email are required.");
      return;
    }

    const driverData = {
      name: newDriver.name.trim(),
      phone: newDriver.phone.trim() || "",
      vehicle: newDriver.vehicle.trim() || "",
      loginEmail: newDriver.loginEmail.trim().toLowerCase(), // ✅ normalized for matching
      status: newDriver.status || "available",
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "drivers", editingId), driverData);
      } else {
        await addDoc(collection(db, "drivers"), {
          ...driverData,
          createdAt: serverTimestamp(),
        });
      }

      // reset form
      setNewDriver({
        name: "",
        phone: "",
        vehicle: "",
        loginEmail: "",
        status: "available",
      });
      setEditingId(null);

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
    setNewDriver(driver);
  };

  const deleteDriver = async (id) => {
    if (!window.confirm("Delete this driver?")) return;
    try {
      await deleteDoc(doc(db, "drivers", id));
      setDrivers((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("deleteDriver", err);
      setError("Failed to delete driver.");
    }
  };

  return (
    <div className="drivers-page">
      <h2>Drivers Management</h2>

      <form onSubmit={saveDriver} className="driver-form">
        <input
          type="text"
          placeholder="Full Name"
          value={newDriver.name}
          onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Phone"
          value={newDriver.phone}
          onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
        />
        <input
          type="text"
          placeholder="Vehicle Info"
          value={newDriver.vehicle}
          onChange={(e) => setNewDriver({ ...newDriver, vehicle: e.target.value })}
        />
        <input
          type="email"
          placeholder="Login Email (for signup match)"
          value={newDriver.loginEmail}
          onChange={(e) =>
            setNewDriver({ ...newDriver, loginEmail: e.target.value })
          }
          required
        />
        <select
          value={newDriver.status}
          onChange={(e) => setNewDriver({ ...newDriver, status: e.target.value })}
        >
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </select>
        <button className="cp-btn" type="submit">
          {editingId ? "Update Driver" : "Add Driver"}
        </button>
        {editingId && (
          <button
            type="button"
            className="cp-btn ghost"
            onClick={() => {
              setEditingId(null);
              setNewDriver({
                name: "",
                phone: "",
                vehicle: "",
                loginEmail: "",
                status: "available",
              });
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {error && <p className="error">{error}</p>}

      <div className="drivers-table">
        {loading ? (
          <p>Loading drivers…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Vehicle</th>
                <th>Email</th>
                <th>Status</th>
                <th>Auth UID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.phone}</td>
                  <td>{d.vehicle}</td>
                  <td>{d.loginEmail}</td>
                  <td>{d.status}</td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>
                    {d.authUid ? d.authUid.slice(0, 8) + "…" : "-"}
                  </td>
                  <td>
                    <button className="cp-btn ghost" onClick={() => editDriver(d)}>
                      Edit
                    </button>
                    <button className="cp-btn ghost" onClick={() => deleteDriver(d.id)}>
                      Delete
                    </button>
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
