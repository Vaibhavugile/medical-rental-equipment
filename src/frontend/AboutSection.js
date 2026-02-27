import React from "react";
import "./AboutSection.css";

const AboutSection = () => {
  return (
    <section className="about-premium">

      {/* IMAGE SIDE */}
      <div className="about-premium-image">
        <img
          src="./hero-slide-expert1.png"
          alt="Certified Healthcare Professionals"
        />

        <div className="floating-badge">
          <h3>10+</h3>
          <p>Years Experience</p>
        </div>
      </div>

      {/* CONTENT SIDE */}
      <div className="about-premium-content">

        <p className="premium-small-title">
          ABOUT BOOK MY MEDICARE
        </p>

        <h2>
          Hospital-Level Care <br />
          Delivered <span>At Your Home</span>
        </h2>

        {/* Short Premium Description */}
        <p className="premium-description">
         Bookmymedicare Private Limited is a trusted healthcare service provider based in Mumbai, India, dedicated to delivering high-quality medical care at the comfort of your home. Established with the vision of making healthcare accessible, affordable, and patient-centered, we strive to bridge the gap between hospitals and home care.
        </p>

        <p className="premium-description">
          We understand that recovery and long-term care are most effective when patients are in a familiar and comfortable environment. That’s why we offer a wide range of professional home healthcare services designed to meet individual medical needs with compassion and expertise.
        </p>

        {/* Compact Services */}
        <div className="services-grid">
          <div>Home Nursing Care</div>
          <div>ICU Setup at Home</div>
          <div>Post-Operative Care</div>
          <div>Elderly & Palliative Care</div>
          <div>Physiotherapy at Home</div>
          <div>Ambulance Services</div>
        </div>

        {/* Inline Mission */}
        <div className="mission-card">
          <h4>Your Health. Our Priority.</h4>
          <p>
            Trusted professionals. Clinical excellence. Compassionate care.
          </p>
        </div>

      </div>
    </section>
  );
};

export default AboutSection;