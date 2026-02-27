import React from "react";
import "./Meet.css";

const Meet = () => {
  return (
    <section className="meet-section">
      <div className="meet-container">

        {/* ===== Banner ===== */}
        <div className="meet-banner">

          <img
            src="/meet.png"
            alt="Indian doctor consulting patient"
            className="meet-img"
          />

          <div className="meet-overlay" />

          <div className="meet-content">
            <h2 className="meet-title">
              Meet Our Medical Specialists
            </h2>

            <p className="meet-text">
              Book personalized home healthcare services with our
              experienced doctors and physiotherapists.
            </p>

            {/* Mobile Button */}
            <a href="/doctors" className="meet-btn-mobile">
              Book My Appointment →
            </a>

          </div>
        </div>

        {/* ===== Desktop Full Width CTA ===== */}
        <div className="meet-cta-bar">
          <a href="/doctors">
            <button className="meet-cta-btn">
              Book My Appointment →
            </button>
          </a>
        </div>

      </div>
    </section>
  );
};

export default Meet;