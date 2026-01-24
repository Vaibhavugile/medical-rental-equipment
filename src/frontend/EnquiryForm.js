import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "./EnquiryForm.css";

export default function EnquiryForm({ onSuccess }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    service: "",
    requirements: ""
  });

  const [status, setStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const validatePhone = (p) => p.replace(/\D/g, "").length === 10;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (!form.name.trim())
      return setStatus({ type: "error", message: "Please enter your name." });

    if (!validatePhone(form.phone))
      return setStatus({ type: "error", message: "Please enter a valid 10-digit phone number." });

    if (!form.city)
      return setStatus({ type: "error", message: "Please select your city." });

    if (!form.service)
      return setStatus({ type: "error", message: "Please select a service." });

    try {
      setStatus({ type: "sending", message: "Sending..." });

      await addDoc(collection(db, "leads"), {
        customerName: form.name.trim(),
        contactPerson: form.name.trim(),
        phone: form.phone.replace(/\D/g, ""),
        email: "",
        city: form.city,
        type: form.service,
        notes: form.requirements || "",
        address: "",
        status: "new",
        leadSource: "website",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: "website",
        createdByName: "Website"
      });

      setStatus({
        type: "success",
        message: "Thanks — we will call you shortly."
      });

      setForm({
        name: "",
        phone: "",
        city: "",
        service: "",
        requirements: ""
      });

      onSuccess?.();
    } catch (err) {
      console.error(err);
      setStatus({
        type: "error",
        message: "Something went wrong. Please try again."
      });
    }
  };

  return (
    <form className="hp-form" onSubmit={handleSubmit} noValidate>
      {/* Name */}
      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Your full name *"
      />

      {/* Phone */}
      <input
        name="phone"
        value={form.phone}
        onChange={handleChange}
        placeholder="10-digit phone number *"
        inputMode="tel"
      />

      {/* City */}
      <select name="city" value={form.city} onChange={handleChange}>
        <option value="">Select City *</option>
        <option value="navimumbai">Navi Mumbai</option>
        <option value="mumbai">Mumbai</option>
        <option value="palghar">Palghar</option>
        <option value="thane">Thane</option>
      </select>

      {/* Service */}
      <select name="service" value={form.service} onChange={handleChange}>
        <option value="">Select Service *</option>

        <option value="general_inquiry">General Inquiry</option>
        <option value="diagnostic_home">Diagnostic Services at Home</option>
        <option value="icu_setup">ICU Setup</option>
        <option value="post_surgery_care">Post Surgery Care</option>
        <option value="palliative_care">Palliative Care at Home</option>
        <option value="ambulance_care">Ambulance Care</option>
        <option value="medical_equipment">Medical Equipment</option>
        <option value="nursing_care">Nursing Care</option>
        <option value="physiotherapy">Physiotherapy Support</option>
        <option value="respiratory_care">Respiratory Care</option>
        <option value="pharmacy_delivery">Pharmacy Delivery</option>
      </select>

      {/* Requirements */}
      <textarea
        name="requirements"
        value={form.requirements}
        onChange={handleChange}
        placeholder="Any details (optional)"
        rows="3"
      />

      {/* Submit */}
      <button type="submit" disabled={status?.type === "sending"}>
        {status?.type === "sending" ? "Sending..." : "Request a Callback"}
      </button>

      {/* Status */}
      {status && (
        <p className={status.type}>
          {status.message}
        </p>
      )}
    </form>
  );
}
