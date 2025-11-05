// src/TrackingPage.js
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import AdminDriverTracker from "./AdminDriverTracker";
import { db } from "../firebase"; // <-- FIXED PATH

export default function TrackingPage({ presetDriverId = "", presetDate }) {
  const [drivers, setDrivers] = useState([]);
  const [driverId, setDriverId] = useState(presetDriverId || "");
  const [date, setDate] = useState(() => presetDate || new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "drivers"));
        const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
        setDrivers(rows);
        // if preset driverId not provided, default to first driver (optional)
        if (!presetDriverId && rows.length) setDriverId(rows[0].id);
      } catch (e) {
        console.error("Failed to load drivers", e);
      }
    })();
  }, [presetDriverId]);

  useEffect(() => {
    if (presetDriverId) setDriverId(presetDriverId);
  }, [presetDriverId]);
  useEffect(() => {
    if (presetDate) setDate(presetDate);
  }, [presetDate]);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Driver Tracking</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "end", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Driver</label>
          <select
            style={{ padding: 8, minWidth: 320 }}
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            {drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.name || d.loginEmail || d.id}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Date</label>
          <input
            type="date"
            style={{ padding: 8 }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {driverId ? (
        <AdminDriverTracker db={db} driverId={driverId} initialDate={date} height="75vh" />
      ) : (
        <div style={{ opacity: 0.7 }}>Select a driver to load the map.</div>
      )}
    </div>
  );
}
