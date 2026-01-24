import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  setDoc,
  doc,
  serverTimestamp,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Staff.css";

export default function Staff() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const empty = {
    name: "",
    loginEmail: "",
    phone: "",
    alternatePhone: "",

    aadharNumber: "",
    panNumber: "",

    gender: "",
    dateOfBirth: "",
    bloodGroup: "",
    address: "",

    staffType: "nurse",
    qualifications: "",
    experienceYears: "",
    servicesOffered: "",
    shiftPreference: "day",

    baseRate: "",
    rateType: "daily",

    emergencyContactName: "",
    emergencyContactPhone: "",
    relation: "",

    joiningDate: "",

    available: true,
    active: true,

    authUid: "",
  };

  const [form, setForm] = useState(empty);

  /* ================= FETCH ================= */
  const reload = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
    } catch (e) {
      console.error(e);
      setError("Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (editingId) setShowForm(true);
  }, [editingId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setShowForm(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ================= HELPERS ================= */
  const validate = (p) => {
    if (!p.name.trim()) return "Name is required";
    if (!p.loginEmail.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.loginEmail))
      return "Invalid email";
    if (p.aadharNumber && p.aadharNumber.length < 12)
      return "Invalid Aadhaar number";
    return "";
  };

  const normalize = (p) => ({
    name: p.name.trim(),
    loginEmail: p.loginEmail.trim().toLowerCase(),
    phone: p.phone.trim(),
    alternatePhone: p.alternatePhone.trim(),

    aadharNumber: p.aadharNumber.trim(),
    panNumber: p.panNumber.trim(),

    gender: p.gender,
    dateOfBirth: p.dateOfBirth || "",
    bloodGroup: p.bloodGroup || "",
    address: p.address.trim(),

    staffType: p.staffType,
    qualifications: p.qualifications.trim(),
    experienceYears:
      p.experienceYears === "" ? "" : Number(p.experienceYears),

    servicesOffered: p.servicesOffered
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),

    shiftPreference: p.shiftPreference,

    baseRate: p.baseRate === "" ? "" : Number(p.baseRate),
    rateType: p.rateType,

    emergencyContactName: p.emergencyContactName.trim(),
    emergencyContactPhone: p.emergencyContactPhone.trim(),
    relation: p.relation.trim(),

    joiningDate: p.joiningDate || "",

    available: !!p.available,
    active: !!p.active,

    role: "staff",
    updatedAt: serverTimestamp(),
  });

  /* ================= SAVE ================= */
  const save = async (e) => {
    e.preventDefault();
    setError("");

    const payload = normalize(form);
    const msg = validate(payload);
    if (msg) return setError(msg);

    try {
      if (editingId) {
        await updateDoc(doc(db, "staff", editingId), payload);
      } else {
        if (payload.authUid) {
          await setDoc(
            doc(db, "staff", payload.authUid),
            {
              ...payload,
              uid: payload.authUid,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          await addDoc(collection(db, "staff"), {
            ...payload,
            createdAt: serverTimestamp(),
          });
        }
      }

      setForm(empty);
      setEditingId(null);
      setShowForm(false);
      reload();
    } catch (e) {
      console.error(e);
      setError("Failed to save staff");
    }
  };

  const editRow = (r) => {
    setEditingId(r.id);
    setForm({
      ...empty,
      ...r,
      servicesOffered: (r.servicesOffered || []).join(", "),
      experienceYears: r.experienceYears ?? "",
      baseRate: r.baseRate ?? "",
      authUid: r.uid || "",
    });
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this staff member?")) return;
    await deleteDoc(doc(db, "staff", id));
    setRows((p) => p.filter((x) => x.id !== id));
  };

  /* ================= FILTER ================= */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const text = [
        r.name,
        r.loginEmail,
        r.phone,
        r.staffType,
        ...(r.servicesOffered || []),
      ]
        .join(" ")
        .toLowerCase();

      const qOk = !q || text.includes(q);
      const tOk = typeFilter === "all" ? true : r.staffType === typeFilter;
      return qOk && tOk;
    });
  }, [rows, search, typeFilter]);

  /* ================= UI ================= */
  return (
    <div className="staff-page">
      <h2>Nursing & Caretaker Management</h2>

      <div className="staff-toolbar">
        <input
          placeholder="Search staff..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="nurse">Nurse</option>
          <option value="caretaker">Caretaker</option>
        </select>
        <button
          className="cp-btn"
          onClick={() => {
            setForm(empty);
            setEditingId(null);
            setShowForm(true);
          }}
        >
          Add Staff
        </button>
      </div>

      {showForm && (
        <div className="drawer-overlay" onClick={() => setShowForm(false)} />
      )}
      <div className={`drawer ${showForm ? "open" : ""}`}>
        <div className="drawer-header">
          <h3>{editingId ? "Edit Staff" : "Add Staff"}</h3>
          <button className="cp-btn ghost" onClick={() => setShowForm(false)}>
            Close
          </button>
        </div>

        <form className="staff-form" onSubmit={save}>
          <input placeholder="Full Name *" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />

          <input placeholder="Login Email *" value={form.loginEmail}
            onChange={(e) => setForm({ ...form, loginEmail: e.target.value })} />

          <input placeholder="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <input placeholder="Alternate Phone" value={form.alternatePhone}
            onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })} />

          <input placeholder="Aadhaar Number" value={form.aadharNumber}
            onChange={(e) => setForm({ ...form, aadharNumber: e.target.value })} />

          <input placeholder="PAN Number" value={form.panNumber}
            onChange={(e) => setForm({ ...form, panNumber: e.target.value })} />

          <textarea placeholder="Address" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />

          <select value={form.staffType}
            onChange={(e) => setForm({ ...form, staffType: e.target.value })}>
            <option value="nurse">Nurse</option>
            <option value="caretaker">Caretaker</option>
          </select>

          <input placeholder="Qualifications" value={form.qualifications}
            onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />

          <input type="number" placeholder="Experience (years)"
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />

          <input placeholder="Services (comma separated)"
            value={form.servicesOffered}
            onChange={(e) => setForm({ ...form, servicesOffered: e.target.value })} />

          <input type="number" placeholder="Base Rate"
            value={form.baseRate}
            onChange={(e) => setForm({ ...form, baseRate: e.target.value })} />

          <select value={form.rateType}
            onChange={(e) => setForm({ ...form, rateType: e.target.value })}>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>

          <input placeholder="Emergency Contact Name"
            value={form.emergencyContactName}
            onChange={(e) =>
              setForm({ ...form, emergencyContactName: e.target.value })
            } />

          <input placeholder="Emergency Contact Phone"
            value={form.emergencyContactPhone}
            onChange={(e) =>
              setForm({ ...form, emergencyContactPhone: e.target.value })
            } />

          <div className="actions-row">
            <button className="cp-btn">
              {editingId ? "Update Staff" : "Add Staff"}
            </button>
            <button type="button" className="cp-btn ghost"
              onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </form>
      </div>

      <div className="staff-table">
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Aadhaar</th>
                <th>Services</th>
                <th>Rate</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.staffType}</td>
                  <td>{r.phone || "-"}</td>
                  <td>
                    {r.aadharNumber
                      ? `XXXX-XXXX-${r.aadharNumber.slice(-4)}`
                      : "-"}
                  </td>
                  <td>{(r.servicesOffered || []).join(", ")}</td>
                  <td>
                    {r.baseRate
                      ? `₹${r.baseRate}/${r.rateType}`
                      : "-"}
                  </td>
                  <td>
                    <button className="cp-btn ghost" onClick={() => editRow(r)}>
                      Edit
                    </button>
                    <button className="cp-btn ghost" onClick={() => remove(r.id)}>
                      Delete
                    </button>
                    <button
                      className="cp-btn ghost"
                      onClick={() =>
                        navigate(`/crm/attendance?role=staff&userId=${r.id}`)
                      }
                    >
                      Attendance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
