import React, { useEffect, useRef } from "react";
import "./Hero.css";

/**
 * BmmHero (namespaced)
 * Props:
 *  - imgSrc (string) optional: path to hero image
 *  - alt (string) optional: alt text for the image
 *
 * Notes:
 *  - All class names are prefixed with "bmm-" to avoid collisions.
 *  - Keeps IntersectionObserver entrance and reduced-motion support.
 */
export default function BmmHero({
  imgSrc = "/hero-right.png",
  alt = "Caregiver assisting a patient in a home environment",
}) {
  const leftRef = useRef(null);
  const imgWrapRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rootMargin = "0px 0px -8% 0px";
    const opts = { root: null, rootMargin, threshold: 0.06 };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          leftRef.current?.classList.add("entered");
          imgWrapRef.current?.classList.add("entered");
          if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
          }
        }
      });
    }, opts);

    if (leftRef.current) observerRef.current?.observe(leftRef.current);

    const fallback = setTimeout(() => {
      if (leftRef.current && !leftRef.current.classList.contains("entered")) {
        leftRef.current.classList.add("entered");
        imgWrapRef.current?.classList.add("entered");
      }
    }, 900);

    return () => {
      clearTimeout(fallback);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return (
    <section id="home" className="bmm-hero" aria-label="Hero section">
      {/* floating blurred blobs */}
      <div className="bmm-blob bmm-blob--left" aria-hidden="true" />
      <div className="bmm-blob bmm-blob--right" aria-hidden="true" />

      {/* Rotator: auto-rotating soft shapes (SVG) */}
      <div className="bmm-rotator" aria-hidden="true">
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <radialGradient id="bmm-rotGrad1" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#0069ff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0069ff" stopOpacity="0.0" />
            </radialGradient>
            <radialGradient id="bmm-rotGrad2" cx="70%" cy="30%">
              <stop offset="0%" stopColor="#ffb84d" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffb84d" stopOpacity="0.0" />
            </radialGradient>
            <radialGradient id="bmm-rotGrad3" cx="50%" cy="60%">
              <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#00d2ff" stopOpacity="0.0" />
            </radialGradient>
          </defs>
        </svg>

        {/* three soft SVG organic shapes */}
        <svg className="bmm-shape s1" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M422,95C480,164,470,291,407,357C344,423,233,434,150,385C67,336,54,230,92,151C130,72,364,26,422,95Z" fill="url(#bmm-rotGrad1)"></path>
        </svg>

        <svg className="bmm-shape s2" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M498,329C490,420,396,498,307,482C218,466,133,356,137,263C141,170,238,110,326,98C414,86,506,238,498,329Z" fill="url(#bmm-rotGrad2)"></path>
        </svg>

        <svg className="bmm-shape s3" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M382,98C426,156,438,224,416,292C394,360,330,410,264,412C198,414,146,360,120,294C94,228,180,132,248,108C316,84,340,40,382,98Z" fill="url(#bmm-rotGrad3)"></path>
        </svg>
      </div>

      <div className="bmm-inner">
        <div className="bmm-left" ref={leftRef}>
          <p className="bmm-eyebrow" aria-hidden="false">HOME HEALTHCARE SERVICES</p>

          <h1 className="bmm-title" aria-level="1">BOOKMYMEDICARE</h1>

          <p className="bmm-lead">EVERYTIME, ANYWHERE — PREMIUM CARE AT YOUR DOORSTEP</p>

          <div className="bmm-subtitle-pill" role="note" aria-live="polite">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="bmm-gA" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#0069ff" />
                  <stop offset="1" stopColor="#ffb84d" />
                </linearGradient>
              </defs>
              <rect width="24" height="24" rx="4" fill="url(#bmm-gA)"></rect>
            </svg>
            <span>
              Homecare <strong>You Need and Deserve</strong> — Compassionate, Trained Professionals.
            </span>
          </div>

          <div className="bmm-actions" role="group" aria-label="Hero actions">
            <a className="bmm-btn bmm-btn-primary" href="#booking" role="button">
              <span className="bmm-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 5.5C3 4.67 3.67 4 4.5 4h2C7.33 4 8 4.67 8 5.5V7c0 .83-.67 1.5-1.5 1.5H6.5C6.22 8.5 6 8.72 6 9v1.5C6 12.43 8.57 15 11.5 15H13c.28 0 .5.22.5.5V14.5C13.5 13.67 14.17 13 15 13h1.5C17.33 13 18 12.33 18 11.5v-2C18 7.67 17.33 7 16.5 7h-2C13.67 7 13 6.33 13 5.5V4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Request a Callback
            </a>

            <a className="bmm-btn bmm-btn-ghost" href="#services" role="button">Our Services</a>
          </div>
        </div>

        <div className="bmm-right" aria-hidden="false">
          <div className="bmm-img-wrap" ref={imgWrapRef}>
            <div className="bmm-img-card" role="img" aria-label={alt}>
              <picture>
                <source srcSet={`${imgSrc.replace(/(\.\w+)$/, '-large$1')} 1200w, ${imgSrc.replace(/(\.\w+)$/, '-med$1')} 800w`} />
                <img className="bmm-hero-img" src={imgSrc} alt={alt} loading="lazy" decoding="async" />
              </picture>
              <div className="bmm-img-shine" aria-hidden="true" />
            </div>

            <div className="bmm-img-badge bmm-img-badge--a" aria-hidden="true" title="24/7 Support">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h3" stroke="#0C2340" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 8v4l2 2" stroke="#0C2340" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div className="bmm-img-badge bmm-img-badge--b" aria-hidden="true" title="Expert Care">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2v6" stroke="#0C2340" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 10c0 3.6 2.9 6 6 6s6-2.4 6-6" stroke="#0C2340" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 18v4" stroke="#0C2340" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div className="bmm-img-badge bmm-img-badge--c" aria-hidden="true" title="Trusted">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="#0C2340" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
