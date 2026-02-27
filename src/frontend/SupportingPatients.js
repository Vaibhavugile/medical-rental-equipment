"use client";
import React, { useEffect, useState } from "react";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";

import "swiper/css";
import "./SupportingPatients.css";

export default function SupportingPatients() {

  /* ================= STATE ================= */
  const [hospitals, setHospitals] = useState([]);

  /* ================= FETCH ================= */
  useEffect(() => {

    const fetchHospitals = async () => {
      try {
        const q = query(
          collection(db, "supportingPatients"), // 🔥 new collection
          where("published", "==", true),
          orderBy("order", "asc")
        );

        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        console.log("Supporting Hospitals:", data);

        setHospitals(data);

      } catch (err) {
        console.error("Hospitals fetch error:", err);
      }
    };

    fetchHospitals();

  }, []);

  return (
    <section className="supportSection">

      {/* ===== HEADER ===== */}
      <div className="supportHeader">
        <h2>
          Supporting <span>Patients</span>
        </h2>

        <p>
          We work closely with esteemed hospitals to ensure
          seamless patient care and medical support services.
        </p>
      </div>

      {/* ===== SINGLE ROW SLIDER ===== */}
      {hospitals.length > 0 && (
        <Swiper
          modules={[Autoplay]}
          spaceBetween={40}
          slidesPerView={5}
          loop={true}
          speed={3000}
          autoplay={{
            delay: 0,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          breakpoints={{
            0: { slidesPerView: 2 },
            480: { slidesPerView: 3 },
            768: { slidesPerView: 4 },
            1024: { slidesPerView: 5 },
          }}
          className="supportSlider"
        >
          {hospitals.map((item) => (
            <SwiperSlide key={item.id}>
              <div className="supportLogoBox">
                <img
                  src={item.logo}
                  alt={item.name || "Hospital Logo"}
                  loading="lazy"
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}

    </section>
  );
}
