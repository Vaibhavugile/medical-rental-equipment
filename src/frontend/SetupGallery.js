"use client";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";

import { db } from "../firebase";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { createPortal } from "react-dom";

import styles from "./SetupGallery.module.css";

export default function SetupGallery({ id = "gallery" }) {
  const sectionRef = useRef(null);
  const swiperRef = useRef(null);
  const navigate = useNavigate();

  const [galleryItems, setGalleryItems] = useState([]);
  const [loading, setLoading] = useState(true);
const [activeMedia, setActiveMedia] = useState(null);

  /* ================= TOUCH DEVICE DETECT ================= */
  const isTouchDevice = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
  }, []);

  /* ================= FETCH FROM FIREBASE ================= */
  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const q = query(
          collection(db, "gallery"),
          where("published", "==", true),
          orderBy("order", "asc")
        );

        const snapshot = await getDocs(q);

        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setGalleryItems(items);
      } catch (err) {
        console.error("Error fetching gallery:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, []);

  /* ================= INTERSECTION ANIMATION ================= */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add(styles.visible);
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ================= AUTOPLAY CONTROL ================= */
  const stopAutoplay = () => swiperRef.current?.autoplay?.stop();
  const startAutoplay = () => swiperRef.current?.autoplay?.start();

  /* ================= LOOP SAFETY ================= */
  const enableLoop = galleryItems.length > 3;

  /* ================= ORIENTATION DETECT ================= */
  const detectImageOrientation = (e) => {
    const img = e.target;
    if (img.naturalHeight > img.naturalWidth) {
      img.classList.add(styles.portrait);
    } else {
      img.classList.add(styles.landscape);
    }
  };
const openMedia = (item) => {
  setActiveMedia(item);
  document.body.style.overflow = "hidden"; // prevent scroll
};

const closeMedia = () => {
  setActiveMedia(null);
  document.body.style.overflow = "auto";
};

  const detectVideoOrientation = (e) => {
    const video = e.target;
    if (video.videoHeight > video.videoWidth) {
      video.classList.add(styles.portrait);
    } else {
      video.classList.add(styles.landscape);
    }
  };

  return (
    <section id={id} ref={sectionRef} className={styles.gallery}>
      <div className={styles.galleryInner}>

        {/* ===== Title ===== */}
        <h2 className={styles.title}>
          OUR <span>COMPLETED SETUPS</span>
        </h2>

        <p className={styles.subtitle}>
          Real ICU setups, Equipment Setup Gallery
        </p>

        {/* ===== LOADING ===== */}
        {loading && (
          <p style={{ textAlign: "center" }}>
            Loading gallery...
          </p>
        )}

        {/* ===== EMPTY ===== */}
        {!loading && galleryItems.length === 0 && (
          <p style={{ textAlign: "center" }}>
            No gallery media added yet.
          </p>
        )}

        {/* ===== SLIDER ===== */}
        {!loading && galleryItems.length > 0 && (
          <>
            <Swiper
              modules={[Autoplay, Navigation, Pagination]}
              onSwiper={(swiper) => (swiperRef.current = swiper)}

              /* ===== MOBILE OPTIMIZED SPACING ===== */
              spaceBetween={18}
              slidesPerView={3}

              /* ===== TOUCH AUTOPLAY LOGIC ===== */
              autoplay={
                isTouchDevice
                  ? false
                  : {
                      delay: 2600,
                      disableOnInteraction: false,
                      pauseOnMouseEnter: true,
                    }
              }

              navigation={!isTouchDevice}
              pagination={{ clickable: true }}
              loop={enableLoop}

              /* ===== BREAKPOINTS ===== */
              breakpoints={{
                0: {
                  slidesPerView: 1,
                  spaceBetween: 14,
                },
                480: {
                  slidesPerView: 1.2, // peek effect
                  spaceBetween: 16,
                },
                640: {
                  slidesPerView: 2,
                  spaceBetween: 18,
                },
                1024: {
                  slidesPerView: 3,
                  spaceBetween: 26,
                },
              }}
            >
              {galleryItems.map((item) => (
                <SwiperSlide key={item.id}>
                  <div
                    className={styles.card}
                      onClick={() => openMedia(item)}
                    onMouseEnter={!isTouchDevice ? stopAutoplay : undefined}
                    onMouseLeave={!isTouchDevice ? startAutoplay : undefined}
                  >
                    {item.type === "image" ? (
                      <img
                        src={item.url}
                        alt="Medical setup"
                        loading="lazy"
                        onLoad={detectImageOrientation}
                      />
                    ) : (
                      <video
                        src={item.url}
                        muted
                        loop
                        autoPlay={!isTouchDevice}
                        playsInline
                        onLoadedMetadata={detectVideoOrientation}
                        onPlay={!isTouchDevice ? stopAutoplay : undefined}
                        onPause={!isTouchDevice ? startAutoplay : undefined}
                      />
                    )}
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
            {/* ===== MEDIA LIGHTBOX ===== */}
{activeMedia &&
  createPortal(
    <div
      className={styles.lightbox}
      onClick={closeMedia}
    >
      <div
        className={styles.lightboxContent}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className={styles.closeBtn}
          onClick={closeMedia}
        >
          ✕
        </button>

        {activeMedia.type === "image" ? (
          <img
            src={activeMedia.url}
            alt="Setup preview"
          />
        ) : (
          <video
            src={activeMedia.url}
            controls
            autoPlay
          />
        )}
      </div>
    </div>,
    document.body   // 👈 renders outside gallery
  )}



            {/* ===== SEE ALL ===== */}
            <div className={styles.seeAllWrap}>
              <button
                className={styles.seeAllBtn}
                onClick={() => navigate("/gallery-setups")}
              >
                See All Setups →
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
