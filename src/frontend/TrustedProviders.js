"use client";

import React, { useEffect, useState } from "react";
import "./TrustedProviders.css";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";

/* ================= ROTATING IMAGE COMPONENT ================= */
const RotatingLogos = ({ items }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!items || items.length === 0) return;

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % items.length);
    }, 1200);

    return () => clearInterval(timer);
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <div className="logo-rotator">
      {items.map((src, index) => (
        <img
          key={index}
          src={src}
          alt="trusted provider"
          className={`logo-item ${index === current ? "visible" : "hidden"}`}
        />
      ))}
    </div>
  );
};

/* ================= MAIN SECTION ================= */
const TrustedProviders = () => {
  const [providerList, setProviderList] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ===== FETCH PROVIDERS FROM FIRESTORE ===== */
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const q = query(
          collection(db, "providers"),
          where("published", "==", true),
          orderBy("order", "asc")
        );

        const snapshot = await getDocs(q);

        const results = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProviderList(results);
      } catch (error) {
        console.error("Error loading providers:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
  }, []);

  /* ===== SPLIT INTO TWO GROUPS ===== */
  const midpoint = Math.ceil(providerList.length / 2);
  const topLogos = providerList.slice(0, midpoint).map((p) => p.logo);
  const bottomLogos = providerList.slice(midpoint).map((p) => p.logo);

  return (
    <section className="providers-wrapper">
      <header className="providers-title-area">
        <h1 className="providers-main-title">
          Our <span>Trusted</span> Providers
        </h1>
      </header>

      <div className="providers-layout">
        <div className="providers-left">
          {!loading && (
            <>
              <RotatingLogos items={topLogos} />
              <RotatingLogos items={bottomLogos} />
            </>
          )}
        </div>

        <div className="providers-right">
          <h2 className="providers-subtitle">
            Carefully Selected Healthcare Partners
          </h2>
          <p className="providers-description">
            We collaborate with top-tier hospitals, healthcare brands, and
            certified medical equipment providers. Each partner undergoes
            quality verification to ensure consistent excellence, reliability,
            and patient-focused service delivery.
          </p>
        </div>
      </div>
    </section>
  );
};

export default TrustedProviders;