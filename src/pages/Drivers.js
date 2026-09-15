// src/pages/Drivers.js — Complete Updated Driver Management

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  where,
  query,
  onSnapshot,
} from "firebase/firestore";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, auth } from "../firebase";
import "./Drivers.css";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

/**
 * Drivers Management Module
 *
 * Keeps all existing driver functionality and adds
 * complete employee / HR information.
 */
export default function Drivers() {

  /* =========================================================
     STATE
  ========================================================= */

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [showForm, setShowForm] =
    useState(false);

  const [userRole, setUserRole] =
    useState(null);

  const [saving, setSaving] =
    useState(false);

  const navigate =
    useNavigate();

  const storage =
    getStorage();


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
    "Driver",
    "Senior Driver",
    "Driver Supervisor",
    "Transport Executive",
    "Fleet Executive",
    "Fleet Supervisor",
    "Operations Executive",
    "Operations Manager",
    "Field Executive",
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
     EMPTY DRIVER
  ========================================================= */

  const emptyDriver = {
    /* Employee Information */

    employeeId: "",

    name: "",

    loginEmail: "",

    phone: "",

    alternatePhone: "",


    /* Personal Information */

    dob: "",

    fatherName: "",

    gender: "",

    bloodGroup: "",

    aadharNumber: "",

    panNumber: "",


    /* Employment Information */

    designation: "Driver",

    workType: "",

    joiningDate: "",

    employeeStatus: "Active",

    branchId: "",


    /* Profile */

    profilePhotoUrl: "",

    profilePhotoFile: null,


    /* Driver Information */

    vehicle: "",

    status: "available",

    salary: "",

    salaryPeriod: "monthly",

    active: true,

    joinDate: "",

    licenseNumber: "",

    licenseExpiry: "",

    shift: "day",

    address: "",

    emergencyContactName: "",

    emergencyContactPhone: "",

    notes: "",
  };


  const [newDriver, setNewDriver] =
    useState(emptyDriver);


  /* =========================================================
     UPDATE FORM HELPER
  ========================================================= */

  const updateField = (
    field,
    value
  ) => {
    setNewDriver((prev) => ({
      ...prev,
      [field]: value,
    }));
  };


  /* =========================================================
     FETCH ALL DRIVERS
  ========================================================= */

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError("");

      const snap =
        await getDocs(
          collection(db, "drivers")
        );

      const rows =
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }));

      setDrivers(rows);

    } catch (err) {
      console.error(
        "Error fetching drivers",
        err
      );

      setError(
        "Failed to load drivers"
      );

    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchDrivers();
  }, []);


  /* =========================================================
     CURRENT USER ROLE
  ========================================================= */

  useEffect(() => {

    const user =
      auth.currentUser;

    if (!user) return;

    const unsub =
      onSnapshot(
        doc(
          db,
          "users",
          user.uid
        ),
        (docSnap) => {

          if (docSnap.exists()) {
            setUserRole(
              docSnap.data().role
            );
          }

        },
        (err) => {
          console.error(
            "Failed to get user role:",
            err
          );
        }
      );

    return () => unsub();

  }, []);


  /* =========================================================
     OPEN FORM WHEN EDITING
  ========================================================= */

  useEffect(() => {

    if (editingId) {
      setShowForm(true);
    }

  }, [editingId]);


  /* =========================================================
     CLOSE DRAWER ON ESC
  ========================================================= */

  useEffect(() => {

    const onKey = (e) => {

      if (
        e.key === "Escape"
      ) {
        setShowForm(false);
      }

    };

    window.addEventListener(
      "keydown",
      onKey
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKey
      );

  }, []);

