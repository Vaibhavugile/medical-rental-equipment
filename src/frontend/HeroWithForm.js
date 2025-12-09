import React, { useEffect, useRef, useState } from "react";
import "./HeroWithForm.css";

export default function HeroWithForm({ imgSrc = "/banner.jpg" }) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const leftRef = useRef(null);
  const formRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    service: "",
    requirements: ""
  });
  const [status, setStatus] = useState(null);

  useEffect(() => {
    // entry animation
    const t = setTimeout(() => {
      leftRef.current?.classList.add("hpf-entered");
      formRef.current?.classList.add("hpf-entered");
    }, 80);

    // subtle desktop parallax on background
    const onMove = (e) => {
      if (!bgRef.current) return;
      if (window.innerWidth < 1000) return;
      const rect = rootRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      bgRef.current.style.transform = `translate3d(${dx * 18}px, ${dy * 10}px, 0) scale(1.03)`;
    };
    window.addEventListener("mousemove", onMove);

    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function validatePhone(p) {
    const digits = p.replace(/\D/g, "");
    return digits.length === 10;
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);
    if (!form.name.trim()) return setStatus({ type: "error", message: "Please enter your name." });
    if (!validatePhone(form.phone)) return setStatus({ type: "error", message: "Please enter a valid 10-digit phone number." });
    if (!form.city) return setStatus({ type: "error", message: "Please select your city." });
    if (!form.service) return setStatus({ type: "error", message: "Please select a service." });

    setStatus({ type: "sending", message: "Sending..." });
    // replace with actual API call
    setTimeout(() => {
      setStatus({ type: "success", message: "Thanks — we will call you shortly." });
      setForm({ name: "", phone: "", city: "", service: "", requirements: "" });
    }, 800);
  }

  return (
    <section className="hp-fixed" ref={rootRef} aria-labelledby="hp-title-fixed">
      {/* full-bleed background */}
      <div
        className="hp-fixed-bg"
        ref={bgRef}
        style={{ backgroundImage: `url(${imgSrc})` }}
        aria-hidden="true"
      />

      {/* overlay for contrast */}
      <div className="hp-fixed-overlay" aria-hidden="true" />

      <div className="hp-fixed-inner">
        {/* LEFT: large stacked title + subcopy */}
        <div className="hp-fixed-left" ref={leftRef}>
          <div className="hp-fixed-left-inner">
            <div className="hp-fixed-eyebrow">HOME HEALTHCARE SERVICES</div>

            <h1 id="hp-title-fixed" className="hp-fixed-title" aria-label="From Our Family To Your">
              <span className="hp-fixed-line hp-line-a">From Our</span>
              <span className="hp-fixed-line hp-line-b">Family</span>
              <span className="hp-fixed-line hp-line-c">To</span>
              <span className="hp-fixed-line hp-line-d">Your</span>
            </h1>

            <p className="hp-fixed-sub">
              We understand your need and we deliver our best.
              <br />
              Taking care of you and your loved ones — as we would our own.
            </p>

            <div className="hp-fixed-cta-row">
              <a href="#booking" className="hp-btn-primary">Request a Callback</a>
              <a href="#services" className="hp-btn-ghost">Explore Services</a>
            </div>
          </div>
        </div>

        {/* RIGHT: floating, rounded form card */}
        <aside className="hp-fixed-formcard" ref={formRef} aria-labelledby="hp-form-title-fixed">
          <h3 id="hp-form-title-fixed" className="hp-form-title">Request a Callback</h3>

          <form className="hp-form" onSubmit={handleSubmit} noValidate>
            <label className="hp-field">
              <span className="hp-label">Name *</span>
              <input name="name" value={form.name} onChange={handleChange} className="hp-input" placeholder="Your full name" aria-required="true" />
            </label>

            <label className="hp-field">
              <span className="hp-label">Phone *</span>
              <input name="phone" value={form.phone} onChange={handleChange} className="hp-input" placeholder="10-digit phone number" inputMode="tel" aria-required="true" />
            </label>

            <div className="hp-row">
              <label className="hp-field hp-half">
                <span className="hp-label">City *</span>
                <select name="city" value={form.city} onChange={handleChange} className="hp-select" aria-required="true">
                  <option value="">Select City</option>
                  <option value="delhi">Delhi</option>
                  <option value="mumbai">Mumbai</option>
                  <option value="bangalore">Bangalore</option>
                  <option value="hyderabad">Hyderabad</option>
                  <option value="chennai">Chennai</option>
                </select>
              </label>

              <label className="hp-field hp-half">
                <span className="hp-label">Service *</span>
                <select name="service" value={form.service} onChange={handleChange} className="hp-select" aria-required="true">
                  <option value="">Select Service</option>
                  <option value="nursing">Nursing Care</option>
                  <option value="icu">ICU Setup</option>
                  <option value="ambulance">Ambulance</option>
                  <option value="equipment">Equipment</option>
                  <option value="lab">Lab Services</option>
                </select>
              </label>
            </div>

            <label className="hp-field">
              <span className="hp-label">Requirements</span>
              <textarea name="requirements" value={form.requirements} onChange={handleChange} className="hp-textarea" placeholder="Any details (optional)" rows="3" />
            </label>

            <div className="hp-form-actions">
              <button type="submit" className="hp-submit">{status?.type === "sending" ? "Sending..." : "Request a Callback"}</button>
            </div>

            {status && (
              <div role="status" className={`hp-status ${status.type === "error" ? "hp-error" : status.type === "success" ? "hp-success" : "hp-info"}`}>
                {status.message}
              </div>
            )}
          </form>
        </aside>
      </div>
    </section>
  );
}
