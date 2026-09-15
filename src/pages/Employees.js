import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, auth } from "../firebase";
import "./Marketing.css"; // reuse same styling
import jsPDF from "jspdf";

export default function Employees() {
  /* =========================================================
     STATE
  ========================================================= */

  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [saving, setSaving] = useState(false);

  const storage = getStorage();


  /* =========================================================
     DROPDOWN OPTIONS
  ========================================================= */

  const GENDER_OPTIONS = [
    "Male",
    "Female",
    "Other",
  ];

  const BLOOD_GROUP_OPTIONS = [
    "A+",
    "A-",
    "B+",
    "B-",
    "AB+",
    "AB-",
    "O+",
    "O-",
  ];

  const DESIGNATION_OPTIONS = [
    "Manager",
    "Assistant Manager",
    "Team Leader",
    "Executive",
    "Senior Executive",
    "Supervisor",
    "Accountant",
    "HR Executive",
    "Receptionist",
    "Sales Executive",
    "Marketing Executive",
    "Operations Executive",
    "Admin Executive",
    "Developer",
    "Technician",
    "Support Executive",
    "Other",
  ];

  const WORK_TYPE_OPTIONS = [
    "Payroll",
    "Non-Payroll",
    "Full Time",
    "Part Time",
    "Contract",
    "Temporary",
    "Intern",
  ];

  const EMPLOYEE_STATUS_OPTIONS = [
    "Active",
    "Inactive",
    "On Leave",
    "Suspended",
    "Resigned",
    "Terminated",
  ];


  /* =========================================================
     EMPTY FORM
  ========================================================= */

  const empty = {
    employeeId: "",

    name: "",
    email: "",
    phone: "",
    alternatePhone: "",

    dob: "",
    fatherName: "",

    gender: "",
    bloodGroup: "",

    aadharNumber: "",
    panNumber: "",

    designation: "",
    workType: "",

    joiningDate: "",

    employeeStatus: "Active",

    address: "",

    profilePhotoUrl: "",
    profilePhotoFile: null,

    branchId: "",
    salaryMonthly: "",

    role: "",

    active: true,
  };


  const [form, setForm] = useState(empty);


  /* =========================================================
     COMMON FIELD HANDLER
  ========================================================= */

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };


  /* =========================================================
     LOAD EMPLOYEES
  ========================================================= */

  const reload = async () => {
    try {
      setLoading(true);

      const [userSnap, roleSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "roles")),
      ]);

      /*
        Employees screen is for normal employee/user roles.

        Driver / Marketing / Staff have their own screens,
        so keep excluding them here.
      */
      const WORKFORCE_ROLES = [
        "driver",
        "marketing",
        "staff",
      ];

      const users = userSnap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }))
        .filter(
          (u) => !WORKFORCE_ROLES.includes(
            String(u.role || "").toLowerCase()
          )
        );

      setRows(users);

      setRoles(
        roleSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }))
      );
    } catch (err) {
      console.error("Failed to load employees:", err);
      alert("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };


  /* =========================================================
     CURRENT USER ROLE
  ========================================================= */

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) return;

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setUserRole(docSnap.data().role);
        }
      },
      (error) => {
        console.error("Failed to load current user role:", error);
      }
    );

    return () => unsub();
  }, []);


  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    reload();
  }, []);


  /* =========================================================
     SEARCH FILTER
  ========================================================= */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((r) => {
      const text = [
        r.employeeId,

        r.name,
        r.email,
        r.phone,
        r.alternatePhone,

        r.dob,
        r.fatherName,

        r.gender,
        r.bloodGroup,

        r.aadharNumber,
        r.panNumber,

        r.designation,
        r.workType,

        r.joiningDate,
        r.employeeStatus,

        r.address,

        r.branchId,

        r.salaryMonthly,

        r.role,
      ]
        .filter(
          (value) =>
            value !== null &&
            value !== undefined &&
            value !== ""
        )
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [rows, search]);


  /* =========================================================
     DELETE EMPLOYEE
  ========================================================= */

  async function deleteEmployee(user) {
    if (!window.confirm("Delete this employee permanently?")) {
      return;
    }

    try {
      const uid =
        user.authUid ||
        user.uid ||
        user.id;

      const res = await fetch(
        "https://us-central1-medrent-5d771.cloudfunctions.net/deleteUser",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uid }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        throw new Error("Delete failed");
      }

      setRows((prev) =>
        prev.filter((x) => x.id !== user.id)
      );
    } catch (err) {
      console.error(err);
      alert("Failed to delete employee");
    }
  }


  /* =========================================================
     EDIT EMPLOYEE
  ========================================================= */

  const editRow = (r) => {
    setEditingId(r.id);

    setForm({
      employeeId: r.employeeId || "",

      name: r.name || "",
      email: r.email || "",
      phone: r.phone || "",
      alternatePhone: r.alternatePhone || "",

      dob: r.dob || r.dateOfBirth || "",
      fatherName: r.fatherName || "",

      gender: r.gender || "",
      bloodGroup: r.bloodGroup || "",

      aadharNumber:
        r.aadharNumber ||
        r.aadhaarNumber ||
        "",

      panNumber: r.panNumber || "",

      designation: r.designation || "",
      workType: r.workType || "",

      joiningDate: r.joiningDate || "",

      employeeStatus:
        r.employeeStatus ||
        (r.active === false ? "Inactive" : "Active"),

      address: r.address || "",

      profilePhotoUrl:
        r.profilePhotoUrl ||
        r.profilePhoto ||
        "",

      profilePhotoFile: null,

      branchId: r.branchId || "",

      salaryMonthly:
        r.salaryMonthly !== undefined &&
        r.salaryMonthly !== null
          ? r.salaryMonthly
          : "",

      role: r.role || "",

      active: r.active !== false,
    });

    setShowDrawer(true);
  };


  /* =========================================================
     VALIDATION
  ========================================================= */

  const validateForm = () => {
    const employeeId = String(
      form.employeeId || ""
    ).trim();

    const name = String(
      form.name || ""
    ).trim();

    const email = String(
      form.email || ""
    ).trim();

    const phone = String(
      form.phone || ""
    ).trim();

    const alternatePhone = String(
      form.alternatePhone || ""
    ).trim();

    const aadhar = String(
      form.aadharNumber || ""
    ).trim();

    const pan = String(
      form.panNumber || ""
    ).trim();

    const salary = Number(
      form.salaryMonthly || 0
    );


    if (!employeeId) {
      alert("Please enter Employee ID");
      return false;
    }

    if (!name) {
      alert("Please enter employee name");
      return false;
    }

    if (!email) {
      alert("Please enter email");
      return false;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      alert("Please enter a valid email address");
      return false;
    }

    if (!phone) {
      alert("Please enter contact number");
      return false;
    }

    if (
      !/^\d{10}$/.test(
        phone.replace(/\D/g, "")
      )
    ) {
      alert("Contact number must contain 10 digits");
      return false;
    }

    if (alternatePhone) {
      if (
        !/^\d{10}$/.test(
          alternatePhone.replace(/\D/g, "")
        )
      ) {
        alert(
          "Alternate contact number must contain 10 digits"
        );
        return false;
      }
    }

    if (aadhar) {
      if (
        !/^\d{12}$/.test(
          aadhar.replace(/\D/g, "")
        )
      ) {
        alert("Aadhaar number must contain 12 digits");
        return false;
      }
    }

    if (pan) {
      if (
        !/^[A-Za-z]{5}\d{4}[A-Za-z]{1}$/.test(
          pan.toUpperCase()
        )
      ) {
        alert("Please enter a valid PAN number");
        return false;
      }
    }

    if (salary < 0) {
      alert("Salary cannot be negative");
      return false;
    }

    if (form.dob) {
      const dob = new Date(form.dob);
      const today = new Date();

      if (dob > today) {
        alert("Date of birth cannot be in the future");
        return false;
      }
    }

    if (form.joiningDate) {
      const joiningDate = new Date(
        form.joiningDate
      );
      const today = new Date();

      if (joiningDate > today) {
        alert("Joining date cannot be in the future");
        return false;
      }
    }

    return true;
  };


  /* =========================================================
     UPLOAD PROFILE PHOTO
  ========================================================= */

  const uploadProfilePhoto = async (
    file,
    employeeId
  ) => {
    if (!file) {
      return "";
    }

    if (!file.type.startsWith("image/")) {
      throw new Error(
        "Profile photo must be an image file"
      );
    }

    const MAX_SIZE = 5 * 1024 * 1024;

    if (file.size > MAX_SIZE) {
      throw new Error(
        "Profile photo must be less than 5 MB"
      );
    }

    const safeEmployeeId =
      String(employeeId || "employee")
        .replace(/[^a-zA-Z0-9_-]/g, "_");

    const extension =
      file.name.includes(".")
        ? file.name
            .split(".")
            .pop()
            .toLowerCase()
        : "jpg";

    const fileName = `profile_${Date.now()}.${extension}`;

    const storageRef = ref(
      storage,
      `employees/profilePhotos/${safeEmployeeId}/${fileName}`
    );

    await uploadBytes(
      storageRef,
      file
    );

    return await getDownloadURL(
      storageRef
    );
  };


  /* =========================================================
     SAVE EMPLOYEE
  ========================================================= */

  const save = async (e) => {
    e.preventDefault();

    if (saving) return;

    if (!editingId) {
      alert(
        "Employee editing ID is missing"
      );
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      let profilePhotoUrl =
        form.profilePhotoUrl || "";

      /*
        Upload only when a new file was selected.
        Existing profile photo remains untouched otherwise.
      */
      if (form.profilePhotoFile) {
        profilePhotoUrl =
          await uploadProfilePhoto(
            form.profilePhotoFile,
            form.employeeId
          );
      }

      /*
        Do NOT send profilePhotoFile to Firestore.
        File objects cannot be stored directly in Firestore.
      */
      const employeeData = {
        employeeId:
          String(form.employeeId || "").trim(),

        name:
          String(form.name || "").trim(),

        email:
          String(form.email || "")
            .trim()
            .toLowerCase(),

        phone:
          String(form.phone || "")
            .replace(/\D/g, ""),

        alternatePhone:
          String(form.alternatePhone || "")
            .replace(/\D/g, ""),

        dob:
          form.dob || "",

        fatherName:
          String(form.fatherName || "").trim(),

        gender:
          form.gender || "",

        bloodGroup:
          form.bloodGroup || "",

        aadharNumber:
          String(form.aadharNumber || "")
            .replace(/\D/g, ""),

        panNumber:
          String(form.panNumber || "")
            .trim()
            .toUpperCase(),

        designation:
          form.designation || "",

        workType:
          form.workType || "",

        joiningDate:
          form.joiningDate || "",

        employeeStatus:
          form.employeeStatus || "Active",

        address:
          String(form.address || "").trim(),

        profilePhotoUrl:
          profilePhotoUrl,

        branchId:
          String(form.branchId || "").trim(),

        salaryMonthly:
          Number(form.salaryMonthly || 0),

        role:
          form.role || "",

        active:
          form.active !== false,

        updatedAt:
          serverTimestamp(),
      };


      await updateDoc(
        doc(db, "users", editingId),
        employeeData
      );


      setShowDrawer(false);
      setEditingId(null);
      setForm({ ...empty });

      await reload();

    } catch (err) {
      console.error(
        "Failed to update employee:",
        err
      );

      alert(
        err?.message ||
        "Failed to update employee"
      );
    } finally {
      setSaving(false);
    }
  };


  /* =========================================================
     ACTIVE TOGGLE
  ========================================================= */

  const toggleActive = async (r) => {
    try {
      const next =
        !(r.active !== false);

      await updateDoc(
        doc(db, "users", r.id),
        {
          active: next,

          /*
            Keep employeeStatus synchronized
            with the existing Active toggle.
          */
          employeeStatus:
            next
              ? "Active"
              : "Inactive",

          updatedAt:
            serverTimestamp(),
        }
      );

      setRows((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? {
                ...x,
                active: next,
                employeeStatus:
                  next
                    ? "Active"
                    : "Inactive",
              }
            : x
        )
      );

    } catch (err) {
      console.error(
        "Failed to update active status:",
        err
      );

      alert(
        "Failed to update employee status"
      );
    }
  };


  /* =========================================================
     EXPORT EMPLOYEES
  ========================================================= */
