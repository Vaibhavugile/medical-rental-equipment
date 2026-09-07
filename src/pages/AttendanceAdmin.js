// src/pages/AttendanceAdmin.js
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  Timestamp,
  getCountFromServer,
  setDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase";
import { useSearchParams, useNavigate } from "react-router-dom";
import "./AttendanceAdmin.css";

// --- Debug helpers ---
const DEBUG = true;
const log = (...a) => DEBUG && console.log("[AttendanceAdmin]", ...a);
const warn = (...a) => DEBUG && console.warn("[AttendanceAdmin]", ...a);
const err = (...a) => DEBUG && console.error("[AttendanceAdmin]", ...a);

export default function AttendanceAdmin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
const [manualPerson, setManualPerson] = useState("");
const [manualDate, setManualDate] = useState(isoOf(new Date()));
const [manualCheckoutDate, setManualCheckoutDate] = useState(isoOf(new Date()));
const [manualCheckIn, setManualCheckIn] = useState("");
const [manualCheckOut, setManualCheckOut] = useState("");
const [manualNotes, setManualNotes] = useState("");
const [savingManual, setSavingManual] = useState(false);
const [manualPersonSearch, setManualPersonSearch] = useState("");
const [manualPersonOpen, setManualPersonOpen] = useState(false);

const [personSearch, setPersonSearch] = useState("");
const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  // role = "drivers" | "marketing" (default drivers)
  const [role, setRole] = useState(() => (searchParams.get("role") || "drivers").toLowerCase());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [people, setPeople] = useState([]); // drivers or marketing users
  const [records, setRecords] = useState([]);

  const [personId, setPersonId] = useState(searchParams.get("driverId") || "all");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("from") || isoOf(daysAgo(7)));
  const [dateTo, setDateTo] = useState(() => searchParams.get("to") || isoOf(new Date()));

  const [openRow, setOpenRow] = useState(null);

  // Per-user Leads/Visits counters for current range
  const [perUser, setPerUser] = useState([]);
  const [perUserLoading, setPerUserLoading] = useState(false);
  const [perUserError, setPerUserError] = useState("");
const personDropdownRef = useRef(null);
const manualPersonDropdownRef = useRef(null);

