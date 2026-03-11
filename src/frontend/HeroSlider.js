import React, { useState, useEffect } from "react";
import "./HeroSlider.css";

/* =========================
   SLIDES DATA
   Desktop + Mobile Images
========================= */

const slidesData = [
  {
    image: "/hero-slide-icusetup1.webp",
    mobileImage: "/hero-slide-icusetup1-mobile.webp",
    tagline: "Hospital Level ICU Care at Home",
    title: (
      <>
        Affordable <span>ICU Setup</span> at Home
      </>
    ),
    desc:
      "Hospital-level ICU care at home with advanced equipment, complete safety, and cost-effective solutions."
  },

  {
    image: "/hero-slide-expert1.webp",
    mobileImage: "/hero-slide-expert1-mobile.webp",
    tagline: "Trusted Clinical Experts",
    title: (
      <>
        Meet Our <span>Expert Clinical</span> Team
      </>
    ),
    desc:
      "Experienced doctors and highly trained healthcare team committed to your optimum care."
  },

  {
    image: "/hero-slide-nursingcare1.webp",
    mobileImage: "/hero-slide-nursingcare1-mobile.webp",
    tagline: "Compassionate Home Care",
    title: (
      <>
        Skilled Nursing <span>Care at Home</span>
      </>
    ),
    desc:
      "Trained, experienced nursing care for your loved ones."
  },

  {
    image: "/hero-slide-chemo1.webp",
    mobileImage: "/hero-slide-chemo1-mobile.webp",
    tagline: "Advanced Cancer Care at Home",
    title: (
      <>
        Experienced <span>Chemo Nursing</span> at Home
      </>
    ),
    desc:
      "Specialized chemotherapy nursing delivered with compassion and expertise."
  },

  {
    image: "/hero-slide-pharmacy1.webp",
    mobileImage: "/hero-slide-pharmacy1-mobile.webp",
    tagline: "Trusted Medicine Delivery",
    title: (
      <>
        Pharmacy Services <span>at Your Doorstep</span>
      </>
    ),
    desc:
      "100% genuine medicines delivered safely and promptly to your home."
  },

  {
    image: "/hero-slide-bloodtest1.webp",
    mobileImage: "/hero-slide-bloodtest1-mobile.webp",
    tagline: "Diagnostic Care at Home",
    title: (
      <>
        Quick <span>Blood Tests</span> at Home
      </>
    ),
    desc:
      "Fast, accurate, and hygienic lab testing services at home."
  }
];

/* =========================
   COMPONENT
========================= */

const HeroSlider = () => {
  const [index, setIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  /* =========================
     DETECT MOBILE SCREEN
  ========================= */
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () =>
      window.removeEventListener("resize", checkMobile);
  }, []);

  /* =========================
     AUTO SLIDE
  ========================= */
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % slidesData.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  /* =========================
     NAVIGATION
  ========================= */
  const nextSlide = () => {
    setIndex((prev) => (prev + 1) % slidesData.length);
  };

  const prevSlide = () => {
    setIndex((prev) =>
      prev === 0 ? slidesData.length - 1 : prev - 1
    );
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <section className="hero-slider">
      {slidesData.map((slide, i) => {
        /* Choose correct image */
        const bgImage =
          isMobile && slide.mobileImage
            ? slide.mobileImage
            : slide.image;

        return (
          <div
            key={i}
            className={`hero-slide ${
              i === index ? "active" : ""
            }`}
            style={{
              backgroundImage: `url(${bgImage})`
            }}
          >
            {/* Overlay */}
            <div className="hero-overlay" />

            {/* Content */}
            <div className="hero-content">
              {/* Tagline */}
              <p className="hero-tagline animate animate-1">
                {slide.tagline}
              </p>

              {/* Title */}
              <h2 className="hero-title animate animate-2">
                {slide.title}
              </h2>

              {/* Description */}
              <p className="hero-desc animate animate-3">
                {slide.desc}
              </p>

              {/* CTA */}
              <div className="hero-actions animate animate-4">
                <a href="#" className="hero-btn primary">
                  Get Service →
                </a>
              </div>
            </div>
          </div>
        );
      })}

      {/* =========================
          ARROWS
      ========================= */}
      <div
        className="hero-nav hero-prev"
        onClick={prevSlide}
      >
        ‹
      </div>

      <div
        className="hero-nav hero-next"
        onClick={nextSlide}
      >
        ›
      </div>

      {/* =========================
          DOTS
      ========================= */}
      <div className="hero-dots">
        {slidesData.map((_, i) => (
          <span
            key={i}
            className={`hero-dot ${
              i === index ? "active" : ""
            }`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSlider;
