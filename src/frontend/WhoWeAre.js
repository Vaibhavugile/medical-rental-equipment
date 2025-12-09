import React, { useEffect, useRef } from "react";
import "./WhoWeAre.css";

/**
 * Animated "Who We Are" section
 * - imgSrc: path to image in public (default /who-image.jpg)
 */
export default function WhoWeAreUnique({ imgSrc = "/who-image.jpg", id = "who-we-are" }) {
  const rootRef = useRef(null);

  // items data so we can easily map and apply delays
  const items = [
    "Created to make quality home healthcare simple, accessible, and stress-free for every family.",
    "Evolved from a small initiative into a trusted provider of nursing, elderly care, physiotherapy, palliative and critical care at home.",
    "Supported by certified nurses, caregivers, physiotherapists, and technicians delivering safe, hospital-level care at home.",
    "Trusted by thousands for reliable, affordable, and compassionate healthcare at their doorstep."
  ];

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // mark visible
            el.classList.add("bmm-visible");

            // add 'bmm-item-visible' per list item with stagger via setTimeout
            const list = Array.from(el.querySelectorAll(".bmm-who-item"));
            list.forEach((li, i) => {
              setTimeout(() => li.classList.add("bmm-item-visible"), i * 110);
            });

            // animate image float start slightly delayed
            setTimeout(() => {
              el.querySelector(".bmm-who-media-card")?.classList.add("bmm-media-visible");
            }, 180);

            obs.disconnect();
          }
        });
      },
      { threshold: 0.14 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id={id} className="bmm-who-section" ref={rootRef} aria-labelledby="bmm-who-heading">
      <div className="bmm-who-inner">

        {/* LEFT MEDIA */}
        <div className="bmm-who-left" aria-hidden="true">
          <div className="bmm-who-media-card">
            <img src={imgSrc} alt="Caregiver with patient" className="bmm-who-img" />
          </div>
        </div>

        {/* RIGHT COPY */}
        <div className="bmm-who-right">
          <h2 id="bmm-who-heading" className="bmm-who-title">
            WHO <span className="bmm-who-accent">WE ARE</span>
          </h2>

          <ul className="bmm-who-list" aria-live="polite">
            {items.map((text, idx) => (
              <li
                key={idx}
                className="bmm-who-item"
                // also provide inline transition delay fallback (CSS animation mostly handles it)
                style={{ transitionDelay: `${idx * 110}ms` }}
              >
                <span className="bmm-who-icon" aria-hidden="true">
                  {/* inline SVG icons — keep same shapes but animate scale/glow in CSS */}
                  {idx === 0 && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
                      <path d="M12 2l6 2v5c0 5-3.5 9-6 11-2.5-2-6-6-6-11V4l6-2z" stroke="#007BFF" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
                      <path d="M9.5 12.5l1.8 1.8L15 10.6" stroke="#007BFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {idx === 1 && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
                      <path d="M12 12a3 3 0 100-6 3 3 0 000 6z" stroke="#007BFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 20a4 4 0 014-4h8a4 4 0 014 4" stroke="#007BFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {idx === 2 && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
                      <path d="M12 20s-6-4.5-8-8 2.5-7 8-7 8 4 8 7-8 8-8 8z" stroke="#007BFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 11a2 2 0 11-4 0 2 2 0 014 0z" stroke="#007BFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {idx === 3 && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
                      <path d="M14 9V5a3 3 0 00-3-3L6 6v9a3 3 0 003 3h6a3 3 0 003-3v-3a3 3 0 00-4-3z" stroke="#007BFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M7 12v-2" stroke="#007BFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>

                <div className="bmm-who-text">{text}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