useEffect(() => {
  const handleOutsideClick = (event) => {
    if (
      personDropdownRef.current &&
      !personDropdownRef.current.contains(event.target)
    ) {
      setPersonDropdownOpen(false);
    }

    if (
      manualPersonDropdownRef.current &&
      !manualPersonDropdownRef.current.contains(event.target)
    ) {
      setManualPersonOpen(false);
    }
  };

  document.addEventListener("mousedown", handleOutsideClick);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
  };
}, []);
  // Keep URL in sync
  useEffect(() => {
    const params = {};
    if (role && role !== "drivers") params.role = role;
    if (personId && personId !== "all") params.driverId = personId; // keep key for backward compatibility
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    log("sync url params", params);
    setSearchParams(params);
  }, [role, personId, dateFrom, dateTo, setSearchParams]);
  

  // Load people (drivers or marketing)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setError("");
      try {
const base =
  role === "marketing"
    ? "marketing"
    : role === "staff"
    ? "staff"
    : role === "users"
    ? "users"
    : "drivers";
        log("people: fetching", base);
        const snap = await getDocs(collection(db, base));
        if (!mounted) return;
       let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

if (role === "users") {
  rows = rows.filter(
    (u) => !["driver", "marketing", "staff"].includes(u.role)
  );
}
        if (DEBUG) console.table(rows.map(r => ({
          id: r.id, name: r.name, email: r.loginEmail || r.email, authUid: r.authUid
        })));
        setPeople(rows);
      } catch (e) {
        err("people load", e);
        setError(`Failed to load ${role}.`);
      }
    })();
    return () => { mounted = false; };
  }, [role]);

  
  // Load attendance from subcollections when filters or people change
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    log("attendance: start load", { role, personId, dateFrom, dateTo, people: people.length });

    (async () => {
      try {
const base =
  role === "marketing"
    ? "marketing"
    : role === "staff"
    ? "staff"
    : role === "users"
    ? "users"
    : "drivers";
        const list = personId === "all" ? people : people.filter(p => p.id === personId);
        if (!list.length) { setRecords([]); setLoading(false); return; }

        const dayIds = daysBetween(dateFrom, dateTo);
        const promises = [];
        for (const p of list) {
          for (const dayId of dayIds) {
            const ref = doc(db, base, p.id, "attendance", dayId);
            promises.push(
              getDoc(ref)
                .then(snap => ({ snap, p, dayId }))
                .catch(e => { warn("getDoc failed", { person: p.id, dayId, error: e?.message }); return null; })
            );
          }
        }

        const results = await Promise.all(promises);
        const out = [];
        for (const item of results) {
          if (!item) continue;
          const { snap, p, dayId } = item;
          if (!snap || !snap.exists()) {
  out.push({
    id: `${p.id}_${dayId}`,
    personId: p.id,
    dayId,
    checkInAt: null,
    checkOutAt: null,
    durationMinutes: 0,
    notes: "",
    status: "absent",
  });
  continue;
}
        const raw = snap.data() || {};

const mappedRows = mapDayDoc({
  id: `${p.id}_${dayId}`,
  personId: p.id,
  dayId,
  raw
});

out.push(...mappedRows);
        }
        if (!mounted) return;
        out.sort((a,b)=> a.dayId.localeCompare(b.dayId));
setRecords(out);
      } catch (e) {
        err("attendance load", e);
        setError(`Failed to load attendance: ${e?.message || e}`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [role, people, personId, dateFrom, dateTo]);

  // Build per-user (Leads, Visits) for current range — using AUTH UID mapping
  // Build per-user (Leads, Visits) for current range — using AUTH UID mapping
useEffect(() => {
  let live = true;

  (async () => {
    // ✅ STAFF DOES NOT HAVE LEADS / VISITS
    if (role === "staff") {
      if (!live) return;
      setPerUser([]);
      setPerUserLoading(false);
      setPerUserError("");
      return;
    }

    try {
      setPerUserLoading(true);
      setPerUserError("");

      const { from, to } = toTimestampRange(dateFrom, dateTo);

      const peopleList =
        personId === "all"
          ? people
          : people.filter((p) => p.id === personId);

      if (!peopleList.length) {
        if (live) {
          setPerUser([]);
          setPerUserLoading(false);
        }
        return;
      }

      const leadsCol = collection(db, "leads");
      const visitsCol = collection(db, "visits");

      const rows = await Promise.all(
        peopleList.map(async (p) => {
          const key = userKey(p); // authUid || uid || docId

          // Leads: ownerId OR createdBy
          const leadsCount = await countLeadsForUser(
            leadsCol,
            from,
            to,
            key
          );

          // Visits: assignedToId OR createdBy
          const visitsCount = await countVisitsForUser(
            visitsCol,
            from,
            to,
            key
          );

          return {
            id: p.id,
            name: p.name || p.loginEmail || p.email || p.id,
            leads: leadsCount,
            visits: visitsCount,
            total: leadsCount + visitsCount,
          };
        })
      );

      rows.sort((a, b) => b.total - a.total);

      if (!live) return;
      setPerUser(rows);
      setPerUserLoading(false);
    } catch (e) {
      if (!live) return;
      console.error("[AttendanceAdmin] per-user stats error:", e);
      setPerUser([]);
      setPerUserLoading(false);
      setPerUserError(e?.message || String(e));
    }
  })();

  return () => {
    live = false;
  };
}, [role, people, personId, dateFrom, dateTo]);

  
  const peopleById = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]);
const filteredPeople = useMemo(() => {
  const search = personSearch.trim().toLowerCase();

  if (!search) return people;

  return people.filter((p) => {
    const name = (p.name || "").toLowerCase();
    const email = (p.loginEmail || p.email || "").toLowerCase();

    return name.includes(search) || email.includes(search);
  });
}, [people, personSearch]);

const filteredManualPeople = useMemo(() => {
  const search = manualPersonSearch.trim().toLowerCase();

  if (!search) return people;

  return people.filter((p) => {
    const name = (p.name || "").toLowerCase();
    const email = (p.loginEmail || p.email || "").toLowerCase();

    return name.includes(search) || email.includes(search);
  });
}, [people, manualPersonSearch]);
  // Aggregation per person (existing attendance summary)
 const totals = useMemo(() => {

  const map = new Map();
  const graceState = {};

  for (const r of records) {

    const id = r.personId;

    const type = getAttendanceType(
      r.durationMinutes,
      r.personId,
      r.dayId,
      graceState
    );

   const prev = map.get(id) || {
  present: 0,
  grace: 0,
  half: 0,
  absent: 0,
  minutes: 0
};

    if (type === "present") prev.present++;
if (type === "grace") prev.grace++;
if (type === "half") prev.half++;
if (type === "absent") prev.absent++;

    prev.minutes += r.durationMinutes || 0;

    map.set(id, prev);
  }

  return map;

}, [records]);

  // quick lookup for per-user leads/visits
  const perUserById = useMemo(() => {
    const m = {};
    for (const row of perUser) m[row.id] = row;
    return m;
  }, [perUser]);

  const exportCsv = () => {
    const header = [
      role === "marketing" ? "Marketing Name" : "Driver Name",
      "Email", "Date", "Check-in", "Check-out", "Duration (minutes)", "Status", "Notes", "Record ID",
    ];
    const rows = records.map(r => [
      peopleById[r.personId]?.name || r.personId || "",
      peopleById[r.personId]?.loginEmail || peopleById[r.personId]?.email || "",
      r.dayId,
      fmtDT(r.checkInAt),
      fmtDT(r.checkOutAt),
      r.durationMinutes ?? "",
      r.attendanceType || "",
      (r.notes || "").replace(/\n/g, " "),
      r.id,
    ]);
    const csv = [header.join(","), ...rows.map(cols => cols.map(csvEscape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${role}_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  async function saveManualAttendance() {
  try {
    if (!manualPerson) {
      alert("Select person");
      return;
    }

    if (!manualCheckIn) {
      alert("Enter check-in time");
      return;
    }

    setSavingManual(true);

   const base =
  role === "marketing"
    ? "marketing"
    : role === "staff"
    ? "staff"
    : role === "users"
    ? "users"
    : "drivers";

    const dayId = manualDate;

    const checkInDate = new Date(`${manualDate}T${manualCheckIn}`);

const checkOutDate = manualCheckOut
  ? new Date(`${manualCheckoutDate}T${manualCheckOut}`)
  : null;

if (checkOutDate && checkOutDate <= checkInDate) {
  alert("Checkout date/time must be after check-in date/time");
  setSavingManual(false);
  return;
}

    const ref = doc(db, base, manualPerson, "attendance", dayId);

    await setDoc(
      ref,
      {
        date: manualDate,
        checkInServer: Timestamp.fromDate(checkInDate),
        checkOutServer: checkOutDate ? Timestamp.fromDate(checkOutDate) : null,
        status: checkOutDate ? "present" : "open",
        notes: manualNotes || "Manual attendance by admin",
        createdBy: "admin",
      },
      { merge: true }
    );

    alert("Attendance saved");

    setManualCheckIn("");
    setManualCheckOut("");
    setManualCheckoutDate(manualDate);
    setManualNotes("");
  } catch (e) {
    console.error(e);
    alert("Failed to save attendance");
  } finally {
    setSavingManual(false);
  }
}
async function saveManualAbsent() {
  try {
    if (!manualPerson) {
      alert("Select person");
      return;
    }

    if (!manualDate) {
      alert("Select date");
      return;
    }

    const base =
      role === "marketing"
        ? "marketing"
        : role === "staff"
        ? "staff"
        : role === "users"
        ? "users"
        : "drivers";

    const dayId = manualDate;

    const ref = doc(
      db,
      base,
      manualPerson,
      "attendance",
      dayId
    );

    await setDoc(
      ref,
      {
        date: manualDate,

        // Remove existing check-in/check-out completely
        checkInServer: deleteField(),
        checkOutServer: deleteField(),

        // Also remove possible old millisecond fields
        checkInMs: deleteField(),
        checkOutMs: deleteField(),

        status: "absent",

        notes: manualNotes || "Manual absent by admin",

        createdBy: "admin",
      },
      { merge: true }
    );

    alert("Attendance marked absent");

    setManualCheckIn("");
    setManualCheckOut("");
    setManualCheckoutDate(manualDate);
    setManualNotes("");

    // Reload attendance data
    setRecords((prev) => [...prev]);

  } catch (e) {
    console.error("saveManualAbsent:", e);
    alert("Failed to mark absent");
  }
}

  return (
    <div className="attendance-page">
<h2>
  {role === "marketing"
    ? "Marketing Attendance"
    : role === "staff"
    ? "Nurse & Caretaker Attendance"
    : role === "users"
    ? "User Attendance"
    : "Driver Attendance"}
</h2>

      {/* Toolbar */}
      <div className="toolbar">
        {/* Role switcher */}
        <select value={role} onChange={e => setRole(e.target.value)}>
  <option value="drivers">Drivers</option>
  <option value="marketing">Marketing</option>
  <option value="staff">Nurses/Caretakers</option>
  <option value="users">Users</option>   
</select>

        <div className="person-search-dropdown"
        ref={personDropdownRef}>
  <button
    type="button"
    className="person-dropdown-button"
    onClick={() => setPersonDropdownOpen((v) => !v)}
  >
    {personId === "all"
      ? role === "marketing"
        ? "All marketing"
        : role === "staff"
        ? "All staff"
        : role === "users"
        ? "All users"
        : "All drivers"
      : (
        peopleById[personId]?.name ||
        peopleById[personId]?.loginEmail ||
        peopleById[personId]?.email ||
        "Select Person"
      )}

    <span>▾</span>
  </button>

  {personDropdownOpen && (
    <div className="person-dropdown-menu">

      <input
        type="text"
        className="person-search-input"
        placeholder="Search person..."
        value={personSearch}
        onChange={(e) => setPersonSearch(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        autoFocus
      />

      <div
        className="person-dropdown-option"
        onClick={() => {
          setPersonId("all");
          setPersonDropdownOpen(false);
          setPersonSearch("");
        }}
      >
        {role === "marketing"
          ? "All marketing"
          : role === "staff"
          ? "All staff"
          : role === "users"
          ? "All users"
          : "All drivers"}
      </div>

      {filteredPeople.map((p) => (
        <div
          key={p.id}
          className={`person-dropdown-option ${
            personId === p.id ? "selected" : ""
          }`}
          onClick={() => {
            setPersonId(p.id);
            setPersonDropdownOpen(false);
            setPersonSearch("");
          }}
        >
          <div>
            <strong>
              {p.name || p.loginEmail || p.email || p.id}
            </strong>
          </div>

          {(p.loginEmail || p.email) && (
            <small>{p.loginEmail || p.email}</small>
          )}
        </div>
      ))}

      {!filteredPeople.length && (
        <div className="person-dropdown-empty">
          No person found
        </div>
      )}
    </div>
  )}
</div>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button className="cp-btn" onClick={() => quickRange(0, setDateFrom, setDateTo)}>Today</button>
        <button className="cp-btn ghost" onClick={() => quickRange(7, setDateFrom, setDateTo)}>Last 7 days</button>
        <button className="cp-btn ghost" onClick={() => quickRange(30, setDateFrom, setDateTo)}>Last 30 days</button>
        <div className="spacer" />
        <button className="cp-btn" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="manual-attendance">
  <h3>Manual Attendance</h3>

 <div className="person-search-dropdown manual-person-dropdown"
  ref={manualPersonDropdownRef}>
  <button
    type="button"
    className="person-dropdown-button"
    onClick={() => setManualPersonOpen((v) => !v)}
  >
    {manualPerson
      ? (
          peopleById[manualPerson]?.name ||
          peopleById[manualPerson]?.loginEmail ||
          peopleById[manualPerson]?.email ||
          "Select Person"
        )
      : "Select Person"}

    <span>▾</span>
  </button>

  {manualPersonOpen && (
    <div className="person-dropdown-menu">

      <input
        type="text"
        className="person-search-input"
        placeholder="Search person..."
        value={manualPersonSearch}
        onChange={(e) => setManualPersonSearch(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        autoFocus
      />

      {filteredManualPeople.map((p) => (
        <div
          key={p.id}
          className={`person-dropdown-option ${
            manualPerson === p.id ? "selected" : ""
          }`}
          onClick={() => {
            setManualPerson(p.id);
            setManualPersonOpen(false);
            setManualPersonSearch("");
          }}
        >
          <div>
            <strong>
              {p.name || p.loginEmail || p.email || p.id}
            </strong>
          </div>

          {(p.loginEmail || p.email) && (
            <small>{p.loginEmail || p.email}</small>
          )}
        </div>
      ))}

      {!filteredManualPeople.length && (
        <div className="person-dropdown-empty">
          No person found
        </div>
      )}
    </div>
  )}
</div>

  <input
    type="date"
    value={manualDate}
    onChange={(e) => setManualDate(e.target.value)}
  />

  <input
    type="time"
    value={manualCheckIn}
    onChange={(e) => setManualCheckIn(e.target.value)}
  />
<input
  type="date"
  value={manualCheckoutDate}
  onChange={(e) => setManualCheckoutDate(e.target.value)}
/>
  <input
    type="time"
    value={manualCheckOut}
    onChange={(e) => setManualCheckOut(e.target.value)}
  />

  <input
    placeholder="Notes"
    value={manualNotes}
    onChange={(e) => setManualNotes(e.target.value)}
  />

  
  <button
  className="cp-btn"
  onClick={saveManualAttendance}
  disabled={savingManual}
>
  {savingManual ? "Saving..." : "Save Attendance"}
</button>

<button
  type="button"
  className="cp-btn ghost"
  onClick={saveManualAbsent}
  disabled={savingManual}
>
  Mark Absent
</button>
</div>

      {error && <p className="error">{error}</p>}

      {/* Table */}
    <div className="table-wrap">
  {loading ? (
    <p>Loading attendance…</p>
  ) : (
    (() => {
      // shared grace tracker for table rendering
      const graceStateForTable = {};

      return (
        <table className="attendance-table">
          <thead>
            <tr>
              <th>
  {role === "marketing"
    ? "Marketing User"
    : role === "staff"
    ? "Nurse & Caretaker"
    : role === "users"
    ? "User"
    : "Driver"}
</th>

              <th>Date</th>
              <th>Shift</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Track</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
           {records.map((r) => {
  const attendance = getAttendanceType(
    r.durationMinutes,
    r.personId,
    r.dayId,
    graceStateForTable
  );

  const sunday = isSunday(r.dayId);

  return (
    <tr
      key={r.id}
      className={sunday ? "sunday-row" : ""}
    >
                  <td style={{ minWidth: 220 }}>
                    <div className="dname">
                      {peopleById[r.personId]?.name || "(unknown)"}
                    </div>
                    <div className="muted">
                      {peopleById[r.personId]?.loginEmail ||
                        peopleById[r.personId]?.email ||
                        r.personId}
                    </div>
                  </td>

                  <td className="mono">{r.dayId}</td>
<td>
  <strong>
    Shift {r.shift || 1}
  </strong>
</td>

                  <td>{fmtDT(r.checkInAt)}</td>

                  <td>
                    {fmtDT(r.checkOutAt) || (
                      <span className="chip warn">Open</span>
                    )}
                  </td>

                  <td>{minsToHhmm(r.durationMinutes || 0)}</td>

                  <td>
  {attendance === "grace" ? (
    <span className="chip grace">Grace</span>
  ) : (
    attendance
  )}
</td>

                  <td
                    style={{
                      maxWidth: 280,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.notes || "-"}
                  </td>

                  <td>
                    <button
                      className="cp-btn ghost"
                      onClick={() =>
                        navigate(
                          `/crm/tracking?role=${role}&driverId=${r.personId}&date=${r.dayId}`
                        )
                      }
                    >
                      Track
                    </button>
                  </td>

                  <td>
                    <button
                      className="cp-btn ghost"
                      onClick={() => setOpenRow(r)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    })()
  )}
</div>

      {/* Per-person totals (same UI, now includes Leads/Visits) */}
      <div className="totals">
        {[...totals.entries()].map(([id, t]) => {

  const pu = perUserById[id] || { leads: 0, visits: 0 };

  // salary calculation
  const monthlySalary = peopleById[id]?.salaryMonthly ||peopleById[id]?.salary || 0;
  const perDaySalary = monthlySalary / 26;

const salary =
  ((t.present + (t.grace || 0)) * perDaySalary) +
  (t.half * (perDaySalary / 2));
          return (
            <div className="total-row" key={id}>
              <div className="name">{peopleById[id]?.name || id}</div>
              <div className="muted">{peopleById[id]?.loginEmail || peopleById[id]?.email || ""}</div>
          <div className="pill">Present {t.present}</div>

{t.grace > 0 && (
  <div className="pill grace">Grace {t.grace}</div>
)}

<div className="pill">Half {t.half}</div>
<div className="pill">Absent {t.absent}</div>

<div className="pill">Hours {minsToHhmm(t.minutes)}</div>

<div className="pill salary">
  Salary ₹{Math.round(salary)}
</div>

<div className="pill">Leads {pu.leads}</div>
<div className="pill">Visits {pu.visits}</div>
              {perUserLoading && <div className="muted" style={{ marginLeft: 8 }}>updating…</div>}
              {perUserError && (
                <div className="pill warn" title={perUserError}>
                  {perUserError.length > 38 ? "stats error" : perUserError}
                </div>
              )}
            </div>
          );
        })}
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
            <div className="drawer-content">

              <div className="detail-grid">
                <Info label={role === "marketing" ? "Marketing User" : "Driver"} value={peopleById[openRow.personId]?.name || openRow.personId} />
                <Info label="Email" value={peopleById[openRow.personId]?.loginEmail || peopleById[openRow.personId]?.email || "-"} />
                <Info label="Date" value={openRow.dayId} mono />
                <Info label="Check-in" value={fmtDT(openRow.checkInAt)} />
                <Info label="Check-in location" value={locToText(openRow.checkInLocation)} mono />
                <Info label="Check-out" value={fmtDT(openRow.checkOutAt) || "(open)"} />
                <Info label="Check-out location" value={locToText(openRow.checkOutLocation)} mono />

                <Info label="Duration" value={minsToHhmm(openRow.durationMinutes || 0)} />
                {/* Check-in photo */}
                {openRow.checkInPhotoUrl && (
                  <div className="photo-block">
                    <div className="info-label">Check-in Photo</div>
                    <img
                      src={openRow.checkInPhotoUrl}
                      alt="Check-in"
                      className="attendance-photo"
                      onClick={() => window.open(openRow.checkInPhotoUrl, "_blank")}
                    />
                  </div>
                )}

                {/* Check-out photo */}
                {openRow.checkOutPhotoUrl && (
                  <div className="photo-block">
                    <div className="info-label">Check-out Photo</div>
                    <img
                      src={openRow.checkOutPhotoUrl}
                      alt="Check-out"
                      className="attendance-photo"
                      onClick={() => window.open(openRow.checkOutPhotoUrl, "_blank")}
                    />
                  </div>
                )}

                <Info label="Status" value={openRow.status || (openRow.checkOutAt ? "present" : "open")} />
                <Info label="Notes" value={openRow.notes || "-"} />
                <Info label="Record ID" value={openRow.id} mono />
              </div>
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
function isoOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isSunday(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);

  // JavaScript months are 0-based
  const date = new Date(year, month - 1, day);

  return date.getDay() === 0;
}
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
function mapDayDoc({ id, personId, dayId, raw }) {
  const rows = [];

  // =========================================================
  // SHIFT 1
  // ONLY USE SHIFT 1 TIME DATA
  // =========================================================
  const shift1Data = raw.shifts?.["1"] || null;

  const shift1CheckIn =
    shift1Data?.checkInServer ??
    shift1Data?.checkInMs ??
    null;

  const shift1CheckOut =
    shift1Data?.checkOutServer ??
    shift1Data?.checkOutMs ??
    null;

  const shift1 = {
    id: `${id}_shift1`,
    personId,
    dayId: raw.date || dayId,
    shift: 1,

    checkInAt: shift1CheckIn,
    checkOutAt: shift1CheckOut,

    checkInLocation:
      shift1Data?.checkInLocation || null,

    checkOutLocation:
      shift1Data?.checkOutLocation || null,

    checkInPhotoUrl:
  shift1Data?.checkInPhotoUrl ||
  raw["check-inPhotoUrl"] ||
  raw.checkInPhotoUrl ||
  "",

checkOutPhotoUrl:
  shift1Data?.checkOutPhotoUrl ||
  raw["check-outPhotoUrl"] ||
  raw.checkOutPhotoUrl ||
  "",

    checkInPhotoStoragePath:
      shift1Data?.checkInPhotoStoragePath || "",

    checkOutPhotoStoragePath:
      shift1Data?.checkOutPhotoStoragePath || "",

    notes:
      shift1Data?.note || "",

    status:
      shift1Data?.status ||
      (shift1CheckOut ? "present" : "open"),
  };

  // Duration ONLY for Shift 1
  shift1.durationMinutes = durationInMinutes(
    shift1.checkInAt,
    shift1.checkOutAt
  );

  rows.push(shift1);


  // =========================================================
  // SHIFT 2
  // ONLY USE SHIFT 2 TIME DATA
  // =========================================================
  const shift2Data = raw.shifts?.["2"] || null;

  if (shift2Data) {
    const shift2CheckIn =
      shift2Data.checkInServer ??
      shift2Data.checkInMs ??
      null;

    const shift2CheckOut =
      shift2Data.checkOutServer ??
      shift2Data.checkOutMs ??
      null;

    const shift2 = {
      id: `${id}_shift2`,
      personId,
      dayId: raw.date || dayId,
      shift: 2,

      checkInAt: shift2CheckIn,
      checkOutAt: shift2CheckOut,

      checkInLocation:
        shift2Data.checkInLocation || null,

      checkOutLocation:
        shift2Data.checkOutLocation || null,

      checkInPhotoUrl:
  shift2Data.checkInPhotoUrl ||
  raw["check-inPhotoUrl"] ||
  raw.checkInPhotoUrl ||
  "",

checkOutPhotoUrl:
  shift2Data.checkOutPhotoUrl ||
  raw["check-outPhotoUrl"] ||
  raw.checkOutPhotoUrl ||
  "",

      checkInPhotoStoragePath:
        shift2Data.checkInPhotoStoragePath || "",

      checkOutPhotoStoragePath:
        shift2Data.checkOutPhotoStoragePath || "",

      notes:
        shift2Data.note || "",

      status:
        shift2Data.status ||
        (shift2CheckOut ? "present" : "open"),
    };

    // Duration ONLY for Shift 2
    shift2.durationMinutes = durationInMinutes(
      shift2.checkInAt,
      shift2.checkOutAt
    );

    rows.push(shift2);
  }

  return rows;
}

// ---- NEW: time range + counting helpers ----
function toTimestampRange(fromIso, toIso) {
  const start = new Date(fromIso);
  start.setHours(0, 0, 0, 0);

  const end = new Date(toIso);
  end.setHours(23, 59, 59, 999);

  return {
    from: Timestamp.fromDate(start),
    to: Timestamp.fromDate(end),
  };
}



// ---- NEW: ID mapping helpers ----
function userKey(person) {
  // Prefer the auth UID saved in your visit/lead docs
  return person?.authUid || person?.uid || person?.id;
}

// Leads count without OR(): de-duplicate IDs from two queries
async function countLeadsForUser(leadsColRef, fromTs, toTs, userKeyVal) {
  const base = [
    where("createdAt", ">=", fromTs),
    where("createdAt", "<=", toTs),
  ];
  // A: ownerId == auth uid
  const qA = query(leadsColRef, ...base, where("ownerId", "==", userKeyVal));
  // B: createdBy == auth uid (safety, depending on mobile save)
  const qB = query(leadsColRef, ...base, where("createdBy", "==", userKeyVal));

  const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
  const ids = new Set();
  snapA.forEach(d => ids.add(d.id));
  snapB.forEach(d => ids.add(d.id));
  return ids.size;
}

// Visits count without OR(): de-duplicate IDs from two queries
async function countVisitsForUser(visitsColRef, fromTs, toTs, userKeyVal) {
  const base = [
    where("createdAt", ">=", fromTs),
    where("createdAt", "<=", toTs),
  ];
  // A: assigned to user (assignedToId == auth uid)
  const qA = query(visitsColRef, ...base, where("assignedToId", "==", userKeyVal));
  // B: created by user (createdBy == auth uid) for directly-created visits
  const qB = query(visitsColRef, ...base, where("createdBy", "==", userKeyVal));

  const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
  const ids = new Set();
  snapA.forEach(d => ids.add(d.id));
  snapB.forEach(d => ids.add(d.id));
  return ids.size;
}
function getAttendanceType(durationMinutes, personId, dayId, graceState) {

  const month = dayId.slice(0,7);

  if (!graceState[personId]) graceState[personId] = {};
  if (!graceState[personId][month]) graceState[personId][month] = 0;

  // FULL DAY
  if (durationMinutes >= 525) {
    return "present";
  }

  // 8 – 8.74 hrs
  if (durationMinutes >= 480) {

    if (graceState[personId][month] < 2) {
      graceState[personId][month] += 1;
      return "grace";   // ⭐ return grace instead of present
    }

    return "half";
  }

  // HALF DAY
  if (durationMinutes >= 240) {
    return "half";
  }

  return "absent";
}