import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  serverTimestamp,
  addDoc,
  query,
  where,
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import "./NursingOrderDetails.css";

/* ======================
   Helpers
====================== */

const fmtCurrency = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function NursingOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [assignments, setAssignments] = useState([]);
const [userRole, setUserRole] = useState("");
const isSuperAdmin = userRole === "superadmin";
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [error, setError] = useState("");
const [salaryRequests, setSalaryRequests] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignServiceIndex, setAssignServiceIndex] = useState(null);
  const [editableItems, setEditableItems] = useState([]);
  const [servicesEditing, setServicesEditing] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [tempSalary, setTempSalary] = useState({});
  const [rateCard, setRateCard] = useState([]);
  const [careTypes, setCareTypes] = useState([]);
  const [assignRateConfig, setAssignRateConfig] = useState({
    careType: "base",
    shift: "day"
  });
  const [staffFilters, setStaffFilters] = useState({
    staffType: "all",
    shiftType: "all",
    rateType: "all"
  });
  const [extendServiceModal, setExtendServiceModal] = useState({
    open: false,
    serviceIndex: null,
    endDate: "",
    amount: ""
  });
  const [salaryRequestModal, setSalaryRequestModal] = useState({
    open: false,
    assignment: null,
    rate: "",
    note: ""
  });
  const openSalaryRequestModal = (assignment) => {

    setSalaryRequestModal({
      open: true,
      assignment,
      rate: "",
      note: ""
    });

  };
  const openExtendServiceModal = (serviceIndex) => {

    const service = editableItems?.[serviceIndex];

    setExtendServiceModal({
      open: true,
      serviceIndex,
      endDate: formatDateTimeLocal(service?.expectedEndDate),
      amount: ""
    });

  };
  const formatDateTimeLocal = (value) => {
    if (!value) return "";

    const d = new Date(value);

    const pad = (n) => String(n).padStart(2, "0");

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const openAssignModal = (serviceIndex) => {

    const service = editableItems?.[serviceIndex];

    setAssignServiceIndex(serviceIndex);

    setAssignDates({
      startDate: formatDateTimeLocal(service?.expectedStartDate),
      endDate: formatDateTimeLocal(service?.expectedEndDate)
    });

    setAssignOpen(true);

  };
  const getDuration = (start, end) => {

    const startDate = new Date(start);
    const endDate = new Date(end);

    const diffMs = endDate - startDate;

    if (diffMs <= 0) {
      return { hours: 0, days: 0, months: 0 };
    }

    /* HOURS */

    const hours = Math.floor(diffMs / (1000 * 60 * 60));

    /* DAYS (inclusive calendar days) */

    const startDay = new Date(startDate);
    const endDay = new Date(endDate);

    startDay.setHours(0, 0, 0, 0);
    endDay.setHours(0, 0, 0, 0);

    const days =
      Math.floor((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1;

    /* MONTHS */

    let months = 0;

    if (days >= 29) {
      months = Math.floor(days / 30);
      if (days % 30 !== 0) months++;
    }

    return {
      hours,
      days,
      months
    };

  };

  const calculateStaffSalary = (start, end, rate, rateType) => {

    const duration = getDuration(start, end);

    let amount = 0;

    if (rateType === "hourly") {
      amount = duration.hours * rate;
    }

    if (rateType === "daily") {
      amount = duration.days * rate;
    }

    if (rateType === "monthly") {
      amount = duration.months * rate;
    }

    return {
      hours: duration.hours,
      days: duration.days,
      months: duration.months,
      amount
    };

  };
  const fmtDateTime = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString();
  };

  const [staffPaymentHistory, setStaffPaymentHistory] = useState({
    open: false,
    assignment: null
  });
  const openPaymentHistory = (assignment) => {

    setStaffPaymentHistory({
      open: true,
      assignment
    });

  };
  const [stopServiceModal, setStopServiceModal] = useState({
    open: false,
    assignment: null,
    endDate: ""
  });

  const [assignDates, setAssignDates] = useState({
    startDate: "",
    endDate: ""
  });
  const filteredStaff = staffList.filter((s) => {

    if (staffFilters.staffType !== "all" && s.staffType !== staffFilters.staffType) {
      return false;
    }

    if (staffFilters.shiftType !== "all" && s.shiftType !== staffFilters.shiftType) {
      return false;
    }

    if (staffFilters.rateType !== "all" && s.rateType !== staffFilters.rateType) {
      return false;
    }

    return true;

  });

  const displayUser = (uid, name) =>
    uid === auth.currentUser?.uid ? "You" : name;
  const calculateTotals = (items, discountAmount = 0, taxBreakdown = []) => {
    const subtotal = items.reduce(
      (sum, it) => sum + Number(it.amount || 0),
      0
    );

    const taxes = taxBreakdown.map((t) => {
      const amount = (subtotal * Number(t.value || 0)) / 100;
      return { ...t, amount };
    });

    const taxTotal = taxes.reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0
    );

    const total = subtotal - Number(discountAmount || 0) + taxTotal;

    return {
      subtotal,
      discountAmount,
      taxBreakdown: taxes,
      total,
    };
  };
  const derivedTotals = calculateTotals(
    editableItems,
    order?.totals?.discountAmount || 0,
    order?.totals?.taxBreakdown || []
  );
  const [staffPaymentModal, setStaffPaymentModal] = useState({
    open: false,
    assignment: null,
    amount: ""
  });
  const openStaffPayment = (assignment) => {

    setStaffPaymentModal({
      open: true,
      assignment,
      amount: ""
    });

  };
  const emptyPaymentForm = {
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    method: "cash",
    status: "completed",
    reference: "",
    note: "",
  };

  // payments
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    editingId: null,
    form: {
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      method: "cash",
      status: "completed",
      reference: "",
      note: "",
    },
    saving: false,
  });

  /* ======================
     Load Order
  ====================== */

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "nursingOrders", id));
        if (!snap.exists()) {
          setError("Order not found");
        } else {
          setOrder({ id: snap.id, ...(snap.data() || {}) });
        }
      } catch (err) {
        setError(err.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);
  const loadAssignments = async () => {
    if (!id) return;

    setLoadingAssignments(true);
    try {
      const q = query(
        collection(db, "staffAssignments"),
        where("orderId", "==", id)
      );

      const snap = await getDocs(q);
      setAssignments(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
      );
    } catch (err) {
      console.error("loadAssignments error", err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {

    const loadRates = async () => {

      try {

        const snap = await getDocs(collection(db, "staffRates"));

        const rates = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() || {})
        }));

        setRateCard(rates);

      } catch (err) {

        console.error("Failed to load staff rates", err);

      }

    };

    loadRates();

  }, []);
 useEffect(() => {

  const loadUserRole = async () => {

    try {

      const uid = auth.currentUser?.uid;

      console.log("UID:", uid);

      if (!uid) {
        console.log("No UID found");
        return;
      }

      const ref = doc(db, "users", uid);

      console.log("Fetching user doc:", ref.path);

      const snap = await getDoc(ref);

      console.log("Firestore document exists:", snap.exists());

      if (snap.exists()) {

        const data = snap.data();

        console.log("User document data:", data);

        const role = data?.role || "";

        console.log("User role from Firestore:", role);

        setUserRole(role);

      } else {

        console.log("User document NOT FOUND in Firestore");

      }

    } catch (err) {

      console.error("Failed loading user role", err);

    }

  };

  loadUserRole();

}, []);
useEffect(() => {

  const loadCareTypes = async () => {

    try {

      const snap = await getDocs(collection(db, "careTypes"));

      const list = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() || {})
      }));

      setCareTypes(list);

      // auto set first care type
      if (list.length) {
        setAssignRateConfig(p => ({
          ...p,
          careType: list[0].name
        }));
      }

    } catch (err) {

      console.error("Failed loading care types", err);

    }

  };

  loadCareTypes();

}, []);
  useEffect(() => {

  const loadRequests = async () => {

    try {

      const q = query(
        collection(db, "salaryOverrideRequests"),
        where("orderId", "==", id)
      );

      const snap = await getDocs(q);

      const data = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() || {})
      }));

      setSalaryRequests(data);

    } catch (err) {

      console.error("Failed loading salary requests", err);

    }

  };

  if (id) loadRequests();

}, [id]);
const getSalaryRequest = (assignmentId) => {

  const list = salaryRequests
    .filter(r => r.assignmentId === assignmentId);

  if (list.length === 0) return null;

  list.sort((a,b)=>
    new Date(b.requestedAt || 0) -
    new Date(a.requestedAt || 0)
  );

  return list[0]; // latest request

};
  /* ======================
     Load Assignments
  ====================== */

  useEffect(() => {
    if (!id) return;

    const loadAssignments = async () => {
      setLoadingAssignments(true);
      try {
        const q = query(
          collection(db, "staffAssignments"),
          where("orderId", "==", id)
        );

        const snap = await getDocs(q);
        setAssignments(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
        );
      } catch (err) {
        console.error("loadAssignments error", err);
      } finally {
        setLoadingAssignments(false);
      }
    };

    loadAssignments();
  }, [id]);

  /* ======================
     Load Staff
  ====================== */

  useEffect(() => {

    const loadStaff = async () => {

      try {

        const snap = await getDocs(collection(db, "staff"));

        const staff = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {})
        }));

        // optional: sort staff by name for cleaner UI
        staff.sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        );

        setStaffList(staff);

      } catch (err) {

        console.error("Failed to load staff", err);

      }

    };

    loadStaff();

  }, []);
  useEffect(() => {
    if (order?.items) {
      setEditableItems(order.items);
    }
  }, [order]);


  const buildActivityLogs = (oldItems, newItems) => {
    const logs = [];
    const user = auth.currentUser;

    newItems.forEach((item, i) => {
      const old = oldItems?.[i];

      if (!old) {
        logs.push({
          action: "ADD_SERVICE",
          field: `items[${i}]`,
          oldValue: null,
          newValue: item,
        });
        return;
      }

      if (old.name !== item.name) {
        logs.push({
          action: "UPDATE_SERVICE",
          field: `items[${i}].name`,
          oldValue: old.name,
          newValue: item.name,
        });
      }

      if (old.amount !== item.amount) {
        logs.push({
          action: "UPDATE_SERVICE",
          field: `items[${i}].amount`,
          oldValue: old.amount,
          newValue: item.amount,
        });
      }

      if (old.expectedStartDate !== item.expectedStartDate) {
        logs.push({
          action: "UPDATE_SERVICE",
          field: `items[${i}].expectedStartDate`,
          oldValue: old.expectedStartDate,
          newValue: item.expectedStartDate,
        });
      }

      if (old.expectedEndDate !== item.expectedEndDate) {
        logs.push({
          action: "UPDATE_SERVICE",
          field: `items[${i}].expectedEndDate`,
          oldValue: old.expectedEndDate,
          newValue: item.expectedEndDate,
        });
      }
    });

    // detect removed services
    if (oldItems.length > newItems.length) {
      logs.push({
        action: "REMOVE_SERVICE",
        field: "items",
        oldValue: oldItems.length,
        newValue: newItems.length,
      });
    }

    // enrich logs
    return logs.map((log) => ({
      ...log,
      editedByUid: user?.uid || "",
      editedByName:
        user?.displayName ||
        user?.email ||
        "Admin",
      editedAt: new Date().toISOString(),
    }));
  };
  const saveServices = async () => {
    try {
      const activityLogs = buildActivityLogs(
        order.items || [],
        editableItems
      );

      const newTotals = calculateTotals(
        editableItems,
        order?.totals?.discountAmount || 0,
        order?.totals?.taxBreakdown || []
      );

      const updatedActivityLog = [
        ...(order.activityLog || []),
        ...activityLogs,
      ];

      await updateDoc(doc(db, "nursingOrders", id), {
        items: editableItems,
        totals: newTotals,
        activityLog: updatedActivityLog,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
      });

      setOrder((o) => ({
        ...o,
        items: editableItems,
        totals: newTotals,
        activityLog: updatedActivityLog,
      }));

      setServicesEditing(false);
    } catch (e) {
      console.error("saveServices error", e);
      alert("Failed to save services");
    }
  };




  /* ======================
     Assign Staff (CORRECT)
  ====================== */
  /* ======================
   Salary Calculations
====================== */

  const totalSalary = assignments.reduce(
    (sum, a) => sum + Number(a.amount || 0),
    0
  );
  const paidSalary = assignments.reduce(
    (sum, a) => sum + Number(a.paidAmount || 0),
    0
  );

  const pendingSalary = assignments.reduce(
    (sum, a) => sum + Number(a.balanceAmount || 0),
    0
  );

  const getSalaryPreview = (staff) => {

    if (!assignDates.startDate || !assignDates.endDate) return null;

    const rateEntry = rateCard.find(r =>
      r.role === staff.staffType &&
      r.careType === assignRateConfig.careType &&
      r.shift === assignRateConfig.shift
    );

    if (!rateEntry) return null;

    const rate = Number(rateEntry.rate);
    const rateType = rateEntry.rateType || "daily";

    const salary = calculateStaffSalary(
      assignDates.startDate,
      assignDates.endDate,
      rate,
      rateType
    );

    return {
      rate,
      rateType,
      days: salary.days,
      hours: salary.hours,
      months: salary.months,
      amount: salary.amount
    };

  };
  const assignStaff = async (staff) => {

    if (!order) return;

    setAssigning(true);

    try {

      /* ===============================
         0️⃣ GET SELECTED SERVICE
      =============================== */

      const item = order.items?.[assignServiceIndex];

      if (!item) {
        alert("Service not found");
        setAssigning(false);
        return;
      }


      /* ===============================
         1️⃣ VALIDATE DATES
      =============================== */

      if (!assignDates.startDate || !assignDates.endDate) {
        alert("Please select start and end dates");
        setAssigning(false);
        return;
      }

      const start = new Date(assignDates.startDate);
      const end = new Date(assignDates.endDate);

      if (end <= start) {
        alert("End date must be after start date");
        setAssigning(false);
        return;
      }


      /* ===============================
         Ensure assignment inside service
      =============================== */

      if (item.expectedStartDate && item.expectedEndDate) {

        const serviceStart = new Date(item.expectedStartDate);
        const serviceEnd = new Date(item.expectedEndDate);

        if (start < serviceStart || end > serviceEnd) {
          alert("Assignment must be within service dates");
          setAssigning(false);
          return;
        }

      }


      /* ===============================
         2️⃣ CHECK EXISTING ASSIGNMENT
      =============================== */

      const q = query(
        collection(db, "staffAssignments"),
        where("orderId", "==", id),
        where("staffId", "==", staff.id),
        where("serviceIndex", "==", assignServiceIndex),
        where("status", "==", "assigned")
      );

      const existingSnap = await getDocs(q);

      if (!existingSnap.empty) {
        alert("This staff is already assigned to this service.");
        setAssigning(false);
        return;
      }


      /* ===============================
         3️⃣ GET GLOBAL RATE
      =============================== */

      const rateEntry = rateCard.find(r =>
        r.role === staff.staffType &&
        r.careType === assignRateConfig.careType &&
        r.shift === assignRateConfig.shift
      );

      if (!rateEntry) {
        alert("Salary rate not configured for this role, care type and shift");
        setAssigning(false);
        return;
      }

      const rate = Number(rateEntry.rate);
      const staffRateType = rateEntry.rateType || "daily";


      /* ===============================
         4️⃣ CALCULATE SALARY
      =============================== */

      const salary = calculateStaffSalary(
        assignDates.startDate,
        assignDates.endDate,
        rate,
        staffRateType
      );

      const hours = salary.hours;
      const days = salary.days;
      const months = salary.months;
      const amount = salary.amount;


      /* ===============================
         5️⃣ CREATE ASSIGNMENT
      =============================== */

      await addDoc(collection(db, "staffAssignments"), {

        staffId: staff.id,
        staffName: staff.name,
        staffType: staff.staffType,

        role: staff.staffType,
        careType: assignRateConfig.careType,
        shift: assignRateConfig.shift,

        orderId: id,
        orderNo: order.orderNo,

        serviceIndex: assignServiceIndex,
        serviceName: item.name || "Service",

        startDate: assignDates.startDate,
        endDate: assignDates.endDate,

        hours,
        days,
        months,

        rate,
        rateType: staffRateType,

        amount,

        paidAmount: 0,
        balanceAmount: amount,

        status: "assigned",
        paid: false,

        payments: [],

        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || "",
      });


      /* ===============================
         6️⃣ UPDATE ORDER STATUS
      =============================== */

      await updateDoc(doc(db, "nursingOrders", id), {
        status: "assigned",
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
      });


      /* ===============================
         7️⃣ RELOAD ASSIGNMENTS
      =============================== */

      await loadAssignments();

      setAssignOpen(false);

    }
    catch (err) {

      console.error("assignStaff error", err);
      alert("Failed to assign staff");

    }
    finally {

      setAssigning(false);

    }

  };
 const submitSalaryRequest = async () => {

  const a = salaryRequestModal.assignment;

  const requestedRate = Number(salaryRequestModal.rate);

  if (!requestedRate) {
    alert("Enter requested rate");
    return;
  }

  const salary = calculateStaffSalary(
    a.startDate,
    a.endDate,
    requestedRate,
    a.rateType
  );

  try {

    await addDoc(collection(db, "salaryOverrideRequests"), {

      assignmentId: a.id,

      orderId: a.orderId,
      orderNo: a.orderNo,

      /* NEW FIELDS */

      orderTotal: order?.totals?.total || 0,
      staffType: a.staffType,

      staffId: a.staffId,
      staffName: a.staffName,

      role: a.role,
      careType: a.careType,
      shift: a.shift,

      serviceStart: a.startDate,
      serviceEnd: a.endDate,

      currentRate: a.rate,
      requestedRate,

      currentAmount: a.amount,
      requestedAmount: salary.amount,

      note: salaryRequestModal.note,

      status: "pending",

      requestedAt: serverTimestamp(),
      requestedBy: auth.currentUser?.uid || ""

    });

    alert("Salary request submitted");

    setSalaryRequestModal({
      open: false,
      assignment: null,
      rate: "",
      note: ""
    });

  }
  catch (err) {

    console.error(err);
    alert("Failed to submit request");

  }

};

  const extendService = async () => {

    const { serviceIndex, endDate, amount } = extendServiceModal;

    if (!endDate || !amount) {
      alert("Enter end date and amount");
      return;
    }

    const extraAmount = Number(amount);

    try {

      const service = editableItems[serviceIndex];
      const updatedEndDate = endDate;

      /* =====================
         UPDATE SERVICE
      ===================== */

      const updatedItems = [...editableItems];

      updatedItems[serviceIndex] = {
        ...service,
        expectedEndDate: updatedEndDate,
        amount: Number(service.amount || 0) + extraAmount
      };

      const newTotals = calculateTotals(
        updatedItems,
        order?.totals?.discountAmount || 0,
        order?.totals?.taxBreakdown || []
      );

      await updateDoc(doc(db, "nursingOrders", id), {

        items: updatedItems,
        totals: newTotals,

        extensionHistory: [
          ...(order.extensionHistory || []),
          {
            serviceIndex,
            serviceName: service.name,

            oldEndDate: service.expectedEndDate,
            newEndDate: updatedEndDate,

            extraAmount,

            extendedByUid: auth.currentUser?.uid || "",
            extendedByName:
              auth.currentUser?.displayName ||
              auth.currentUser?.email ||
              "Admin",

            extendedAt: new Date().toISOString()
          }
        ],

        updatedAt: serverTimestamp()

      });

      /* =====================
         UPDATE STAFF ASSIGNMENTS
      ===================== */

      const q = query(
        collection(db, "staffAssignments"),
        where("orderId", "==", id),
        where("serviceIndex", "==", serviceIndex),
        where("status", "==", "assigned")
      );

      const snap = await getDocs(q);

      for (const d of snap.docs) {

        const a = d.data();

        /* =====================
           USE CENTRAL SALARY ENGINE
        ===================== */

        const salary = calculateStaffSalary(
          a.startDate,
          updatedEndDate,
          a.rate,
          a.rateType
        );

        const newAmount = salary.amount;

        const newBalance =
          newAmount - Number(a.paidAmount || 0);

        await updateDoc(doc(db, "staffAssignments", d.id), {

          endDate: updatedEndDate,

          hours: salary.hours,
          days: salary.days,
          months: salary.months,

          amount: newAmount,
          balanceAmount: newBalance,

          updatedAt: serverTimestamp()

        });

      }

      /* =====================
         REFRESH UI
      ===================== */

      setEditableItems(updatedItems);

      setOrder(o => ({
        ...o,
        items: updatedItems,
        totals: newTotals
      }));

      await loadAssignments();

      setExtendServiceModal({
        open: false,
        serviceIndex: null,
        endDate: "",
        amount: ""
      });

    } catch (err) {

      console.error(err);
      alert("Failed to extend service");

    }

  };
  const unassignStaff = async (assignmentId) => {
    if (!window.confirm("Unassign this staff from order?")) return;

    try {
      await updateDoc(doc(db, "staffAssignments", assignmentId), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || "",
      });

      // update UI instantly
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId ? { ...a, status: "cancelled" } : a
        )
      );
    } catch (err) {
      console.error("unassignStaff error", err);
      alert("Failed to unassign staff");
    }
  };
  const savePayment = async () => {
    setPaymentModal((p) => ({ ...p, saving: true }));

    try {
      const user = auth.currentUser;

      const newPayment = {
        amount: Number(paymentModal.form.amount),
        date: paymentModal.form.date,
        method: paymentModal.form.method,
        status: paymentModal.form.status,
        reference: paymentModal.form.reference || "",
        note: paymentModal.form.note || "",

        // ✅ CREATED BY (from login)
        createdByUid: user?.uid || "",
        createdByName:
          user?.name ||
          user?.email ||
          "Admin",

        // ❌ no serverTimestamp inside array
        createdAt: new Date().toISOString(),
      };


      let updatedPayments = Array.isArray(order.payments)
        ? [...order.payments]
        : [];

      if (paymentModal.editingId) {
        updatedPayments = updatedPayments.map((p) =>
          p.id === paymentModal.editingId
            ? { ...p, ...newPayment }
            : p
        );
      } else {
        updatedPayments.push({
          id: Date.now().toString(), // ✅ SAFE ID
          ...newPayment,
        });
      }

      await updateDoc(doc(db, "nursingOrders", id), {
        payments: updatedPayments,
        updatedAt: serverTimestamp(),
      });

      setOrder((o) => ({
        ...o,
        payments: updatedPayments,
      }));

      setPaymentModal({
        open: false,
        editingId: null,
        form: emptyPaymentForm,
        saving: false,
      });
    } catch (e) {
      console.error("savePayment error:", e);
      alert(e.message || "Failed to save payment");
    }
  };
  const stopStaffService = async () => {

    const assignment = stopServiceModal.assignment;
    const stopDate = stopServiceModal.endDate;

    if (!assignment || !stopDate) return;

    try {

      const start = new Date(assignment.startDate);
      const end = new Date(stopDate);

      if (end <= start) {
        alert("Stop date must be after start date");
        return;
      }

      /* =========================
         CALCULATE SALARY USING ENGINE
      ========================= */

      const salary = calculateStaffSalary(
        assignment.startDate,
        stopDate,
        Number(assignment.rate || 0),
        assignment.rateType
      );

      const amount = Number(salary.amount || 0);

      const paidAmount = Number(assignment.paidAmount || 0);

      const balanceAmount = Math.max(0, amount - paidAmount);

      /* =========================
         UPDATE FIRESTORE
      ========================= */

      await updateDoc(doc(db, "staffAssignments", assignment.id), {

        endDate: stopDate,

        hours: salary.hours || 0,
        days: salary.days || 0,
        months: salary.months || 0,

        amount,
        balanceAmount,

        status: "completed",

        stoppedAt: serverTimestamp(),
        stoppedBy: auth.currentUser?.uid || ""

      });

      /* =========================
         REFRESH UI
      ========================= */

      await loadAssignments();

      /* =========================
         CLOSE MODAL
      ========================= */

      setStopServiceModal({
        open: false,
        assignment: null,
        endDate: ""
      });

    } catch (err) {

      console.error(err);
      alert("Failed to stop staff service");

    }

  };
  const openStopServiceModal = (assignment) => {

    setStopServiceModal({
      open: true,
      assignment,
      endDate: formatDateTimeLocal(assignment.endDate || new Date())
    });

  };

  const payAssignment = async (assignment) => {
    if (!window.confirm("Mark this staff payment as paid?")) return;

    try {
      const log = {
        action: "PAY_STAFF",
        field: `staffAssignments/${assignment.id}`,
        oldValue: "UNPAID",
        newValue: "PAID",
        editedByUid: auth.currentUser?.uid || "",
        editedByName:
          auth.currentUser?.displayName ||
          auth.currentUser?.email ||
          "Admin",
        editedAt: new Date().toISOString(),
      };

      await updateDoc(
        doc(db, "staffAssignments", assignment.id),
        {
          paid: true,
          paidAt: serverTimestamp(),
          paymentMode: "manual",
        }
      );

      const updatedLog = [
        ...(order.activityLog || []),
        log,
      ];

      await updateDoc(doc(db, "nursingOrders", id), {
        activityLog: updatedLog,
      });

      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignment.id
            ? { ...a, paid: true }
            : a
        )
      );

      setOrder((o) => ({
        ...o,
        activityLog: updatedLog,
      }));
    } catch (err) {
      console.error("payAssignment error", err);
      alert("Failed to mark payment");
    }
  };


  const payments = order?.payments || [];

  const totalPaid = payments
    .filter(Boolean)
    .reduce((sum, p) => sum + Number(p?.amount || 0), 0);


  const orderTotal = Number(order?.totals?.total || 0);

  const balance = Math.max(0, orderTotal - totalPaid);

  /* ======================
     Status Updates
  ====================== */

  const markStatus = async (status) => {

    const message =
      status === "active"
        ? "Are you sure you want to mark this order as ACTIVE?"
        : "Are you sure you want to mark this order as COMPLETED?";

    const confirmed = window.confirm(message);

    if (!confirmed) return;

    try {

      /* =========================
         UPDATE ORDER STATUS
      ========================= */

      await updateDoc(doc(db, "nursingOrders", id), {
        status,
        completedAt:
          status === "completed" ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || ""
      });

      /* =========================
         UPDATE LOCAL UI STATE
      ========================= */

      setOrder((prev) => ({
        ...prev,
        status
      }));


      /* =========================
         IF COMPLETED → COMPLETE STAFF
      ========================= */

      if (status === "completed") {

        const q = query(
          collection(db, "staffAssignments"),
          where("orderId", "==", id),
          where("status", "in", ["assigned", "active"])
        );

        const snap = await getDocs(q);

        for (const d of snap.docs) {

          await updateDoc(doc(db, "staffAssignments", d.id), {
            status: "completed",
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

        }

        /* reload assignments in UI */
        await loadAssignments();

      }

    } catch (err) {

      console.error("markStatus error", err);
      alert("Failed to update order status");

    }

  };
  const buildStaffActivityLog = (oldA, newA) => {
    if (!oldA || !newA) return null;

    if (Number(oldA.amount) === Number(newA.amount)) return null;

    return {
      action: "UPDATE_STAFF_SALARY",
      field: `staffAssignments/${oldA.id}/amount`,
      oldValue: oldA.amount,
      newValue: newA.amount,
      editedByUid: auth.currentUser?.uid || "",
      editedByName:
        auth.currentUser?.displayName ||
        auth.currentUser?.email ||
        "Admin",
      editedAt: new Date().toISOString(),
    };
  };
  const saveStaffSalary = async (assignment) => {
    try {
      // find original assignment (before edit)
      const original = assignments.find(
        (a) => a.id === assignment.id
      );

      if (!original) {
        alert("Assignment not found");
        return;
      }

      // build activity log (only if amount changed)
      const log = buildStaffActivityLog(original, assignment);

      // update staff assignment
      await updateDoc(
        doc(db, "staffAssignments", assignment.id),
        {
          amount: Number(assignment.amount || 0),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || "",
        }
      );

      // update local assignments state
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignment.id
            ? { ...a, amount: Number(assignment.amount || 0) }
            : a
        )
      );

      // append activity log to order (if any change)
      if (log) {
        const updatedLog = [
          ...(order.activityLog || []),
          log,
        ];

        await updateDoc(doc(db, "nursingOrders", id), {
          activityLog: updatedLog,
        });

        setOrder((o) => ({
          ...o,
          activityLog: updatedLog,
        }));
      }

      // ✅ CLOSE EDIT MODE
      setEditingStaffId(null);
      setTempSalary({});
    } catch (e) {
      console.error("saveStaffSalary error", e);
      alert("Failed to save staff salary");
    }
  };


  const saveStaffPayment = async () => {

    const a = staffPaymentModal.assignment;

    const payAmount = Number(staffPaymentModal.amount || 0);

    if (!payAmount) {
      alert("Enter payment amount");
      return;
    }

    if (payAmount > a.balanceAmount) {
      alert("Payment exceeds balance");
      return;
    }

    try {

      const newPaid = Number(a.paidAmount || 0) + payAmount;

      const newBalance = Number(a.amount) - newPaid;

      const payment = {
        amount: payAmount,
        date: new Date().toISOString(),

        createdByUid: auth.currentUser?.uid || "",
        createdByName:
          auth.currentUser?.displayName ||
          auth.currentUser?.email ||
          "Admin"
      };

      await updateDoc(doc(db, "staffAssignments", a.id), {

        paidAmount: newPaid,
        balanceAmount: newBalance,

        payments: [...(a.payments || []), payment],

        paid: newBalance <= 0,

        updatedAt: serverTimestamp()

      });

      await loadAssignments();

      setStaffPaymentModal({
        open: false,
        assignment: null,
        amount: ""
      });

    } catch (err) {

      console.error(err);
      alert("Payment failed");

    }

  };


  /* ======================
     UI
  ====================== */
  if (loading) return <div className="nod-muted">Loading…</div>;
  if (error) return <div className="nod-error">{error}</div>;
  if (!order) return null;

  return (
    <div className="nod-wrap">
      {/* HEADER */}
      <div className="nod-head">
        <h2>Nursing Order — {order.orderNo}</h2>
        <button className="nod-btn nod-btn-secondary" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      {/* CUSTOMER */}
      <div className="nod-card">
        <h3>Customer</h3>
        <strong>{order.customerName}</strong>
        <div className="nod-muted">{order.deliveryAddress}</div>
        <div className="nod-muted">
          {order.deliveryContact?.name} · {order.deliveryContact?.phone}
        </div>
      </div>

      {/* SERVICES */}
      <div className="nod-card">
        <div className="nod-row">
          <h3>Services</h3>

          {!servicesEditing ? (
            <button
              className="nod-btn nod-btn-secondary"
              onClick={() => setServicesEditing(true)}
            >
              Edit Services
            </button>
          ) : (
            <>
              <button
                className="nod-btn nod-btn-primary"
                onClick={saveServices}
              >
                Save
              </button>
              <button
                className="nod-btn nod-btn-secondary"
                onClick={() => {
                  setEditableItems(order.items);
                  setServicesEditing(false);
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {editableItems.map((it, i) => (

          <div key={i} className="nod-item-row">
            <div>
              {/* SERVICE NAME */}
              {servicesEditing ? (
                <input
                  className="nod-input"
                  value={it.name}
                  onChange={(e) => {
                    const updated = [...editableItems];
                    updated[i] = {
                      ...updated[i],
                      name: e.target.value,
                    };
                    setEditableItems(updated);
                  }}
                />
              ) : (
                <strong>{it.name}</strong>
              )}

              {/* DATES */}
              <div className="nod-muted">
                {servicesEditing ? (
                  <>
                    <input
                      type="datetime-local"
                      className="nod-input small"
                      value={it.expectedStartDate}
                      onChange={(e) => {
                        const updated = [...editableItems];
                        updated[i] = {
                          ...updated[i],
                          expectedStartDate: e.target.value,
                        };
                        setEditableItems(updated);
                      }}
                    />
                    {" → "}
                    <input
                      type="datetime-local"

                      className="nod-input small"
                      value={it.expectedEndDate}
                      onChange={(e) => {
                        const updated = [...editableItems];
                        updated[i] = {
                          ...updated[i],
                          expectedEndDate: e.target.value,
                        };
                        setEditableItems(updated);
                      }}
                    />
                  </>
                ) : (
                  <>
                    {it.expectedStartDate} → {it.expectedEndDate}
                  </>
                )}
              </div>

              {/* MANUAL SERVICE AMOUNT */}
              <div className="nod-muted">
                {servicesEditing ? (
                  <>
                    ₹{" "}
                    <input
                      type="number"
                      className="nod-input small"
                      value={it.amount}
                      onChange={(e) => {
                        const updated = [...editableItems];
                        updated[i] = {
                          ...updated[i],
                          amount: Number(e.target.value || 0),
                        };
                        setEditableItems(updated);
                      }}
                    />
                  </>
                ) : (
                  <>₹ {fmtCurrency(it.amount)}</>
                )}
              </div>
            </div>

            <div className="nod-right">
              <div className="nod-bold">
                ₹ {fmtCurrency(it.amount)}
              </div>


              <button
                className="nod-btn nod-btn-primary small"
                onClick={() => openAssignModal(i)}
              >
                Assign Nurse
              </button>
              <button
                className="nod-btn nod-btn-secondary small"
                onClick={() => openExtendServiceModal(i)}
              >
                Extend Service
              </button>

              {servicesEditing && (
                <button
                  className="nod-btn nod-btn-danger small"
                  onClick={() => {
                    const updated = editableItems.filter((_, idx) => idx !== i);
                    setEditableItems(updated);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}

        {servicesEditing && (
          <button
            className="nod-btn nod-btn-primary"
            onClick={() =>
              setEditableItems((prev) => [
                ...prev,
                {
                  name: "New Service",
                  expectedStartDate: "",
                  expectedEndDate: "",
                  amount: 0,
                },
              ])
            }
          >
            + Add Service
          </button>
        )}
      </div>


      <div className="nod-card">
        <h3>Billing Summary</h3>

        <div className="nod-row">
          <span>Subtotal</span>
          <strong>
            ₹ {fmtCurrency(derivedTotals.subtotal)}
          </strong>
        </div>

        {derivedTotals.discountAmount > 0 && (
          <div className="nod-row">
            <span>Discount</span>
            <strong className="nod-red">
              − ₹ {fmtCurrency(derivedTotals.discountAmount)}
            </strong>
          </div>
        )}

        {derivedTotals.taxBreakdown.map((t, i) => (
          <div key={i} className="nod-row">
            <span>
              {t.name} ({t.value}%)
            </span>
            <strong>
              ₹ {fmtCurrency(t.amount)}
            </strong>
          </div>
        ))}

        <div className="nod-row nod-total">
          <span>Total</span>
          <span>
            ₹ {fmtCurrency(derivedTotals.total)}
          </span>
        </div>
      </div>

      <div className="nod-card">
        <h3>Payments</h3>

        <div className="nod-row">
          <div>
            <div className="nod-muted">Total Paid</div>
            <strong className="nod-green">
              ₹ {fmtCurrency(totalPaid)}
            </strong>
          </div>

          <div>
            <div className="nod-muted">Balance</div>
            <strong className={balance > 0 ? "nod-red" : "nod-green"}>
              ₹ {fmtCurrency(balance)}
            </strong>
          </div>

          <button
            className="nod-btn nod-btn-primary"
            onClick={() =>
              setPaymentModal({
                open: true,
                editingId: null,
                form: emptyPaymentForm,
                saving: false,
              })
            }

          >
            + Add Payment
          </button>
        </div>

        {payments.length === 0 && (
          <div className="nod-muted">No payments recorded</div>
        )}

        {payments.map((p) => (
          <div key={p.id} className="nod-row nod-payment-row">
            {/* LEFT */}
            <div>
              <strong>₹ {fmtCurrency(p.amount)}</strong>

              <div className="nod-muted">
                {p.method?.toUpperCase()} · {p.status}
              </div>

              <div className="nod-muted small">
                Paid on {fmtDateTime(p.createdAt)}
              </div>

              <div className="nod-muted small">
                Entered by:{" "}
                {displayUser(p.createdByUid, p.createdByName)}
              </div>

              {p.reference && (
                <div className="nod-muted small">
                  Ref: {p.reference}
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div>
              <button
                className="nod-btn nod-btn-secondary"
                onClick={() =>
                  setPaymentModal({
                    open: true,
                    editingId: p.id,
                    form: {
                      ...p,
                      date: p.date,
                    },
                  })
                }
              >
                Edit
              </button>
            </div>
          </div>
        ))}

      </div>


      {/* ASSIGNED STAFF HEADER */}
      <div className="nod-card">

        <h3>Assigned Nurses</h3>

        {loadingAssignments && (
          <div className="nod-muted">Loading assignments…</div>
        )}

        {!loadingAssignments && editableItems.map((service, i) => {

          const serviceAssignments = assignments.filter(
            (a) => a.serviceIndex === i && a.status !== "cancelled"
          );

          return (
            <div key={i} className="nod-service-block">

              {/* SERVICE HEADER */}
              <div className="nod-row">
                <strong>
                  Service {i + 1}: {service.name} : {Number(service.qty || 0)} REQUIRED
                </strong>


                <button
                  className="nod-btn nod-btn-primary small"
                  onClick={() => openAssignModal(i)}
                >
                  Assign Nurse
                </button>
              </div>

              {/* NO STAFF */}
              {serviceAssignments.length === 0 && (
                <div className="nod-muted">
                  No nurse assigned
                </div>
              )}

              {/* STAFF LIST */}
              {serviceAssignments.map((a) => (
                <div key={a.id} className="nod-staff-row">

                  <div>

                    <strong>{a.staffName}</strong>

                    <div className="nod-muted">
                      {a.staffType}
                    </div>

                    <div className="nod-muted">
                      {fmtDateTime(a.startDate)} → {fmtDateTime(a.endDate)} · {(() => {

                        if (a.rateType === "hourly") {
                          return `${a.hours || 0} hours`;
                        }

                        if (a.rateType === "daily") {
                          return `${a.days || 0} days`;
                        }

                        if (a.rateType === "monthly") {
                          return `${a.months || 0} months`;
                        }

                        return "";

                      })()}
                    </div>

                    <div className="nod-staff-meta">

                      {/* SALARY DISPLAY / EDIT */}
                      <div className="nod-bold">
  {isSuperAdmin && editingStaffId === a.id ? (
    <>
      ₹
      <input
        type="number"
        className="nod-input small"
        value={tempSalary[a.id]}
        onChange={(e) =>
          setTempSalary((p) => ({
            ...p,
            [a.id]: Number(e.target.value || 0),
          }))
        }
      />
    </>
  ) : (
    <>₹ {fmtCurrency(a.amount)}</>
  )}
</div>

                      {/* Payment badge */}
                      <span
                        className={`nod-badge ${a.paid ? "nod-badge-green" : "nod-badge-orange"
                          }`}
                      >
                        {a.paid ? "Paid" : "Unpaid"}
                      </span>

                      {/* Stopped badge */}
                      {a.status === "completed" && (
                        <span className="nod-badge nod-badge-blue">
                          Stopped
                        </span>
                      )}

                      {/* Payment summary */}
                      <div
                        className="nod-muted small nod-payment-history"
                        onClick={() => openPaymentHistory(a)}
                      >
                        Paid ₹{fmtCurrency(a.paidAmount || 0)} / ₹{fmtCurrency(a.amount)}
                      </div>

                      {/* Attendance */}
                      <button
                        className="nod-btn nod-btn-secondary nod-attendance-btn"
                        onClick={() =>
                          navigate(
                            `/crm/attendance?role=staff&userId=${a.staffId}&from=${a.startDate}&to=${a.endDate}`
                          )
                        }
                      >
                        View Attendance
                      </button>
                      {(() => {

  const req = getSalaryRequest(a.id);

  if (!req) {
    return (
      <button
        className="nod-btn nod-btn-secondary small"
        onClick={() => openSalaryRequestModal(a)}
      >
        Request Salary Increase
      </button>
    );
  }

  if (req.status === "pending") {
    return (
      <span className="nod-badge nod-badge-orange">
        Request Pending
      </span>
    );
  }

  if (req.status === "approved") {
    return (
      <>
        <span className="nod-badge nod-badge-green">
          Salary Increased
        </span>

        <button
          className="nod-btn nod-btn-secondary small"
          onClick={() => openSalaryRequestModal(a)}
        >
          Request Again
        </button>
      </>
    );
  }

  if (req.status === "rejected") {
    return (
      <>
        <span className="nod-badge nod-badge-red">
          Request Rejected
        </span>

        <button
          className="nod-btn nod-btn-secondary small"
          onClick={() => openSalaryRequestModal(a)}
        >
          Request Again
        </button>
      </>
    );
  }

})()}
 

                      {/* EDIT / SAVE */}
                     {/* EDIT / SAVE (SUPERADMIN ONLY) */}
{isSuperAdmin && (
  editingStaffId === a.id ? (
    <>
      <button
        className="nod-btn nod-btn-primary small"
        onClick={() =>
          saveStaffSalary({
            ...a,
            amount: tempSalary[a.id],
          })
        }
      >
        Save
      </button>

      <button
        className="nod-btn nod-btn-secondary small"
        onClick={() => {
          setEditingStaffId(null);
          setTempSalary({});
        }}
      >
        Cancel
      </button>
    </>
  ) : (
    <button
      className="nod-btn nod-btn-secondary small"
      onClick={() => {
        setEditingStaffId(a.id);
        setTempSalary({ [a.id]: a.amount });
      }}
    >
      Edit
    </button>
  )
)}

                      {/* PAY */}
                      {a.status !== "cancelled" && (a.paidAmount || 0) < a.amount && (
                        <button
                          className="nod-btn nod-btn-primary small"
                          onClick={() => openStaffPayment(a)}
                        >
                          Pay
                        </button>
                      )}

                      {/* UNASSIGN */}
                      {a.status !== "cancelled" && (
                        <button
                          className="nod-btn nod-btn-danger small"
                          onClick={() => unassignStaff(a.id)}
                        >
                          Unassign
                        </button>
                      )}

                      {/* STOP */}
                      {a.status !== "completed" && (
                        <button
                          className="nod-btn nod-btn-danger small"
                          onClick={() => openStopServiceModal(a)}
                        >
                          Stop
                        </button>
                      )}

                    </div>

                  </div>



                </div>
              ))}

            </div>
          );
        })}

      </div>

      {/* SALARY SUMMARY */}
      <div className="nod-card">
        <h3>Salary Summary</h3>

        <div className="nod-row">
          <span>Total Salary</span>
          <strong>₹ {fmtCurrency(totalSalary)}</strong>
        </div>

        <div className="nod-row">
          <span>Paid</span>
          <strong className="nod-green">
            ₹ {fmtCurrency(paidSalary)}
          </strong>
        </div>

        <div className="nod-row">
          <span>Pending</span>
          <strong className="nod-red">
            ₹ {fmtCurrency(pendingSalary)}
          </strong>
        </div>
      </div>



      {/* ASSIGNED STAFF */}



      {/* TOTAL */}


      {/* ACTIONS */}
      <div className="nod-actions">
        <button className="nod-btn nod-btn-secondary" onClick={() => markStatus("active")}>
          Mark Active
        </button>
        <button className="nod-btn nod-btn-primary" onClick={() => markStatus("completed")}>
          Mark Completed
        </button>
      </div>
      <div className="nod-card">
        <h3>Activity Log</h3>

        {(order.activityLog || []).length === 0 && (
          <div className="nod-muted">No activity yet</div>
        )}

        {(order.activityLog || [])
          .slice()
          .reverse()
          .map((log, i) => (
            <div key={i} className="nod-muted small">
              <strong>{log.editedByName}</strong>{" "}
              {log.action.replace("_", " ").toLowerCase()} <br />

              <span>
                {String(log.oldValue)} →{" "}
                <strong>{String(log.newValue)}</strong>
              </span>
              <br />

              <span>{fmtDateTime(log.editedAt)}</span>
            </div>
          ))}
      </div>

      <div className="nod-card">

        <h3>Service Extensions</h3>

        {(order.extensionHistory || []).length === 0 && (
          <div className="nod-muted">
            No extensions recorded
          </div>
        )}

        {(order.extensionHistory || [])
          .slice()
          .reverse()
          .map((e, i) => (
            <div key={i} className="nod-row nod-extension-row">

              <div>

                <strong>{e.serviceName}</strong>

                <div className="nod-muted small">
                  {e.oldEndDate} → {e.newEndDate}
                </div>

                <div className="nod-muted small">
                  Extended by {e.extendedByName}
                </div>

                <div className="nod-muted small">
                  {new Date(e.extendedAt).toLocaleString()}
                </div>

              </div>

              <div className="nod-green">
                + ₹{fmtCurrency(e.extraAmount)}
              </div>

            </div>
          ))}

      </div>


      {/* ASSIGN MODAL */}

      {assignOpen && (
        <div className="nod-modal">
          <div className="nod-modal-card">

            <div className="assign-modal-header">
              <h4>Assign Nurse</h4>
            </div>

            {/* DATE SELECTION */}

            <div className="nod-assign-dates">

              <div>
                <label>Start Date</label>
                <input
                  type="datetime-local"
                  className="nod-input"
                  value={assignDates.startDate}
                  onChange={(e) =>
                    setAssignDates(p => ({
                      ...p,
                      startDate: e.target.value
                    }))
                  }
                />
              </div>

              <div>
                <label>End Date</label>
                <input
                  type="datetime-local"
                  className="nod-input"
                  value={assignDates.endDate}
                  onChange={(e) =>
                    setAssignDates(p => ({
                      ...p,
                      endDate: e.target.value
                    }))
                  }
                />
              </div>

            </div>
            <div className="assign-rate-config">

              <div>
                <label>Care Type</label>

                <select
  className="nod-input"
  value={assignRateConfig.careType}
  onChange={(e) =>
    setAssignRateConfig(p => ({
      ...p,
      careType: e.target.value
    }))
  }
>

  {careTypes.map(c => (
    <option key={c.id} value={c.name}>
      {c.name}
    </option>
  ))}

</select>
              </div>

              <div>
                <label>Shift</label>

                <select
                  className="nod-input"
                  value={assignRateConfig.shift}
                  onChange={(e) =>
                    setAssignRateConfig(p => ({
                      ...p,
                      shift: e.target.value
                    }))
                  }
                >
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                  <option value="full">Day & Night</option>
                </select>
              </div>

            </div>


            {/* STAFF FILTERS */}

            <div className="assign-filter">

              <div className="assign-filter-row">
                <label>Staff Type</label>

                <div className="assign-filter-chips">
                  {["all", "nurse", "caretaker"].map(type => (
                    <button
                      key={type}
                      className={`assign-chip ${staffFilters.staffType === type ? "active" : ""}`}
                      onClick={() => setStaffFilters(p => ({ ...p, staffType: type }))}
                    >
                      {type === "all" ? "All" : type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="assign-filter-row">
                <label>Shift</label>

                <div className="assign-filter-chips">
                  {["all", "day", "night", "full", "flexible"].map(shift => (
                    <button
                      key={shift}
                      className={`assign-chip ${staffFilters.shiftType === shift ? "active" : ""}`}
                      onClick={() => setStaffFilters(p => ({ ...p, shiftType: shift }))}
                    >
                      {shift}
                    </button>
                  ))}
                </div>
              </div>

              <div className="assign-filter-row">
                <label>Rate</label>

                <div className="assign-filter-chips">
                  {["all", "hourly", "daily", "monthly"].map(rate => (
                    <button
                      key={rate}
                      className={`assign-chip ${staffFilters.rateType === rate ? "active" : ""}`}
                      onClick={() => setStaffFilters(p => ({ ...p, rateType: rate }))}
                    >
                      {rate}
                    </button>
                  ))}
                </div>
              </div>

            </div>


            {/* GLOBAL RATE CONFIG */}




            {/* STAFF GRID */}

            <div className="nod-staff-grid">

              {filteredStaff.map((s) => {

                const preview = getSalaryPreview(s);

                return (
                  <div key={s.id} className="nod-staff-card">

                    <div>

                      <strong>{s.name}</strong>

                      <div className="nod-muted">
                        {s.staffType} · {s.shiftType || "day"} shift
                      </div>

                      {/* SALARY PREVIEW */}

                      {preview ? (

                        <div className="salary-preview">

                          <div className="nod-muted small">
                            Rate: ₹{preview.rate}/{preview.rateType}
                          </div>

                          {preview.rateType === "daily" && (
                            <div className="nod-muted small">
                              Duration: {preview.days} days
                            </div>
                          )}

                          {preview.rateType === "hourly" && (
                            <div className="nod-muted small">
                              Duration: {preview.hours} hours
                            </div>
                          )}

                          {preview.rateType === "monthly" && (
                            <div className="nod-muted small">
                              Duration: {preview.months} months
                            </div>
                          )}

                          <div className="nod-bold">
                            Total Salary: ₹{fmtCurrency(preview.amount)}
                          </div>

                        </div>

                      ) : (

                        <div className="nod-muted small">
                          Salary rate not configured
                        </div>

                      )}

                    </div>

                    <button
                      className="nod-btn nod-btn-primary"
                      disabled={assigning || !preview}
                      onClick={() => assignStaff(s)}
                    >
                      Assign
                    </button>

                  </div>
                );

              })}

            </div>


            {/* FOOTER */}

            <div className="assign-modal-footer">

              <button
                className="nod-btn nod-btn-secondary"
                onClick={() => setAssignOpen(false)}
              >
                Close
              </button>

            </div>

          </div>
        </div>
      )}



      {paymentModal.open && (
        <div className="nod-modal">
          <div className="nod-modal-card">
            <h4>
              {paymentModal.editingId ? "Edit Payment" : "Add Payment"}
            </h4>

            <input
              className="nod-input"
              placeholder="Amount"
              value={paymentModal.form.amount}
              onChange={(e) =>
                setPaymentModal((p) => ({
                  ...p,
                  form: { ...p.form, amount: e.target.value },
                }))
              }
            />

            <input
              type="date"
              className="nod-input"
              value={paymentModal.form.date}
              onChange={(e) =>
                setPaymentModal((p) => ({
                  ...p,
                  form: { ...p.form, date: e.target.value },
                }))
              }
            />

            <select
              className="nod-input"
              value={paymentModal.form.method}
              onChange={(e) =>
                setPaymentModal((p) => ({
                  ...p,
                  form: { ...p.form, method: e.target.value },
                }))
              }
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
            </select>

            <textarea
              className="nod-input"
              placeholder="Note"
              value={paymentModal.form.note}
              onChange={(e) =>
                setPaymentModal((p) => ({
                  ...p,
                  form: { ...p.form, note: e.target.value },
                }))
              }
            />

            <div className="nod-row">
              <button
                className="nod-btn nod-btn-secondary"
                onClick={() => setPaymentModal({ open: false })}
              >
                Cancel
              </button>
              <button
                className="nod-btn nod-btn-primary"
                onClick={savePayment}
                disabled={paymentModal.saving}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {staffPaymentModal.open && (

        <div className="nod-modal">
          <div className="nod-modal-card">

            <h4>Pay Staff</h4>

            <div className="nod-muted">
              Total Salary: ₹{fmtCurrency(staffPaymentModal.assignment?.amount)}
            </div>

            <div className="nod-muted">
              Already Paid: ₹{fmtCurrency(staffPaymentModal.assignment?.paidAmount || 0)}
            </div>

            <div className="nod-muted">
              Balance: ₹{fmtCurrency(staffPaymentModal.assignment?.balanceAmount || 0)}
            </div>

            <input
              type="number"
              className="nod-input"
              placeholder="Payment Amount"
              value={staffPaymentModal.amount}
              onChange={(e) =>
                setStaffPaymentModal(p => ({
                  ...p,
                  amount: e.target.value
                }))
              }
            />

            <div className="nod-row">

              <button
                className="nod-btn nod-btn-secondary"
                onClick={() =>
                  setStaffPaymentModal({
                    open: false,
                    assignment: null,
                    amount: ""
                  })
                }      >
                Cancel
              </button>

              <button
                className="nod-btn nod-btn-primary"
                onClick={saveStaffPayment}
              >
                Pay
              </button>

            </div>

          </div>
        </div>

      )}
      {staffPaymentHistory.open && (

        <div className="nod-modal">
          <div className="nod-modal-card">

            <h4>Staff Payment History</h4>

            <div className="nod-muted">
              Staff: {staffPaymentHistory.assignment?.staffName}
            </div>

            <div className="nod-muted">
              Total Salary: ₹{fmtCurrency(staffPaymentHistory.assignment?.amount)}
            </div>

            <div className="nod-payment-list">

              {(staffPaymentHistory.assignment?.payments || []).length === 0 && (
                <div className="nod-muted">
                  No payments recorded
                </div>
              )}

              {(staffPaymentHistory.assignment?.payments || []).map((p, i) => (
                <div key={i} className="nod-payment-item">

                  <strong>
                    ₹{fmtCurrency(p.amount)}
                  </strong>

                  <div className="nod-muted small">
                    {new Date(p.date).toLocaleDateString()} • {p.createdByName}
                  </div>

                </div>
              ))}

            </div>

            <button
              className="nod-btn nod-btn-secondary"
              onClick={() => setStaffPaymentHistory({ open: false, assignment: null })}
            >
              Close
            </button>

          </div>
        </div>

      )}
      {stopServiceModal.open && (

        <div className="nod-modal">
          <div className="nod-modal-card">

            <h4>Stop Staff Service</h4>

            <div className="nod-muted">
              Staff: {stopServiceModal.assignment?.staffName}
            </div>

            <div className="nod-muted">
              Current End Date: {stopServiceModal.assignment?.endDate}
            </div>

            <label>Stop Date / Time</label>

            <input
              type="datetime-local"
              className="nod-input"
              value={stopServiceModal.endDate}
              onChange={(e) =>
                setStopServiceModal(p => ({
                  ...p,
                  endDate: e.target.value
                }))
              }
            />

            <div className="nod-row">

              <button
                className="nod-btn nod-btn-secondary"
                onClick={() =>
                  setStopServiceModal({
                    open: false,
                    assignment: null,
                    endDate: ""
                  })
                }
              >
                Cancel
              </button>

              <button
                className="nod-btn nod-btn-danger"
                onClick={stopStaffService}
              >
                Stop Service
              </button>

            </div>

          </div>
        </div>

      )}
      {extendServiceModal.open && (

        <div className="nod-modal">
          <div className="nod-modal-card">

            <h4>Extend Service</h4>

            <label>New End Date</label>

            <input
              type="datetime-local"
              className="nod-input"
              value={extendServiceModal.endDate}
              onChange={(e) =>
                setExtendServiceModal(p => ({
                  ...p,
                  endDate: e.target.value
                }))
              }
            />

            <label>Extra Amount</label>

            <input
              type="number"
              className="nod-input"
              placeholder="Extension Amount"
              value={extendServiceModal.amount}
              onChange={(e) =>
                setExtendServiceModal(p => ({
                  ...p,
                  amount: e.target.value
                }))
              }
            />

            <div className="nod-row">

              <button
                className="nod-btn nod-btn-secondary"
                onClick={() => setExtendServiceModal({
                  open: false,
                  serviceIndex: null,
                  endDate: "",
                  amount: ""
                })}
              >
                Cancel
              </button>

              <button
                className="nod-btn nod-btn-primary"
                onClick={extendService}
              >
                Extend Service
              </button>

            </div>

          </div>
        </div>

      )}
    {salaryRequestModal.open && (

  <div className="salaryreq-overlay">

    <div className="salaryreq-modal">

      <h4 className="salaryreq-title">
        Request Salary Increase
      </h4>

      <div className="salaryreq-current">
        Current Rate: ₹{salaryRequestModal.assignment?.rate}/{salaryRequestModal.assignment?.rateType}
      </div>

      <input
        type="number"
        className="salaryreq-input"
        placeholder="Requested Rate"
        value={salaryRequestModal.rate}
        onChange={(e)=>
          setSalaryRequestModal(p=>({
            ...p,
            rate:e.target.value
          }))
        }
      />

      <textarea
        className="salaryreq-textarea"
        placeholder="Reason / Note"
        value={salaryRequestModal.note}
        onChange={(e)=>
          setSalaryRequestModal(p=>({
            ...p,
            note:e.target.value
          }))
        }
      />

      <div className="salaryreq-actions">

        <button
          className="salaryreq-btn salaryreq-btn-cancel"
          onClick={()=>setSalaryRequestModal({ open:false })}
        >
          Cancel
        </button>

        <button
          className="salaryreq-btn salaryreq-btn-submit"
          onClick={submitSalaryRequest}
        >
          Submit Request
        </button>

      </div>

    </div>

  </div>

)}
    </div>
  );
}
