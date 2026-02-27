"use client";
import React, { useEffect, useState } from "react";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";

import "./GallerySetups.css";
import Header from "../frontend/Header"; // adjust path if Header lives in a subfolder
import TopBar from "../frontend/TopBar";

export default function GallerySetups() {
const [activeMedia, setActiveMedia] = useState(null);

  const [gallery, setGallery] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [categories, setCategories] = useState([]);

  const [activeCategory, setActiveCategory] =
    useState("All");

  const [loading, setLoading] = useState(true);

  /* ================= FETCH ================= */
  useEffect(() => {

    const fetchGallery = async () => {
      try {
        const q = query(
          collection(db, "gallery"),
          where("published", "==", true),
          orderBy("order", "asc")
        );

        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setGallery(data);
        setFiltered(data);

        /* ===== EXTRACT UNIQUE CATEGORIES ===== */
        const uniqueCategories = [
          "All",
          ...new Set(
            data
              .map((item) => item.category)
              .filter(Boolean)
          ),
        ];

        setCategories(uniqueCategories);

      } catch (err) {
        console.error("Gallery fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();

  }, []);
const openViewer = (item) => {
  setActiveMedia(item);
  document.body.style.overflow = "hidden";
};

const closeViewer = () => {
  setActiveMedia(null);
  document.body.style.overflow = "auto";
};

  /* ================= FILTER ================= */
  const handleFilter = (category) => {

    setActiveCategory(category);

    if (category === "All") {
      setFiltered(gallery);
    } else {
      setFiltered(
        gallery.filter(
          (item) => item.category === category
        )
      );
    }
  };

  return (
    <div className="galleryPage">
            <TopBar />
            <Header />
      


      {/* ================= HEADER ================= */}
      <div className="galleryHeader">

        <h1>
          Our <span>Completed Medical Setups</span>
        </h1>

        <p className="subtitle">
          Real ICU setups, ventilator installations,
          oxygen therapy and home nursing care services.
        </p>

        <p className="trustLine">
          1000+ successful home healthcare setups completed.
        </p>

      </div>

      {/* ================= FILTERS ================= */}
      {/* ================= FILTERS ================= */}
{!loading && categories.length > 0 && (
  <div className="galleryFilters">

    {categories.map((cat) => (
      <button
        key={cat}
        className={`filterChip ${
          activeCategory === cat
            ? "active"
            : ""
        }`}
        onClick={() => handleFilter(cat)}
      >
        {cat}
      </button>
    ))}

  </div>
)}


      {/* ================= STATE ================= */}
      {loading && (
        <p className="galleryState">
          Loading gallery...
        </p>
      )}

      {!loading && filtered.length === 0 && (
        <p className="galleryState">
          No media found.
        </p>
      )}

      {/* ================= GRID ================= */}
      {!loading && filtered.length > 0 && (
        <div className="galleryGrid">

          {filtered.map((item) => (
            <div
  key={item.id}
  className="galleryItem"
  onClick={() => openViewer(item)}
>

              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt={item.category}
                />
              ) : (
                <video
                  src={item.url}
                  controls
                />
              )}
            </div>
          ))}

        </div>
      )}
{/* ================= FULLSCREEN VIEWER ================= */}
{activeMedia && (
  <div
    className="viewerOverlay"
    onClick={closeViewer}
  >
    <div
      className="viewerContent"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button */}
      <button
        className="viewerClose"
        onClick={closeViewer}
        style={{
  background: "#fff",
  color: "#000",
}}

      >
        ✕
      </button>

      {activeMedia.type === "image" ? (
        <img
          src={activeMedia.url}
          alt="Setup preview"
          className="viewerMedia"
        />
      ) : (
        <video
          src={activeMedia.url}
          controls
          autoPlay
          className="viewerMedia"
        />
      )}
    </div>
  </div>
)}

    </div>
  );
}
