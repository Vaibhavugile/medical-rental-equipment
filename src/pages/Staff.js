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
  where,
  onSnapshot
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Staff.css";
import { useRef } from "react";

export default function Staff({ defaultType = "all" }) {
  const navigate = useNavigate();
const servicesRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const [servicesOpen, setServicesOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(defaultType);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [careTypes, setCareTypes] = useState([]);
  const [userRole, setUserRole] = useState(null);
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

    staffType: defaultType === "all" ? "nurse" : defaultType,
    qualifications: "",
    experienceYears: "",
   servicesOffered: [],
    shiftPreference: "day",
    shiftType: "day",



    emergencyContactName: "",
    emergencyContactPhone: "",
    relation: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfsc: "",
    upiId: "",

    joiningDate: "",

    available: true,
    active: true,

    authUid: "",
  };

  const [form, setForm] = useState(empty);
  useEffect(() => {
    const loadCareTypes = async () => {
      const snap = await getDocs(collection(db, "careTypes"));

      const list = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() || {})
      }));

      setCareTypes(list);
    };

    loadCareTypes();
  }, []);
  useEffect(() => {
  const handleClickOutside = (event) => {
    if (
      servicesRef.current &&
      !servicesRef.current.contains(event.target)
    ) {
      setServicesOpen(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);
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
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserRole(docSnap.data().role);
      }
    });

    return () => unsub();
  }, []);

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

  const emailExists = async (email) => {
    const staffQuery = query(
      collection(db, "staff"),
      where("loginEmail", "==", email)
    );

    const userQuery = query(
      collection(db, "users"),
      where("email", "==", email)
    );

    const [staffSnap, userSnap] = await Promise.all([
      getDocs(staffQuery),
      getDocs(userQuery),
    ]);

    return !staffSnap.empty || !userSnap.empty;
  };

  /* ================= HELPERS ================= */
  const validate = (p) => {

    /* ================= NAME ================= */
    if (!p.name.trim()) return "Name is required";
    if (!/^[A-Za-z\s]{3,50}$/.test(p.name))
      return "Name should contain only letters and spaces";

    /* ================= EMAIL ================= */
    if (!p.loginEmail.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.loginEmail))
      return "Invalid email format";

    /* ================= PHONE ================= */
    if (!p.phone) return "Phone number is required";
    if (!/^[6-9]\d{9}$/.test(p.phone))
      return "Invalid Indian phone number";

    if (p.alternatePhone && !/^[6-9]\d{9}$/.test(p.alternatePhone))
      return "Invalid alternate phone number";

    /* ================= AADHAAR ================= */
    if (p.aadharNumber && !/^\d{12}$/.test(p.aadharNumber))
      return "Aadhaar must be exactly 12 digits";

    /* ================= PAN ================= */
    if (p.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(p.panNumber))
      return "Invalid PAN format (ABCDE1234F)";

    /* ================= ADDRESS ================= */
    if (p.address && p.address.length < 5)
      return "Address is too short";

    /* ================= EXPERIENCE ================= */
    if (p.experienceYears && (p.experienceYears < 0 || p.experienceYears > 60))
      return "Experience must be between 0 and 60 years";

    /* ================= SERVICES ================= */
    if (p.servicesOffered && p.servicesOffered.length > 200)
      return "Services description too long";

    /* ================= SHIFT ================= */
    if (!p.shiftType) return "Please select shift type";

    /* ================= RATE ================= */


    /* ================= EMERGENCY CONTACT ================= */
    if (p.emergencyContactPhone && !/^[6-9]\d{9}$/.test(p.emergencyContactPhone))
      return "Invalid emergency contact phone";

    /* ================= BANK ACCOUNT ================= */
    if (p.bankAccountNumber && !/^\d{9,18}$/.test(p.bankAccountNumber))
      return "Invalid bank account number";

    /* ================= IFSC ================= */
    if (p.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(p.bankIfsc))
      return "Invalid IFSC code";



    /* ================= UPI ================= */
    if (p.upiId && !/^[\w.-]+@[\w.-]+$/.test(p.upiId))
      return "Invalid UPI ID";

    return "";
  };
  useEffect(() => {
    if (error) {
      const alert = document.querySelector(".staff-alert");
      if (alert) {
        alert.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    }
  }, [error]);
  const handleEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      const form = e.target.form;
      const index = Array.prototype.indexOf.call(form, e.target);

      if (form.elements[index + 1]) {
        form.elements[index + 1].focus();
      }
    }
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

   servicesOffered: p.servicesOffered || [],

    shiftPreference: p.shiftPreference,
    shiftType: p.shiftType,



    emergencyContactName: p.emergencyContactName.trim(),
    emergencyContactPhone: p.emergencyContactPhone.trim(),
    relation: p.relation.trim(),

    joiningDate: p.joiningDate || "",
    bankName: p.bankName.trim(),
    bankAccountNumber: p.bankAccountNumber.trim(),
    bankIfsc: p.bankIfsc.trim().toUpperCase(),
    upiId: p.upiId.trim().toLowerCase(),
    available: !!p.available,
    active: !!p.active,

    role: "staff",
    updatedAt: serverTimestamp(),
  });

  /* ================= SAVE ================= */
  const save = async (e) => {
    e.preventDefault();
    setError("");

    const msg = validate(form);
    if (msg) return setError(msg);

    const payload = normalize(form);

    try {



      // ✅ Check duplicate email only when creating new
      if (!editingId) {
        const exists = await emailExists(payload.loginEmail);

        if (exists) {
          setError("This email already exists in the system.");
          return;
        }
      }
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
     servicesOffered: r.servicesOffered || [],
      experienceYears: r.experienceYears ?? "",

      authUid: r.uid || "",
    });
  };

  const remove = async (staff) => {

    if (!window.confirm("Delete this staff member permanently?")) return;

    try {

      const uid = staff.authUid || staff.uid || staff.id;

      await fetch(
        "https://us-central1-medrent-5d771.cloudfunctions.net/deleteUser",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            uid
          })
        }
      );

      setRows(prev =>
        prev.filter(x => x.id !== staff.id)
      );

    } catch (err) {

      console.error("deleteStaff", err);
      setError("Failed to delete staff member.");

    }

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
      <h2>
        {defaultType === "caretaker"
          ? "Caretaker Management"
          : defaultType === "nurse"
            ? "Nursing Staff Management"
            : "Nursing & Caretaker Management"}
      </h2>

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
          {defaultType === "caretaker" ? "Add Caretaker" : "Add Nurse"}
        </button>


      </div>

      {showForm && (
        <div className="drawer-overlay" onClick={() => setShowForm(false)} />
      )}
      <div className={`drawer ${showForm ? "open" : ""}`}>
        <div className="drawer-header">
          <h3>
            {editingId
              ? defaultType === "caretaker"
                ? "Edit Caretaker"
                : "Edit Nurse"
              : defaultType === "caretaker"
                ? "Add Caretaker"
                : "Add Nurse"}
          </h3>
          <button className="cp-btn ghost" onClick={() => setShowForm(false)}>
            Close
          </button>
        </div>
        {error && (
          <div className="staff-alert">
            ⚠ {error}
          </div>
        )}

        <form className="staff-form" onSubmit={save} onKeyDown={handleEnter}>
          <input placeholder="Full Name *" value={form.name}
            onChange={(e) => {
              const value = e.target.value.replace(/[^A-Za-z\s]/g, "");
              setForm({ ...form, name: value });
            }} />

          <input placeholder="Login Email *" value={form.loginEmail}
            onChange={(e) => setForm({ ...form, loginEmail: e.target.value })} />

          <input
            placeholder="Phone *"
            value={form.phone}
            maxLength={10}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, ""); // numbers only
              if (value.length <= 10) {
                setForm({ ...form, phone: value });
              }
            }}
          />

          <input
            placeholder="Alternate Phone"
            value={form.alternatePhone}
            maxLength={10}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= 10) {
                setForm({ ...form, alternatePhone: value });
              }
            }}
          />
          <input
            placeholder="Aadhaar Number"
            value={form.aadharNumber}
            maxLength={12}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, ""); // numbers only
              if (value.length <= 12) {
                setForm({ ...form, aadharNumber: value });
              }
            }}
          />

          <input placeholder="PAN Number" value={form.panNumber}
            onChange={(e) =>
              setForm({ ...form, panNumber: e.target.value.toUpperCase() })
            } />

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

         <div className="services-dropdown" ref={servicesRef}>

  {/* SELECT BOX */}
  <div
    className="services-select"
    onClick={() => setServicesOpen(!servicesOpen)}
  >
    {form.servicesOffered.length
      ? form.servicesOffered.join(", ")
      : "Select Services"}
  </div>

  {/* DROPDOWN */}
  {servicesOpen && (
    <div className="services-menu">

      {careTypes.map(c => {

        const selected = form.servicesOffered.includes(c.name);

        return (
          <label key={c.id} className="service-option">

            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {

                if (e.target.checked) {
                  setForm({
                    ...form,
                    servicesOffered: [...form.servicesOffered, c.name]
                  });
                } else {
                  setForm({
                    ...form,
                    servicesOffered: form.servicesOffered.filter(
                      s => s !== c.name
                    )
                  });
                }

              }}
            />

            {c.name}

          </label>
        );
      })}

    </div>
  )}

