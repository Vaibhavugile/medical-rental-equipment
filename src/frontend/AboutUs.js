import React from "react";
import "./AboutUs.css";

const WHATSAPP_NUMBER = "917777066885";

const openWhatsApp = () => {
  const msg = "Hello BookMyMedicare, I would like to know more about your home healthcare services.";
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
};

const AboutUs = () => {
  return (
    <section className="about-us" id="about-us">
      <div className="about-container">

        {/* Image Section */}
     <div className="about-image">
  <img
    src="/about-us.png"
    alt="Home healthcare and medical equipment rental services by BookMyMedicare"
    loading="lazy"
  />


</div>



        {/* Content Section */}
        <div className="about-content">
          <h2>About <span>BookMyMedicare</span></h2>

          <p>
            <strong>BookMyMedicare</strong> is a trusted provider of
            <strong> home healthcare services</strong>, delivering professional
            medical care and support directly to patients’ homes. We focus on
            making healthcare accessible, reliable, and affordable for every
            family.
          </p>

          <p>
            We offer a wide range of <strong>medical services at home</strong>,
            including <strong>home nursing care</strong>, trained caregivers,
            <strong> diagnostic tests at home</strong>, pharmacy delivery,
            ambulance services, post-surgical care,
            <strong> home ICU setup</strong>, and palliative care.
          </p>

          <p>
            In addition, we provide
            <strong> medical equipment rentals at home</strong> such as hospital
            beds, oxygen concentrators, BiPAP & CPAP machines, ventilators,
            patient monitors, suction machines, wheelchairs, and other essential
            healthcare equipment.
          </p>

          <p>
            Serving patients across <strong>Mumbai, Navi Mumbai, and nearby
            areas</strong>, our certified doctors, nurses, technicians, and
            caregivers follow strict clinical standards for safe, personalized care.
          </p>

          <div className="about-trust">
            ✔ Verified Healthcare Professionals & Certified Medical Equipment
          </div>

          <p className="about-tagline">
            Complete Home Healthcare & Medical Equipment Solutions.
          </p>
        </div>

      </div>
    </section>
  );
};

export default AboutUs;
