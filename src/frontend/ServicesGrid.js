import React, { useEffect, useRef } from "react";
import "./ServicesSection.css";

/**
 * ServicesSection.jsx
 * - Each card is now clickable and navigates to its respective link.
 * - Keeps original visuals, intersection reveal and parallax.
 * - Add `link` to each item in `services` to make the card navigable.
 *
 * Example services entry:
 *   { key: "icu", title: "ICU Setup", subtitle: "critical bed & monitoring", icon: "icu", link: "/icu" }
 */

export default function ServicesGrid() {
  const rootRef = useRef(null);

  // Add `link` to each object to make it navigable
const services = [
  {
    key: "equip",
    title: "Medical Equipment",
    subtitle: "Hospital-grade equipment at home",
    icon: "equip",
    link: "/equipment",
    enquire: true
  },
  {
    key: "icu",
    title: "ICU Setup",
    subtitle: "Advanced critical care at home",
    icon: "icu",
    link: "/icu",
    enquire: true
  },
  {
    key: "post",
    title: "Post Surgery Care",
    subtitle: "Safe recovery after surgery",
    icon: "post",
    link: "/post-surgery-care",
    enquire: false
  },
  {
    key: "pall",
    title: "Palliative Care",
    subtitle: "Comfort-focused compassionate care",
    icon: "pall",
    link: "/palliative-care",
    enquire: true
  },
  {
    key: "ambulance",
    title: "Ambulance Services",
    subtitle: "24/7 emergency medical transport",
    icon: "ambulance",
    link: "/ambulance",
    enquire: true
  },
  {
    key: "lab",
    title: "Lab Services",
    subtitle: "Home sample collection & reports",
    icon: "lab",
    link: "/lab-services",
    enquire: false
  },
  {
    key: "pharmacy",
    title: "Pharmacy Delivery",
    subtitle: "Medicines delivered at doorstep",
    icon: "pharmacy",
    link: "/pharmacy-delivery",
    enquire: true
  },
  {
    key: "nursing",
    title: "Nursing Care",
    subtitle: "Trained nurses for home care",
    icon: "nursing",
    link: "/nursing-care",
    enquire: true
  },
  {
    key: "physio",
    title: "Physiotherapy Support",
    subtitle: "Rehabilitation & mobility therapy",
    icon: "physio",
    link: "/physiotherapy",
    enquire: false
  },
  {
    key: "resp",
    title: "Respiratory Care",
    subtitle: "Oxygen & ventilator support",
    icon: "resp",
    link: "/respiratory-care",
    enquire: true
  }
];


const openWhatsApp = (serviceName) => {
  const phone = "917777066885"; // country code without +
  const message = `Hello BookMyMedicare, I would like to enquire about ${serviceName}.`;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
};

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            root.classList.add("bmm-services-visible");
            const cards = Array.from(root.querySelectorAll(".bmm-service-card"));
            cards.forEach((c, i) => setTimeout(() => c.classList.add("bmm-card-in"), i * 70));
            obs.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    obs.observe(root);

    // small parallax for desktop
    const onMove = (e) => {
      if (window.innerWidth < 1000) return;
      const rect = root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      root.querySelectorAll(".bmm-service-card").forEach((card, idx) => {
        const depth = 6 + (idx % 3);
        card.style.setProperty("--tx", `${dx * depth}px`);
        card.style.setProperty("--ty", `${dy * depth}px`);
      });
    };
    window.addEventListener("mousemove", onMove);

    return () => {
      obs.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  /* BLUE ICONS - modern, premium, crisp */
  function Icon({ name }) {
    switch (name) {
      case "equip":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <rect x="10" y="18" width="44" height="28" rx="6" className="bmm-icon-fill" />
            <rect x="10" y="18" width="44" height="28" rx="6" className="bmm-icon-stroke" />
            <path d="M20 30h24M24 36h16" className="bmm-icon-stroke" />
          </svg>
        );

      case "icu":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <rect x="10" y="14" width="44" height="24" rx="5" className="bmm-icon-fill" />
            <rect x="10" y="14" width="44" height="24" rx="5" className="bmm-icon-stroke" />
            <path d="M20 24h24M20 30h18" className="bmm-icon-stroke" />
            <circle cx="44" cy="22" r="2.5" fill="var(--bmm-blue)" />
          </svg>
        );

      case "post":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <path d="M12 18l20-8 20 8v26a4 4 0 01-4 4H16a4 4 0 01-4-4V18z" className="bmm-icon-fill" />
            <path d="M12 18l20-8 20 8v26a4 4 0 01-4 4H16a4 4 0 01-4-4V18z" className="bmm-icon-stroke" />
            <path d="M32 28v10M26 33h12" className="bmm-icon-stroke" />
          </svg>
        );

      case "pall":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <path d="M32 10c8 0 14 6 14 14 0 11-14 20-14 20S18 35 18 24c0-8 6-14 14-14z" className="bmm-icon-fill" />
            <path d="M32 10c8 0 14 6 14 14 0 11-14 20-14 20S18 35 18 24c0-8 6-14 14-14z" className="bmm-icon-stroke" />
          </svg>
        );

      case "ambulance":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <rect x="8" y="20" width="40" height="20" rx="4" className="bmm-icon-fill" />
            <rect x="8" y="20" width="40" height="20" rx="4" className="bmm-icon-stroke" />
            <rect x="46" y="26" width="8" height="8" rx="2" className="bmm-icon-stroke" />
            <circle cx="18" cy="44" r="3" fill="var(--bmm-blue)" />
            <circle cx="36" cy="44" r="3" fill="var(--bmm-blue)" />
            <path d="M22 26v6M26 29h6" className="bmm-icon-stroke" />
          </svg>
        );

      case "lab":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <path d="M22 10h20l-6 20v12H28V30L22 10z" className="bmm-icon-fill" />
            <path d="M22 10h20l-6 20v12H28V30L22 10z" className="bmm-icon-stroke" />
            <path d="M28 28h8" className="bmm-icon-stroke" />
          </svg>
        );

      case "pharmacy":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <rect x="16" y="10" width="32" height="40" rx="8" className="bmm-icon-fill" />
            <rect x="16" y="10" width="32" height="40" rx="8" className="bmm-icon-stroke" />
            <path d="M32 18v24M22 30h20" className="bmm-icon-stroke" />
          </svg>
        );

      case "nursing":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <circle cx="32" cy="18" r="8" className="bmm-icon-fill" />
            <circle cx="32" cy="18" r="8" className="bmm-icon-stroke" />
            <path d="M12 46a20 20 0 0140 0" className="bmm-icon-stroke" />
          </svg>
        );

      case "physio":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <rect x="10" y="42" width="44" height="10" rx="4" className="bmm-icon-fill" />
            <rect x="10" y="42" width="44" height="10" rx="4" className="bmm-icon-stroke" />
            <path d="M18 32c6-8 22-8 28 0" className="bmm-icon-stroke" />
          </svg>
        );

      case "resp":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <path d="M18 20c0-6 6-10 14-10s14 4 14 10v8l-4 4v8H22v-8l-4-4v-8z" className="bmm-icon-fill" />
            <path d="M18 20c0-6 6-10 14-10s14 4 14 10v8l-4 4v8H22v-8l-4-4v-8z" className="bmm-icon-stroke" />
          </svg>
        );

      default:
        return null;
    }
  }

  return (
    <section className="bmm-services-section" ref={rootRef} aria-labelledby="bmm-services-title">
      <div className="bmm-services-inner">
        <div className="bmm-services-head">
          <h2 id="bmm-services-title" className="bmm-services-title">
            OUR <span>SERVICES</span>
          </h2>
          <p className="bmm-services-sub">AT YOUR HOME</p>
        </div>

        <div className="bmm-services-grid" role="list">
          {services.map((s, i) => {
            const target = s.link || null;
            return (
              <article
                key={s.key}
                role="listitem"
                className="bmm-service-card"
                data-key={s.key}
                style={{ ["--i"]: i }}
                aria-label={`${s.title} — ${s.subtitle}`}
              >
                <a href={target || "#"} className="bmm-service-link" aria-label={`${s.title} — ${s.subtitle}`}>
                  <div className="bmm-service-icon" aria-hidden>
                    <div className="bmm-icon-circle bmm-icon-glass">
  <Icon name={s.icon} />
</div>

                  </div>

      <div className="bmm-service-body">
  <h3 className="bmm-service-title">{s.title}</h3>
  <div className="bmm-service-subtitle">{s.subtitle}</div>

  <div className="bmm-service-actions">
    <div className="bmm-service-cta">know more →</div>

    <button
      className="bmm-enquire-btn"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openWhatsApp(s.title);
      }}
    >
      Enquiry Now
    </button>
  </div>
</div>


                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
