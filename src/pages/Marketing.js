// Marketing.js — Marketing Management
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
  onSnapshot,
} from "firebase/firestore";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, auth } from "../firebase";
import "./Marketing.css";
import QRCode from "qrcode";
import jsPDF from "jspdf";
export default function Marketing() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const storage = getStorage();

  /*
   * ============================================================
   * EMPTY FORM
   * Existing fields are preserved.
   * New employee fields are added.
   * ============================================================
   */

  const empty = {
    // NEW EMPLOYEE INFORMATION
    employeeId: "",
    dob: "",
    fatherName: "",
    gender: "",
    bloodGroup: "",
    designation: "",
    workType: "",
    joiningDate: "",
    employeeStatus: "Active",
    address: "",
    profilePhotoUrl: "",
    profilePhotoFile: null,

    // EXISTING FIELDS
    name: "",
    loginEmail: "",
    phone: "",
    branchId: "",
    salaryMonthly: "",
    active: true,
    authUid: "",
    sourceLabels: [],
  };

  const [leadSourceSearch, setLeadSourceSearch] = useState("");
  const [form, setForm] = useState(empty);
  const [leadSources, setLeadSources] = useState([]);

  /*
   * ============================================================
   * LOAD MARKETING USERS
   * ============================================================
   */

  const reload = async () => {
    setLoading(true);

    try {
      const q = query(
        collection(db, "marketing"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      setRows(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }))
      );
    } catch (err) {
      console.error("fetch marketing", err);
      setError("Failed to load marketing users.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * ============================================================
   * LOAD CURRENT USER ROLE
   * ============================================================
   */

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) return;

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setUserRole(docSnap.data().role);
        }
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    reload();
  }, []);

  /*
   * ============================================================
   * AUTO OPEN DRAWER WHEN EDITING
   * ============================================================
   */

  useEffect(() => {
    if (editingId) {
      setShowForm(true);
    }
  }, [editingId]);

  /*
   * ============================================================
   * ESC TO CLOSE
   * ============================================================
   */

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowForm(false);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  /*
   * ============================================================
   * LOAD LEAD SOURCES
   * ============================================================
   */

  useEffect(() => {
    const loadLeadSources = async () => {
      try {
        const snap = await getDocs(
          collection(db, "leadSources")
        );

        const arr = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter((source) => source.active !== false)
          .sort((a, b) =>
            String(a.name || "").localeCompare(
              String(b.name || "")
            )
          );

        setLeadSources(arr);
      } catch (err) {
        console.error("load lead sources error", err);
      }
    };

    loadLeadSources();
  }, []);

  /*
   * ============================================================
   * CHECK DUPLICATE EMAIL
   * ============================================================
   */

  const emailExists = async (email) => {
    const marketingQuery = query(
      collection(db, "marketing"),
      where("loginEmail", "==", email)
    );

    const staffQuery = query(
      collection(db, "staff"),
      where("loginEmail", "==", email)
    );

    const usersQuery = query(
      collection(db, "users"),
      where("email", "==", email)
    );

    const [
      marketingSnap,
      staffSnap,
      usersSnap,
    ] = await Promise.all([
      getDocs(marketingQuery),
      getDocs(staffQuery),
      getDocs(usersQuery),
    ]);

    return (
      !marketingSnap.empty ||
      !staffSnap.empty ||
      !usersSnap.empty
    );
  };

  /*
   * ============================================================
   * VALIDATION
   * ============================================================
   */

  const validate = (p) => {
    /*
     * EMPLOYEE ID
     */

    if (!p.employeeId.trim()) {
      return "Employee ID is required";
    }

    if (
      !/^[A-Za-z0-9_-]{2,30}$/.test(
        p.employeeId.trim()
      )
    ) {
      return "Employee ID can contain only letters, numbers, hyphens and underscores";
    }

    /*
     * NAME
     */

    if (!p.name.trim()) {
      return "Name is required";
    }

    if (!/^[A-Za-z\s]{3,50}$/.test(p.name)) {
      return "Name should contain only letters and spaces";
    }

    /*
     * EMAIL
     */

    if (!p.loginEmail.trim()) {
      return "Email is required";
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        p.loginEmail
      )
    ) {
      return "Invalid email format";
    }

    /*
     * PHONE
     */

    if (
      p.phone &&
      !/^[6-9]\d{9}$/.test(p.phone)
    ) {
      return "Invalid Indian phone number";
    }

    /*
     * DOB
     */

    if (
      p.dob &&
      p.dob > new Date().toISOString().split("T")[0]
    ) {
      return "DOB cannot be in the future";
    }

    /*
     * JOINING DATE
     */

    if (
      p.joiningDate &&
      p.joiningDate >
        new Date().toISOString().split("T")[0]
    ) {
      return "Joining date cannot be in the future";
    }

    /*
     * BRANCH
     */

    if (
      p.branchId &&
      p.branchId.length < 2
    ) {
      return "Branch ID too short";
    }

    /*
     * SALARY
     */

    if (
      p.salaryMonthly &&
      p.salaryMonthly < 0
    ) {
      return "Salary cannot be negative";
    }

    if (
      p.salaryMonthly &&
      p.salaryMonthly > 500000
    ) {
      return "Salary seems unrealistic";
    }

    return "";
  };

  /*
   * ============================================================
   * NORMALIZE DATA BEFORE FIRESTORE
   * ============================================================
   */

  const normalize = (p) => ({
    /*
     * NEW EMPLOYEE FIELDS
     */

    employeeId: p.employeeId.trim(),

    dob: p.dob || "",

    fatherName: p.fatherName.trim(),

    gender: p.gender.trim(),

    bloodGroup: p.bloodGroup.trim(),

    designation: p.designation.trim(),

    workType: p.workType.trim(),

    joiningDate: p.joiningDate || "",

    employeeStatus:
      p.employeeStatus.trim() || "Active",

    address: p.address.trim(),

    profilePhotoUrl:
      p.profilePhotoUrl || "",

    /*
     * EXISTING FIELDS
     */

    name: p.name.trim(),

    loginEmail:
      p.loginEmail.trim().toLowerCase(),

    phone: p.phone.trim(),

    branchId: p.branchId.trim(),

    salaryMonthly:
      Number(p.salaryMonthly || 0),

    active: !!p.active,

    authUid: p.authUid.trim(),

    sourceLabels:
      Array.isArray(p.sourceLabels)
        ? p.sourceLabels
        : [],

    role: "marketing",

    updatedAt: serverTimestamp(),
  });

  /*
   * ============================================================
   * PROFILE PHOTO UPLOAD
   * ============================================================
   */

  const uploadProfilePhoto = async (
    file,
    employeeId
  ) => {
    if (!file) {
      return form.profilePhotoUrl || "";
    }

    if (!file.type.startsWith("image/")) {
      throw new Error(
        "Profile photo must be an image."
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error(
        "Profile photo must be smaller than 5 MB."
      );
    }

    const safeEmployeeId = String(
      employeeId || "employee"
    )
      .trim()
      .replace(
        /[^A-Za-z0-9_-]/g,
        "_"
      );

    const safeFileName =
      file.name.replace(
        /[^A-Za-z0-9._-]/g,
        "_"
      );

    const fileRef = ref(
      storage,
      `marketing/profilePhotos/${safeEmployeeId}_${Date.now()}_${safeFileName}`
    );

    await uploadBytes(
      fileRef,
      file
    );

    return await getDownloadURL(
      fileRef
    );
  };

  /*
   * ============================================================
   * SAVE / UPDATE
   * ============================================================
   */

  const save = async (e) => {
    e.preventDefault();

    setError("");

    try {
      /*
       * Upload profile image first
       */

      let profilePhotoUrl =
        form.profilePhotoUrl || "";

      if (form.profilePhotoFile) {
        profilePhotoUrl =
          await uploadProfilePhoto(
            form.profilePhotoFile,
            form.employeeId
          );
      }

      const payload = normalize({
        ...form,
        profilePhotoUrl,
      });

      /*
       * VALIDATE
       */

      const msg = validate(payload);

      if (msg) {
        setError(msg);
        return;
      }

      /*
       * DUPLICATE EMAIL CHECK
       */

      if (!editingId) {
        const exists =
          await emailExists(
            payload.loginEmail
          );

        if (exists) {
          setError(
            "This email already exists in the system."
          );
          return;
        }
      }

      /*
       * UPDATE
       */

      if (editingId) {
        await updateDoc(
          doc(
            db,
            "marketing",
            editingId
          ),
          payload
        );
      }

      /*
       * ADD WITH AUTH UID AS DOCUMENT ID
       */

      else {
        if (payload.authUid) {
          await setDoc(
            doc(
              db,
              "marketing",
              payload.authUid
            ),
            {
              ...payload,
              uid: payload.authUid,
              createdAt:
                serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        }

        /*
         * ADD NORMAL DOCUMENT
         */

        else {
          await addDoc(
            collection(
              db,
              "marketing"
            ),
            {
              ...payload,
              createdAt:
                serverTimestamp(),
            }
          );
        }
      }

      /*
       * RESET
       */

      setForm({
        ...empty,
      });

      setEditingId(null);

      setShowForm(false);

      await reload();

    } catch (err) {
      console.error(
        "save marketing",
        err
      );

      setError(
        err?.message ||
          "Failed to save marketing user."
      );
    }
  };

  /*
   * ============================================================
   * EDIT
   * ============================================================
   */

  const editRow = (r) => {
    setEditingId(r.id);

    setForm({
      /*
       * NEW EMPLOYEE FIELDS
       */

      employeeId:
        r.employeeId || "",

      dob:
        r.dob || "",

      fatherName:
        r.fatherName || "",

      gender:
        r.gender || "",

      bloodGroup:
        r.bloodGroup || "",

      designation:
        r.designation || "",

      workType:
        r.workType || "",

      joiningDate:
        r.joiningDate || "",

      employeeStatus:
        r.employeeStatus ||
        (r.active !== false
          ? "Active"
          : "Inactive"),

      address:
        r.address || "",

      profilePhotoUrl:
        r.profilePhotoUrl || "",

      profilePhotoFile:
        null,

      /*
       * EXISTING FIELDS
       */

      name:
        r.name || "",

      loginEmail:
        r.loginEmail ||
        r.email ||
        "",

      phone:
        r.phone || "",

      branchId:
        r.branchId || "",

      salaryMonthly:
        r.salaryMonthly || "",

      sourceLabels:
        Array.isArray(
          r.sourceLabels
        )
          ? r.sourceLabels
          : [],

      active:
        r.active !== false,

      authUid:
        r.uid ||
        r.authUid ||
        "",
    });
  };

  /*
   * ============================================================
   * DELETE
   * ============================================================
   */

  const deleteRow = async (user) => {
    if (
      !window.confirm(
        "Delete this marketing user permanently?"
      )
    ) {
      return;
    }

    try {
      const uid =
        user.authUid ||
        user.uid;

      const docId =
        user.id;

      const res = await fetch(
        "https://us-central1-medrent-5d771.cloudfunctions.net/deleteUser",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            uid,
            docId,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          "Delete failed"
        );
      }

      setRows((prev) =>
        prev.filter(
          (x) =>
            x.id !== user.id
        )
      );

    } catch (err) {
      console.error(err);

      alert(
        "Failed to delete marketing user"
      );
    }
  };

  /*
   * ============================================================
   * ENTER KEY NAVIGATION
   * ============================================================
   */

  const handleEnter = (e) => {
    if (e.key === "Enter") {
      /*
       * Don't submit while typing in textarea
       */

      if (
        e.target.tagName ===
        "TEXTAREA"
      ) {
        return;
      }

      e.preventDefault();

      const formElement =
        e.target.form;

      const index =
        Array.prototype.indexOf.call(
          formElement,
          e.target
        );

      if (
        formElement.elements[
          index + 1
        ]
      ) {
        formElement.elements[
          index + 1
        ].focus();
      }
    }
  };

  /*
   * ============================================================
   * EXPORT
   * ============================================================
   */
  /*
   * ============================================================
   * PRINT EMPLOYEE QR CODES
   * ============================================================
   *
   * Uses the currently filtered marketing employees.
   * Each QR opens:
   * /employeeprofiles/{uid}
   *
   * PDF format:
   * A4 portrait
   * 2 columns × 4 rows
   * Premium BookMyMedicare employee cards
   */

 const printMarketingQR = async () => {
  try {
    setError("");

    if (!filtered?.length) {
      setError("No marketing employees available to print.");
      return;
    }

    // ================================================================
    // EMPLOYEE PROFILE URL LIST
    // ONLY NAME + URL
    // NO QR CODE
    // NO PHOTO
    // NO EMPLOYEE ID
    // NO DESIGNATION
    // ================================================================

    const employees = filtered
      .map((r) => {
        const uid = String(
          r?.uid ||
            r?.authUid ||
            r?.id ||
            ""
        ).trim();

        if (!uid) return null;

        const name = String(
          r?.name || "Employee"
        ).trim();

        const profileUrl =
          `https://bookmymedicare.com/employeeprofiles/${encodeURIComponent(
            uid
          )}`;

        return {
          uid,
          name,
          profileUrl,
        };
      })
      .filter(Boolean);

    if (!employees.length) {
      setError(
        "No valid employee UID found for profile URL generation."
      );
      return;
    }

    // ================================================================
    // PDF
    // ================================================================

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = 210;
    const pageHeight = 297;

    const marginX = 16;
    const marginTop = 20;
    const marginBottom = 18;

    const cardWidth =
      pageWidth - marginX * 2;

    const cardHeight = 31;
    const gapY = 7;

    const cardsPerPage = 7;

    // Premium colors
    const NAVY = [15, 23, 42];
    const TEAL = [15, 118, 110];
    const MUTED = [100, 116, 139];
    const BORDER = [226, 232, 240];
    const LIGHT_BG = [248, 250, 252];
    const WHITE = [255, 255, 255];

    // ================================================================
    // PAGE HEADER
    // ================================================================

    const drawHeader = () => {
      // Brand
      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(17);

      pdf.setTextColor(
        ...TEAL
      );

      pdf.text(
        "BookMyMedicare",
        marginX,
        12
      );

      // Subtitle
      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(7);

      pdf.setTextColor(
        ...MUTED
      );

      pdf.text(
        "Employee Profile Directory",
        marginX,
        17
      );

      // Employee count
      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(7);

      pdf.setTextColor(
        ...NAVY
      );

      pdf.text(
        `${employees.length} Employee${
          employees.length === 1
            ? ""
            : "s"
        }`,
        pageWidth - marginX,
        14,
        {
          align: "right",
        }
      );

      // Divider
      pdf.setDrawColor(
        ...BORDER
      );

      pdf.setLineWidth(0.3);

      pdf.line(
        marginX,
        22,
        pageWidth - marginX,
        22
      );
    };

    // ================================================================
    // DRAW EMPLOYEE
    // ================================================================

    const drawEmployee = (
      employee,
      x,
      y,
      number
    ) => {
      // Card background
      pdf.setFillColor(
        ...LIGHT_BG
      );

      pdf.setDrawColor(
        ...BORDER
      );

      pdf.setLineWidth(0.35);

      pdf.roundedRect(
        x,
        y,
        cardWidth,
        cardHeight,
        3,
        3,
        "FD"
      );

      // Left teal accent
      pdf.setFillColor(
        ...TEAL
      );

      pdf.roundedRect(
        x,
        y,
        3,
        cardHeight,
        1.5,
        1.5,
        "F"
      );

      // Number circle
      pdf.setFillColor(
        ...TEAL
      );

      pdf.circle(
        x + 10,
        y + cardHeight / 2,
        4,
        "F"
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(6);

      pdf.setTextColor(
        ...WHITE
      );

      pdf.text(
        String(number),
        x + 10,
        y + cardHeight / 2 + 2,
        {
          align: "center",
        }
      );

      // ============================================================
      // NAME
      // ============================================================

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(10);

      pdf.setTextColor(
        ...NAVY
      );

      const nameLines =
        pdf.splitTextToSize(
          employee.name,
          70
        );

      pdf.text(
        nameLines.slice(0, 2),
        x + 18,
        y + 10
      );

      // ============================================================
      // URL
      // ============================================================

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(6.5);

      pdf.setTextColor(
        ...TEAL
      );

      const urlLines =
        pdf.splitTextToSize(
          employee.profileUrl,
          cardWidth - 70
        );

      pdf.text(
        urlLines.slice(0, 2),
        x + 18,
        y + 18
      );

      // Small label
      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(4.8);

      pdf.setTextColor(
        ...MUTED
      );

      pdf.text(
        "EMPLOYEE PROFILE URL",
        x + 18,
        y + 26
      );
    };

    // ================================================================
    // DRAW PAGES
    // ================================================================

    for (
      let i = 0;
      i < employees.length;
      i++
    ) {
      const position =
        i % cardsPerPage;

      // New page
      if (position === 0) {
        if (i > 0) {
          pdf.addPage();
        }

        drawHeader();
      }

      const x = marginX;

      const y =
        marginTop +
        10 +
        position *
          (cardHeight + gapY);

      drawEmployee(
        employees[i],
        x,
        y,
        i + 1
      );
    }

    // ================================================================
    // FOOTER
    // ================================================================

    const totalPages =
      pdf.getNumberOfPages();

    for (
      let page = 1;
      page <= totalPages;
      page++
    ) {
      pdf.setPage(page);

      pdf.setDrawColor(
        ...BORDER
      );

      pdf.setLineWidth(0.25);

      pdf.line(
        marginX,
        pageHeight - 10,
        pageWidth - marginX,
        pageHeight - 10
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(6);

      pdf.setTextColor(
        ...MUTED
      );

      pdf.text(
        "BookMyMedicare • Employee Management",
        marginX,
        pageHeight - 5
      );

      pdf.text(
        `Page ${page} of ${totalPages}`,
        pageWidth - marginX,
        pageHeight - 5,
        {
          align: "right",
        }
      );
    }

    // ================================================================
    // SAVE PDF
    // ================================================================

    pdf.save(
      "bookmymedicare_employee_profile_urls.pdf"
    );

  } catch (err) {
    console.error(
      "print employee profile URLs",
      err
    );

    setError(
      err?.message ||
        "Failed to generate employee profile URL PDF."
    );
  }
};
  const exportMarketing = () => {
    const rowsExport =
      filtered.map((r, i) => ({
        No: i + 1,

        "Employee ID":
          r.employeeId || "",

        Name:
          r.name || "",

        Email:
          r.loginEmail ||
          r.email ||
          "",

        Phone:
          r.phone || "",

        DOB:
          r.dob || "",

        "Father Name":
          r.fatherName || "",

        Gender:
          r.gender || "",

        "Blood Group":
          r.bloodGroup || "",

        Designation:
          r.designation || "",

        "Work Type":
          r.workType || "",

        "Joining Date":
          r.joiningDate || "",

        "Employee Status":
          r.employeeStatus ||
          "",

        Address:
          r.address || "",

        Branch:
          r.branchId || "",

        Salary:
          r.salaryMonthly || 0,

        Active:
          r.active !== false
            ? "Active"
            : "Inactive",

        UID:
          r.uid ||
          r.authUid ||
          r.id,
      }));

    if (!rowsExport.length) {
      return;
    }

    const headers =
      Object.keys(
        rowsExport[0]
      );

    const escapeCSV = (v) =>
      `"${String(v ?? "").replace(
        /"/g,
        '""'
      )}"`;

    const csv = [
      headers.join(","),

      ...rowsExport.map(
        (r) =>
          headers
            .map((h) =>
              escapeCSV(r[h])
            )
            .join(",")
      ),
    ].join("\n");

    const blob =
      new Blob([csv], {
        type:
          "text/csv;charset=utf-8;",
      });

    const url =
      URL.createObjectURL(
        blob
      );

    const a =
      document.createElement(
        "a"
      );

    a.href = url;

    a.download =
      "marketing_export.csv";

    a.click();

    URL.revokeObjectURL(url);
  };

  /*
   * ============================================================
   * ACTIVE TOGGLE
   * ============================================================
   */

  const toggleActive = async (
    r,
    next
  ) => {
    try {
      await updateDoc(
        doc(
          db,
          "marketing",
          r.id
        ),
        {
          active: next,

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
              }
            : x
        )
      );
    } catch (err) {
      console.error(
        "toggle active",
        err
      );

      setError(
        "Failed to update active flag."
      );
    }
  };

  /*
   * ============================================================
   * FILTER
   * ============================================================
   */

  const filtered = useMemo(() => {
    const q =
      search
        .trim()
        .toLowerCase();

    return rows.filter((r) => {
      const text = [
        r.employeeId,
        r.name,
        r.loginEmail,
        r.phone,
        r.fatherName,
        r.gender,
        r.bloodGroup,
        r.designation,
        r.workType,
        r.employeeStatus,
        r.address,
        r.branchId,
        r.uid,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const qOk =
        !q ||
        text.includes(q);

      const aOk =
        activeFilter === "all"
          ? true
          : activeFilter ===
            "active"
          ? r.active !== false
          : r.active === false;

      return qOk && aOk;
    });
  }, [
    rows,
    search,
    activeFilter,
  ]);

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <div className="marketing-page">

      <h2>
        Marketing Management
      </h2>

      {/* ======================================================
          TOOLBAR
      ======================================================= */}

      <div className="marketing-toolbar">

        <input
          type="text"
          placeholder="Search employee ID, name, phone, email, branch, designation..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />

        <select
          value={
            activeFilter
          }
          onChange={(e) =>
            setActiveFilter(
              e.target.value
            )
          }
          title="Filter by active"
        >
          <option value="all">
            All
          </option>

          <option value="active">
            Active
          </option>

          <option value="inactive">
            Inactive
          </option>
        </select>

        <div className="leads-header-actions">

  <button
    className="cp-btn ghost"
    type="button"
    onClick={() => {
      setShowForm(true);
      setEditingId(null);
      setForm({
        ...empty,
      });
    }}
  >
    Add Marketing
  </button>

  <button
    className="cp-btn ghost"
    type="button"
    onClick={exportMarketing}
  >
    Export
  </button>

  <button
    className="cp-btn ghost"
    type="button"
    onClick={printMarketingQR}
    title="Generate QR code PDF for filtered employees"
  >
    Print QR
  </button>

</div>
      </div>

      {/* ======================================================
          MOBILE FAB
      ======================================================= */}

      <button
        className="fab-add"
        aria-label="Add Marketing"
        onClick={() => {
          setShowForm(true);
          setEditingId(null);
          setForm({
            ...empty,
          });
        }}
      >
        +
      </button>

      {/* ======================================================
          DRAWER OVERLAY
      ======================================================= */}

      {showForm && (
        <div
          className="drawer-overlay"
          onClick={() =>
            setShowForm(false)
          }
        />
      )}

      {/* ======================================================
          DRAWER
      ======================================================= */}

      <div
        className={`drawer ${
          showForm
            ? "open"
            : ""
        }`}
      >

        <div className="drawer-header">

          <h3>
            {editingId
              ? "Edit Marketing"
              : "Add Marketing"}
          </h3>

          <button
            className="cp-btn ghost"
            type="button"
            onClick={() =>
              setShowForm(false)
            }
          >
            Close
          </button>

        </div>

        {/* ====================================================
            FORM
        ===================================================== */}

        <form
          onSubmit={save}
          className="marketing-form"
          onKeyDown={handleEnter}
        >

          {/* ==================================================
              EMPLOYEE ID
          =================================================== */}

          <input
            type="text"
            placeholder="Employee ID *"
            value={
              form.employeeId
            }
            onChange={(e) =>
              setForm({
                ...form,
                employeeId:
                  e.target.value,
              })
            }
            required
          />

          {/* ==================================================
              NAME
          =================================================== */}

          <input
            type="text"
            placeholder="Full Name *"
            value={
              form.name
            }
            onChange={(e) =>
              setForm({
                ...form,
                name:
                  e.target.value,
              })
            }
            required
          />

          {/* ==================================================
              EMAIL
          =================================================== */}

          <input
            type="email"
            placeholder="Login Email *"
            value={
              form.loginEmail
            }
            onChange={(e) =>
              setForm({
                ...form,
                loginEmail:
                  e.target.value,
              })
            }
            required
          />

          {/* ==================================================
              PHONE
          =================================================== */}

          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            placeholder="Contact No"
            value={
              form.phone
            }
            onChange={(e) =>
              setForm({
                ...form,
                phone:
                  e.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(
                      0,
                      10
                    ),
              })
            }
          />

          {/* ==================================================
              DOB
          =================================================== */}

          <label className="form-field-label">
            Date of Birth
          </label>

          <input
            type="date"
            value={
              form.dob
            }
            onChange={(e) =>
              setForm({
                ...form,
                dob:
                  e.target.value,
              })
            }
          />

          {/* ==================================================
              FATHER NAME
          =================================================== */}

          <input
            type="text"
            placeholder="Father Name"
            value={
              form.fatherName
            }
            onChange={(e) =>
              setForm({
                ...form,
                fatherName:
                  e.target.value,
              })
            }
          />

          {/* ==================================================
              GENDER
          =================================================== */}

          <select
            value={
              form.gender
            }
            onChange={(e) =>
              setForm({
                ...form,
                gender:
                  e.target.value,
              })
            }
          >
            <option value="">
              Select Gender
            </option>

            <option value="Male">
              Male
            </option>

            <option value="Female">
              Female
            </option>

            <option value="Other">
              Other
            </option>

            <option value="Prefer not to say">
              Prefer not to say
            </option>
          </select>

          {/* ==================================================
              BLOOD GROUP
          =================================================== */}

          <select
            value={
              form.bloodGroup
            }
            onChange={(e) =>
              setForm({
                ...form,
                bloodGroup:
                  e.target.value,
              })
            }
          >
            <option value="">
              Select Blood Group
            </option>

            <option value="A+">
              A+
            </option>

            <option value="A-">
              A-
            </option>

            <option value="B+">
              B+
            </option>

            <option value="B-">
              B-
            </option>

            <option value="AB+">
              AB+
            </option>

            <option value="AB-">
              AB-
            </option>

            <option value="O+">
              O+
            </option>

            <option value="O-">
              O-
            </option>
          </select>

          {/* ==================================================
              DESIGNATION
          =================================================== */}

         <input
  type="text"
  placeholder="Designation"
  value={form.designation}
  onChange={(e) =>
    setForm({
      ...form,
      designation: e.target.value,
    })
  }
/>

{/* ==================================================
    WORK TYPE
=================================================== */}

<input
  type="text"
  placeholder="Work Type"
  value={form.workType}
  onChange={(e) =>
    setForm({
      ...form,
      workType: e.target.value,
    })
  }
/>

          {/* ==================================================
              JOINING DATE
          =================================================== */}

          <label className="form-field-label">
            Joining Date
          </label>

          <input
            type="date"
            value={
              form.joiningDate
            }
            onChange={(e) =>
              setForm({
                ...form,
                joiningDate:
                  e.target.value,
              })
            }
          />

          {/* ==================================================
              EMPLOYEE STATUS
          =================================================== */}

          <select
            value={
              form.employeeStatus
            }
            onChange={(e) => {
              const value =
                e.target.value;

              setForm({
                ...form,
                employeeStatus:
                  value,

                active:
                  value ===
                  "Active",
              });
            }}
          >
            <option value="Active">
              Active
            </option>

            <option value="Inactive">
              Inactive
            </option>

            <option value="On Leave">
              On Leave
            </option>

            <option value="Probation">
              Probation
            </option>

            <option value="Resigned">
              Resigned
            </option>
          </select>

          {/* ==================================================
              ADDRESS
          =================================================== */}

          <textarea
            placeholder="Address Information"
            value={
              form.address
            }
            onChange={(e) =>
              setForm({
                ...form,
                address:
                  e.target.value,
              })
            }
            rows={4}
          />

          {/* ==================================================
              PROFILE PHOTO
          =================================================== */}

          <div className="profile-photo-field">

            <label className="form-field-label">
              Profile Photo
            </label>

            {form.profilePhotoUrl && (
              <img
                src={
                  form.profilePhotoUrl
                }
                alt="Profile preview"
                style={{
                  width: 90,
                  height: 90,
                  borderRadius:
                    "50%",
                  objectFit:
                    "cover",
                  display:
                    "block",
                  marginBottom:
                    10,
                  border:
                    "1px solid #e2e8f0",
                }}
              />
            )}

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setForm({
                  ...form,
                  profilePhotoFile:
                    e.target
                      .files?.[0] ||
                    null,
                })
              }
            />

            <small
              style={{
                display:
                  "block",
                marginTop:
                  5,
                color:
                  "#64748b",
              }}
            >
              JPG, PNG or WEBP. Maximum 5 MB.
            </small>

          </div>

          {/* ==================================================
              EXISTING BRANCH
          =================================================== */}

          <input
            type="text"
            placeholder="Branch ID"
            value={
              form.branchId
            }
            onChange={(e) =>
              setForm({
                ...form,
                branchId:
                  e.target.value,
              })
            }
          />

          {/* ==================================================
              LEAD SOURCES
          =================================================== */}

          <div
            style={{
              display:
                "flex",
              flexDirection:
                "column",
              gap: 8,
            }}
          >

            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color:
                  "#334155",
              }}
            >
              Lead Sources
            </label>

            <details
              style={{
                position:
                  "relative",
              }}
            >

              {/* DROPDOWN HEADER */}

              <summary
                style={{
                  height: 44,
                  padding:
                    "0 14px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius:
                    10,
                  background:
                    "#f8fafc",
                  fontSize: 14,
                  color:
                    form
                      .sourceLabels
                      ?.length
                      ? "#0f172a"
                      : "#94a3b8",
                  cursor:
                    "pointer",
                  listStyle:
                    "none",
                  boxSizing:
                    "border-box",
                }}
              >

                <span>
                  {form
                    .sourceLabels
                    ?.length
                    ? `${
                        form
                          .sourceLabels
                          .length
                      } source${
                        form
                          .sourceLabels
                          .length >
                        1
                          ? "s"
                          : ""
                      } selected`
                    : "Select Lead Sources"}
                </span>

                <span
                  style={{
                    fontSize:
                      12,
                    color:
                      "#64748b",
                  }}
                >
                  ▼
                </span>

              </summary>

              {/* DROPDOWN */}

              <div
                style={{
                  position:
                    "absolute",
                  top: 50,
                  left: 0,
                  right: 0,
                  background:
                    "#fff",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius:
                    10,
                  boxShadow:
                    "0 10px 25px rgba(0,0,0,0.08)",
                  zIndex: 100,
                  overflow:
                    "hidden",
                }}
              >

                {/* SEARCH */}

                <div
                  style={{
                    padding: 8,
                    borderBottom:
                      "1px solid #e2e8f0",
                    background:
                      "#fff",
                  }}
                >

                  <input
                    type="text"
                    placeholder="Search lead sources..."
                    value={
                      leadSourceSearch
                    }
                    onChange={(
                      e
                    ) =>
                      setLeadSourceSearch(
                        e.target
                          .value
                      )
                    }
                    onClick={(e) =>
                      e.stopPropagation()
                    }
                    style={{
                      width:
                        "100%",
                      height:
                        40,
                      padding:
                        "0 12px",
                      borderRadius:
                        8,
                      border:
                        "1px solid #e2e8f0",
                      background:
                        "#f8fafc",
                      fontSize:
                        13,
                      color:
                        "#0f172a",
                      outline:
                        "none",
                      boxSizing:
                        "border-box",
                    }}
                  />

                </div>

                {/* SOURCE LIST */}

                <div
                  style={{
                    maxHeight:
                      220,
                    overflowY:
                      "auto",
                    padding: 6,
                  }}
                >

                  {leadSources.length ===
                  0 ? (

                    <div
                      style={{
                        padding:
                          12,
                        fontSize:
                          13,
                        color:
                          "#94a3b8",
                      }}
                    >
                      No lead sources available
                    </div>

                  ) : (

                    (() => {
                      const searchText =
                        leadSourceSearch
                          .trim()
                          .toLowerCase();

                      const filteredSources =
                        leadSources.filter(
                          (
                            source
                          ) =>
                            String(
                              source.name ||
                                ""
                            )
                              .toLowerCase()
                              .includes(
                                searchText
                              )
                        );

                      if (
                        filteredSources.length ===
                        0
                      ) {
                        return (
                          <div
                            style={{
                              padding:
                                12,
                              fontSize:
                                13,
                              color:
                                "#94a3b8",
                            }}
                          >
                            No matching lead sources
                          </div>
                        );
                      }

                      return filteredSources.map(
                        (
                          source
                        ) => {
                          const selected =
                            form
                              .sourceLabels
                              ?.includes(
                                source.id
                              );

                          return (
                            <label
                              key={
                                source.id
                              }
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 10,
                                padding:
                                  "10px 8px",
                                borderRadius:
                                  8,
                                cursor:
                                  "pointer",
                                background:
                                  selected
                                    ? "#eff6ff"
                                    : "transparent",
                              }}
                            >

                              <input
                                type="checkbox"
                                checked={
                                  selected
                                }
                                onChange={(
                                  e
                                ) => {
                                  setForm(
                                    (
                                      f
                                    ) => ({
                                      ...f,

                                      sourceLabels:
                                        e
                                          .target
                                          .checked
                                          ? [
                                              ...(f.sourceLabels ||
                                                []),
                                              source.id,
                                            ]
                                          : (
                                              f.sourceLabels ||
                                              []
                                            ).filter(
                                              (
                                                id
                                              ) =>
                                                id !==
                                                source.id
                                            ),
                                    })
                                  );
                                }}
                              />

                              <span
                                style={{
                                  fontSize:
                                    14,
                                  color:
                                    "#0f172a",
                                  flex: 1,
                                }}
                              >
                                {
                                  source.name
                                }
                              </span>

                              {selected && (
                                <span
                                  style={{
                                    fontSize:
                                      12,
                                    color:
                                      "#2563eb",
                                    fontWeight:
                                      600,
                                  }}
                                >
                                  ✓
                                </span>
                              )}

                            </label>
                          );
                        }
                      );
                    })()
                  )}

                </div>

              </div>

            </details>

            {/* SELECTED SOURCES */}

            {form.sourceLabels?.length >
              0 && (
              <div
                style={{
                  display:
                    "flex",
                  flexWrap:
                    "wrap",
                  gap: 6,
                  marginTop:
                    2,
                }}
              >

                {form.sourceLabels.map(
                  (
                    sourceId
                  ) => {
                    const source =
                      leadSources.find(
                        (s) =>
                          s.id ===
                          sourceId
                      );

                    return (
                      <span
                        key={
                          sourceId
                        }
                        style={{
                          display:
                            "inline-flex",
                          alignItems:
                            "center",
                          gap: 6,
                          padding:
                            "5px 9px",
                          borderRadius:
                            999,
                          background:
                            "#eff6ff",
                          color:
                            "#2563eb",
                          fontSize:
                            12,
                          fontWeight:
                            600,
                        }}
                      >

                        {
                          source?.name ||
                          sourceId
                        }

                        <button
                          type="button"
                          onClick={() =>
                            setForm(
                              (
                                f
                              ) => ({
                                ...f,

                                sourceLabels:
                                  (
                                    f.sourceLabels ||
                                    []
                                  ).filter(
                                    (
                                      id
                                    ) =>
                                      id !==
                                      sourceId
                                  ),
                              })
                            )
                          }
                          style={{
                            border:
                              "none",
                            background:
                              "transparent",
                            color:
                              "#2563eb",
                            cursor:
                              "pointer",
                            padding:
                              0,
                            fontSize:
                              14,
                            lineHeight:
                              1,
                          }}
                        >
                          ×
                        </button>

                      </span>
                    );
                  }
                )}

              </div>
            )}

          </div>

          {/* ==================================================
              EXISTING SALARY
          =================================================== */}

          <input
            type="number"
            placeholder="Monthly Salary (₹)"
            value={
              form.salaryMonthly ||
              ""
            }
            onChange={(e) =>
              setForm({
                ...form,
                salaryMonthly:
                  e.target.value,
              })
            }
          />

          {/* ==================================================
              EXISTING AUTH UID
          =================================================== */}

          <input
            type="text"
            placeholder="Auth UID (optional)"
            value={
              form.authUid
            }
            onChange={(e) =>
              setForm({
                ...form,
                authUid:
                  e.target.value,
              })
            }
            title="If you already created the Firebase Auth user, paste the UID to make the doc id match."
          />

          {/* ==================================================
              EXISTING ACTIVE SWITCH
          =================================================== */}

          <label className="switch-row">

            <input
              type="checkbox"
              checked={
                form.active
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  active:
                    e.target
                      .checked,
                })
              }
            />

            Active

          </label>

          {/* ==================================================
              ACTIONS
          =================================================== */}

          <div className="actions-row">

            <button
              className="cp-btn"
              type="submit"
            >
              {editingId
                ? "Update"
                : "Add Marketing"}
            </button>

            <button
              type="button"
              className="cp-btn ghost"
              onClick={() => {
                setEditingId(
                  null
                );

                setForm({
                  ...empty,
                });

                setShowForm(
                  false
                );
              }}
            >
              Cancel
            </button>

          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

        </form>
      </div>

      {/* ======================================================
          TABLE
      ======================================================= */}

      <div className="marketing-table">

        {loading ? (

          <p>
            Loading marketing users…
          </p>

        ) : (

          <table>

            <thead>

              <tr>

                <th>#</th>

                <th>
                  Profile
                </th>

                <th>
                  Emp ID
                </th>

                <th>
                  Name
                </th>

                <th>
                  Login Email
                </th>

                <th>
                  Phone
                </th>

                <th>
                  DOB
                </th>

                <th>
                  Designation
                </th>

                <th>
                  Employee Status
                </th>

                <th>
                  Branch
                </th>

                <th>
                  Salary
                </th>

                <th>
                  Active
                </th>

                <th>
                  UID
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {filtered.map(
                (r, i) => (

                  <tr
                    key={r.id}
                  >

                    <td>
                      {i + 1}
                    </td>

                    {/* PROFILE PHOTO */}

                    <td>

                      {r.profilePhotoUrl ? (

                        <img
                          src={
                            r.profilePhotoUrl
                          }
                          alt={
                            r.name ||
                            "Profile"
                          }
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius:
                              "50%",
                            objectFit:
                              "cover",
                          }}
                        />

                      ) : (

                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius:
                              "50%",
                            background:
                              "#e2e8f0",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontWeight:
                              700,
                            color:
                              "#64748b",
                          }}
                        >
                          {(
                            r.name ||
                            "?"
                          )
                            .charAt(
                              0
                            )
                            .toUpperCase()}
                        </div>

                      )}

                    </td>

                    <td>
                      {r.employeeId ||
                        "-"}
                    </td>

                    <td>
                      {r.name ||
                        "-"}
                    </td>

                    <td>
                      {r.loginEmail ||
                        r.email ||
                        "-"}
                    </td>

                    <td>
                      {r.phone ||
                        "-"}
                    </td>

                    <td>
                      {r.dob ||
                        "-"}
                    </td>

                    <td>
                      {r.designation ||
                        "-"}
                    </td>

                    <td>
                      {r.employeeStatus ||
                        (r.active !==
                        false
                          ? "Active"
                          : "Inactive")}
                    </td>

                    <td>
                      {r.branchId ||
                        "-"}
                    </td>

                    <td>
                      ₹
                      {r.salaryMonthly ||
                        0}
                    </td>

                    <td
                      style={{
                        whiteSpace:
                          "nowrap",
                      }}
                    >

                      <button
                        className="cp-btn ghost"
                        onClick={() =>
                          toggleActive(
                            r,
                            !(
                              r.active !==
                              false
                            )
                          )
                        }
                      >
                        {r.active !==
                        false
                          ? "Active"
                          : "Inactive"}
                      </button>

                    </td>

                    <td
                      style={{
                        fontSize:
                          12,
                        color:
                          "#6b7280",
                      }}
                    >
                      {r.uid ||
                        r.authUid ||
                        r.id}
                    </td>

                    <td>

                      <div className="marketing-actions">

                        <button
                          className="mk-btn edit"
                          onClick={() =>
                            editRow(
                              r
                            )
                          }
                        >
                          Edit
                        </button>

                        {userRole ===
                          "superadmin" && (
                          <button
                            className="mk-btn delete"
                            onClick={() =>
                              deleteRow(
                                r
                              )
                            }
                          >
                            Delete
                          </button>
                        )}

                        <button
                          className="mk-btn attendance"
                          onClick={() =>
                            (window.location.href =
                              `/crm/attendance?role=marketing&driverId=${r.id}`)
                          }
                        >
                          Attendance
                        </button>

                        <button
                          className="mk-btn track"
                          onClick={() =>
                            (window.location.href =
                              `/crm/tracking?role=marketing&driverId=${r.id}`)
                          }
                        >
                          Track
                        </button>

                      </div>

                    </td>

                  </tr>

                )
              )}

              {filtered.length ===
                0 && (

                <tr>

                  <td
                    colSpan={14}
                    style={{
                      padding:
                        12,
                    }}
                  >
                    No records.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        )}

      </div>

    </div>
  );
}