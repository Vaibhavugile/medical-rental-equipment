import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useSearchParams } from "react-router-dom";
import "./AttendanceAdmin.css";

// --- Debug helpers ---
const DEBUG = true; // flip to false to silence logs in production
const log  = (...a) => DEBUG && console.log("[AttendanceAdmin]", ...a);
const warn = (...a) => DEBUG && console.warn("[AttendanceAdmin]", ...a);
const err  = (...a) => DEBUG && console.error("[AttendanceAdmin]", ...a);

export default function AttendanceAdmin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [drivers, setDrivers] = useState([]);
  const [records, setRecords] = useState([]);

  const [driverId, setDriverId] = useState(searchParams.get("driverId") || "all");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("from") || isoOf(daysAgo(7)));
  const [dateTo, setDateTo] = useState(() => searchParams.get("to") || isoOf(new Date()));

  const [openRow, setOpenRow] = useState(null);

  // Keep URL in sync
  useEffect(() => {
    const params = {};
    if (driverId && driverId !== "all") params.driverId = driverId;
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    log("sync url params", params);
    setSearchParams(params);
  }, [driverId, dateFrom, dateTo, setSearchParams]);

  // Load drivers once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        log("drivers: fetching");
        const snap = await getDocs(collection(db, "drivers"));
        if (!mounted) return;
        const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
        log("drivers: fetched", rows.length);
        if (DEBUG) console.table(rows.map(r => ({ id: r.id, name: r.name, email: r.loginEmail })));
        setDrivers(rows);
      } catch (e) {
        err("drivers load", e);
        setError("Failed to load drivers.");
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load attendance from subcollections when filters or drivers change
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    log("attendance: start load", { driverId, dateFrom, dateTo, drivers: drivers.length, online: navigator.onLine });

    (async () => {
      try {
        const driverList = driverId === "all" ? drivers : drivers.filter(d => d.id === driverId);
        log("driverList", driverList.map(d => d.id));
        if (!driverList.length) { setRecords([]); setLoading(false); return; }

        const dayIds = daysBetween(dateFrom, dateTo);
        log("dayIds (range)", dayIds);

        const promises = [];
        for (const drv of driverList) {
          for (const dayId of dayIds) {
            const ref = doc(db, "drivers", drv.id, "attendance", dayId);
            promises.push(
              getDoc(ref)
                .then(snap => ({ snap, drv, dayId }))
                .catch(e => { warn("getDoc failed", { driver: drv.id, dayId, error: e?.message }); return null; })
            );
          }
        }

        const results = await Promise.all(promises);
        log("attendance: fetched docs", results.filter(Boolean).length);

        const list = [];
        for (const item of results) {
          if (!item) continue;
          const { snap, drv, dayId } = item;
          if (!snap || !snap.exists()) { if (DEBUG) warn("missing day doc", { driver: drv.id, dayId }); continue; }
          const raw = snap.data() || {};
          const rec = mapDayDoc({ id: `${drv.id}_${dayId}`, driverId: drv.id, dayId, raw });
          list.push(rec);
        }

        if (!mounted) return;
        log("attendance: mapped records", list.length);
        if (DEBUG && list.length) {
          console.table(list.map(x => ({
            id: x.id, driverId: x.driverId, day: x.dayId,
            in: fmtDT(x.checkInAt), out: fmtDT(x.checkOutAt),
            mins: x.durationMinutes, status: x.status
          })));
        }
        setRecords(list);
      } catch (e) {
        err("attendance load (subcollections)", e);
        setError(`Failed to load attendance: ${e?.message || e}`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [drivers, driverId, dateFrom, dateTo]);

  const driverById = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers]);

  // Aggregation per driver
  const totals = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const dId = r.driverId || "(unknown)";
      const prev = map.get(dId) || { sessions: 0, minutes: 0 };
      prev.sessions += 1;
      prev.minutes += r.durationMinutes || 0;
      map.set(dId, prev);
    }
    return map;
  }, [records]);

  const exportCsv = () => {
    const header = [
      "Driver Name","Driver Email","Date","Check-in","Check-out",
      "Duration (minutes)","Status","Notes","Record ID",
    ];
    const rows = records.map(r => [
      driverById[r.driverId]?.name || r.driverId || "",
      driverById[r.driverId]?.loginEmail || "",
      r.dayId,
      fmtDT(r.checkInAt),
      fmtDT(r.checkOutAt),
      r.durationMinutes ?? "",
      r.status || "",
      (r.notes || "").replace(/\n/g, " "),
      r.id,
    ]);
    const csv = [header.join(","), ...rows.map(cols => cols.map(csvEscape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="attendance-page">
      <h2>Attendance</h2>

      {/* Filters */}
      <div className="toolbar">
        <select value={driverId} onChange={e => setDriverId(e.target.value)}>
          <option value="all">All drivers</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>{d.name || d.loginEmail || d.id}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button className="cp-btn" onClick={() => quickRange(0, setDateFrom, setDateTo)}>Today</button>
        <button className="cp-btn ghost" onClick={() => quickRange(7, setDateFrom, setDateTo)}>Last 7 days</button>
        <button className="cp-btn ghost" onClick={() => quickRange(30, setDateFrom, setDateTo)}>Last 30 days</button>
        <div className="spacer" />
        <button className="cp-btn" onClick={exportCsv}>Export CSV</button>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Table */}
      <div className="table-wrap">
        {loading ? (
          <p>Loading attendance…</p>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Date</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td style={{minWidth:220}}>
                    <div className="dname">{driverById[r.driverId]?.name || "(unknown)"}</div>
                    <div className="muted">{driverById[r.driverId]?.loginEmail || r.driverId}</div>
                  </td>
                  <td className="mono">{r.dayId}</td>
                  <td>{fmtDT(r.checkInAt)}</td>
                  <td>{fmtDT(r.checkOutAt) || <span className="chip warn">Open</span>}</td>
                  <td>{minsToHhmm(r.durationMinutes || 0)}</td>
                  <td>{r.status || (r.checkOutAt ? "present" : "open")}</td>
                  <td style={{maxWidth:280, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{r.notes || "-"}</td>
                  <td><button className="cp-btn ghost" onClick={() => setOpenRow(r)}>Details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Per-driver totals */}
      <div className="totals">
        {[...totals.entries()].map(([dId, t]) => (
          <div className="total-row" key={dId}>
            <div className="name">{driverById[dId]?.name || dId}</div>
            <div className="muted">{driverById[dId]?.loginEmail || ""}</div>
            <div className="pill">{t.sessions} sessions</div>
            <div className="pill">{minsToHhmm(t.minutes)}</div>
          </div>
        ))}
      </div>

      {/* Drawer */}
      {openRow && <div className="drawer-overlay" onClick={() => setOpenRow(null)} />}
      <div className={`drawer ${openRow ? "open" : ""}`}>
        {openRow && (
          <div className="drawer-inner">
            <div className="drawer-header">
              <h3>Attendance Details</h3>
              <button className="cp-btn ghost" onClick={() => setOpenRow(null)}>Close</button>
            </div>
            <div className="detail-grid">
              <Info label="Driver" value={driverById[openRow.driverId]?.name || openRow.driverId} />
              <Info label="Email" value={driverById[openRow.driverId]?.loginEmail || "-"} />
              <Info label="Date" value={openRow.dayId} mono />
              <Info label="Check-in" value={fmtDT(openRow.checkInAt)} />
              <Info label="Check-in location" value={locToText(openRow.checkInLocation)} mono />
              <Info label="Check-out" value={fmtDT(openRow.checkOutAt) || "(open)"} />
              <Info label="Check-out location" value={locToText(openRow.checkOutLocation)} mono />
              <Info label="Duration" value={minsToHhmm(openRow.durationMinutes || 0)} />
              <Info label="Status" value={openRow.status || (openRow.checkOutAt ? "present" : "open")} />
              <Info label="Notes" value={openRow.notes || "-"} />
              <Info label="Record ID" value={openRow.id} mono />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, mono }) {
  return (
    <div className="info">
      <div className="info-label">{label}</div>
      <div className={`info-value ${mono ? "mono" : ""}`}>{value ?? "-"}</div>
    </div>
  );
}

// ---------- helpers ----------
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function isoOf(d) { return d.toISOString().slice(0, 10); }
function daysBetween(fromIso, toIso) {
  const res = [];
  const from = new Date(fromIso + "T00:00:00");
  const to = new Date(toIso + "T00:00:00");
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) res.push(isoOf(d));
  return res;
}
function quickRange(daysBack, setFrom, setTo) {
  const now = new Date();
  const from = daysBack === 0 ? now : daysAgo(daysBack);
  setFrom(isoOf(from));
  setTo(isoOf(now));
}
function fmtDT(v) {
  if (!v) return "";
  try {
    const d = v instanceof Date ? v : (v?.toDate ? v.toDate() : (typeof v === "number" ? new Date(v) : new Date(v)));
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}
function minsToHhmm(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}
function csvEscape(x) {
  const s = String(x ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
function locToText(loc) {
  if (!loc) return "-";
  if (typeof loc === "string") return loc;
  if (typeof loc === "object" && loc.lat != null && loc.lng != null) return `${loc.lat}, ${loc.lng}`;
  return JSON.stringify(loc);
}
function durationInMinutes(checkInAt, checkOutAt) {
  if (!checkInAt) return 0;
  const a = checkInAt?.toDate ? checkInAt.toDate() : (typeof checkInAt === "number" ? new Date(checkInAt) : new Date(checkInAt));
  const b = checkOutAt ? (checkOutAt?.toDate ? checkOutAt.toDate() : (typeof checkOutAt === "number" ? new Date(checkOutAt) : new Date(checkOutAt))) : new Date();
  const diffMs = Math.max(0, b - a);
  return Math.round(diffMs / 60000);
}
function mapDayDoc({ id, driverId, dayId, raw }) {
  const checkInAt  = raw.checkInServer ?? raw.checkInMs ?? null;
  const checkOutAt = raw.checkOutServer ?? raw.checkOutMs ?? null;
  const rec = {
    id,
    driverId,
    dayId: raw.date || dayId,
    checkInAt,
    checkOutAt,
    checkInLocation: raw.checkInLocation || raw.inLocation || null,
    checkOutLocation: raw.checkOutLocation || raw.outLocation || null,
    notes: raw.note || raw.notes || raw.remarks || "",
    status: raw.status || (checkOutAt ? "present" : "open"),
  };
  rec.durationMinutes = durationInMinutes(rec.checkInAt, rec.checkOutAt);
  return rec;
}
