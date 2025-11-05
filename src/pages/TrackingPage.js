// src/TrackingPage.js
import React, { useEffect, useState } from "react";
import AdminDriverTracker from "./AdminDriverTracker";
import { db } from "../firebase"; // your existing firebase.js

export default function TrackingPage() {
  const [driverId, setDriverId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    console.log("🧭 TrackingPage mounted");
  }, []);

  useEffect(() => {
    console.log("🆔 driverId changed:", driverId);
  }, [driverId]);

  useEffect(() => {
    console.log("📅 date changed:", date);
  }, [date]);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Driver Tracking</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "end", marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Driver ID</label>
          <input
            style={{ padding: 8, width: 320 }}
            placeholder="drivers/{driverId}"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          />
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
        <div style={{ opacity: 0.7 }}>Enter a driver ID to load the map.</div>
      )}
    </div>
  );
}
