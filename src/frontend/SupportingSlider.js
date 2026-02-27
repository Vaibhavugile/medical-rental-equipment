"use client";

import { useEffect, useRef, useState } from "react";
import "./Slider.css";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";

function SupportingSlider() {
  const sliderRef = useRef(null);
  const autoplayRef = useRef(null);

  const [logos, setLogos] = useState([]);
  const [index, setIndex] = useState(0);

  const visible = 4; // 4 visible logos

  /* ================= FETCH FIREBASE ================= */

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const q = query(
          collection(db, "supportingPatients"),
          where("published", "==", true),
          orderBy("order", "asc")
        );

        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) =>
          doc.data()
        );

        const images = data.map((d) => d.logo);

        // Duplicate for infinite loop
        setLogos([...images, ...images]);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    fetchHospitals();
  }, []);

  /* ================= CARD WIDTH ================= */

  const getCardWidth = () => {
    const slider = sliderRef.current;
    if (!slider) return 0;

    const firstCard =
      slider.querySelector(".circle");

    if (!firstCard) return 0;

    const style =
      window.getComputedStyle(firstCard);

    const margin =
      parseFloat(style.marginRight || 0);

    return (
      firstCard.getBoundingClientRect().width +
      margin
    );
  };

  /* ================= SLIDE ================= */

  const slide = (newIndex) => {
    const slider = sliderRef.current;
    if (!slider) return;

    const cardWidth = getCardWidth();

    slider.style.transform =
      `translateX(-${newIndex * cardWidth}px)`;
  };

  /* ================= NEXT ================= */

  const nextSlide = () => {
    setIndex((prev) => {
      const newIndex = prev + 1;
      const half = logos.length / 2;

      const slider = sliderRef.current;
      if (!slider) return 0;

      if (newIndex >= half) {
        slider.style.transition = "none";
        slider.style.transform = "translateX(0)";

        setTimeout(() => {
          slider.style.transition =
            "transform 0.7s ease";
        }, 50);

        return 0;
      }

      return newIndex;
    });
  };

  /* ================= PREV ================= */

  const prevSlide = () => {
    setIndex((prev) =>
      prev > 0 ? prev - 1 : 0
    );
  };

  /* ================= AUTOPLAY ================= */

  useEffect(() => {
    if (logos.length === 0) return;

    autoplayRef.current = setInterval(() => {
      nextSlide();
    }, 2500);

    return () =>
      clearInterval(autoplayRef.current);
  }, [logos]);

  /* ================= HOVER PAUSE ================= */

  const pauseAuto = () =>
    clearInterval(autoplayRef.current);

  const resumeAuto = () => {
    autoplayRef.current = setInterval(() => {
      nextSlide();
    }, 2500);
  };

  /* ================= APPLY SLIDE ================= */

  useEffect(() => {
    if (logos.length > 0) {
      slide(index);
    }
  }, [index, logos]);

  /* ================= RESIZE FIX ================= */

  useEffect(() => {
    const handleResize = () => slide(index);
    window.addEventListener("resize", handleResize);

    return () =>
      window.removeEventListener(
        "resize",
        handleResize
      );
  }, [index]);

  /* ================= UI ================= */

  return (
    <div className="supporting">

      {/* HEADER */}
      <h1>
        <span>Supporting</span> Patients
      </h1>

      <p>
        We work closely with esteemed hospitals
        to ensure seamless patient care.
      </p>

      <div
        className="slider-container"
        onMouseEnter={pauseAuto}
        onMouseLeave={resumeAuto}
      >

        {/* PREV */}
        <button
          className="btn prev"
          onClick={prevSlide}
        >
          &#10094;
        </button>

        {/* SLIDER */}
        <div className="slider">
          <div
            className="supporting_track"
            ref={sliderRef}
          >
            {logos.map((img, i) => {

              // 🔥 CENTER FOCUS LOGIC
              const centerIndex =
                index + Math.floor(visible / 2);

              const isCenter =
                i === centerIndex;

              return (
                <div
                  className={`circle ${
                    isCenter
                      ? "active-center"
                      : ""
                  }`}
                  key={i}
                >
                  <img
                    src={img}
                    alt="Hospital Logo"
                    loading="lazy"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* NEXT */}
        <button
          className="btn next"
          onClick={nextSlide}
        >
          &#10095;
        </button>

      </div>
    </div>
  );
}

export default SupportingSlider;