</div>
          <select
            value={form.shiftType}
            onChange={(e) =>
              setForm({ ...form, shiftType: e.target.value })
            }
          >
            <option value="">Select Shift</option>

            <option value="day">Day Shift</option>
            <option value="night">Night Shift</option>
            <option value="full">Full Day (24hr)</option>
            <option value="flexible">Flexible</option>
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
          <h4>Bank Details</h4>

          <input
            placeholder="Bank Name"
            value={form.bankName}
            onChange={(e) =>
              setForm({ ...form, bankName: e.target.value })
            }
          />
          <input
            placeholder="Account Number"
            value={form.bankAccountNumber}
            maxLength={18}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= 18) {
                setForm({ ...form, bankAccountNumber: value });
              }
            }}
          />

          <input
            placeholder="IFSC Code"
            value={form.bankIfsc}
            maxLength={11}
            onChange={(e) => {
              const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
              if (value.length <= 11) {
                setForm({ ...form, bankIfsc: value });
              }
            }}
          />
          <input
            placeholder="UPI ID"
            value={form.upiId}
            onChange={(e) =>
              setForm({ ...form, upiId: e.target.value })
            }
          />

          <div className="actions-row">
            <button className="cp-btn">
              {editingId
                ? defaultType === "caretaker"
                  ? "Update Caretaker"
                  : "Update Nurse"
                : defaultType === "caretaker"
                  ? "Add Caretaker"
                  : "Add Nurse"}
            </button>
            <button type="button" className="cp-btn ghost"
              onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>

          {/* {error && <div className="error">{error}</div}> */}
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
                <th>Shift</th>
                <th>Phone</th>
                <th>Aadhaar</th>
                <th>Services</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td
                    className="staff-name-link"
                    onClick={() => navigate(`/crm/staff/${r.id}`)}
                  >
                    {r.name}
                  </td>

                  <td>{r.staffType}</td>

                  <td>
                    {r.shiftType
                      ? r.shiftType.charAt(0).toUpperCase() + r.shiftType.slice(1)
                      : "-"}
                  </td>

                  <td>{r.phone || "-"}</td>
                  <td>
                    {r.aadharNumber
                      ? `XXXX-XXXX-${r.aadharNumber.slice(-4)}`
                      : "-"}
                  </td>
                  <td>{(r.servicesOffered || []).join(", ")}</td>

                  <td>
                    <div className="staff-actions">

                      <button
                        className="st-btn view"
                        onClick={() => navigate(`/crm/staff/${r.id}`)}
                      >
                        View
                      </button>

                      <button
                        className="st-btn edit"
                        onClick={() => editRow(r)}
                      >
                        Edit
                      </button>
                      {userRole === "superadmin" && (
                        <button
                          className="st-btn delete"
                          onClick={() => remove(r)}
                        >
                          Delete
                        </button>
                      )}

                      <button
                        className="st-btn attendance"
                        onClick={() =>
                          navigate(`/crm/attendance?role=staff&userId=${r.id}`)
                        }
                      >
                        Attendance
                      </button>

                    </div>
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
