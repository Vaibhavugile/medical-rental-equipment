import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  setDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  where,
  onSnapshot
} from "firebase/firestore";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Staff.css";
import jsPDF from "jspdf";
export default function Staff({ defaultType = "all" }) {
  const navigate = useNavigate();

  const servicesRef = useRef(null);
  const fileInputRef = useRef(null);

  const storage = getStorage();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [servicesOpen, setServicesOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [typeFilter, setTypeFilter] = useState(defaultType);
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [careTypes, setCareTypes] = useState([]);
  const [userRole, setUserRole] = useState(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /*
  ============================================================
  EMPTY FORM
  ============================================================
  */

  const empty = {
    // --------------------------------------------------------
    // EMPLOYEE / PERSONAL DETAILS
    // --------------------------------------------------------

    employeeId: "",
    name: "",
    loginEmail: "",
    phone: "",
    alternatePhone: "",

    dateOfBirth: "",
    fatherName: "",
    gender: "",
    bloodGroup: "",

    aadharNumber: "",
    panNumber: "",

    address: "",

    // --------------------------------------------------------
    // EMPLOYMENT DETAILS
    // --------------------------------------------------------

    designation: "",

    workType: "Payroll",

    joiningDate: "",

    employeeStatus: "Active",

    staffType:
      defaultType === "all"
        ? "nurse"
        : defaultType,

    // --------------------------------------------------------
    // PROFESSIONAL DETAILS
    // --------------------------------------------------------

    qualifications: "",
    experienceYears: "",

    servicesOffered: [],

    shiftPreference: "day",
    shiftType: "day",

    // --------------------------------------------------------
    // EMERGENCY CONTACT
    // --------------------------------------------------------

    emergencyContactName: "",
    emergencyContactPhone: "",
    relation: "",

    // --------------------------------------------------------
    // BANK DETAILS
    // --------------------------------------------------------

    bankName: "",
    bankAccountNumber: "",
    bankIfsc: "",
    upiId: "",

    // --------------------------------------------------------
    // PROFILE PHOTO
    // --------------------------------------------------------

    profilePhotoUrl: "",
    profilePhotoFile: null,

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    available: true,
    active: true,

    // --------------------------------------------------------
    // AUTH
    // --------------------------------------------------------

    authUid: ""
  };

  const [form, setForm] = useState(empty);

  /*
  ============================================================
  CARE TYPES
  ============================================================
  */

  useEffect(() => {
    const loadCareTypes = async () => {
      try {
        const snap = await getDocs(
          collection(db, "careTypes")
        );

        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {})
        }));

        setCareTypes(list);
      } catch (e) {
        console.error("loadCareTypes", e);
      }
    };

    loadCareTypes();
  }, []);

  /*
  ============================================================
  CLICK OUTSIDE SERVICES DROPDOWN
  ============================================================
  */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        servicesRef.current &&
        !servicesRef.current.contains(event.target)
      ) {
        setServicesOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /*
  ============================================================
  FETCH STAFF
  ============================================================
  */

  const reload = async () => {
    setLoading(true);
    setError("");

    try {
      const q = query(
        collection(db, "staff"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      setRows(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {})
        }))
      );
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

  /*
  ============================================================
  CURRENT USER ROLE
  ============================================================
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

  /*
  ============================================================
  OPEN EDIT FORM
  ============================================================
  */

  useEffect(() => {
    if (editingId) {
      setShowForm(true);
    }
  }, [editingId]);

  /*
  ============================================================
  ESCAPE KEY
  ============================================================
  */

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowForm(false);
        setServicesOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  /*
  ============================================================
  EMAIL DUPLICATE CHECK
  ============================================================
  */

  const emailExists = async (
    email,
    currentStaffId = null
  ) => {
    const normalizedEmail =
      email.trim().toLowerCase();

    const staffQuery = query(
      collection(db, "staff"),
      where(
        "loginEmail",
        "==",
        normalizedEmail
      )
    );

    const userQuery = query(
      collection(db, "users"),
      where(
        "email",
        "==",
        normalizedEmail
      )
    );

    const [
      staffSnap,
      userSnap
    ] = await Promise.all([
      getDocs(staffQuery),
      getDocs(userQuery)
    ]);

    const staffDuplicate =
      staffSnap.docs.some(
        (d) => d.id !== currentStaffId
      );

    return (
      staffDuplicate ||
      !userSnap.empty
    );
  };

  /*
  ============================================================
  VALIDATION
  ============================================================
  */

  const validate = (p) => {
    // --------------------------------------------------------
    // EMPLOYEE ID
    // --------------------------------------------------------

    if (!p.employeeId.trim()) {
      return "Employee ID is required";
    }

    // --------------------------------------------------------
    // NAME
    // --------------------------------------------------------

    if (!p.name.trim()) {
      return "Name is required";
    }

    if (
      !/^[A-Za-z\s]{3,50}$/.test(
        p.name.trim()
      )
    ) {
      return "Name should contain only letters and spaces";
    }

    // --------------------------------------------------------
    // EMAIL
    // --------------------------------------------------------

    if (!p.loginEmail.trim()) {
      return "Email is required";
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        p.loginEmail.trim()
      )
    ) {
      return "Invalid email format";
    }

    // --------------------------------------------------------
    // PHONE
    // --------------------------------------------------------

    if (!p.phone) {
      return "Phone number is required";
    }

    if (!/^[6-9]\d{9}$/.test(p.phone)) {
      return "Invalid Indian phone number";
    }

    // --------------------------------------------------------
    // ALTERNATE PHONE
    // --------------------------------------------------------

    if (
      p.alternatePhone &&
      !/^[6-9]\d{9}$/.test(
        p.alternatePhone
      )
    ) {
      return "Invalid alternate phone number";
    }

    // --------------------------------------------------------
    // AADHAAR
    // --------------------------------------------------------

    if (
      p.aadharNumber &&
      !/^\d{12}$/.test(
        p.aadharNumber
      )
    ) {
      return "Aadhaar must be exactly 12 digits";
    }

    // --------------------------------------------------------
    // PAN
    // --------------------------------------------------------

    if (
      p.panNumber &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(
        p.panNumber
      )
    ) {
      return "Invalid PAN format (ABCDE1234F)";
    }

    // --------------------------------------------------------
    // ADDRESS
    // --------------------------------------------------------

    if (
      p.address &&
      p.address.length < 5
    ) {
      return "Address is too short";
    }

    // --------------------------------------------------------
    // EXPERIENCE
    // --------------------------------------------------------

    if (
      p.experienceYears !== "" &&
      (
        Number(p.experienceYears) < 0 ||
        Number(p.experienceYears) > 60
      )
    ) {
      return "Experience must be between 0 and 60 years";
    }

    // --------------------------------------------------------
    // SERVICES
    // --------------------------------------------------------

    if (
      p.servicesOffered &&
      p.servicesOffered.length > 200
    ) {
      return "Services selection is too large";
    }

    // --------------------------------------------------------
    // SHIFT
    // --------------------------------------------------------

    if (!p.shiftType) {
      return "Please select shift type";
    }

    // --------------------------------------------------------
    // EMERGENCY PHONE
    // --------------------------------------------------------

    if (
      p.emergencyContactPhone &&
      !/^[6-9]\d{9}$/.test(
        p.emergencyContactPhone
      )
    ) {
      return "Invalid emergency contact phone";
    }

    // --------------------------------------------------------
    // BANK ACCOUNT
    // --------------------------------------------------------

    if (
      p.bankAccountNumber &&
      !/^\d{9,18}$/.test(
        p.bankAccountNumber
      )
    ) {
      return "Invalid bank account number";
    }

    // --------------------------------------------------------
    // IFSC
    // --------------------------------------------------------

    if (
      p.bankIfsc &&
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(
        p.bankIfsc
      )
    ) {
      return "Invalid IFSC code";
    }

    // --------------------------------------------------------
    // UPI
    // --------------------------------------------------------

    if (
      p.upiId &&
      !/^[\w.-]+@[\w.-]+$/.test(
        p.upiId
      )
    ) {
      return "Invalid UPI ID";
    }

    // --------------------------------------------------------
    // DOB
    // --------------------------------------------------------

    if (p.dateOfBirth) {
      const dob = new Date(
        p.dateOfBirth
      );

      if (dob > new Date()) {
        return "Date of birth cannot be in the future";
      }
    }

    // --------------------------------------------------------
    // JOINING DATE
    // --------------------------------------------------------

    if (p.joiningDate) {
      const joiningDate =
        new Date(p.joiningDate);

      if (joiningDate > new Date()) {
        return "Joining date cannot be in the future";
      }
    }

    return "";
  };

  /*
  ============================================================
  ERROR SCROLL
  ============================================================
  */

  useEffect(() => {
    if (error) {
      const alert =
        document.querySelector(
          ".staff-alert"
        );

      if (alert) {
        alert.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    }
  }, [error]);

  /*
  ============================================================
  ENTER KEY NAVIGATION
  ============================================================
  */

  const handleEnter = (e) => {
    if (e.key !== "Enter") return;

    e.preventDefault();

    const formElement =
      e.target.form;

    if (!formElement) return;

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
  };

  /*
  ============================================================
  NORMALIZE DATA
  ============================================================
  */

  const normalize = (p) => ({
    // --------------------------------------------------------
    // EMPLOYEE
    // --------------------------------------------------------

    employeeId:
      p.employeeId.trim(),

    name:
      p.name.trim(),

    loginEmail:
      p.loginEmail
        .trim()
        .toLowerCase(),

    phone:
      p.phone.trim(),

    alternatePhone:
      p.alternatePhone.trim(),

    // --------------------------------------------------------
    // PERSONAL
    // --------------------------------------------------------

    dateOfBirth:
      p.dateOfBirth || "",

    fatherName:
      p.fatherName.trim(),

    gender:
      p.gender || "",

    bloodGroup:
      p.bloodGroup || "",

    aadharNumber:
      p.aadharNumber.trim(),

    panNumber:
      p.panNumber
        .trim()
        .toUpperCase(),

    address:
      p.address.trim(),

    // --------------------------------------------------------
    // EMPLOYMENT
    // --------------------------------------------------------

    designation:
      p.designation || "",

    workType:
      p.workType || "Payroll",

    joiningDate:
      p.joiningDate || "",

    employeeStatus:
      p.employeeStatus || "Active",

    staffType:
      p.staffType,

    // --------------------------------------------------------
    // PROFESSIONAL
    // --------------------------------------------------------

    qualifications:
      p.qualifications.trim(),

    experienceYears:
      p.experienceYears === ""
        ? ""
        : Number(p.experienceYears),

    servicesOffered:
      p.servicesOffered || [],

    shiftPreference:
      p.shiftPreference,

    shiftType:
      p.shiftType,

    // --------------------------------------------------------
    // EMERGENCY
    // --------------------------------------------------------

    emergencyContactName:
      p.emergencyContactName.trim(),

    emergencyContactPhone:
      p.emergencyContactPhone.trim(),

    relation:
      p.relation.trim(),

    // --------------------------------------------------------
    // BANK
    // --------------------------------------------------------

    bankName:
      p.bankName.trim(),

    bankAccountNumber:
      p.bankAccountNumber.trim(),

    bankIfsc:
      p.bankIfsc
        .trim()
        .toUpperCase(),

    upiId:
      p.upiId
        .trim()
        .toLowerCase(),

    // --------------------------------------------------------
    // PROFILE
    // --------------------------------------------------------

    profilePhotoUrl:
      p.profilePhotoUrl || "",

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    available:
      !!p.available,

    active:
      !!p.active,

    // --------------------------------------------------------
    // AUTH
    // --------------------------------------------------------

    authUid:
      p.authUid.trim(),

    role: "staff",

    updatedAt:
      serverTimestamp()
  });

  /*
  ============================================================
  PROFILE PHOTO UPLOAD
  ============================================================
  */

  const uploadProfilePhoto = async (
    file,
    employeeId
  ) => {
    if (!file) {
      return "";
    }

    if (!file.type.startsWith("image/")) {
      throw new Error(
        "Please select an image file"
      );
    }

    const maxSize =
      5 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new Error(
        "Profile photo must be smaller than 5 MB"
      );
    }

    const safeEmployeeId =
      employeeId
        .trim()
        .replace(
          /[^A-Za-z0-9_-]/g,
          "_"
        );

    const extension =
      file.name
        .split(".")
        .pop()
        .toLowerCase();

    const fileName =
      `${Date.now()}_${safeEmployeeId}.${extension}`;

    const storageRef = ref(
      storage,
      `staff/profilePhotos/${safeEmployeeId}/${fileName}`
    );

    await uploadBytes(
      storageRef,
      file
    );

    return await getDownloadURL(
      storageRef
    );
  };

  /*
  ============================================================
  PHOTO CHANGE
  ============================================================
  */

  const handlePhotoChange = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(
        "Please select a valid image file"
      );

      e.target.value = "";
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setError(
        "Profile photo must be smaller than 5 MB"
      );

      e.target.value = "";
      return;
    }

    setError("");

    setForm((prev) => ({
      ...prev,
      profilePhotoFile: file
    }));
  };

  /*
  ============================================================
  SAVE
  ============================================================
  */

  const save = async (e) => {
    e.preventDefault();

    setError("");

    const msg = validate(form);

    if (msg) {
      setError(msg);
      return;
    }

    try {
      setUploadingPhoto(false);

      // ------------------------------------------------------
      // DUPLICATE EMAIL
      // ------------------------------------------------------

      const exists =
        await emailExists(
          form.loginEmail,
          editingId
        );

      if (exists) {
        // When editing, an existing email on the same
        // staff record is allowed.
        if (!editingId) {
          setError(
            "This email already exists in the system."
          );

          return;
        }
      }

      let profilePhotoUrl =
        form.profilePhotoUrl || "";

      // ------------------------------------------------------
      // UPLOAD PHOTO
      // ------------------------------------------------------

      if (form.profilePhotoFile) {
        setUploadingPhoto(true);

        profilePhotoUrl =
          await uploadProfilePhoto(
            form.profilePhotoFile,
            form.employeeId
          );

        setUploadingPhoto(false);
      }

      // ------------------------------------------------------
      // CREATE PAYLOAD
      // ------------------------------------------------------

      const payload = normalize({
        ...form,
        profilePhotoUrl
      });

      // ------------------------------------------------------
      // UPDATE
      // ------------------------------------------------------

      if (editingId) {
        await updateDoc(
          doc(
            db,
            "staff",
            editingId
          ),
          payload
        );
      }

      // ------------------------------------------------------
      // CREATE WITH AUTH UID
      // ------------------------------------------------------

      else if (payload.authUid) {
        await setDoc(
          doc(
            db,
            "staff",
            payload.authUid
          ),
          {
            ...payload,

            uid:
              payload.authUid,

            createdAt:
              serverTimestamp()
          },
          {
            merge: true
          }
        );
      }

      // ------------------------------------------------------
      // NORMAL CREATE
      // ------------------------------------------------------

      else {
        await addDoc(
          collection(db, "staff"),
          {
            ...payload,

            createdAt:
              serverTimestamp()
          }
        );
      }

      // ------------------------------------------------------
      // RESET
      // ------------------------------------------------------

      setForm({
        ...empty,

        staffType:
          defaultType === "all"
            ? "nurse"
            : defaultType
      });

      setEditingId(null);
      setShowForm(false);
      setServicesOpen(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await reload();

    } catch (e) {
      console.error(
        "saveStaff",
        e
      );

      setUploadingPhoto(false);

      setError(
        e.message ||
        "Failed to save staff"
      );
    }
  };

  /*
  ============================================================
  EDIT
  ============================================================
  */

  const editRow = (r) => {
    setError("");

    setEditingId(r.id);

    setForm({
      ...empty,

      ...r,

      employeeId:
        r.employeeId || "",

      fatherName:
        r.fatherName || "",

      designation:
        r.designation || "",

      workType:
        r.workType || "Payroll",

      employeeStatus:
        r.employeeStatus ||
        "Active",

      profilePhotoUrl:
        r.profilePhotoUrl || "",

      profilePhotoFile:
        null,

      servicesOffered:
        r.servicesOffered || [],

      experienceYears:
        r.experienceYears ?? "",

      authUid:
        r.authUid ||
        r.uid ||
        ""
    });

    setShowForm(true);
  };

  /*
  ============================================================
  DELETE
  ============================================================
  */

  const remove = async (staff) => {
    if (
      !window.confirm(
        "Delete this staff member permanently?"
      )
    ) {
      return;
    }

    try {
      const uid =
        staff.authUid ||
        staff.uid ||
        staff.id;

      await fetch(
        "https://us-central1-medrent-5d771.cloudfunctions.net/deleteUser",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            uid
          })
        }
      );

      setRows((prev) =>
        prev.filter(
          (x) => x.id !== staff.id
        )
      );

    } catch (err) {
      console.error(
        "deleteStaff",
        err
      );

      setError(
        "Failed to delete staff member."
      );
    }
  };

  /*
  ============================================================
  FILTER
  ============================================================
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
        r.alternatePhone,
        r.fatherName,
        r.gender,
        r.bloodGroup,
        r.designation,
        r.workType,
        r.employeeStatus,
        r.staffType,
        r.qualifications,
        r.address,
        ...(r.servicesOffered || [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const qOk =
        !q ||
        text.includes(q);

      const tOk =
        typeFilter === "all"
          ? true
          : r.staffType ===
            typeFilter;

      const sOk =
        statusFilter === "all"
          ? true
          : String(
              r.currentStatus ||
              r.employeeStatus ||
              ""
            )
              .toLowerCase() ===
            "on duty";

      return (
        qOk &&
        tOk &&
        sOk
      );
    });
  }, [
    rows,
    search,
    typeFilter,
    statusFilter
  ]);

  /*
  ============================================================
  EXPORT
  ============================================================
  */
  /*
  ============================================================
  PRINT STAFF PROFILE URLS
  NAME + PROFILE URL ONLY
  ============================================================
  */

  const printStaffProfileUrls = () => {
    if (!filtered.length) {
      setError("No staff records available to print.");
      return;
    }

    const pdf = new jsPDF(
      "p",
      "mm",
      "a4"
    );

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    let y = 20;

    /*
    ------------------------------------------------------------
    HEADER
    ------------------------------------------------------------
    */

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(18);

    pdf.text(
      "BookMyMedicare",
      pageWidth / 2,
      y,
      {
        align: "center"
      }
    );

    y += 8;

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(11);

    pdf.text(
      defaultType === "caretaker"
        ? "Caretaker Profile Directory"
        : defaultType === "nurse"
          ? "Nursing Staff Profile Directory"
          : "Nursing & Caretaker Profile Directory",
      pageWidth / 2,
      y,
      {
        align: "center"
      }
    );

    y += 16;

    /*
    ------------------------------------------------------------
    STAFF LIST
    ------------------------------------------------------------
    */

    filtered.forEach(
      (staff, index) => {

        const uid =
          staff.authUid ||
          staff.uid ||
          staff.id;

        /*
        Skip records that have
        absolutely no usable UID.
        */
        if (!uid) {
          return;
        }

        const name =
          String(
            staff.name ||
              "Staff Member"
          ).trim();

        const profileUrl =
          `https://bookmymedicare.com/employeeprofiles/${encodeURIComponent(
            uid
          )}`;

        /*
        --------------------------------------------------------
        PAGE BREAK
        --------------------------------------------------------
        */

        if (
          y >
          pageHeight - 35
        ) {
          pdf.addPage();
          y = 20;
        }

        /*
        --------------------------------------------------------
        NAME
        --------------------------------------------------------
        */

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(11);

        pdf.text(
          `${index + 1}. ${name}`,
          15,
          y
        );

        y += 7;

        /*
        --------------------------------------------------------
        PROFILE URL
        --------------------------------------------------------
        */

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(9);

        pdf.text(
          profileUrl,
          20,
          y
        );

        y += 12;

        /*
        --------------------------------------------------------
        SEPARATOR
        --------------------------------------------------------
        */

        pdf.setDrawColor(
          210,
          210,
          210
        );

        pdf.line(
          15,
          y - 5,
          pageWidth - 15,
          y - 5
        );
      }
    );

    /*
    ------------------------------------------------------------
    FOOTER ON ALL PAGES
    ------------------------------------------------------------
    */

    const totalPages =
      pdf.internal.getNumberOfPages();

    for (
      let page = 1;
      page <= totalPages;
      page++
    ) {
      pdf.setPage(page);

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(8);

      pdf.text(
        "BookMyMedicare • Employee Management",
        pageWidth / 2,
        pageHeight - 10,
        {
          align: "center"
        }
      );
    }

    /*
    ------------------------------------------------------------
    DOWNLOAD
    ------------------------------------------------------------
    */

    const fileName =
      defaultType === "caretaker"
        ? "bookmymedicare_caretaker_profile_urls.pdf"
        : defaultType === "nurse"
          ? "bookmymedicare_nurse_profile_urls.pdf"
          : "bookmymedicare_staff_profile_urls.pdf";

    pdf.save(fileName);
  };
  const exportStaff = () => {
    const exportRows =
      filtered.map(
        (r, i) => ({
          No: i + 1,

          "Employee ID":
            r.employeeId || "",

          Name:
            r.name || "",

          Email:
            r.loginEmail || "",

          Phone:
            r.phone || "",

          "Alternate Phone":
            r.alternatePhone || "",

          "Father Name":
            r.fatherName || "",

          DOB:
            r.dateOfBirth || "",

          Gender:
            r.gender || "",

          "Blood Group":
            r.bloodGroup || "",

          Aadhaar:
            r.aadharNumber
              ? `XXXX-XXXX-${r.aadharNumber.slice(
                  -4
                )}`
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
            r.employeeStatus || "",

          Address:
            r.address || "",

          Type:
            r.staffType || "",

          Qualifications:
            r.qualifications || "",

          Experience:
            r.experienceYears ?? "",

          Shift:
            r.shiftType || "",

          Services:
            (
              r.servicesOffered ||
              []
            ).join(", "),

          "Emergency Contact":
            r.emergencyContactName ||
            "",

          "Emergency Phone":
            r.emergencyContactPhone ||
            "",

          Relation:
            r.relation || "",

          "Bank Name":
            r.bankName || "",

          "Account Number":
            r.bankAccountNumber || "",

          IFSC:
            r.bankIfsc || "",

          UPI:
            r.upiId || "",

          "Profile Photo":
            r.profilePhotoUrl || "",

          Available:
            r.available
              ? "Yes"
              : "No",

          Active:
            r.active
              ? "Yes"
              : "No",

          "Auth UID":
            r.authUid ||
            r.uid ||
            ""
        })
      );

    if (!exportRows.length) {
      setError(
        "No staff records available to export."
      );

      return;
    }

    const headers =
      Object.keys(
        exportRows[0]
      );

    const escapeCSV = (v) =>
      `"${String(
        v ?? ""
      ).replace(
        /"/g,
        '""'
      )}"`;

    const csv = [
      headers.join(","),
      ...exportRows.map(
        (r) =>
          headers
            .map(
              (h) =>
                escapeCSV(r[h])
            )
            .join(",")
      )
    ].join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );

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
      "staff_export.csv";

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  /*
  ============================================================
  FORM RESET
  ============================================================
  */

  const openAddForm = () => {
    setError("");

    setForm({
      ...empty,

      staffType:
        defaultType === "all"
          ? "nurse"
          : defaultType
    });

    setEditingId(null);
    setServicesOpen(false);
    setShowForm(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /*
  ============================================================
  FORM FIELD HELPER
  ============================================================
  */

  const updateField = (
    field,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  /*
  ============================================================
  UI
  ============================================================
  */

  return (
    <div className="staff-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <h2>
        {defaultType === "caretaker"
          ? "Caretaker Management"
          : defaultType === "nurse"
            ? "Nursing Staff Management"
            : "Nursing & Caretaker Management"}
      </h2>

      {/* =====================================================
          TOOLBAR
      ===================================================== */}

            {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <div className="staff-toolbar">

        <input
          placeholder="Search employee ID, name, phone, email, designation..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />

        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(
              e.target.value
            )
          }
        >
          <option value="all">
            All
          </option>

          <option value="nurse">
            Nurse
          </option>

          <option value="caretaker">
            Caretaker
          </option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
        >
          <option value="all">
            All Status
          </option>

          <option value="on-duty">
            On Duty
          </option>
        </select>

        <div className="leads-header-actions">

          <button
            type="button"
            className="cp-btn ghost"
            onClick={openAddForm}
          >
            {defaultType === "caretaker"
              ? "Add Caretaker"
              : "Add Nurse"}
          </button>

          <button
            type="button"
            className="cp-btn ghost"
            onClick={exportStaff}
          >
            Export
          </button>

          <button
            type="button"
            className="cp-btn ghost"
            onClick={printStaffProfileUrls}
          >
            Print Profile URLs
          </button>

        </div>

      </div>

      {/* =====================================================
          OVERLAY
      ===================================================== */}

      {showForm && (
        <div
          className="drawer-overlay"
          onClick={() => {
            setShowForm(false);
            setServicesOpen(false);
          }}
        />
      )}

      {/* =====================================================
          DRAWER
      ===================================================== */}

      <div
        className={`drawer ${
          showForm
            ? "open"
            : ""
        }`}
      >

        {/* ===================================================
            DRAWER HEADER
        =================================================== */}

        <div className="drawer-header">

          <h3>
            {editingId
              ? defaultType ===
                "caretaker"
                ? "Edit Caretaker"
                : "Edit Nurse"
              : defaultType ===
                "caretaker"
                ? "Add Caretaker"
                : "Add Nurse"}
          </h3>

          <button
            type="button"
            className="cp-btn ghost"
            onClick={() => {
              setShowForm(false);
              setServicesOpen(false);
            }}
          >
            Close
          </button>

        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="staff-alert">
            ⚠ {error}
          </div>
        )}

        {/* ===================================================
            FORM
        =================================================== */}

        <form
          className="staff-form"
          onSubmit={save}
          onKeyDown={
            handleEnter
          }
        >

          {/* =================================================
              PERSONAL INFORMATION
          ================================================= */}

          <h4>
            Personal Information
          </h4>

          {/* EMPLOYEE ID */}

          <input
            placeholder="Employee ID *"
            value={
              form.employeeId
            }
            onChange={(e) =>
              updateField(
                "employeeId",
                e.target.value
                  .toUpperCase()
                  .replace(
                    /\s/g,
                    ""
                  )
              )
            }
          />

          {/* NAME */}

          <input
            placeholder="Full Name *"
            value={
              form.name
            }
            onChange={(e) => {
              const value =
                e.target.value.replace(
                  /[^A-Za-z\s]/g,
                  ""
                );

              updateField(
                "name",
                value
              );
            }}
          />

          {/* EMAIL */}

          <input
            type="email"
            placeholder="Login Email *"
            value={
              form.loginEmail
            }
            onChange={(e) =>
              updateField(
                "loginEmail",
                e.target.value
              )
            }
          />

          {/* PHONE */}

          <input
            placeholder="Contact Number *"
            value={
              form.phone
            }
            maxLength={10}
            inputMode="numeric"
            onChange={(e) => {
              const value =
                e.target.value.replace(
                  /\D/g,
                  ""
                );

              if (
                value.length <=
                10
              ) {
                updateField(
                  "phone",
                  value
                );
              }
            }}
          />

          {/* ALTERNATE PHONE */}

          <input
            placeholder="Alternate Contact Number"
            value={
              form.alternatePhone
            }
            maxLength={10}
            inputMode="numeric"
            onChange={(e) => {
              const value =
                e.target.value.replace(
                  /\D/g,
                  ""
                );

              if (
                value.length <=
                10
              ) {
                updateField(
                  "alternatePhone",
                  value
                );
              }
            }}
          />

          {/* DOB */}

          <label>
            Date of Birth
          </label>

          <input
            type="date"
            value={
              form.dateOfBirth
            }
            onChange={(e) =>
              updateField(
                "dateOfBirth",
                e.target.value
              )
            }
          />

          {/* FATHER NAME */}

          <input
            placeholder="Father Name"
            value={
              form.fatherName
            }
            onChange={(e) =>
              updateField(
                "fatherName",
                e.target.value
              )
            }
          />

          {/* GENDER */}

          <select
            value={
              form.gender
            }
            onChange={(e) =>
              updateField(
                "gender",
                e.target.value
              )
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
          </select>

          {/* BLOOD GROUP */}

          <select
            value={
              form.bloodGroup
            }
            onChange={(e) =>
              updateField(
                "bloodGroup",
                e.target.value
              )
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

          {/* AADHAAR */}

          <input
            placeholder="Aadhaar Number"
            value={
              form.aadharNumber
            }
            maxLength={12}
            inputMode="numeric"
            onChange={(e) => {
              const value =
                e.target.value.replace(
                  /\D/g,
                  ""
                );

              if (
                value.length <=
                12
              ) {
                updateField(
                  "aadharNumber",
                  value
                );
              }
            }}
          />

          {/* PAN */}

          <input
            placeholder="PAN Number"
            value={
              form.panNumber
            }
            maxLength={10}
            onChange={(e) =>
              updateField(
                "panNumber",
                e.target.value
                  .toUpperCase()
                  .replace(
                    /[^A-Z0-9]/g,
                    ""
                  )
              )
            }
          />

          {/* ADDRESS */}

          <textarea
            placeholder="Complete Address"
            value={
              form.address
            }
            onChange={(e) =>
              updateField(
                "address",
                e.target.value
              )
            }
          />

          {/* =================================================
              EMPLOYMENT INFORMATION
          ================================================= */}

          <h4>
            Employment Information
          </h4>

          {/* DESIGNATION */}

         <input
  type="text"
  placeholder="Designation"
  value={form.designation}
  onChange={(e) =>
    updateField(
      "designation",
      e.target.value
    )
  }
/>

{/* WORK TYPE */}

<input
  type="text"
  placeholder="Work Type"
  value={form.workType}
  onChange={(e) =>
    updateField(
      "workType",
      e.target.value
    )
  }
/>
          {/* JOINING DATE */}

          <label>
            Joining Date
          </label>

          <input
            type="date"
            value={
              form.joiningDate
            }
            onChange={(e) =>
              updateField(
                "joiningDate",
                e.target.value
              )
            }
          />

          {/* EMPLOYEE STATUS */}

          <select
            value={
              form.employeeStatus
            }
            onChange={(e) =>
              updateField(
                "employeeStatus",
                e.target.value
              )
            }
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

            <option value="Suspended">
              Suspended
            </option>

            <option value="Resigned">
              Resigned
            </option>

            <option value="Terminated">
              Terminated
            </option>
          </select>

          {/* STAFF TYPE */}

          <select
            value={
              form.staffType
            }
            onChange={(e) =>
              updateField(
                "staffType",
                e.target.value
              )
            }
          >
            <option value="nurse">
              Nurse
            </option>

            <option value="caretaker">
              Caretaker
            </option>
          </select>

          {/* =================================================
              PROFESSIONAL DETAILS
          ================================================= */}

          <h4>
            Professional Details
          </h4>

          {/* QUALIFICATIONS */}

          <input
            placeholder="Qualifications"
            value={
              form.qualifications
            }
            onChange={(e) =>
              updateField(
                "qualifications",
                e.target.value
              )
            }
          />

          {/* EXPERIENCE */}

          <input
            type="number"
            min="0"
            max="60"
            placeholder="Experience (years)"
            value={
              form.experienceYears
            }
            onChange={(e) =>
              updateField(
                "experienceYears",
                e.target.value
              )
            }
          />

          {/* =================================================
              SERVICES
          ================================================= */}

          <div
            className="services-dropdown"
            ref={servicesRef}
          >

            <div
              className="services-select"
              onClick={() =>
                setServicesOpen(
                  !servicesOpen
                )
              }
            >
              {form.servicesOffered
                .length
                ? form.servicesOffered.join(
                    ", "
                  )
                : "Select Services"}
            </div>

            {servicesOpen && (
              <div className="services-menu">

                {careTypes.length ===
                0 ? (
                  <div className="service-option">
                    No services found
                  </div>
                ) : (
                  careTypes.map(
                    (c) => {
                      const selected =
                        form.servicesOffered.includes(
                          c.name
                        );

                      return (
                        <label
                          key={
                            c.id
                          }
                          className="service-option"
                        >
                          <input
                            type="checkbox"
                            checked={
                              selected
                            }
                            onChange={(
                              e
                            ) => {
                              if (
                                e.target
                                  .checked
                              ) {
                                updateField(
                                  "servicesOffered",
                                  [
                                    ...form.servicesOffered,
                                    c.name
                                  ]
                                );
                              } else {
                                updateField(
                                  "servicesOffered",
                                  form.servicesOffered.filter(
                                    (s) =>
                                      s !==
                                      c.name
                                  )
                                );
                              }
                            }}
                          />

                          <span>
                            {c.name}
                          </span>
                        </label>
                      );
                    }
                  )
                )}

              </div>
            )}

          </div>

          {/* SHIFT TYPE */}

          <select
            value={
              form.shiftType
            }
            onChange={(e) =>
              updateField(
                "shiftType",
                e.target.value
              )
            }
          >
            <option value="">
              Select Shift
            </option>

            <option value="day">
              Day Shift
            </option>

            <option value="night">
              Night Shift
            </option>

            <option value="full">
              Full Day (24hr)
            </option>

            <option value="flexible">
              Flexible
            </option>
          </select>

          {/* SHIFT PREFERENCE */}

          <select
            value={
              form.shiftPreference
            }
            onChange={(e) =>
              updateField(
                "shiftPreference",
                e.target.value
              )
            }
          >
            <option value="day">
              Day Preference
            </option>

            <option value="night">
              Night Preference
            </option>

            <option value="any">
              Any Shift
            </option>
          </select>

          {/* =================================================
              EMERGENCY CONTACT
          ================================================= */}

          <h4>
            Emergency Contact
          </h4>

          <input
            placeholder="Emergency Contact Name"
            value={
              form.emergencyContactName
            }
            onChange={(e) =>
              updateField(
                "emergencyContactName",
                e.target.value
              )
            }
          />

          <input
            placeholder="Emergency Contact Phone"
            value={
              form.emergencyContactPhone
            }
            maxLength={10}
            inputMode="numeric"
            onChange={(e) => {
              const value =
                e.target.value.replace(
                  /\D/g,
                  ""
                );

              if (
                value.length <=
                10
              ) {
                updateField(
                  "emergencyContactPhone",
                  value
                );
              }
            }}
          />

          <input
            placeholder="Relation"
            value={
              form.relation
            }
            onChange={(e) =>
              updateField(
                "relation",
                e.target.value
              )
            }
          />

          {/* =================================================
              BANK DETAILS
          ================================================= */}

          <h4>
            Bank Details
          </h4>

          <input
            placeholder="Bank Name"
            value={
              form.bankName
            }
            onChange={(e) =>
              updateField(
                "bankName",
                e.target.value
              )
            }
          />

          <input
            placeholder="Account Number"
            value={
              form.bankAccountNumber
            }
            maxLength={18}
            inputMode="numeric"
            onChange={(e) => {
              const value =
                e.target.value.replace(
                  /\D/g,
                  ""
                );

              if (
                value.length <=
                18
              ) {
                updateField(
                  "bankAccountNumber",
                  value
                );
              }
            }}
          />

          <input
            placeholder="IFSC Code"
            value={
              form.bankIfsc
            }
            maxLength={11}
            onChange={(e) => {
              const value =
                e.target.value
                  .toUpperCase()
                  .replace(
                    /[^A-Z0-9]/g,
                    ""
                  );

              if (
                value.length <=
                11
              ) {
                updateField(
                  "bankIfsc",
                  value
                );
              }
            }}
          />

          <input
            placeholder="UPI ID"
            value={
              form.upiId
            }
            onChange={(e) =>
              updateField(
                "upiId",
                e.target.value
              )
            }
          />

          {/* =================================================
              PROFILE PHOTO
          ================================================= */}

          <h4>
            Profile Photo
          </h4>

          <div className="staff-profile-photo">

            {form.profilePhotoUrl ? (
              <img
                src={
                  form.profilePhotoUrl
                }
                alt="Staff profile"
                className="staff-profile-preview"
              />
            ) : form.profilePhotoFile ? (
              <img
                src={
                  URL.createObjectURL(
                    form.profilePhotoFile
                  )
                }
                alt="Staff preview"
                className="staff-profile-preview"
              />
            ) : (
              <div className="staff-profile-placeholder">
                No Photo
              </div>
            )}

            <input
              ref={
                fileInputRef
              }
              type="file"
              accept="image/*"
              onChange={
                handlePhotoChange
              }
            />

            <small>
              JPG, PNG, WEBP — Maximum 5 MB
            </small>

          </div>

          {/* =================================================
              AUTH UID
          ================================================= */}

          <h4>
            System / Authentication
          </h4>

          <input
            placeholder="Auth UID"
            value={
              form.authUid
            }
            onChange={(e) =>
              updateField(
                "authUid",
                e.target.value
              )
            }
          />

          {/* =================================================
              AVAILABILITY
          ================================================= */}

          <div className="active-checkbox">

            <label>
              <input
                type="checkbox"
                checked={
                  !!form.available
                }
                onChange={(e) =>
                  updateField(
                    "available",
                    e.target.checked
                  )
                }
              />

              <span>
                Available
              </span>
            </label>

          </div>

          {/* =================================================
              ACTIVE
          ================================================= */}

          <div className="active-checkbox">

            <label>
              <input
                type="checkbox"
                checked={
                  !!form.active
                }
                onChange={(e) =>
                  updateField(
                    "active",
                    e.target.checked
                  )
                }
              />

              <span>
                Active
              </span>
            </label>

          </div>

          {/* =================================================
              ACTIONS
          ================================================= */}

          <div className="actions-row">

            <button
              type="submit"
              className="cp-btn"
              disabled={
                uploadingPhoto
              }
            >
              {uploadingPhoto
                ? "Uploading Photo..."
                : editingId
                  ? defaultType ===
                    "caretaker"
                    ? "Update Caretaker"
                    : "Update Nurse"
                  : defaultType ===
                    "caretaker"
                    ? "Add Caretaker"
                    : "Add Nurse"}
            </button>

            <button
              type="button"
              className="cp-btn ghost"
              onClick={() => {
                setShowForm(false);
                setServicesOpen(false);
              }}
            >
              Cancel
            </button>

          </div>

        </form>

      </div>

      {/* =====================================================
          STAFF TABLE
      ===================================================== */}

      <div className="staff-table">

        {loading ? (
          <p>
            Loading…
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
                  Employee ID
                </th>

                <th>
                  Name
                </th>

                <th>
                  Designation
                </th>

                <th>
                  Type
                </th>

                <th>
                  Work Type
                </th>

                <th>
                  Phone
                </th>

                <th>
                  Gender
                </th>

                <th>
                  Blood Group
                </th>

                <th>
                  Shift
                </th>

                <th>
                  Employee Status
                </th>

                <th>
                  Services
                </th>

                <th>
                  Actions
                </th>

              </tr>
            </thead>

            <tbody>

              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="14"
                    style={{
                      textAlign:
                        "center"
                    }}
                  >
                    No staff found
                  </td>
                </tr>
              ) : (
                filtered.map(
                  (r, index) => (
                    <tr
                      key={
                        r.id
                      }
                    >

                      {/* NUMBER */}

                      <td>
                        {index + 1}
                      </td>

                      {/* PROFILE */}

                      <td>

                        {r.profilePhotoUrl ? (
                          <img
                            src={
                              r.profilePhotoUrl
                            }
                            alt={
                              r.name ||
                              "Staff"
                            }
                            style={{
                              width:
                                42,
                              height:
                                42,
                              borderRadius:
                                "50%",
                              objectFit:
                                "cover"
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width:
                                42,
                              height:
                                42,
                              borderRadius:
                                "50%",
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              background:
                                "#f1f5f9",
                              fontWeight:
                                700
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

                      {/* EMPLOYEE ID */}

                      <td>
                        {r.employeeId ||
                          "-"}
                      </td>

                      {/* NAME */}

                      <td
                        className="staff-name-link"
                        onClick={() =>
                          navigate(
                            `/crm/staff/${r.id}`
                          )
                        }
                      >
                        {r.name ||
                          "-"}
                      </td>

                      {/* DESIGNATION */}

                      <td>
                        {r.designation ||
                          "-"}
                      </td>

                      {/* TYPE */}

                      <td>
                        {r.staffType ||
                          "-"}
                      </td>

                      {/* WORK TYPE */}

                      <td>
                        {r.workType ||
                          "-"}
                      </td>

                      {/* PHONE */}

                      <td>
                        {r.phone ||
                          "-"}
                      </td>

                      {/* GENDER */}

                      <td>
                        {r.gender ||
                          "-"}
                      </td>

                      {/* BLOOD GROUP */}

                      <td>
                        {r.bloodGroup ||
                          "-"}
                      </td>

                      {/* SHIFT */}

                      <td>
                        {r.shiftType
                          ? r.shiftType
                              .charAt(
                                0
                              )
                              .toUpperCase() +
                            r.shiftType.slice(
                              1
                            )
                          : "-"}
                      </td>

                      {/* STATUS */}

                      <td>
                        {r.employeeStatus ||
                          (r.active
                            ? "Active"
                            : "Inactive")}
                      </td>

                      {/* SERVICES */}

                      <td>
                        {(
                          r.servicesOffered ||
                          []
                        ).join(
                          ", "
                        ) || "-"}
                      </td>

                      {/* ACTIONS */}

                      <td>

                        <div className="staff-actions">

                          <button
                            className="st-btn view"
                            onClick={() =>
                              navigate(
                                `/crm/staff/${r.id}`
                              )
                            }
                          >
                            View
                          </button>

                          <button
                            className="st-btn edit"
                            onClick={() =>
                              editRow(r)
                            }
                          >
                            Edit
                          </button>

                          {userRole ===
                            "superadmin" && (
                            <button
                              className="st-btn delete"
                              onClick={() =>
                                remove(
                                  r
                                )
                              }
                            >
                              Delete
                            </button>
                          )}

                          <button
                            className="st-btn attendance"
                            onClick={() =>
                              navigate(
                                `/crm/attendance?role=staff&driverId=${r.id}`
                              )
                            }
                          >
                            Attendance
                          </button>

                        </div>

                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>
        )}

      </div>

    </div>
  );
}