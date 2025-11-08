// src/TrackingPage.js
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import AdminDriverTracker from "./AdminDriverTracker";
import { db } from "../firebase";

export default function TrackingPage({ presetDriverId = "", presetDate, presetRole }) {
  // Prefer URL ?role=..., then prop, then default "drivers"
  const urlParams = new URLSearchParams(window.location.search);
  const initialRole = (urlParams.get("role") || presetRole || "drivers").toLowerCase();

  const [role, setRole] = useState(initialRole);        // "drivers" | "marketing"
  const [people, setPeople] = useState([]);             // drivers or marketing users
  const [driverId, setDriverId] = useState(presetDriverId || "");
  const [date, setDate] = useState(() =>
    presetDate || new Date().toISOString().slice(0, 10)
  );

  // Load people list for the selected role
  useEffect(() => {
    (async () => {
      try {
        const base = role === "marketing" ? "marketing" : "drivers";
        const snap = await getDocs(collection(db, base));
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setPeople(rows);

        // If no preset id, default to first user (optional)
        if (!presetDriverId && rows.length) setDriverId(rows[0].id);
      } catch (e) {
        console.error("Failed to load list", e);
      }
    })();
  }, [role, presetDriverId]);

  // Respect incoming presets if they change
  useEffect(() => {
    if (presetDriverId) setDriverId(presetDriverId);
  }, [presetDriverId]);

  useEffect(() => {
    if (presetDate) setDate(presetDate);
  }, [presetDate]);

  // Keep URL in sync (nice-to-have)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("role", role);
    if (driverId) sp.set("driverId", driverId);
    if (date) sp.set("date", date);
    const url = `${window.location.pathname}?${sp.toString()}`;
    window.history.replaceState({}, "", url);
  }, [role, driverId, date]);

  const label = role === "marketing" ? "Marketing User" : "Driver";

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>
        {role === "marketing" ? "Marketing Tracking" : "Driver Tracking"}
      </h1>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "end",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Role</label>
          <select
            style={{ padding: 8, minWidth: 180 }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="drivers">Drivers</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>{label}</label>
          <select
            style={{ padding: 8, minWidth: 320 }}
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.loginEmail || p.email || p.id}
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
        <AdminDriverTracker
          db={db}
          driverId={driverId}
          role={role}           // 👈 pass role down
          initialDate={date}
          height="75vh"
        />
      ) : (
        <div style={{ opacity: 0.7 }}>
          Select a {label.toLowerCase()} to load the map.
        </div>
      )}
    </div>
  );
}
