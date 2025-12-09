import React, { useEffect, useRef } from "react";
import "./HowWeWorkUnique.css";

export default function HowWeWorkUnique({
  id = "how-we-work",
  imgSrc = "/how-image.jpg",
  bullets = [
    "A proper and complete clinical assessment of each patient by Medical team to ascertain patient clinical requirements.",
    "Daily monitoring of patients as per BMM protocol and same should be documented.",
    "Supervision of patient status by experienced medical nursing supervisor.",
    "Daily patient status to be informed to respective consultants."
  ]
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.classList.add("bmm-visible");

          const items = Array.from(el.querySelectorAll(".bmm-how-item"));
          items.forEach((it, i) => {
            setTimeout(() => it.classList.add("bmm-item-visible"), i * 120);
          });

          // start image float after a short delay
          setTimeout(() => el.querySelector(".bmm-how-media-card")?.classList.add("bmm-media-visible"), 200);

          obs.disconnect();
        }
      });
    }, { threshold: 0.14 });

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id={id} className="bmm-how-section" ref={rootRef} aria-labelledby="bmm-how-heading">
      <div className="bmm-how-inner">
        {/* LEFT: text */}
        <div className="bmm-how-left">
          <h2 id="bmm-how-heading" className="bmm-how-title">HOW <span className="bmm-blue">WE WORK</span></h2>

          <ul className="bmm-how-list" aria-live="polite">
            {bullets.map((txt, idx) => (
              <li key={idx} className="bmm-how-item" style={{ transitionDelay: `${idx * 120}ms` }}>
                <span className="bmm-how-icon" aria-hidden>
                  {/* ICONS: premium medical SVGs */}
                  {idx === 0 && (
                    /* Stethoscope */
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke="#007BFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 4v5a5 5 0 0 0 10 0V4" />
                      <path d="M8 15a7 7 0 0 0 14 0v-2" />
                      <circle cx="20" cy="10" r="2" />
                    </svg>
                  )}

                  {idx === 1 && (
                    /* Heartbeat Monitor */
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke="#007BFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="14" rx="2" />
                      <path d="M4 12h3l2-3 3 6 2-3h4" />
                    </svg>
                  )}

                  {idx === 2 && (
                    /* Medical Shield */
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke="#007BFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l7 4v5c0 5-3.5 9-7 11-3.5-2-7-6-7-11V6l7-4z" />
                      <path d="M12 8v8" />
                      <path d="M9 12h6" />
                    </svg>
                  )}

                  {idx === 3 && (
                    /* Clipboard / Report */
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke="#007BFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 2h6l1 3H8l1-3z" />
                      <rect x="5" y="5" width="14" height="17" rx="2" />
                      <path d="M9 14h6" />
                      <path d="M9 10h6" />
                    </svg>
                  )}
                </span>

                <p className="bmm-how-text">{txt}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT: image */}
        <div className="bmm-how-right" aria-hidden="true">
          <div className="bmm-how-media-card">
            <img src={imgSrc} alt="Medical team" className="bmm-how-img" />
          </div>
        </div>
      </div>
    </section>
  );
}
