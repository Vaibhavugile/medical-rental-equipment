import React, { useEffect, useRef, useState } from "react";
import "./ExperienceTrust.css";

/* ================= COUNT UP HOOK ================= */

function useCountUp(target, active, delay = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    let startTs = null;
    let timeoutId;
    const duration = 1400;

    function step(ts) {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.floor(eased * target));

      if (progress < 1) requestAnimationFrame(step);
    }

    timeoutId = setTimeout(() => {
      requestAnimationFrame(step);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [target, active, delay]);

  return value;
}

/* ================= COMPONENT ================= */

export default function ExperienceTrust() {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          el.classList.add("et-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* STAGGERED COUNTERS */
  const families = useCountUp(1000, active, 0);
  const equipment = useCountUp(50, active, 200);

  return (
    <section className="et-section" ref={ref} aria-labelledby="et-heading">
      <div className="et-inner">

        {/* CONTENT */}
        <div className="et-content">
          <span className="et-eyebrow">TRUSTED HOME HEALTHCARE</span>

          <h2 id="et-heading">
            Over a Decade of
            <br />
            Trusted Home Care
          </h2>

          <p>
            BookMyMediCare delivers reliable, protocol-driven medical care
            at home — combining clinical expertise, speed, and compassion
            to support families when it matters most.
          </p>
        </div>

        {/* METRICS BAR */}
        <div className="et-metrics-wrap">
          <div className="et-metrics">

            {/* COUNT-UP */}
            <div className="et-metric">
              <strong className="et-count">{families}+</strong>
              <span>Families Served</span>
            </div>

            <div className="et-metric">
              <strong className="et-count">{equipment}+</strong>
              <span>Medical Equipment</span>
            </div>

            {/* FADE-IN */}
            <div className="et-metric et-fade">
              <strong className="et-count">24/7</strong>
              <span>Medical Support</span>
            </div>

            {/* LOCATION */}
            <div className="et-metric et-location">
              <strong className="et-location-text">Mumbai</strong>
              <span>All Areas Covered</span>
            </div>

          </div>
        </div>

        {/* CTA */}
        <div className="et-cta">
          <a href="/#contact" className="et-btn">
            Talk to Our Care Team
          </a>
        </div>

      </div>
    </section>
  );
}
