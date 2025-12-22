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

export default function ServicesSection() {
  const rootRef = useRef(null);

  // Add `link` to each object to make it navigable
  const services = [
    { key: "equip", title: "Medical Equipment", subtitle: "on Rental / Purchase", icon: "equip", link: "/equipment" },
    { key: "icu", title: "ICU Setup", subtitle: "critical bed & monitoring", icon: "icu", link: "/icu" },
    { key: "post", title: "Post Surgery Care", subtitle: "recovery at home", icon: "post", link: "/post-surgery-care" },
    { key: "pall", title: "Palliative Care", subtitle: "elderly & comfort care", icon: "pall", link: "/palliative-care" },
    { key: "ambulance", title: "Ambulance Services", subtitle: "24/7 transport", icon: "ambulance", link: "/ambulance" },
    { key: "lab", title: "Lab Services", subtitle: "home sample collection", icon: "lab", link: "/lab-services" },
    { key: "pharmacy", title: "Pharmacy Delivery", subtitle: "medicines at doorstep", icon: "pharmacy", link: "/pharmacy-delivery" },
    { key: "nursing", title: "Nursing Care", subtitle: "trained medical staff", icon: "nursing", link: "/nursing-care" },
    { key: "physio", title: "Physiotherapy Support", subtitle: "rehab & exercises", icon: "physio", link: "/physiotherapy" },
    { key: "resp", title: "Respiratory Care", subtitle: "oxygen & ventilator support", icon: "resp", link: "/respiratory-care" },
  ];

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
    const blue = "var(--bmm-blue)"; // main blue
    const blueGrad1 = "var(--bmm-blue-grad-1)"; // gradient start
    const blueGrad2 = "var(--bmm-blue-grad-2)"; // gradient end

    switch (name) {
      case "equip":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gEquipB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad1} />
                <stop offset="1" stopColor={blueGrad2} />
              </linearGradient>
            </defs>
            <rect x="8" y="16" width="48" height="32" rx="6" fill="url(#gEquipB)" />
            <path d="M18 28h28" stroke={blue} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M22 36h20" stroke={blue} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        );
      case "icu":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gIcuB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad1} />
                <stop offset="1" stopColor={blueGrad2} />
              </linearGradient>
            </defs>
            <rect x="8" y="12" width="48" height="28" rx="5" fill="url(#gIcuB)" />
            <path d="M20 22h24M20 28h24" stroke={blue} strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="46" cy="18" r="2.6" fill="#fff" />
          </svg>
        );
      case "post":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gPostB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad2} />
                <stop offset="1" stopColor={blueGrad1} />
              </linearGradient>
            </defs>
            <path d="M12 16l18-8 18 8v28a4 4 0 01-4 4H16a4 4 0 01-4-4V16z" fill="url(#gPostB)" />
            <path d="M28 30v10M32 34h-8" stroke={blue} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        );
      case "pall":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gPallB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad1} />
                <stop offset="1" stopColor={blue} />
              </linearGradient>
            </defs>
            <path d="M32 8c7 0 12 6 12 12 0 10-12 18-12 18s-12-8-12-18c0-6 5-12 12-12z" fill="url(#gPallB)" />
            <path d="M24 36s4 4 8 4 8-4 8-4" stroke={blue} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
      case "ambulance":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gAmbB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad1} />
                <stop offset="1" stopColor={blueGrad2} />
              </linearGradient>
            </defs>
            <rect x="6" y="18" width="42" height="22" rx="3" fill="url(#gAmbB)" />
            <rect x="44" y="24" width="10" height="10" rx="2" fill="#fff" />
            <circle cx="18" cy="44" r="3.4" fill={blue} />
            <circle cx="36" cy="44" r="3.4" fill={blue} />
            <path d="M20 26v6M28 26h6" stroke={blue} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
      case "lab":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gLabB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad1} />
                <stop offset="1" stopColor={blueGrad2} />
              </linearGradient>
            </defs>
            <path d="M18 10h28l-6 20v12H24V30L18 10z" fill="url(#gLabB)" />
            <path d="M28 28h8" stroke={blue} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
      case "pharmacy":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gPhB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad1} />
                <stop offset="1" stopColor={blueGrad2} />
              </linearGradient>
            </defs>
            <rect x="14" y="8" width="36" height="40" rx="8" fill="url(#gPhB)" />
            <path d="M22 24h20M32 18v20" stroke={blue} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        );
      case "nursing":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gNurB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad1} />
                <stop offset="1" stopColor={blue} />
              </linearGradient>
            </defs>
            <circle cx="32" cy="18" r="8" fill="url(#gNurB)" />
            <path d="M12 46a20 20 0 0140 0" fill="none" stroke={blue} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        );
      case "physio":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gPhyB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad2} />
                <stop offset="1" stopColor={blueGrad1} />
              </linearGradient>
            </defs>
            <path d="M10 42h44v6a4 4 0 01-4 4H14a4 4 0 01-4-4v-6z" fill="url(#gPhyB)" />
            <path d="M18 30c6-8 22-8 28 0" stroke={blue} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
      case "resp":
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <defs>
              <linearGradient id="gRespB" x1="0" x2="1">
                <stop offset="0" stopColor={blueGrad1} />
                <stop offset="1" stopColor={blueGrad2} />
              </linearGradient>
            </defs>
            <path d="M12 18c0-6 6-10 12-10s12 4 12 10v8l-4 4v6H16v-6l-4-4V18z" fill="url(#gRespB)" />
            <path d="M24 36h16" stroke={blue} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 64 64" className="bmm-svg-icon" aria-hidden>
            <circle cx="32" cy="32" r="20" fill={blue} />
          </svg>
        );
    }
  }

  /**
   * navigateTo(url)
   * - Uses react-router v6 `useNavigate` if present (uncomment and import above),
   *   otherwise falls back to window.location.href for full-page navigation.
   *
   * If you use react-router and prefer client-side routing, uncomment the two lines:
   *   import { useNavigate } from "react-router-dom";
   *   const navigate = useNavigate();
   *
   * Then replace the fallback with: navigate(url);
   */
  function navigateTo(url) {
    if (!url) return;
    // If your app uses react-router and you uncommented useNavigate(), use that:
    // navigate(url);

    // Fallback: full page navigation
    window.location.href = url;
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
                {/* Accessible clickable area: anchor so it works with middle-click / ctrl+click */}
                <a
                  href={target || "#"}
                  onClick={(ev) => {
                    if (!target) {
                      // prevent navigation if no link is provided
                      ev.preventDefault();
                      return;
                    }
                    // For SPA routing replace with navigateTo(target) and prevent default
                    // Example (react-router): ev.preventDefault(); navigate(target);
                    // We'll allow native navigation (href) by default for SEO & middle-clicks.
                  }}
                  className="bmm-service-link"
                  onKeyDown={(e) => {
                    if (!target) return;
                    if (e.key === "Enter" || e.key === " ") {
                      // allow keyboard activation; if SPA nav needed, preventDefault and use navigateTo
                      // e.preventDefault();
                      // navigateTo(target);
                    }
                  }}
                  aria-label={`${s.title} — ${s.subtitle}`}
                >
                  <div className="bmm-service-icon" aria-hidden>
                    <div className="bmm-icon-circle">
                      <Icon name={s.icon} />
                    </div>
                  </div>

                  <div className="bmm-service-body">
                    <h3 className="bmm-service-title">{s.title}</h3>
                    <div className="bmm-service-subtitle">{s.subtitle}</div>
                    <div className="bmm-service-cta">know more →</div>
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
