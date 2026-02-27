import React, { useEffect, useState } from "react";
import "./AdminAppointments.css";

/* 🔥 FIREBASE */
import { db } from "../firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

/* ICONS */
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

const AdminAppointments = () => {

  /* ================= STATES ================= */

  const [appointments, setAppointments] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("all");

  /* 📅 DATE RANGE */
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selected, setSelected] = useState(null);

  /* ================= FETCH ================= */

  const fetchAppointments = async () => {
    const snap = await getDocs(collection(db, "appointments"));

    const data = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setAppointments(data);
    setFiltered(data);
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  /* ================= FILTER LOGIC ================= */

  useEffect(() => {
    let data = [...appointments];

    /* 🔍 SEARCH */
    if (search) {
      data = data.filter((a) =>
        a.name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    /* 👨‍⚕️ DOCTOR */
    if (doctorFilter !== "all") {
      data = data.filter(
        (a) => a.doctor === doctorFilter
      );
    }

    /* 📅 DATE RANGE */
    if (fromDate) {
      data = data.filter(
        (a) =>
          new Date(a.date) >= new Date(fromDate)
      );
    }

    if (toDate) {
      data = data.filter(
        (a) =>
          new Date(a.date) <= new Date(toDate)
      );
    }

    setFiltered(data);

  }, [
    search,
    doctorFilter,
    fromDate,
    toDate,
    appointments,
  ]);

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete appointment?"))
      return;

    await deleteDoc(doc(db, "appointments", id));
    fetchAppointments();
  };

  /* ================= STATUS ================= */

  const updateStatus = async (id, status) => {
    await updateDoc(
      doc(db, "appointments", id),
      { status }
    );

    fetchAppointments();
  };

  /* ================= EXPORT CSV ================= */

  const exportCSV = () => {
    const headers = [
      "Name",
      "Age",
      "Gender",
      "Phone",
      "Email",
      "Doctor",
      "Date",
      "Time",
      "Address",
      "Problem",
      "Status",
    ];

    const rows = filtered.map((a) => [
      a.name,
      a.age,
      a.gender,
      a.phone,
      a.email,
      a.doctor,
      a.date,
      a.time,
      a.address,
      a.problem,
      a.status,
    ]);

    const csv =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((e) => e.join(","))
        .join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "appointments.csv";
    link.click();
  };

  /* ================= WHATSAPP ================= */

  const whatsappPatient = (a) => {
    const msg =
      `Hello ${a.name}, your appointment with ${a.doctor} ` +
      `on ${a.date} at ${a.time} is ${a.status}.`;

    window.open(
      `https://wa.me/91${a.phone}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  };

  /* ================= DOCTOR LIST ================= */

  const doctors = [
    ...new Set(appointments.map((a) => a.doctor)),
  ];

  /* ================= JSX ================= */

  return (
    <div className="admin-page">

      <h2>Appointments Admin</h2>

      {/* ================= FILTER BAR ================= */}

      <div className="admin-actions">

        {/* SEARCH */}
        <input
          className="admin-search"
          placeholder="Search patient..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />

        {/* DOCTOR */}
        <select
          className="admin-filter"
          value={doctorFilter}
          onChange={(e) =>
            setDoctorFilter(e.target.value)
          }
        >
          <option value="all">
            All Doctors
          </option>

          {doctors.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>

        {/* FROM DATE */}
        <input
          type="date"
          className="admin-date"
          value={fromDate}
          onChange={(e) =>
            setFromDate(e.target.value)
          }
        />

        {/* TO DATE */}
        <input
          type="date"
          className="admin-date"
          value={toDate}
          onChange={(e) =>
            setToDate(e.target.value)
          }
        />

        {/* EXPORT */}
        <button
          className="export-btn"
          onClick={exportCSV}
        >
          Export CSV
        </button>

      </div>

      {/* ================= TABLE ================= */}

      <div className="table-wrapper">

        <table>

          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Phone</th>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {filtered.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign:"center", padding:"20px" }}>
                  No appointments found
                </td>
              </tr>
            )}

            {filtered.map((a) => (

              <tr key={a.id}>

                <td>{a.name}</td>
                <td>{a.doctor}</td>
                <td>{a.phone}</td>
                <td>{a.date}</td>
                <td>{a.time}</td>

                <td>
                  <span className={`status ${a.status}`}>
                    {a.status}
                  </span>
                </td>

                <td>

                  <div className="action-buttons">

                    <button
                      className="view-btn"
                      onClick={() =>
                        setSelected(a)
                      }
                    >
                      View
                    </button>

                    <button
                      className="approve-btn"
                      onClick={() =>
                        updateStatus(a.id,"approved")
                      }
                    >
                      Approve
                    </button>

                    <button
                      className="reject-btn"
                      onClick={() =>
                        updateStatus(a.id,"rejected")
                      }
                    >
                      Reject
                    </button>

                    <button
                      className="whatsapp-btn"
                      onClick={() =>
                        whatsappPatient(a)
                      }
                    >
                      <FontAwesomeIcon icon={faWhatsapp}/>
                      WhatsApp
                    </button>

                    <button
                      className="delete-btn"
                      onClick={() =>
                        handleDelete(a.id)
                      }
                    >
                      Delete
                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* ================= MODAL ================= */}

      {selected && (

        <div
          className="admin-modal-overlay"
          onClick={() =>
            setSelected(null)
          }
        >
          <div
            className="admin-modal-box"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h3>Appointment Details</h3>

            <div className="details-grid">

              <p><b>Name:</b> {selected.name}</p>
              <p><b>Age:</b> {selected.age}</p>
              <p><b>Gender:</b> {selected.gender}</p>
              <p><b>Phone:</b> {selected.phone}</p>
              <p><b>Email:</b> {selected.email}</p>
              <p><b>Doctor:</b> {selected.doctor}</p>
              <p><b>Date:</b> {selected.date}</p>
              <p><b>Time:</b> {selected.time}</p>

              <p className="full">
                <b>Address:</b> {selected.address}
              </p>

              <p className="full">
                <b>Problem:</b> {selected.problem}
              </p>

            </div>

            <button
              className="close-btn"
              onClick={() =>
                setSelected(null)
              }
            >
              Close
            </button>

          </div>
        </div>

      )}

    </div>
  );
};

export default AdminAppointments;
