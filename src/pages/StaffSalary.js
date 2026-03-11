import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import "./StaffSalary.css";

export default function StaffSalary() {

  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);

  const [form, setForm] = useState({
    role: "nurse",
    careType: "base",
    shift: "day",
    rateType: "daily",
    rate: ""
  });

  const loadRates = async () => {

    setLoading(true);

    const snap = await getDocs(collection(db, "staffRates"));

    const list = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() || {})
    }));

    setRates(list);

    setLoading(false);

  };

  useEffect(() => {
    loadRates();
  }, []);

  const saveRate = async () => {

    if (!form.rate) {
      alert("Enter rate");
      return;
    }

    await addDoc(collection(db, "staffRates"), {
      ...form,
      rate: Number(form.rate),
      createdAt: serverTimestamp()
    });

    setForm({
      role: "nurse",
      careType: "base",
      shift: "day",
      rateType: "daily",
      rate: ""
    });

    setFormOpen(false);

    loadRates();
  };

  return (
    <div className="ss-wrap">

      <div className="ss-header">

        <h2>Staff Salary Rates</h2>

        <button
          className="ss-btn ss-primary"
          onClick={() => setFormOpen(true)}
        >
          + Add Rate
        </button>

      </div>

      {loading && <div className="ss-muted">Loading...</div>}

      {!loading && rates.length === 0 && (
        <div className="ss-muted">No rates added</div>
      )}

      <div className="ss-list">

        {rates.map(r => (
          <div key={r.id} className="ss-card">

            <div className="ss-row">

              <div>
                <strong>{r.role}</strong>
                <div className="ss-muted">
                  {r.careType} · {r.shift}
                </div>
              </div>

              <div className="ss-rate">
                ₹ {r.rate} / {r.rateType}
              </div>

            </div>

          </div>
        ))}

      </div>

      {formOpen && (
        <div className="ss-modal">

          <div className="ss-modal-card">

            <h3>Add Salary Rate</h3>

            <label>Role</label>
            <select
              value={form.role}
              onChange={(e) =>
                setForm(p => ({ ...p, role: e.target.value }))
              }
            >
              <option value="nurse">Nurse</option>
              <option value="caretaker">Caretaker</option>
            </select>

            <label>Care Type</label>
            <select
              value={form.careType}
              onChange={(e) =>
                setForm(p => ({ ...p, careType: e.target.value }))
              }
            >
              <option value="base">Base Care</option>
              <option value="icu">ICU Care</option>
              <option value="vent">Ventilator Care</option>
            </select>

            <label>Shift</label>
            <select
              value={form.shift}
              onChange={(e) =>
                setForm(p => ({ ...p, shift: e.target.value }))
              }
            >
              <option value="day">Day Shift</option>
              <option value="night">Night Shift</option>
              <option value="full">Day & Night</option>
            </select>

            <label>Rate</label>
            <input
              type="number"
              placeholder="Enter rate"
              value={form.rate}
              onChange={(e) =>
                setForm(p => ({ ...p, rate: e.target.value }))
              }
            />

            <div className="ss-actions">

              <button
                className="ss-btn"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>

              <button
                className="ss-btn ss-primary"
                onClick={saveRate}
              >
                Save
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}