/* =========================================================
   PRINT EMPLOYEE PROFILE URLS
   Name + Profile URL ONLY
========================================================= */

const printEmployeeProfileUrls = () => {
  if (!filtered.length) {
    alert("No employees available to print");
    return;
  }

  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let y = 20;

  // Header
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(
    "BookMyMedicare",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(
    "Employee Profile Directory",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 15;

  filtered.forEach((employee, index) => {
    const uid =
      employee.authUid ||
      employee.uid ||
      employee.id;

    if (!uid) return;

    const name =
      String(employee.name || "Employee").trim();

    const profileUrl =
      `https://bookmymedicare.com/employeeprofiles/${encodeURIComponent(uid)}`;

    // New page if required
    if (y > pageHeight - 35) {
      pdf.addPage();
      y = 20;
    }

    // Employee number
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(
      `${index + 1}. ${name}`,
      15,
      y
    );

    y += 7;

    // Profile URL
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    pdf.text(
      profileUrl,
      20,
      y
    );

    y += 12;

    // Separator
    pdf.setDrawColor(210, 210, 210);
    pdf.line(
      15,
      y - 5,
      pageWidth - 15,
      y - 5
    );
  });

  // Footer on every page
  const totalPages =
    pdf.internal.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);

    pdf.text(
      "BookMyMedicare • Employee Management",
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  pdf.save(
    "bookmymedicare_employee_profile_urls.pdf"
  );
};
  const exportEmployees = () => {
    const rowsExport =
      filtered.map((r, i) => ({
        No: i + 1,

        "Employee ID":
          r.employeeId || "",

        Name:
          r.name || "",

        Email:
          r.email || "",

        "Contact Number":
          r.phone || "",

        "Alternate Contact":
          r.alternatePhone || "",

        DOB:
          r.dob ||
          r.dateOfBirth ||
          "",

        "Father Name":
          r.fatherName || "",

        Gender:
          r.gender || "",

        "Blood Group":
          r.bloodGroup || "",

        /*
          Mask Aadhaar in export for safety.
          Example:
          ********1234
        */
        Aadhaar:
          r.aadharNumber
            ? `********${String(
                r.aadharNumber
              ).slice(-4)}`
            : "",

        PAN:
          r.panNumber || "",

        Designation:
          r.designation || "",

        "Work Type":
          r.workType || "",

        "Joining Date":
          r.joiningDate || "",

        "Employee Status":
          r.employeeStatus ||
          (r.active !== false
            ? "Active"
            : "Inactive"),

        Address:
          r.address || "",

        "Profile Photo":
          r.profilePhotoUrl || "",

        Branch:
          r.branchId || "",

        Salary:
          r.salaryMonthly || 0,

        Role:
          r.role || "",

        Active:
          r.active !== false
            ? "Active"
            : "Inactive",
      }));


    if (!rowsExport.length) {
      alert(
        "No employees available to export"
      );
      return;
    }


    const headers =
      Object.keys(rowsExport[0]);


    const escapeCSV = (v) =>
      `"${String(v ?? "")
        .replace(/"/g, '""')}"`;


    const csv = [
      headers.join(","),
      ...rowsExport.map((r) =>
        headers
          .map((h) =>
            escapeCSV(r[h])
          )
          .join(",")
      ),
    ].join("\n");


    const blob = new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );


    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download =
      "employees_export.csv";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };


  /* =========================================================
     PROFILE PHOTO PREVIEW
  ========================================================= */

  const profilePreview =
    form.profilePhotoFile
      ? URL.createObjectURL(
          form.profilePhotoFile
        )
      : form.profilePhotoUrl || "";


  /* =========================================================
     CLOSE DRAWER
  ========================================================= */

  const closeDrawer = () => {
    if (saving) return;

    setShowDrawer(false);
    setEditingId(null);
    setForm({ ...empty });
  };


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="marketing-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "15px",
          flexWrap: "wrap",
        }}
      >
        <h2>Employees</h2>
      </div>


      {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <div className="marketing-toolbar">

  <input
    type="text"
    placeholder="Search employees..."
    value={search}
    onChange={(e) =>
      setSearch(e.target.value)
    }
  />

  <button
    className="cp-btn ghost"
    onClick={exportEmployees}
    type="button"
  >
    Export
  </button>

  <button
    className="cp-btn ghost"
    onClick={printEmployeeProfileUrls}
    type="button"
  >
    Print Profile URLs
  </button>

</div>


      {/* =====================================================
          DRAWER OVERLAY
      ===================================================== */}

      {showDrawer && (
        <div
          className="drawer-overlay"
          onClick={closeDrawer}
        />
      )}


      {/* =====================================================
          DRAWER
      ===================================================== */}

      <div
        className={`drawer ${
          showDrawer ? "open" : ""
        }`}
      >

        <div className="drawer-header">

          <h3>
            Edit Employee
          </h3>

          <button
            className="cp-btn ghost"
            onClick={closeDrawer}
            type="button"
          >
            Close
          </button>

        </div>


        {/* ===================================================
            FORM
        =================================================== */}

        <form
          onSubmit={save}
          className="marketing-form"
        >

          {/* =================================================
              EMPLOYEE BASIC INFORMATION
          ================================================= */}

          <div
            style={{
              marginBottom: "8px",
              fontWeight: 700,
              fontSize: "15px",
            }}
          >
            Employee Information
          </div>


          {/* Employee ID */}

          <input
            type="text"
            placeholder="Employee ID *"
            value={form.employeeId}
            onChange={(e) =>
              updateForm(
                "employeeId",
                e.target.value
              )
            }
            required
          />


          {/* Name */}

          <input
            type="text"
            placeholder="Full Name *"
            value={form.name}
            onChange={(e) =>
              updateForm(
                "name",
                e.target.value
              )
            }
            required
          />


          {/* Email */}

          <input
            type="email"
            placeholder="Email *"
            value={form.email}
            onChange={(e) =>
              updateForm(
                "email",
                e.target.value
              )
            }
            required
          />


          {/* Contact */}

          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="Contact Number *"
            value={form.phone}
            onChange={(e) =>
              updateForm(
                "phone",
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 10)
              )
            }
            required
          />


          {/* Alternate Contact */}

          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="Alternate Contact Number"
            value={
              form.alternatePhone
            }
            onChange={(e) =>
              updateForm(
                "alternatePhone",
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 10)
              )
            }
          />


          {/* DOB */}

          <label>
            Date of Birth
          </label>

          <input
            type="date"
            value={form.dob}
            onChange={(e) =>
              updateForm(
                "dob",
                e.target.value
              )
            }
          />


          {/* Father Name */}

          <input
            type="text"
            placeholder="Father Name"
            value={
              form.fatherName
            }
            onChange={(e) =>
              updateForm(
                "fatherName",
                e.target.value
              )
            }
          />


          {/* =================================================
              PERSONAL DETAILS
          ================================================= */}

          <div
            style={{
              marginTop: "10px",
              marginBottom: "8px",
              fontWeight: 700,
              fontSize: "15px",
            }}
          >
            Personal Details
          </div>


          {/* Gender */}

          <select
            value={form.gender}
            onChange={(e) =>
              updateForm(
                "gender",
                e.target.value
              )
            }
          >
            <option value="">
              Select Gender
            </option>

            {GENDER_OPTIONS.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>


          {/* Blood Group */}

          <select
            value={form.bloodGroup}
            onChange={(e) =>
              updateForm(
                "bloodGroup",
                e.target.value
              )
            }
          >
            <option value="">
              Select Blood Group
            </option>

            {BLOOD_GROUP_OPTIONS.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>


          {/* Aadhaar */}

          <input
            type="text"
            inputMode="numeric"
            maxLength={12}
            placeholder="Aadhaar Number"
            value={
              form.aadharNumber
            }
            onChange={(e) =>
              updateForm(
                "aadharNumber",
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 12)
              )
            }
          />


          {/* PAN */}

          <input
            type="text"
            maxLength={10}
            placeholder="PAN Number"
            value={
              form.panNumber
            }
            onChange={(e) =>
              updateForm(
                "panNumber",
                e.target.value
                  .toUpperCase()
                  .slice(0, 10)
              )
            }
          />


          {/* =================================================
              JOB DETAILS
          ================================================= */}

          <div
            style={{
              marginTop: "10px",
              marginBottom: "8px",
              fontWeight: 700,
              fontSize: "15px",
            }}
          >
            Employment Details
          </div>


          {/* Designation */}

          <input
  type="text"
  placeholder="Designation"
  value={form.designation}
  onChange={(e) =>
    updateForm("designation", e.target.value)
  }
/>

<input
  type="text"
  placeholder="Work Type"
  value={form.workType}
  onChange={(e) =>
    updateForm("workType", e.target.value)
  }
/>


          {/* Joining Date */}

          <label>
            Joining Date
          </label>

          <input
            type="date"
            value={
              form.joiningDate
            }
            onChange={(e) =>
              updateForm(
                "joiningDate",
                e.target.value
              )
            }
          />


          {/* Employee Status */}

          <select
            value={
              form.employeeStatus
            }
            onChange={(e) => {
              const status =
                e.target.value;

              updateForm(
                "employeeStatus",
                status
              );

              /*
                Keep Active checkbox
                synchronized.
              */
              if (
                status === "Active"
              ) {
                updateForm(
                  "active",
                  true
                );
              } else if (
                status === "Inactive" ||
                status === "Resigned" ||
                status === "Terminated" ||
                status === "Suspended"
              ) {
                updateForm(
                  "active",
                  false
                );
              }
            }}
          >
            {EMPLOYEE_STATUS_OPTIONS.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>


          {/* =================================================
              ADDRESS
          ================================================= */}

          <div
            style={{
              marginTop: "10px",
              marginBottom: "8px",
              fontWeight: 700,
              fontSize: "15px",
            }}
          >
            Address Information
          </div>


          <textarea
            placeholder="Complete Address"
            value={form.address}
            onChange={(e) =>
              updateForm(
                "address",
                e.target.value
              )
            }
            rows={4}
            style={{
              resize: "vertical",
            }}
          />


          {/* =================================================
              PROFILE PHOTO
          ================================================= */}

          <div
            style={{
              marginTop: "10px",
              marginBottom: "8px",
              fontWeight: 700,
              fontSize: "15px",
            }}
          >
            Profile Photo
          </div>


          {profilePreview && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "10px",
              }}
            >
              <img
                src={profilePreview}
                alt="Employee profile"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border:
                    "1px solid #ddd",
                }}
              />

              <div
                style={{
                  fontSize: "12px",
                  opacity: 0.7,
                }}
              >
                Current profile photo
              </div>
            </div>
          )}


          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file =
                e.target.files?.[0] ||
                null;

              updateForm(
                "profilePhotoFile",
                file
              );
            }}
          />


          <small
            style={{
              display: "block",
              marginTop: "-4px",
              marginBottom: "8px",
              opacity: 0.65,
            }}
          >
            JPG, PNG, WEBP or other
            image format. Maximum 5 MB.
          </small>


          {/* =================================================
              COMPANY DETAILS
          ================================================= */}

          <div
            style={{
              marginTop: "10px",
              marginBottom: "8px",
              fontWeight: 700,
              fontSize: "15px",
            }}
          >
            Company Details
          </div>


          {/* Branch */}

          <input
            type="text"
            placeholder="Branch"
            value={form.branchId}
            onChange={(e) =>
              updateForm(
                "branchId",
                e.target.value
              )
            }
          />


          {/* Monthly Salary */}

          <input
            type="number"
            min="0"
            placeholder="Monthly Salary (₹)"
            value={
              form.salaryMonthly
            }
            onChange={(e) =>
              updateForm(
                "salaryMonthly",
                e.target.value
              )
            }
          />


          {/* System Role */}

          <select
            value={form.role}
            onChange={(e) =>
              updateForm(
                "role",
                e.target.value
              )
            }
          >
            <option value="">
              No role
            </option>

            {roles.map((r) => (
              <option
                key={r.id}
                value={r.id}
              >
                {r.label ||
                  r.name ||
                  r.id}
              </option>
            ))}
          </select>


          {/* Active */}

          <label className="switch-row">

            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => {
                const active =
                  e.target.checked;

                setForm((prev) => ({
                  ...prev,
                  active,
                  employeeStatus:
                    active
                      ? "Active"
                      : "Inactive",
                }));
              }}
            />

            Active

          </label>


          {/* =================================================
              ACTIONS
          ================================================= */}

          <div className="actions-row">

            <button
              className="cp-btn"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save"}
            </button>


            <button
              type="button"
              className="cp-btn ghost"
              onClick={closeDrawer}
              disabled={saving}
            >
              Cancel
            </button>

          </div>

        </form>

      </div>


      {/* =====================================================
          TABLE
      ===================================================== */}

      <div className="marketing-table">

        {loading ? (

          <p>
            Loading employees...
          </p>

        ) : (

          <table>

            <thead>

              <tr>
                <th>#</th>
                <th>Profile</th>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Designation</th>
                <th>Work Type</th>
                <th>Branch</th>
                <th>Salary</th>
                <th>Employee Status</th>
                <th>Role</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>

            </thead>


            <tbody>

              {filtered.length === 0 ? (

                <tr>
                  <td
                    colSpan="14"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    No employees found
                  </td>
                </tr>

              ) : (

                filtered.map((r, i) => (

                  <tr key={r.id}>

                    {/* Number */}

                    <td>
                      {i + 1}
                    </td>


                    {/* Profile */}

                    <td>

                      {r.profilePhotoUrl ||
                      r.profilePhoto ? (

                        <img
                          src={
                            r.profilePhotoUrl ||
                            r.profilePhoto
                          }
                          alt={
                            r.name ||
                            "Employee"
                          }
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius:
                              "50%",
                            objectFit:
                              "cover",
                            border:
                              "1px solid #ddd",
                          }}
                        />

                      ) : (

                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius:
                              "50%",
                            display: "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            background:
                              "#f1f3f5",
                            fontWeight: 700,
                            fontSize: "14px",
                          }}
                        >
                          {(
                            r.name ||
                            "E"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                      )}

                    </td>


                    {/* Employee ID */}

                    <td>
                      {r.employeeId ||
                        "-"}
                    </td>


                    {/* Name */}

                    <td>
                      {r.name || "-"}
                    </td>


                    {/* Email */}

                    <td>
                      {r.email || "-"}
                    </td>


                    {/* Phone */}

                    <td>
                      {r.phone || "-"}
                    </td>


                    {/* Designation */}

                    <td>
                      {r.designation ||
                        "-"}
                    </td>


                    {/* Work Type */}

                    <td>
                      {r.workType ||
                        "-"}
                    </td>


                    {/* Branch */}

                    <td>
                      {r.branchId ||
                        "-"}
                    </td>


                    {/* Salary */}

                    <td>
                      ₹
                      {Number(
                        r.salaryMonthly ||
                          0
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </td>


                    {/* Employee Status */}

                    <td>
                      {r.employeeStatus ||
                        (r.active !== false
                          ? "Active"
                          : "Inactive")}
                    </td>


                    {/* Role */}

                    <td>
                      {r.role || "-"}
                    </td>


                    {/* Active */}

                    <td>

                      <button
                        type="button"
                        className="cp-btn ghost"
                        onClick={() =>
                          toggleActive(r)
                        }
                      >
                        {r.active !== false
                          ? "Active"
                          : "Inactive"}
                      </button>

                    </td>


                    {/* Actions */}

                    <td>

                      <div className="marketing-actions">

                        {/* Edit */}

                        <button
                          type="button"
                          className="mk-btn edit"
                          onClick={() =>
                            editRow(r)
                          }
                        >
                          Edit
                        </button>


                        {/* Attendance */}

                        <button
                          type="button"
                          className="mk-btn attendance"
                          onClick={() =>
                            (window.location.href =
                              `/crm/attendance?role=users&driverId=${r.id}`)
                          }
                        >
                          Attendance
                        </button>


                        {/* Tracking */}

                        <button
                          type="button"
                          className="mk-btn track"
                          onClick={() =>
                            (window.location.href =
                              `/crm/tracking?role=users&driverId=${r.id}`)
                          }
                        >
                          Track
                        </button>


                        {/* Delete */}

                        {userRole ===
                          "superadmin" && (

                          <button
                            type="button"
                            className="mk-btn delete"
                            onClick={() =>
                              deleteEmployee(r)
                            }
                          >
                            Delete
                          </button>

                        )}

                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        )}

      </div>

    </div>
  );
}