// src/pages/DriverAttendance.js
// Driver self check-in/out (today actions + past read-only) —
// SAVES under drivers/{driverId}/attendance/{YYYY-MM-DD}

import React, { useEffect, useMemo, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import "./DriverAttendance.css";

/* ---------------- helpers ---------------- */
const NA = "NA";
const val = (v) => (v === undefined || v === null || v === "" ? NA : v);

// Local “YYYY-MM-DD”
function todayISO() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tzOffset * 60000);
  return local.toISOString().slice(0, 10);
}
const nowMs = () => Date.now();

function hhmm(ms) {
  if (ms == null) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function toLocalFromServerTimestamp(ts) {
  try {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

async function findDriverByUser(user) {
  if (!user) return null;
  const tries = [
    query(collection(db, "drivers"), where("authUid", "==", user.uid)),
    query(collection(db, "drivers"), where("loginEmail", "==", user.email || "")),
    query(collection(db, "drivers"), where("email", "==", user.email || "")),
  ];
  for (const qy of tries) {
    const s = await getDocs(qy);
    if (!s.empty) return { id: s.docs[0].id, ...(s.docs[0].data() || {}) };
  }
  return null;
}

// 🔗 Subcollection path helper: drivers/{driverId}/attendance/{YYYY-MM-DD}
const attRef = (driverId, dateStr) => doc(db, "drivers", driverId, "attendance", dateStr);

/* ---------------- page ---------------- */
export default function DriverAttendance() {
  const [user, setUser] = useState(() => auth.currentUser || null);
  const [driver, setDriver] = useState(null);

  const [selectedDate, setSelectedDate] = useState(todayISO()); // past dates are read-only
  const [att, setAtt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const today = todayISO();
  const isToday = selectedDate === today;

  // auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u || null));
    return () => unsub();
  }, []);

  // driver
  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const drv = await findDriverByUser(user);
        setDriver(drv);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // load attendance (subcollection)
  useEffect(() => {
    (async () => {
      if (!driver?.id || !selectedDate) return;
      setLoading(true);
      try {
        const ref = attRef(driver.id, selectedDate);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          setAtt({ id: ref.id, ...data });
          setNote(data.note || "");
        } else {
          setAtt(null);
          setNote("");
        }
      } catch (e) {
        console.error("Failed to load attendance", e);
        setAtt(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [driver?.id, selectedDate]);

  // buttons
  const canCheckIn = useMemo(
    () => isToday && !!driver && !att?.checkInMs,
    [isToday, driver, att?.checkInMs]
  );
  const canCheckOut = useMemo(
    () => isToday && !!driver && !!att?.checkInMs && !att?.checkOutMs,
    [isToday, driver, att?.checkInMs, att?.checkOutMs]
  );
  const actionsDisabledReason = !isToday
    ? "Viewing past date (read-only)"
    : !driver
    ? "No driver profile"
    : "";

  async function handleCheckIn() {
    if (!isToday) return alert("You can only check-in for today.");
    if (!driver?.id) return;
    if (!canCheckIn) {
      alert(att?.checkInMs ? "Already checked in." : "Not allowed.");
      return;
    }
    if (!window.confirm("Confirm: Mark PRESENT and CHECK-IN now?")) return;

    setSaving(true);
    try {
      const ref = attRef(driver.id, today);
      const now = nowMs();
      const payload = {
        date: today,
        driverId: driver.id,
        driverName: driver.name || driver.fullName || driver.displayName || NA,
        status: "present",
        checkInMs: now,
        checkInServer: serverTimestamp(),
        checkOutMs: null,
        checkOutServer: null,
        note: note || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || "",
      };
      await setDoc(ref, payload, { merge: true });
      setAtt({ id: ref.id, ...payload });
      alert(`✅ Checked in at ${hhmm(now)}.`);
    } catch (e) {
      console.error("Check-in failed", e);
      alert("Check-in failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckOut() {
    if (!isToday) return alert("You can only check-out for today.");
    if (!driver?.id) return;
    if (!att?.checkInMs) {
      alert("Please check-in first.");
      return;
    }
    if (!canCheckOut) {
      alert(att?.checkOutMs ? "Already checked out." : "Not allowed.");
      return;
    }
    if (!window.confirm("Confirm: CHECK-OUT now?")) return;

    setSaving(true);
    try {
      const ref = attRef(driver.id, today);
      const now = nowMs();
      const payload = {
        checkOutMs: now,
        checkOutServer: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || "",
      };
      await updateDoc(ref, payload);
      setAtt((prev) => ({ ...(prev || {}), ...payload }));
      alert(`✅ Checked out at ${hhmm(now)}.`);
    } catch (e) {
      console.error("Check-out failed", e);
      alert("Check-out failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMark(type) {
    if (!isToday) return alert("You can only change status for today.");
    if (!driver?.id) return;

    const label =
      type === "leave" ? "LEAVE" :
      type === "absent" ? "ABSENT" :
      type === "half_day" ? "HALF-DAY" :
      type === "late" ? "LATE" : type;

    if (!window.confirm(`Confirm: mark ${label} for today?`)) return;

    setSaving(true);
    try {
      const ref = attRef(driver.id, today);
      const base = {
        date: today,
        driverId: driver.id,
        driverName: driver.name || driver.fullName || driver.displayName || NA,
        note: note || "",
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || "",
      };

      const payload =
        type === "leave"
          ? { ...base, status: "leave", checkInMs: null, checkOutMs: null, checkInServer: null, checkOutServer: null }
          : type === "absent"
          ? { ...base, status: "absent", checkInMs: null, checkOutMs: null, checkInServer: null, checkOutServer: null }
          : type === "half_day"
          ? { ...base, status: "half_day" }
          : type === "late"
          ? { ...base, status: "late" }
          : base;

      await setDoc(ref, payload, { merge: true });
      const snap = await getDoc(ref);
      setAtt({ id: ref.id, ...(snap.data() || payload) });
      alert(`✅ Marked ${label} for today.`);
    } catch (e) {
      console.error("Update status failed", e);
      alert("Could not update status. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const duration = useMemo(() => {
    if (!att?.checkInMs || !att?.checkOutMs) return "";
    const mins = Math.max(0, Math.round((att.checkOutMs - att.checkInMs) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }, [att?.checkInMs, att?.checkOutMs]);

  if (loading) return <div className="att-wrap"><div className="muted">Loading…</div></div>;
  if (!user) return <div className="att-wrap"><div className="muted">Please sign in to mark attendance.</div></div>;
  if (!driver)
    return (
      <div className="att-wrap">
        <div className="muted">No driver profile linked to this account. Contact admin.</div>
      </div>
    );

  return (
    <div className="att-wrap">
      <header className="att-top">
        <div>
          <h2>🗓️ Driver Attendance</h2>
          <div className="muted">
            {val(driver.name)} • ID: {driver.id.slice(0, 8)}
          </div>
        </div>

        {/* Past dates view-only (max = today) */}
        <div className="att-controls">
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value || today)}
            title={selectedDate === today ? "Today" : "Viewing past date (read-only)"}
          />
        </div>
      </header>

      {selectedDate !== today && (
        <div className="muted" style={{ marginBottom: 8 }}>
          Viewing <b>{selectedDate}</b> • <b>read-only</b>. Actions are available only for today ({today}).
        </div>
      )}

      <div className="att-card">
        <div className="att-row">
          <div>
            <div className="label">Date</div>
            <div className="value">{selectedDate}</div>
          </div>
          <div>
            <div className="label">Status</div>
            <div className={`chip ${att?.status || "none"}`}>
              {(att && att.status) ? att.status.replace("_", " ") : "—"}
            </div>
          </div>
          <div>
            <div className="label">Check-in</div>
            <div className="value">
              {hhmm(att?.checkInMs) || toLocalFromServerTimestamp(att?.checkInServer) || "—"}
            </div>
          </div>
          <div>
            <div className="label">Check-out</div>
            <div className="value">
              {hhmm(att?.checkOutMs) || toLocalFromServerTimestamp(att?.checkOutServer) || "—"}
            </div>
          </div>
          <div>
            <div className="label">Duration</div>
            <div className="value">{duration || "—"}</div>
          </div>
        </div>

        {/* Actions (auto-disable after use; hidden for past dates) */}
        <div className="att-actions">
          <button
            className="cp-btn"
            disabled={!canCheckIn || saving}
            onClick={handleCheckIn}
            title={
              canCheckIn
                ? "Mark Present (check-in)"
                : actionsDisabledReason || (att?.checkInMs ? "Already checked in" : "Not allowed")
            }
          >
            {saving && canCheckIn ? "Saving…" : att?.checkInMs ? "Checked-in" : "Mark Present (Check-in)"}
          </button>

          <button
            className="cp-btn ghost"
            disabled={!canCheckOut || saving}
            onClick={handleCheckOut}
            title={
              canCheckOut
                ? "Check-out"
                : actionsDisabledReason || (att?.checkOutMs ? "Already checked out" : "Check-in first")
            }
          >
            {saving && canCheckOut ? "Saving…" : att?.checkOutMs ? "Checked-out" : "Check-out"}
          </button>
        </div>

        <div className="att-status-row">
          <span className="label">Quick Status:</span>
          <div className="quick-grid">
            <button className="chip-btn" onClick={() => handleMark("leave")} disabled={selectedDate !== today || saving} title={selectedDate === today ? "" : "Read-only for past dates"}>Leave</button>
            <button className="chip-btn" onClick={() => handleMark("absent")} disabled={selectedDate !== today || saving} title={selectedDate === today ? "" : "Read-only for past dates"}>Absent</button>
            <button className="chip-btn" onClick={() => handleMark("half_day")} disabled={selectedDate !== today || saving} title={selectedDate === today ? "" : "Read-only for past dates"}>Half-day</button>
            <button className="chip-btn" onClick={() => handleMark("late")} disabled={selectedDate !== today || saving} title={selectedDate === today ? "" : "Read-only for past dates"}>Late</button>
          </div>
        </div>

        <div className="att-note">
          <label>Note</label>
          <textarea
            placeholder={selectedDate === today ? "Optional note (reason / remarks)" : "Viewing past date (read-only)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={selectedDate !== today}
          />
        </div>

        <div className="att-hint muted">
          • Stored at <code>drivers/{driver.id}/attendance/{selectedDate}</code>.<br />
          • Actions only for today (<b>{today}</b>). Past dates are view-only.<br />
          • Timestamps saved as precise ms and serverTimestamp for audit.
        </div>
      </div>
    </div>
  );
}
