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
import "./TrustedProviders.css";

export default function Providers() {

  /* ================= STATE ================= */
  const [providers, setProviders] = useState([]);

  /* ================= FETCH FROM FIREBASE ================= */
  useEffect(() => {

    const fetchProviders = async () => {
      try {
        const q = query(
          collection(db, "providers"),
          where("published", "==", true),
          orderBy("order", "asc")
        );

        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        console.log("Trusted Providers:", data);

        setProviders(data);

      } catch (err) {
        console.error("Providers fetch error:", err);
      }
    };

    fetchProviders();

  }, []);

  /* ================= SPLIT INTO 2 ROWS ================= */
  const half = Math.ceil(providers.length / 2);
  const row1 = providers.slice(0, half);
  const row2 = providers.slice(half);

  return (
    <section className="providersSection">

      {/* ================= HEADER ================= */}
      <div className="providersHeader">
        <h2>
          Our <span>Trusted Providers</span>
        </h2>

        <p>
          We proudly collaborate with leading hospitals,
          healthcare brands and medical equipment providers.
        </p>
      </div>

      {/* ================= ROW 1 ================= */}
      {row1.length > 0 && (
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
          className="providersSlider row1"
        >
          {row1.map((item) => (
            <SwiperSlide key={item.id}>
              <div className="providerLogoBox">
                <img
                  src={item.logo}
                  alt={item.name || "Provider Logo"}
                  loading="lazy"
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}

      {/* ================= ROW 2 ================= */}
      {row2.length > 0 && (
        <Swiper
          modules={[Autoplay]}
          spaceBetween={40}
          slidesPerView={5}
          loop={true}
          speed={3000}
          dir="rtl"
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
          className="providersSlider row2"
        >
          {row2.map((item) => (
            <SwiperSlide key={item.id}>
              <div className="providerLogoBox">
                <img
                  src={item.logo}
                  alt={item.name || "Provider Logo"}
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
