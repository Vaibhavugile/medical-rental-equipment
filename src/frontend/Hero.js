import React, { useEffect, useState } from "react";
import "./Hero.css";

/* ================= SLIDES ================= */

const slides = [
  {
    eyebrow: "MEDICAL EQUIPMENT AT HOME",
    title: "Hospital-Grade\nMedical Equipment",
    desc:
      "Rent or purchase certified medical equipment including oxygen concentrators, hospital beds, ventilators and more — delivered and installed safely at home.",
    primaryCta: "Get Medical Equipment",
    secondaryCta: "Talk to an Expert",
    waMessage: "Hello BookMyMedicare, I want to enquire about medical equipment at home.",
    image: "/hero-slide-equipment.png",
  },
  {
    eyebrow: "PROFESSIONAL NURSING CARE",
    title: "Qualified Nursing Care\nAt Home",
    desc:
      "Trained nurses providing post-operative care, elderly care, injections, wound care and continuous patient monitoring at home.",
    primaryCta: "Book Nursing Care",
    secondaryCta: "Request Callback",
    waMessage: "Hello BookMyMedicare, I want to book nursing care at home.",
    image: "/hero-slide-nursing.png",
  },
  {
    eyebrow: "CRITICAL & ICU CARE",
    title: "ICU Setup &\nCritical Care at Home",
    desc:
      "Advanced ICU setup with monitoring equipment, ventilator support and experienced clinical supervision for critical patients.",
    primaryCta: "Arrange ICU Setup",
    secondaryCta: "Speak to Specialist",
    waMessage: "Hello BookMyMedicare, I need ICU setup and critical care at home.",
    image: "/hero-slide-icu.png",
  },
  {
    eyebrow: "24/7 MEDICAL SUPPORT",
    title: "Medical Support\nWhen It Matters Most",
    desc:
      "Round-the-clock medical assistance, emergency equipment delivery and rapid response across Mumbai.",
    primaryCta: "Call for Immediate Support",
    secondaryCta: "Get Free Consultation",
    waMessage: "Hello BookMyMedicare, I need urgent medical support.",
    image: "/hero-slide-nursing.png",
  },
];


/* ================= COMPONENT ================= */

export default function Hero() {
  const [index, setIndex] = useState(0);

const WHATSAPP_NUMBER = "917777066885"; // no +

function openWhatsApp(message) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

  /* AUTO SLIDE */
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 6500);

    return () => clearInterval(timer);
  }, []);

  const slide = slides[index];

  return (
    <section className="hero" aria-label="Primary Hero">
      <div className="hero-grid">

        {/* ================= LEFT CONTENT ================= */}
        <div className="hero-copy" key={index}>
          <span className="hero-eyebrow stagger">
            {slide.eyebrow}
          </span>

          <h1 className="hero-title stagger">
            {slide.title.split("\n").map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </h1>

          <p className="hero-desc stagger">
            {slide.desc}
          </p>

          <div className="hero-actions stagger">
            <a href="/#contact" className="btn-primary">
              {slide.primaryCta}
            </a>
            <a href="/#contact" className="btn-outline">
              {slide.secondaryCta}
            </a>
          </div>

          <div className="hero-proof">
            <span>✓ Certified Medical Equipment</span>
            <span>✓ ICU-Trained Clinical Staff</span>
            <span>✓ 24/7 Emergency Support</span>
          </div>

          <div className="hero-credibility">
            <strong>Trusted by 1,000+ Families</strong>
            <span>Across Mumbai</span>
          </div>

          {/* <div className="hero-cities">
            <span>Mumbai</span>
          </div>

          <div className="hero-dots" role="tablist">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`hero-dot ${i === index ? "active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Show slide ${i + 1}`}
                aria-selected={i === index}
                role="tab"
              />
            ))}
          </div> */}
        </div>

        {/* ================= RIGHT SIDE = BACKGROUND ================= */}
        <div
          className="hero-media"
          style={{ backgroundImage: `url(${slide.image})` }}
          aria-hidden="true"
        >
          {/* Hidden image for preload + accessibility */}
          <img
            src={slide.image}
            alt=""
            className="hero-image-hidden"
          />
        </div>

      </div>
    </section>
  );
}
