import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  Timestamp,
  collectionGroup,
} from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";
import "./SalaryPayrollPage.css";
import autoTable from "jspdf-autotable";
export default function SalaryPayrollPage() {

  const [role, setRole] = useState("drivers")
  const [people, setPeople] = useState([])
  const [records, setRecords] = useState([])
  const [payStatus, setPayStatus] = useState({})
  const [loading, setLoading] = useState(true)
const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState(firstDay())
  const [dateTo, setDateTo] = useState(today())

useEffect(() => {

  async function load() {

    setLoading(true)

    const base =
      role === "marketing"
        ? "marketing"
        : role === "staff"
        ? "staff"
        : role === "users"
        ? "users"
        : "drivers"

    // ================= LOAD PEOPLE =================

    const peopleSnap = await getDocs(collection(db, base))

  const WORKFORCE_ROLES = ["driver", "marketing", "staff"]

let users = peopleSnap.docs.map(d => ({
  id: d.id,
  ...d.data()
}))

// ❗ When role = users, remove workforce roles
if (role === "users") {
  users = users.filter(
    u => !WORKFORCE_ROLES.includes((u.role || "").toLowerCase())
  )
}

    setPeople(users)

    // ================= LOAD ATTENDANCE (ONE QUERY) =================

    const attendanceSnap = await getDocs(
      collectionGroup(db, "attendance")
    )

    const attendanceMap = {}

    attendanceSnap.docs.forEach(d => {

      const data = d.data()

      const personId = d.ref.parent.parent.id
      const dayId = d.id

      if (dayId < dateFrom || dayId > dateTo) return

      attendanceMap[`${personId}_${dayId}`] = data

    })

    // ================= BUILD RECORDS =================

    const allRecords = []

    const days = getDaysBetween(dateFrom, dateTo)

    users.forEach(p => {

      days.forEach(dayId => {

        const raw = attendanceMap[`${p.id}_${dayId}`]

        if (!raw) {

          allRecords.push({
            id: `${p.id}_${dayId}`,
            personId: p.id,
            dayId,
            durationMinutes: 0
          })

          return
        }

        const checkIn = raw.checkInServer ?? raw.checkInMs ?? null
        const checkOut = raw.checkOutServer ?? raw.checkOutMs ?? null

        allRecords.push({
          id: `${p.id}_${dayId}`,
          personId: p.id,
          dayId,
          durationMinutes: durationInMinutes(checkIn, checkOut)
        })

      })

    })

    setRecords(allRecords)

    // ================= LOAD PAY STATUS =================

    const statusSnap = await getDocs(collection(db, "payrollStatus"))

    const map = {}

    statusSnap.docs.forEach(d => {
      map[d.id] = d.data()
    })

    setPayStatus(map)

    setLoading(false)

  }

  load()

}, [role, dateFrom, dateTo])

  const peopleById = useMemo(() => {
    return Object.fromEntries(people.map(p => [p.id, p]))
  }, [people])

  const totals = useMemo(() => {

    const map = new Map()
    const graceState = {}

    for (const r of records) {

      const type = getAttendanceType(
        r.durationMinutes,
        r.personId,
        r.dayId,
        graceState
      )

      const prev = map.get(r.personId) || {
        present: 0,
        grace: 0,
        half: 0,
        absent: 0,
        minutes: 0
      }

      if (type === "present") prev.present++
      if (type === "grace") prev.grace++
      if (type === "half") prev.half++
      if (type === "absent") prev.absent++

      prev.minutes += r.durationMinutes

      map.set(r.personId, prev)

    }

    return map

  }, [records])

  async function markPaid(userId) {

    const month = dateFrom.slice(0, 7)

    await setDoc(
      doc(db, "payrollStatus", `${userId}_${month}`),
      {
        userId,
        month,
        paid: true,
        paidAt: Timestamp.now()
      },
      { merge: true }
    )

    alert("Salary marked paid")

  }

  async function markUnpaid(userId) {

    const month = dateFrom.slice(0, 7)

    await setDoc(
      doc(db, "payrollStatus", `${userId}_${month}`),
      {
        userId,
        month,
        paid: false
      },
      { merge: true }
    )

    alert("Marked unpaid")

  }

  function downloadPDF(userId, data) {

    const person = peopleById[userId]

    const monthlySalary =
      person?.salaryMonthly ||
      person?.salary ||
      person?.baseRate ||
      0
    const perDaySalary = monthlySalary / 26

    const salary =
      ((data.present + data.grace) * perDaySalary) +
      (data.half * (perDaySalary / 2))

    const doc = new jsPDF()

    // ================= HEADER =================

    doc.setFontSize(14)
    doc.text("BookMyMedicare Pvt. Ltd", 105, 15, { align: "center" })

    doc.setFontSize(9)
    doc.text(
      "SHOP NO 10 Sun and Moon Building, Borivali East, Mumbai - 400066",
      105, 22, { align: "center" }
    )

    doc.text(
      "Tel: +91 7777066885 | Email: bookmymedicare@gmail.com",
      105, 27, { align: "center" }
    )

    doc.text("GSTIN: XXXXXXX | ISO Certified", 105, 32, { align: "center" })

    doc.line(10, 36, 200, 36)

    doc.setFontSize(11)
    doc.text(`Payslip for ${dateFrom.slice(0, 7)}`, 105, 42, { align: "center" })

    // ================= EMPLOYEE TABLE =================

    autoTable(doc, {
      startY: 48,
      theme: "grid",
      styles: { fontSize: 9 },
      body: [

        ["Employee Name", person?.name, "Employee ID", person?.id],
        ["Designation", role, "Pay Period", dateFrom.slice(0, 7)],
        ["Present Days", data.present, "Grace Days", data.grace],
        ["Half Days", data.half, "Absent Days", data.absent],
        ["Total Hours", minsToHhmm(data.minutes), "", ""],

      ]
    })

    // ================= SALARY TABLE =================

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 5,
      theme: "grid",
      styles: { fontSize: 9 },
      head: [
        ["EARNINGS", "AMOUNT", "DEDUCTIONS", "AMOUNT"]
      ],
      body: [

        ["Basic Salary", `₹${Math.round(salary)}`, "PF", "₹0"],
        ["HRA", "₹0", "Professional Tax", "₹0"],
        ["Other Allowances", "₹0", "TDS", "₹0"],
        ["", "", "Other Deduction", "₹0"],

        ["GROSS EARNINGS", `₹${Math.round(salary)}`, "TOTAL DEDUCTIONS", "₹0"],

      ]
    })

    // ================= FINAL TOTAL =================

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 5,
      theme: "grid",
      styles: { fontSize: 10, halign: "right" },
      body: [

        ["Net Salary", `₹${Math.round(salary)}`]

      ]
    })

    // ================= FOOTER =================

    doc.setFontSize(9)
    doc.text(
      "This is a system generated payslip",
      105,
      doc.lastAutoTable.finalY + 15,
      { align: "center" }
    )

    doc.save(`${person?.name}-salary.pdf`)
  }
  return (

    <div className="payroll-page">

      <div className="payroll-header">

        <h2>💰 Salary Payroll</h2>

        <div className="payroll-toolbar">

          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="payroll-select"
          >
            <option value="drivers">Drivers</option>
            <option value="marketing">Marketing</option>
            <option value="staff">Nurse / Caretaker</option>
            <option value="users">Employees</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="payroll-date"
          />

          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="payroll-date"
          />

        </div>

      </div>

      {loading && (
        <div className="loading-box">
          Loading payroll...
        </div>
      )}

      <div className="payroll-grid">

        {[...totals.entries()].map(([id, t]) => {

          const person = peopleById[id]

          const monthlySalary = person?.salaryMonthly || 0
          const perDaySalary = monthlySalary / 26

          const salary =
            ((t.present + t.grace) * perDaySalary) +
            (t.half * (perDaySalary / 2))

          const key = `${id}_${dateFrom.slice(0, 7)}`
          const paid = payStatus[key]?.paid

          return (

            <div className="payroll-card" key={id}>

              <div className="payroll-card-header">

                <div className="payroll-name">
                  {person?.name}
                </div>

                {paid ? (
                  <div className="badge-paid">PAID</div>
                ) : (
                  <div className="badge-unpaid">UNPAID</div>
                )}

              </div>

              <div className="payroll-stats">

                <div className="stat-pill">Present {t.present}</div>

                {t.grace > 0 &&
                  <div className="stat-pill grace">Grace {t.grace}</div>
                }

                <div className="stat-pill">Half {t.half}</div>

                <div className="stat-pill">Absent {t.absent}</div>

                <div className="stat-pill">
                  Hours {minsToHhmm(t.minutes)}
                </div>

              </div>

              <div className="salary-box">
                ₹{Math.round(salary)}
              </div>

              <div className="payroll-actions">

                {paid ? (

                  <button
                    className="btn btn-paid"
                    onClick={() => markUnpaid(id)}
                  >
                    Undo Payment
                  </button>

                ) : (

                  <button
                    className="btn btn-pay"
                    onClick={() => markPaid(id)}
                  >
                    Mark Paid
                  </button>

                )}
                <button
className="btn btn-attendance"
onClick={() =>
navigate(`/crm/attendance?role=${role}&driverId=${id}&from=${dateFrom}&to=${dateTo}`)
}
>
View Attendance
</button>

                <button
                  className="btn btn-pdf"
                  onClick={() => downloadPDF(id, t)}
                >
                  Download PDF
                </button>

              </div>

            </div>

          )

        })}

      </div>

    </div>

  )
}

function today() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function firstDay() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function minsToHhmm(mins) {
  const h = Math.floor(mins / 60)
  const m = String(mins % 60).padStart(2, "0")
  return `${h}:${m}`
}

function durationInMinutes(a, b) {

  if (!a) return 0

  const start = a?.toDate ? a.toDate() : new Date(a)
  const end = b?.toDate ? b.toDate() : new Date()

  return Math.max(0, Math.round((end - start) / 60000))

}

function getAttendanceType(duration, personId, dayId, graceState) {

  const month = dayId.slice(0, 7)

  if (!graceState[personId]) graceState[personId] = {}
  if (!graceState[personId][month]) graceState[personId][month] = 0

  if (duration >= 525) return "present"

  if (duration >= 480) {

    if (graceState[personId][month] < 2) {
      graceState[personId][month] += 1
      return "grace"
    }

    return "half"

  }

  if (duration >= 240) return "half"

  return "absent"

}

function getDaysBetween(from, to) {

  const res = []
  const start = new Date(from)
  const end = new Date(to)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    res.push(d.toISOString().slice(0, 10))
  }

  return res
}