import React, { useState, useEffect } from "react";
import "./Doctors.css";

/* 🔥 FIREBASE */
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
} from "firebase/firestore";

/* HEADER */
import TopBar from "../frontend/TopBar";
import Header from "../frontend/Header";

const Doctors = () => {

  /* ================= STATES ================= */

  const [doctors, setDoctors] = useState([]);
  const [active, setActive] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState("");

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    phone: "",
    email: "",
    date: "",
    time: "",
    address: "",
    problem: "",
  });

  /* ================= FETCH DOCTORS ================= */

  const fetchDoctors = async () => {
    const snap = await getDocs(
      collection(db, "doctors")
    );

    const data = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setDoctors(data);

    if (data.length > 0) {
      setActive(data[0]); // default active
    }
  };

  useEffect(() => {
    fetchDoctors();

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }, []);

  /* ================= AUTO ROTATE ================= */

  useEffect(() => {
    if (!active || showModal) return;

    const interval = setInterval(() => {

      setActive((prev) => {
        const currentIndex =
          doctors.findIndex(
            (d) => d.id === prev.id
          );

        const nextIndex =
          (currentIndex + 1) %
          doctors.length;

        return doctors[nextIndex];
      });

    }, 4000);

    return () => clearInterval(interval);

  }, [active, doctors, showModal]);

  /* ================= FORM ================= */

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  /* ================= SAVE APPOINTMENT ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      await addDoc(
        collection(db, "appointments"),
        {
          doctor: selectedDoctor,
          ...form,
          status: "pending",
          createdAt: new Date(),
        }
      );

      alert("Appointment Booked ✅");

      setShowModal(false);

      setForm({
        name: "",
        age: "",
        gender: "",
        phone: "",
        email: "",
        date: "",
        time: "",
        address: "",
        problem: "",
      });

    } catch (err) {
      console.error(err);
      alert("Error ❌");
    } finally {
      setLoading(false);
    }
  };

  /* ================= OPEN MODAL ================= */

  const openModal = (doctorName) => {
    setSelectedDoctor(doctorName);
    setShowModal(true);
  };

  /* ================= JSX ================= */

  return (
    <div className="doctors-page">

      <TopBar />
      <Header />

      <p className="main-title">
        Meet our <span>All</span> Doctors
      </p>

      {/* ================= GRID ================= */}

      <div className="doctor-section">
        <div className="doctor-grid">

          {doctors.map((doc) => (

            <div
              className="doctor-card"
              key={doc.id}
            >

              <img
                src={doc.image}
                alt={doc.name}
              />

              <h3>{doc.name}</h3>

              <p>{doc.specialist}</p>

              <button
                className="appointment-btn"
                onClick={() =>
                  openModal(doc.name)
                }
              >
                Book Appointment
              </button>

            </div>

          ))}

        </div>
      </div>

      {/* ================= DETAILS ================= */}

      {active && (

        <div className="doctor-wrapper">

          <div className="doctor-buttons">

            {doctors.map((doc) => (

              <button
                key={doc.id}
                className={`doc-btn ${
                  active.id === doc.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setActive(doc)
                }
              >
                {doc.name}
              </button>

            ))}

          </div>

          <div className="doctor-details">

            <h2>
              {active.name}{" "}
              {active.degree}
            </h2>

            <ul>
              {active.points?.map(
                (p, i) => (
                  <li key={i}>{p}</li>
                )
              )}
            </ul>

          </div>

        </div>

      )}

      {/* ================= MODAL ================= */}

      {showModal && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowModal(false)
          }
        >
          <div
            className="modal-box"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2>Book Appointment</h2>

            <p className="doctor-name">
              {selectedDoctor}
            </p>

            <form onSubmit={handleSubmit}>

              <input
                name="name"
                placeholder="Patient Name"
                value={form.name}
                onChange={handleChange}
                required
              />

              <input
                name="age"
                type="number"
                placeholder="Age"
                value={form.age}
                onChange={handleChange}
                required
              />

              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                required
              >
                <option value="">
                  Select Gender
                </option>
                <option>Male</option>
                <option>Female</option>
              </select>

              <input
                name="phone"
                placeholder="Phone"
                value={form.phone}
                onChange={handleChange}
                required
              />

              <input
                name="email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
              />

              <input
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                required
              />

              <input
                name="time"
                type="time"
                value={form.time}
                onChange={handleChange}
                required
              />

              <input
                className="full"
                name="address"
                placeholder="Address"
                value={form.address}
                onChange={handleChange}
              />

              <textarea
                className="full"
                name="problem"
                placeholder="Describe Problem"
                value={form.problem}
                onChange={handleChange}
                required
              />

              <div className="modal-buttons">

                <button
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? "Booking..."
                    : "Submit"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                >
                  Cancel
                </button>

              </div>

            </form>

          </div>
        </div>

      )}

    </div>
  );
};

export default Doctors;
