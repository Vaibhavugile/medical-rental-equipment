import React, { useEffect, useRef } from "react";
import "./TrustPremium.css";

export default function TrustPremium() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("tp-visible");
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const items = [
    {
      icon: "🩺",
      title: "Quality Medical Equipment",
      sub: "Certified equipment for rent & purchase",
    },
    {
      icon: "⏱️",
      title: "24/7 Medical Support",
      sub: "Round-the-clock clinical assistance",
    },
    {
      icon: "👩‍⚕️",
      title: "Qualified Clinical Team",
      sub: "Skilled and experienced professionals",
    },
    {
      icon: "🚑",
      title: "Fastest Delivery Time",
      sub: "Rapid setup when care matters most",
    },
  ];

  return (
    <section className="tp-section" ref={ref} aria-labelledby="tp-heading">
      <div className="tp-inner">

        {/* HEADER */}
        <header className="tp-header">
          <span className="tp-eyebrow">TRUST & SAFETY</span>

          <h2 id="tp-heading">
            Healthcare Built on
            <span> Trust</span>
          </h2>

          <p>
            Reliable, responsive, and professional home healthcare —
            trusted by families across Mumbai.
          </p>
        </header>

        {/* TRUST CARDS */}
        <div className="tp-grid">
          {items.map((it, i) => (
            <article
              key={i}
              className="tp-card"
              style={{ "--delay": `${i * 140}ms` }}
              role="group"
              aria-label={it.title}
            >
              <div className="tp-icon" aria-hidden="true">
                {it.icon}
              </div>

              <h3 className="tp-title">{it.title}</h3>

              <span className="tp-divider" aria-hidden="true" />

              <span className="tp-sub">{it.sub}</span>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