const printDriverProfileUrls = () => {
  try {
    setError("");

    if (!filtered?.length) {
      setError("No drivers available to print.");
      return;
    }

    // ================================================================
    // DRIVER PROFILE URL LIST
    // ONLY NAME + URL
    // NO QR CODE
    // NO PHOTO
    // NO EMPLOYEE ID
    // NO DESIGNATION
    // ================================================================

    const driversForPrint = filtered
      .map((driver) => {
        const uid = String(
          driver?.uid ||
            driver?.authUid ||
            driver?.id ||
            ""
        ).trim();

        if (!uid) return null;

        const name = String(
          driver?.name || "Driver"
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

    if (!driversForPrint.length) {
      setError(
        "No valid driver UID found for profile URL generation."
      );
      return;
    }

    // ================================================================
    // PDF SETTINGS
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
    // HEADER
    // ================================================================

    const drawHeader = () => {
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

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(7);

      pdf.setTextColor(
        ...MUTED
      );

      pdf.text(
        "Driver Profile Directory",
        marginX,
        17
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(7);

      pdf.setTextColor(
        ...NAVY
      );

      pdf.text(
        `${driversForPrint.length} Driver${
          driversForPrint.length === 1
            ? ""
            : "s"
        }`,
        pageWidth - marginX,
        14,
        {
          align: "right",
        }
      );

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
    // DRAW DRIVER
    // ================================================================

    const drawDriver = (
      driver,
      x,
      y,
      number
    ) => {
      // Card
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

      // Teal accent
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

      // Number
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
      // DRIVER NAME
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
          driver.name,
          70
        );

      pdf.text(
        nameLines.slice(0, 2),
        x + 18,
        y + 10
      );

      // ============================================================
      // PROFILE URL
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
          driver.profileUrl,
          cardWidth - 70
        );

      pdf.text(
        urlLines.slice(0, 2),
        x + 18,
        y + 18
      );

      // Label
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
    // GENERATE PAGES
    // ================================================================

    for (
      let i = 0;
      i < driversForPrint.length;
      i++
    ) {
      const position =
        i % cardsPerPage;

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

      drawDriver(
        driversForPrint[i],
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
    // SAVE
    // ================================================================

    pdf.save(
      "bookmymedicare_driver_profile_urls.pdf"
    );

  } catch (err) {
    console.error(
      "print driver profile URLs",
      err
    );

    setError(
      err?.message ||
        "Failed to generate driver profile URL PDF."
    );
  }
};
  /* =========================================================
     CURRENCY
  ========================================================= */

  const toCurrency = (
    val
  ) => {

    if (
      val === undefined ||
      val === null ||
      val === ""
    ) {
      return "-";
    }

    const num =
      Number(val);

    if (
      Number.isNaN(num)
    ) {
      return String(val);
    }

    try {

      return num.toLocaleString(
        "en-IN",
        {
          maximumFractionDigits: 2,
        }
      );

    } catch {

      return String(num);

    }
  };


  /* =========================================================
     EMAIL DUPLICATE CHECK
  ========================================================= */

  const emailExists =
    async (email) => {

      const normalizedEmail =
        String(email || "")
          .trim()
          .toLowerCase();

      if (!normalizedEmail) {
        return false;
      }


      const driversQuery =
        query(
          collection(
            db,
            "drivers"
          ),
          where(
            "loginEmail",
            "==",
            normalizedEmail
          )
        );


      const staffQuery =
        query(
          collection(
            db,
            "staff"
          ),
          where(
            "loginEmail",
            "==",
            normalizedEmail
          )
        );


      const marketingQuery =
        query(
          collection(
            db,
            "marketing"
          ),
          where(
            "loginEmail",
            "==",
            normalizedEmail
          )
        );


      const usersQuery =
        query(
          collection(
            db,
            "users"
          ),
          where(
            "email",
            "==",
            normalizedEmail
          )
        );


      const [
        driversSnap,
        staffSnap,
        marketingSnap,
        usersSnap,
      ] = await Promise.all([
        getDocs(driversQuery),
        getDocs(staffQuery),
        getDocs(marketingQuery),
        getDocs(usersQuery),
      ]);


      /*
        When editing the same driver,
        ignore its own existing email.
      */

      const anotherDriverExists =
        driversSnap.docs.some(
          (d) =>
            d.id !== editingId
        );


      return (
        anotherDriverExists ||
        !staffSnap.empty ||
        !marketingSnap.empty ||
        !usersSnap.empty
      );
    };


  /* =========================================================
     MAKE PREVIOUS DRIVERS ACTIVE
  ========================================================= */

  const makeAllDriversActive =
    async () => {

      try {

        const snap =
          await getDocs(
            collection(
              db,
              "drivers"
            )
          );


        for (
          const driverDoc of snap.docs
        ) {

          const data =
            driverDoc.data();


          if (
            data.active === undefined
          ) {

            await updateDoc(
              driverDoc.ref,
              {
                active: true,
                employeeStatus:
                  "Active",
              }
            );

          }

        }


        alert(
          "All previous drivers are now active."
        );

        await fetchDrivers();

      } catch (error) {

        console.error(
          "Migration failed:",
          error
        );

        alert(
          "Failed to update drivers."
        );

      }
    };


  /* =========================================================
     ENTER KEY NAVIGATION
  ========================================================= */

  const handleEnter =
    (e) => {

      if (
        e.key === "Enter" &&
        e.target.tagName !==
          "TEXTAREA"
      ) {

        e.preventDefault();

        const form =
          e.target.form;

        const index =
          Array.prototype.indexOf.call(
            form,
            e.target
          );


        if (
          form.elements[
            index + 1
          ]
        ) {

          form.elements[
            index + 1
          ].focus();

        }

      }
    };


  /* =========================================================
     VALIDATION
  ========================================================= */

  const validate =
    (payload) => {

      /* NAME */

      if (
        !payload.name.trim()
      ) {
        return "Name is required";
      }


      if (
        !/^[A-Za-z\s.'-]{3,80}$/.test(
          payload.name
        )
      ) {
        return (
          "Name should contain valid characters only"
        );
      }


      /* EMPLOYEE ID */

      if (
        !payload.employeeId.trim()
      ) {
        return (
          "Employee ID is required"
        );
      }


      /* EMAIL */

      if (
        !payload.loginEmail.trim()
      ) {
        return (
          "Email is required"
        );
      }


      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          payload.loginEmail
        )
      ) {
        return (
          "Invalid email format"
        );
      }


      /* PHONE */

      if (
        payload.phone &&
        !/^[6-9]\d{9}$/.test(
          payload.phone
        )
      ) {
        return (
          "Invalid Indian phone number"
        );
      }


      /* ALTERNATE PHONE */

      if (
        payload.alternatePhone &&
        !/^[6-9]\d{9}$/.test(
          payload.alternatePhone
        )
      ) {
        return (
          "Invalid alternate phone number"
        );
      }


      /* AADHAAR */

      if (
        payload.aadharNumber &&
        !/^\d{12}$/.test(
          payload.aadharNumber
        )
      ) {
        return (
          "Aadhaar number must contain 12 digits"
        );
      }


      /* PAN */

      if (
        payload.panNumber &&
        !/^[A-Z]{5}\d{4}[A-Z]$/.test(
          payload.panNumber
        )
      ) {
        return (
          "Invalid PAN number"
        );
      }


      /* SALARY */

      if (
        payload.salary !== "" &&
        Number(payload.salary) < 0
      ) {
        return (
          "Salary cannot be negative"
        );
      }


      if (
        Number(payload.salary) >
        500000
      ) {
        return (
          "Salary seems unrealistic"
        );
      }


      /* DOB */

      if (payload.dob) {

        const dob =
          new Date(
            payload.dob
          );

        const today =
          new Date();

        if (
          dob > today
        ) {
          return (
            "Date of birth cannot be in the future"
          );
        }

      }


      /* JOINING DATE */

      const joiningDate =
        payload.joiningDate ||
        payload.joinDate;

      if (joiningDate) {

        const date =
          new Date(
            joiningDate
          );

        const today =
          new Date();

        if (
          date > today
        ) {
          return (
            "Joining date cannot be in the future"
          );
        }

      }


      /* LICENSE */

      if (
        payload.licenseNumber &&
        payload.licenseNumber.length <
          5
      ) {
        return (
          "License number too short"
        );
      }


      if (
        payload.licenseExpiry &&
        joiningDate &&
        payload.licenseExpiry <
          joiningDate
      ) {
        return (
          "License expiry cannot be before joining date"
        );
      }


      /* EMERGENCY CONTACT */

      if (
        payload.emergencyContactPhone &&
        !/^[6-9]\d{9}$/.test(
          payload.emergencyContactPhone
        )
      ) {
        return (
          "Invalid emergency contact phone"
        );
      }


      return "";
    };


  /* =========================================================
     UPLOAD PROFILE PHOTO
  ========================================================= */

  const uploadProfilePhoto =
    async (
      file,
      employeeId
    ) => {

      if (!file) {
        return "";
      }


      if (
        !file.type.startsWith(
          "image/"
        )
      ) {
        throw new Error(
          "Profile photo must be an image"
        );
      }


      const MAX_SIZE =
        5 * 1024 * 1024;


      if (
        file.size > MAX_SIZE
      ) {
        throw new Error(
          "Profile photo must be less than 5 MB"
        );
      }


      const safeEmployeeId =
        String(
          employeeId ||
            "driver"
        )
          .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          );


      const extension =
        file.name.includes(".")
          ? file.name
              .split(".")
              .pop()
              .toLowerCase()
          : "jpg";


      const fileName =
        `profile_${Date.now()}.${extension}`;


      const storageRef =
        ref(
          storage,
          `drivers/profilePhotos/${safeEmployeeId}/${fileName}`
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
     SAVE DRIVER
  ========================================================= */

  const saveDriver =
    async (e) => {

      e.preventDefault();

      setError("");

      if (saving) {
        return;
      }


      try {

        setSaving(true);


        /*
          Normalize all fields.
        */

        const normalized = {

          /* Employee */

          employeeId:
            newDriver.employeeId
              .trim(),

          name:
            newDriver.name
              .trim(),

          loginEmail:
            newDriver.loginEmail
              .trim()
              .toLowerCase(),

          phone:
            newDriver.phone
              .replace(/\D/g, ""),

          alternatePhone:
            newDriver.alternatePhone
              .replace(/\D/g, ""),


          /* Personal */

          dob:
            newDriver.dob || "",

          fatherName:
            newDriver.fatherName
              .trim(),

          gender:
            newDriver.gender || "",

          bloodGroup:
            newDriver.bloodGroup ||
            "",

          aadharNumber:
            newDriver.aadharNumber
              .replace(/\D/g, ""),

          panNumber:
            newDriver.panNumber
              .trim()
              .toUpperCase(),


          /* Employment */

          designation:
            newDriver.designation ||
            "Driver",

          workType:
            newDriver.workType ||
            "",

          joiningDate:
            newDriver.joiningDate ||
            newDriver.joinDate ||
            "",

          /*
            Keep joinDate too so old driver
            functionality remains compatible.
          */
          joinDate:
            newDriver.joiningDate ||
            newDriver.joinDate ||
            "",

          employeeStatus:
            newDriver.employeeStatus ||
            "Active",

          branchId:
            newDriver.branchId
              .trim(),


          /* Driver */

          vehicle:
            newDriver.vehicle
              .trim(),

          status:
            newDriver.status ||
            "available",

          salary:
            newDriver.salary === ""
              ? ""
              : Number(
                  newDriver.salary
                ),

          salaryPeriod:
            newDriver.salaryPeriod ||
            "monthly",

          licenseNumber:
            newDriver.licenseNumber
              .trim(),

          licenseExpiry:
            newDriver.licenseExpiry ||
            "",

          shift:
            newDriver.shift ||
            "day",

          address:
            newDriver.address
              .trim(),

          emergencyContactName:
            newDriver
              .emergencyContactName
              .trim(),

          emergencyContactPhone:
            newDriver
              .emergencyContactPhone
              .replace(
                /\D/g,
                ""
              ),

          notes:
            newDriver.notes
              .trim(),

          active:
            newDriver.active !==
            false,

          updatedAt:
            serverTimestamp(),
        };


        /*
          Validate.
        */

        const msg =
          validate(normalized);


        if (msg) {
          setError(msg);
          return;
        }


        /*
          Check duplicate email only
          for new driver or another driver.
        */

        const exists =
          await emailExists(
            normalized.loginEmail
          );


        if (exists) {

          setError(
            "This email already exists in the system."
          );

          return;
        }


        /*
          Profile photo upload.
        */

        let profilePhotoUrl =
          newDriver.profilePhotoUrl ||
          "";


        if (
          newDriver.profilePhotoFile
        ) {

          profilePhotoUrl =
            await uploadProfilePhoto(
              newDriver.profilePhotoFile,
              normalized.employeeId
            );

        }


        /*
          Save profile photo URL
          separately from File object.
        */

        const firestoreData = {

          ...normalized,

          profilePhotoUrl,

          updatedAt:
            serverTimestamp(),
        };


        /* UPDATE */

        if (editingId) {

          await updateDoc(
            doc(
              db,
              "drivers",
              editingId
            ),
            firestoreData
          );

        }

        /* CREATE */

        else {

          await addDoc(
            collection(
              db,
              "drivers"
            ),
            {
              ...firestoreData,

              createdAt:
                serverTimestamp(),
            }
          );

        }


        /* RESET */

        setNewDriver({
          ...emptyDriver,
        });

        setEditingId(null);

        setShowForm(false);

        await fetchDrivers();

      } catch (err) {

        console.error(
          "saveDriver",
          err
        );

        setError(
          err?.message ||
          "Failed to save driver."
        );

      } finally {

        setSaving(false);

      }
    };


  /* =========================================================
     EDIT DRIVER
  ========================================================= */

  const editDriver =
    (driver) => {

      setEditingId(
        driver.id
      );


      setNewDriver({

        ...emptyDriver,

        /* Employee */

        employeeId:
          driver.employeeId ||
          "",

        name:
          driver.name ||
          "",

        loginEmail:
          driver.loginEmail ||
          "",

        phone:
          driver.phone ||
          "",

        alternatePhone:
          driver.alternatePhone ||
          "",


        /* Personal */

        dob:
          driver.dob ||
          driver.dateOfBirth ||
          "",

        fatherName:
          driver.fatherName ||
          "",

        gender:
          driver.gender ||
          "",

        bloodGroup:
          driver.bloodGroup ||
          "",

        aadharNumber:
          driver.aadharNumber ||
          driver.aadhaarNumber ||
          "",

        panNumber:
          driver.panNumber ||
          "",


        /* Employment */

        designation:
          driver.designation ||
          "Driver",

        workType:
          driver.workType ||
          "",

        joiningDate:
          driver.joiningDate ||
          driver.joinDate ||
          "",

        employeeStatus:
          driver.employeeStatus ||
          (
            driver.active === false
              ? "Inactive"
              : "Active"
          ),

        branchId:
          driver.branchId ||
          "",


        /* Profile */

        profilePhotoUrl:
          driver.profilePhotoUrl ||
          driver.profilePhoto ||
          "",

        profilePhotoFile:
          null,


        /* Driver */

        vehicle:
          driver.vehicle ||
          "",

        status:
          driver.status ||
          "available",

        salary:
          driver.salary ===
            undefined ||
          driver.salary === null
            ? ""
            : driver.salary,

        salaryPeriod:
          driver.salaryPeriod ||
          "monthly",

        active:
          driver.active !==
          false,

        joinDate:
          driver.joinDate ||
          driver.joiningDate ||
          "",

        licenseNumber:
          driver.licenseNumber ||
          "",

        licenseExpiry:
          driver.licenseExpiry ||
          "",

        shift:
          driver.shift ||
          "day",

        address:
          driver.address ||
          "",

        emergencyContactName:
          driver.emergencyContactName ||
          "",

        emergencyContactPhone:
          driver.emergencyContactPhone ||
          "",

        notes:
          driver.notes ||
          "",
      });

    };


  /* =========================================================
     DELETE DRIVER
  ========================================================= */

  const deleteDriverById =
    async (driver) => {

      if (
        !window.confirm(
          "Delete this driver permanently?"
        )
      ) {
        return;
      }


      try {

        const uid =
          driver.authUid ||
          driver.uid ||
          null;

        const docId =
          driver.id;


        const res =
          await fetch(
            "https://us-central1-medrent-5d771.cloudfunctions.net/deleteUser",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
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


        setDrivers(
          (prev) =>
            prev.filter(
              (d) =>
                d.id !== driver.id
            )
        );

      } catch (err) {

        console.error(
          "deleteDriver",
          err
        );

        setError(
          "Failed to delete driver."
        );

      }
    };


  /* =========================================================
     SEARCH + FILTER
  ========================================================= */

  const filtered =
    useMemo(() => {

      const q =
        search
          .trim()
          .toLowerCase();


      return drivers.filter(
        (d) => {

          const matchText = [

            /* Employee */

            d.employeeId,

            d.name,

            d.phone,

            d.alternatePhone,

            d.loginEmail,

            d.branchId,


            /* Personal */

            d.dob,

            d.fatherName,

            d.gender,

            d.bloodGroup,

            d.aadharNumber,

            d.panNumber,


            /* Employment */

            d.designation,

            d.workType,

            d.joiningDate,

            d.joinDate,

            d.employeeStatus,


            /* Driver */

            d.vehicle,

            d.status,

            d.salary,

            d.licenseNumber,

            d.licenseExpiry,

            d.shift,

            d.address,

            d.emergencyContactName,

            d.emergencyContactPhone,

            d.notes,

          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


          const statusOk =
            statusFilter ===
              "all"
              ? true
              : (
                  d.status ||
                  ""
                ).toLowerCase() ===
                statusFilter;


          const queryOk =
            !q ||
            matchText.includes(q);


          return (
            statusOk &&
            queryOk
          );

        }
      );

    }, [
      drivers,
      search,
      statusFilter,
    ]);


  /* =========================================================
     EXPORT
  ========================================================= */

  const exportDrivers =
    () => {

      const rows =
        filtered.map(
          (d, i) => ({

            No:
              i + 1,

            "Employee ID":
              d.employeeId ||
              "",

            Name:
              d.name ||
              "",

            Email:
              d.loginEmail ||
              "",

            Phone:
              d.phone ||
              "",

            "Alternate Phone":
              d.alternatePhone ||
              "",

            DOB:
              d.dob ||
              "",

            "Father Name":
              d.fatherName ||
              "",

            Gender:
              d.gender ||
              "",

            "Blood Group":
              d.bloodGroup ||
              "",

            /*
              Mask Aadhaar.
            */

            Aadhaar:
              d.aadharNumber
                ? `********${String(
                    d.aadharNumber
                  ).slice(-4)}`
                : "",

            PAN:
              d.panNumber ||
              "",

            Designation:
              d.designation ||
              "",

            "Work Type":
              d.workType ||
              "",

            "Joining Date":
              d.joiningDate ||
              d.joinDate ||
              "",

            "Employee Status":
              d.employeeStatus ||
              (
                d.active !== false
                  ? "Active"
                  : "Inactive"
              ),

            Branch:
              d.branchId ||
              "",

            "Profile Photo":
              d.profilePhotoUrl ||
              "",

            Vehicle:
              d.vehicle ||
              "",

            Status:
              d.status ||
              "",

            Salary:
              d.salary === "" ||
              d.salary === undefined
                ? ""
                : `${d.salary}/${d.salaryPeriod || ""}`,

            Shift:
              d.shift ||
              "",

            LicenseNumber:
              d.licenseNumber ||
              "",

            LicenseExpiry:
              d.licenseExpiry ||
              "",

            Address:
              d.address ||
              "",

            EmergencyContactName:
              d.emergencyContactName ||
              "",

            EmergencyContactPhone:
              d.emergencyContactPhone ||
              "",

            Notes:
              d.notes ||
              "",

            Active:
              d.active !== false
                ? "Active"
                : "Inactive",
          })
        );


      if (!rows.length) {
        alert(
          "No drivers available to export"
        );
        return;
      }


      const headers =
        Object.keys(
          rows[0]
        );


      const escapeCSV =
        (v) =>
          `"${String(
            v ?? ""
          ).replace(
            /"/g,
            '""'
          )}"`;


      const csv = [

        headers.join(","),

        ...rows.map(
          (r) =>
            headers
              .map(
                (h) =>
                  escapeCSV(
                    r[h]
                  )
              )
              .join(",")
        ),

      ].join("\n");


      const blob =
        new Blob(
          [csv],
          {
            type:
              "text/csv;charset=utf-8;",
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
        "drivers_export.csv";

      document.body.appendChild(
        a
      );

      a.click();

      document.body.removeChild(
        a
      );

      URL.revokeObjectURL(
        url
      );
    };


  /* =========================================================
     PROFILE PREVIEW
  ========================================================= */

  const profilePreview =
    newDriver.profilePhotoFile
      ? URL.createObjectURL(
          newDriver.profilePhotoFile
        )
      : newDriver.profilePhotoUrl ||
        "";


  /* =========================================================
     CLOSE FORM
  ========================================================= */

  const closeForm =
    () => {

      if (saving) return;

      setEditingId(null);

      setNewDriver({
        ...emptyDriver,
      });

      setError("");

      setShowForm(false);
    };


  /* =========================================================
     RENDER
  ========================================================= */

  return (

    <div className="drivers-page">

      <h2>
        Runners Management
      </h2>


      {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <div className="drivers-toolbar">

        <input
          type="text"
          placeholder="Search by employee ID, name, phone, email, license, address…"
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />


        <select
          value={
            statusFilter
          }
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
          title="Filter by status"
        >

          <option value="all">
            All statuses
          </option>

          <option value="available">
            Available
          </option>

          <option value="busy">
            Busy
          </option>

          <option value="offline">
            Offline
          </option>

        </select>


        <div className="leads-header-actions">

          <button
            className="cp-btn ghost"
            type="button"
            onClick={() => {

              setShowForm(true);

              setEditingId(null);

              setNewDriver({
                ...emptyDriver,
              });

              setError("");

            }}
          >
            Add Driver
          </button>


          <button
            className="cp-btn ghost"
            type="button"
            onClick={
              exportDrivers
            }
          >
            Export
          </button>
          <button
  className="cp-btn ghost"
  type="button"
  onClick={printDriverProfileUrls}
>
  Print Profile URLs
</button>

        </div>

      </div>


      {/* =====================================================
          MOBILE ADD
      ===================================================== */}

      <button
        className="fab-add"
        aria-label="Add Driver"
        type="button"
        onClick={() => {

          setShowForm(true);

          setEditingId(null);

          setNewDriver({
            ...emptyDriver,
          });

          setError("");

        }}
      >
        +
      </button>


      {/* =====================================================
          MIGRATION BUTTON
      ===================================================== */}

      <button
        className="cp-btn ghost"
        type="button"
        onClick={
          makeAllDriversActive
        }
      >
        Make Previous Drivers Active
      </button>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (

        <div
          style={{
            marginTop: "12px",
            padding: "12px 14px",
            borderRadius: "8px",
            background: "#fff1f2",
            color: "#b42318",
            border:
              "1px solid #fecdd3",
            fontSize: "14px",
          }}
        >
          {error}
        </div>

      )}


      {/* =====================================================
          DRAWER OVERLAY
      ===================================================== */}

      {showForm && (

        <div
          className="drawer-overlay"
          onClick={
            closeForm
          }
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

        <div className="drawer-header">

          <h3>
            {editingId
              ? "Edit Driver"
              : "Add Driver"}
          </h3>


          <button
            className="cp-btn ghost"
            type="button"
            onClick={
              closeForm
            }
          >
            Close
          </button>

        </div>


        {/* ===================================================
            FORM
        =================================================== */}

        <form
          onSubmit={
            saveDriver
          }
          className="driver-form"
          onKeyDown={
            handleEnter
          }
        >

          <div className="grid-cols">


            {/* =================================================
                EMPLOYEE INFORMATION
            ================================================= */}

            <div
              style={{
                gridColumn:
                  "1 / -1",
                fontWeight: 700,
                fontSize:
                  "15px",
                marginTop:
                  "4px",
                marginBottom:
                  "2px",
              }}
            >
              Employee Information
            </div>


            <input
              type="text"
              placeholder="Employee ID *"
              value={
                newDriver.employeeId
              }
              onChange={(e) =>
                updateField(
                  "employeeId",
                  e.target.value
                )
              }
              required
            />


            <input
              type="text"
              placeholder="Full Name *"
              value={
                newDriver.name
              }
              onChange={(e) =>
                updateField(
                  "name",
                  e.target.value
                )
              }
              required
            />


            <input
              type="email"
              placeholder="Login Email *"
              value={
                newDriver.loginEmail
              }
              onChange={(e) =>
                updateField(
                  "loginEmail",
                  e.target.value
                )
              }
              required
            />


            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Contact Number"
              value={
                newDriver.phone
              }
              onChange={(e) =>
                updateField(
                  "phone",
                  e.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(
                      0,
                      10
                    )
                )
              }
            />


            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Alternate Contact Number"
              value={
                newDriver.alternatePhone
              }
              onChange={(e) =>
                updateField(
                  "alternatePhone",
                  e.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(
                      0,
                      10
                    )
                )
              }
            />


            {/* =================================================
                PERSONAL DETAILS
            ================================================= */}

            <div
              style={{
                gridColumn:
                  "1 / -1",
                fontWeight: 700,
                fontSize:
                  "15px",
                marginTop:
                  "8px",
                marginBottom:
                  "2px",
              }}
            >
              Personal Details
            </div>


            <div className="field-group">

              <label>
                Date of Birth
              </label>

              <input
                type="date"
                value={
                  newDriver.dob
                }
                onChange={(e) =>
                  updateField(
                    "dob",
                    e.target.value
                  )
                }
              />

            </div>


            <input
              type="text"
              placeholder="Father Name"
              value={
                newDriver.fatherName
              }
              onChange={(e) =>
                updateField(
                  "fatherName",
                  e.target.value
                )
              }
            />


            <select
              value={
                newDriver.gender
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


            <select
              value={
                newDriver.bloodGroup
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


            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              placeholder="Aadhaar Number"
              value={
                newDriver.aadharNumber
              }
              onChange={(e) =>
                updateField(
                  "aadharNumber",
                  e.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(
                      0,
                      12
                    )
                )
              }
            />


            <input
              type="text"
              maxLength={10}
              placeholder="PAN Number"
              value={
                newDriver.panNumber
              }
              onChange={(e) =>
                updateField(
                  "panNumber",
                  e.target.value
                    .toUpperCase()
                    .slice(
                      0,
                      10
                    )
                )
              }
            />


            {/* =================================================
                EMPLOYMENT DETAILS
            ================================================= */}

            <div
              style={{
                gridColumn:
                  "1 / -1",
                fontWeight: 700,
                fontSize:
                  "15px",
                marginTop:
                  "8px",
                marginBottom:
                  "2px",
              }}
            >
              Employment Details
            </div>


            <input
  type="text"
  placeholder="Designation"
  value={newDriver.designation}
  onChange={(e) =>
    updateField("designation", e.target.value)
  }
/>

<input
  type="text"
  placeholder="Work Type"
  value={newDriver.workType}
  onChange={(e) =>
    updateField("workType", e.target.value)
  }
/>

            <div className="field-group">

              <label>
                Joining Date
              </label>

              <input
                type="date"
                value={
                  newDriver.joiningDate
                }
                onChange={(e) => {

                  updateField(
                    "joiningDate",
                    e.target.value
                  );

                  /*
                    Keep old joinDate
                    field compatible.
                  */
                  updateField(
                    "joinDate",
                    e.target.value
                  );

                }}
              />

            </div>


            <select
              value={
                newDriver.employeeStatus
              }
              onChange={(e) => {

                const status =
                  e.target.value;

                setNewDriver(
                  (prev) => ({

                    ...prev,

                    employeeStatus:
                      status,

                    active:
                      status ===
                      "Active",

                  })
                );

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


            <input
              type="text"
              placeholder="Branch"
              value={
                newDriver.branchId
              }
              onChange={(e) =>
                updateField(
                  "branchId",
                  e.target.value
                )
              }
            />


            {/* =================================================
                PROFILE PHOTO
            ================================================= */}

            <div
              style={{
                gridColumn:
                  "1 / -1",
                fontWeight: 700,
                fontSize:
                  "15px",
                marginTop:
                  "8px",
                marginBottom:
                  "2px",
              }}
            >
              Profile Photo
            </div>


            {profilePreview && (

              <div
                style={{
                  gridColumn:
                    "1 / -1",
                  display: "flex",
                  alignItems:
                    "center",
                  gap: "12px",
                  marginBottom:
                    "6px",
                }}
              >

                <img
                  src={
                    profilePreview
                  }
                  alt="Driver profile"
                  style={{
                    width:
                      "80px",
                    height:
                      "80px",
                    borderRadius:
                      "50%",
                    objectFit:
                      "cover",
                    border:
                      "1px solid #ddd",
                  }}
                />

                <span
                  style={{
                    fontSize:
                      "12px",
                    opacity:
                      0.7,
                  }}
                >
                  Current profile photo
                </span>

              </div>

            )}


            <div
              style={{
                gridColumn:
                  "1 / -1",
              }}
            >

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {

                  const file =
                    e.target.files?.[0] ||
                    null;

                  updateField(
                    "profilePhotoFile",
                    file
                  );

                }}
              />

              <small
                style={{
                  display:
                    "block",
                  marginTop:
                    "5px",
                  opacity:
                    0.65,
                }}
              >
                Image only, maximum
                5 MB.
              </small>

            </div>


            {/* =================================================
                DRIVER DETAILS
            ================================================= */}

            <div
              style={{
                gridColumn:
                  "1 / -1",
                fontWeight: 700,
                fontSize:
                  "15px",
                marginTop:
                  "8px",
                marginBottom:
                  "2px",
              }}
            >
              Driver Details
            </div>


            <input
              type="text"
              placeholder="Vehicle / Equipment"
              value={
                newDriver.vehicle
              }
              onChange={(e) =>
                updateField(
                  "vehicle",
                  e.target.value
                )
              }
            />


            <select
              value={
                newDriver.status
              }
              onChange={(e) =>
                updateField(
                  "status",
                  e.target.value
                )
              }
              title="Current availability"
            >

              <option value="available">
                Available
              </option>

              <option value="busy">
                Busy
              </option>

              <option value="offline">
                Offline
              </option>

            </select>


            {/* =================================================
                SALARY
            ================================================= */}

            <div
              className="field-group"
            >

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Salary (base)"
                value={
                  newDriver.salary
                }
                onChange={(e) =>
                  updateField(
                    "salary",
                    e.target.value
                  )
                }
              />


              <select
                value={
                  newDriver.salaryPeriod
                }
                onChange={(e) =>
                  updateField(
                    "salaryPeriod",
                    e.target.value
                  )
                }
                title="Salary period"
              >

                <option value="monthly">
                  Monthly
                </option>

                <option value="weekly">
                  Weekly
                </option>

                <option value="daily">
                  Daily
                </option>

              </select>

            </div>


            {/* =================================================
                LICENSE
            ================================================= */}

            <input
              type="text"
              placeholder="License Number"
              value={
                newDriver.licenseNumber
              }
              onChange={(e) =>
                updateField(
                  "licenseNumber",
                  e.target.value
                )
              }
            />


            <div className="field-group">

              <label>
                License Expiry
              </label>

              <input
                type="date"
                value={
                  newDriver.licenseExpiry
                }
                onChange={(e) =>
                  updateField(
                    "licenseExpiry",
                    e.target.value
                  )
                }
              />

            </div>


            {/* =================================================
                SHIFT
            ================================================= */}

            <select
              value={
                newDriver.shift
              }
              onChange={(e) =>
                updateField(
                  "shift",
                  e.target.value
                )
              }
              title="Preferred Shift"
            >

              <option value="day">
                Day
              </option>

              <option value="night">
                Night
              </option>

              <option value="rotational">
                Rotational
              </option>

            </select>


            {/* =================================================
                ADDRESS
            ================================================= */}

            <div
              style={{
                gridColumn:
                  "1 / -1",
              }}
            >

              <textarea
                placeholder="Complete Address"
                value={
                  newDriver.address
                }
                onChange={(e) =>
                  updateField(
                    "address",
                    e.target.value
                  )
                }
                rows={3}
                style={{
                  width:
                    "100%",
                  resize:
                    "vertical",
                }}
              />

            </div>


            {/* =================================================
                EMERGENCY CONTACT
            ================================================= */}

            <input
              type="text"
              placeholder="Emergency Contact Name"
              value={
                newDriver.emergencyContactName
              }
              onChange={(e) =>
                updateField(
                  "emergencyContactName",
                  e.target.value
                )
              }
            />


            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Emergency Contact Phone"
              value={
                newDriver.emergencyContactPhone
              }
              onChange={(e) =>
                updateField(
                  "emergencyContactPhone",
                  e.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(
                      0,
                      10
                    )
                )
              }
            />


            {/* =================================================
                NOTES
            ================================================= */}

            <div
              style={{
                gridColumn:
                  "1 / -1",
              }}
            >

              <textarea
                placeholder="Notes"
                value={
                  newDriver.notes
                }
                onChange={(e) =>
                  updateField(
                    "notes",
                    e.target.value
                  )
                }
                rows={3}
                style={{
                  width:
                    "100%",
                  resize:
                    "vertical",
                }}
              />

            </div>


            {/* =================================================
                ACTIVE
            ================================================= */}

            <div
              className="active-checkbox"
            >

              <label>

                <input
                  type="checkbox"
                  checked={
                    !!newDriver.active
                  }
                  onChange={(e) => {

                    const active =
                      e.target.checked;

                    setNewDriver(
                      (prev) => ({

                        ...prev,

                        active,

                        employeeStatus:
                          active
                            ? "Active"
                            : "Inactive",

                      })
                    );

                  }}
                />

                <span>
                  Active
                </span>

              </label>

            </div>


          </div>


          {/* =================================================
              ACTIONS
          ================================================= */}

          <div
            className="actions-row"
          >

            <button
              className="cp-btn"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Driver"
                  : "Add Driver"}
            </button>


            <button
              type="button"
              className="cp-btn ghost"
              onClick={
                closeForm
              }
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

      <div
        className="drivers-table"
      >

        {loading ? (

          <p>
            Loading drivers…
          </p>

        ) : (

          <table>

            <thead>

              <tr>

                <th>
                  #
                </th>

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
                  Phone
                </th>

                <th>
                  Designation
                </th>

                <th>
                  Vehicle
                </th>

                <th>
                  Status
                </th>

                <th>
                  Salary
                </th>

                <th>
                  Shift
                </th>

                <th>
                  Employee Status
                </th>

                <th>
                  Active
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>


            <tbody>

              {filtered.length ===
              0 ? (

                <tr>

                  <td
                    colSpan="13"
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "30px",
                    }}
                  >
                    No drivers found
                  </td>

                </tr>

              ) : (

                filtered.map(
                  (d, i) => (

                    <tr
                      key={
                        d.id
                      }
                    >

                      {/* # */}

                      <td>
                        {i + 1}
                      </td>


                      {/* Profile */}

                      <td>

                        {d.profilePhotoUrl ||
                        d.profilePhoto ? (

                          <img
                            src={
                              d.profilePhotoUrl ||
                              d.profilePhoto
                            }
                            alt={
                              d.name ||
                              "Driver"
                            }
                            style={{
                              width:
                                "42px",
                              height:
                                "42px",
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
                              width:
                                "42px",
                              height:
                                "42px",
                              borderRadius:
                                "50%",
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              background:
                                "#f1f3f5",
                              fontWeight:
                                700,
                            }}
                          >
                            {(
                              d.name ||
                              "D"
                            )
                              .charAt(
                                0
                              )
                              .toUpperCase()}
                          </div>

                        )}

                      </td>


                      {/* Employee ID */}

                      <td>
                        {d.employeeId ||
                          "-"}
                      </td>


                      {/* Name */}

                      <td
                        className="driver-name"
                      >
                        {d.name ||
                          "-"}
                      </td>


                      {/* Phone */}

                      <td>
                        {d.phone ||
                          "-"}
                      </td>


                      {/* Designation */}

                      <td>
                        {d.designation ||
                          "-"}
                      </td>


                      {/* Vehicle */}

                      <td>
                        {d.vehicle ||
                          "-"}
                      </td>


                      {/* Availability */}

                      <td>

                        <span
                          className={`status-badge ${
                            (
                              d.status ||
                              ""
                            ).toLowerCase()
                          }`}
                        >
                          {d.status ||
                            "-"}
                        </span>

                      </td>


                      {/* Salary */}

                      <td>

                        {d.salary ===
                          "" ||
                        d.salary ===
                          undefined
                          ? "-"
                          : `₹${toCurrency(
                              d.salary
                            )}/${d.salaryPeriod ||
                            ""}`}

                      </td>


                      {/* Shift */}

                      <td
                        style={{
                          textTransform:
                            "capitalize",
                        }}
                      >
                        {d.shift ||
                          "-"}
                      </td>


                      {/* Employee Status */}

                      <td>

                        {d.employeeStatus ||
                          (
                            d.active !==
                            false
                              ? "Active"
                              : "Inactive"
                          )}

                      </td>


                      {/* Active */}

                      <td>

                        <button
                          type="button"
                          className="cp-btn ghost"
                          onClick={async () => {

                            try {

                              const next =
                                !(
                                  d.active !==
                                  false
                                );

                              await updateDoc(
                                doc(
                                  db,
                                  "drivers",
                                  d.id
                                ),
                                {
                                  active:
                                    next,

                                  employeeStatus:
                                    next
                                      ? "Active"
                                      : "Inactive",

                                  updatedAt:
                                    serverTimestamp(),
                                }
                              );


                              setDrivers(
                                (prev) =>
                                  prev.map(
                                    (item) =>
                                      item.id ===
                                      d.id
                                        ? {
                                            ...item,
                                            active:
                                              next,
                                            employeeStatus:
                                              next
                                                ? "Active"
                                                : "Inactive",
                                          }
                                        : item
                                  )
                              );

                            } catch (
                              err
                            ) {

                              console.error(
                                err
                              );

                              setError(
                                "Failed to update active status."
                              );

                            }

                          }}
                        >
                          {d.active !==
                          false
                            ? "Active"
                            : "Inactive"}
                        </button>

                      </td>


                      {/* Actions */}

                      <td>

                        <div
                          className="driver-actions"
                        >

                          {/* Edit */}

                          <button
                            type="button"
                            className="dr-btn edit"
                            onClick={() =>
                              editDriver(
                                d
                              )
                            }
                          >
                            Edit
                          </button>


                          {/* Delete */}

                          {userRole ===
                            "superadmin" && (

                            <button
                              type="button"
                              className="dr-btn delete"
                              onClick={() =>
                                deleteDriverById(
                                  d
                                )
                              }
                            >
                              Delete
                            </button>

                          )}


                          {/* Attendance */}

                          <button
                            type="button"
                            className="dr-btn attendance"
                            onClick={() =>
                              navigate(
                                `/crm/attendance?driverId=${d.id}`
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


      <p
        className="muted"
        style={{
          marginTop: 8,
        }}
      >
        Tip: Salary is a base figure.
        If you track per-trip/per-hour
        allowances or bonuses, store
        them in Jobs/Trips and compute
        payouts in reports.
      </p>

    </div>
  );
}