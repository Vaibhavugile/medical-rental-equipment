import React, { useEffect, useRef } from "react";
import "./WhyChooseUsUnique.css";

/**
 * WhyChooseUsUnique (colorful icons + dynamic height)
 * All classnames are uniquely prefixed with `wcu-`
 */
export default function WhyChooseUsUnique({
  id = "why-choose-us",
  items = null
}) {
  const rootRef = useRef(null);

  const defaultItems = [
    { key: "team", title: "Skilled & Experience medical team", desc: "We have an dedicated and experienced medical team, ensuring proper and efficient patient care.", icon: "team" },
    { key: "protocol", title: "Robust Patient Protocol", desc: "A thorough patient evaluation and defined clinical pathway makes our clinical journey objective and patient centric.", icon: "protocol" },
    { key: "availability", title: "365*24/7 Availability", desc: "Our Dedicated team is always available for continuous patient care and support.", icon: "availability" },
    { key: "equipment", title: "Latest & High end Equipment", desc: "We serve our patients with latest and high end equipments for better outcomes.", icon: "equipment" },
    { key: "supply", title: "Strong Supply Chain", desc: "We have a strong supply team for timely equipment delivery.", icon: "supply" },
  ];

  const list = items && items.length ? items : defaultItems;

  // intersection reveal (uses unique selectors)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.classList.add("wcu-visible");
          const cards = Array.from(el.querySelectorAll(".wcu-card"));
          cards.forEach((c, i) => setTimeout(() => c.classList.add("wcu-card-visible"), i * 90));
          obs.disconnect();
        }
      });
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // dynamic equal height (ResizeObserver + responsive disable)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const applyHeights = () => {
      if (!root) return;
      const cards = Array.from(root.querySelectorAll(".wcu-card"));
      if (!cards.length) return;

      const smallScreen = window.innerWidth <= 720;
      if (smallScreen || prefersReduced) {
        cards.forEach(c => {
          c.style.height = "";
        });
        return;
      }

      cards.forEach(c => { c.style.height = ""; });

      let maxH = 0;
      cards.forEach(c => {
        const h = Math.ceil(c.scrollHeight);
        if (h > maxH) maxH = h;
      });

      const final = Math.max(maxH, 190);
      cards.forEach((c) => {
        c.style.height = final + "px";
      });
    };

    let resizeTimer = null;
    const onWindowResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => applyHeights(), 120);
    };

    const cards = Array.from(root.querySelectorAll(".wcu-card"));
    const roObservers = [];
    if ("ResizeObserver" in window) {
      cards.forEach((c) => {
        const ro = new ResizeObserver(() => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => applyHeights(), 90);
        });
        ro.observe(c);
        roObservers.push(ro);
      });
    } else {
      const imgs = root.querySelectorAll("img");
      imgs.forEach(img => img.addEventListener("load", applyHeights));
    }

    const initialTimer = setTimeout(applyHeights, 140);
    window.addEventListener("resize", onWindowResize);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onWindowResize);
      roObservers.forEach(ro => ro.disconnect());
      Array.from(root.querySelectorAll(".wcu-card")).forEach(c => c.style.height = "");
    };
  }, [rootRef]);

  // Colorful icons (filled + outline) — keep them crisp and lightweight
  function Icon({ name, size = 56 }) {
    if (name === "team") {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <defs>
            <linearGradient id="wcu-gTeam" x1="0" x2="1">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="1" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="22" r="10" fill="#fff" stroke="url(#wcu-gTeam)" strokeWidth="2.8" />
          <circle cx="44" cy="22" r="8" fill="#fff" stroke="#6ee7b7" strokeWidth="2.4" />
          <path d="M6 52c3-6 10-10 18-10s15 4 18 10" fill="#fff" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    if (name === "protocol") {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <defs>
            <linearGradient id="wcu-gProt" x1="0" x2="1">
              <stop offset="0" stopColor="#ffd8a8" />
              <stop offset="1" stopColor="#fb923c" />
            </linearGradient>
          </defs>
          <rect x="8" y="12" width="48" height="40" rx="6" fill="#fff" stroke="url(#wcu-gProt)" strokeWidth="2.6" />
          <path d="M20 26h8M36 26h8M20 36h8M36 36h8" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    if (name === "availability") {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="32" cy="32" r="22" fill="#fff" stroke="#60a5fa" strokeWidth="2.8"/>
          <path d="M32 20v10l8 4" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 32h3" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round"/>
        </svg>
      );
    }
    if (name === "equipment") {
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="10" y="16" width="44" height="28" rx="4" fill="#fff" stroke="#7c3aed" strokeWidth="2.6"/>
          <path d="M18 42v6h28v-6" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="48" cy="28" r="2.8" fill="#7c3aed"/>
        </svg>
      );
    }
    // supply
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <linearGradient id="wcu-gSup" x1="0" x2="1">
            <stop offset="0" stopColor="#6ee7b7" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
        </defs>
        <path d="M32 8l10 10-10 10-10-10 10-10z" fill="url(#wcu-gSup)" stroke="#064e3b" strokeWidth="1.6"/>
        <path d="M10 36v12a4 4 0 0 0 4 4h36a4 4 0 0 0 4-4V36" fill="#fff" stroke="#0f172a" strokeWidth="2"/>
      </svg>
    );
  }

  return (
    <section id={id} className="wcu-section" ref={rootRef} aria-labelledby="wcu-heading">
      <div className="wcu-inner">
        <h2 id="wcu-heading" className="wcu-title">
          WHY CHOOSE US
          <br />
          <span className="wcu-accent">FOR YOUR HEALTH</span>
        </h2>

        <div className="wcu-grid">
          {list.slice(0,3).map((it, idx) => (
            <article key={it.key || idx} data-icon={it.icon} className="wcu-card wcu-top-card" tabIndex={0} aria-label={it.title}>
              <div className="wcu-card-icon-left" aria-hidden>
                <div className={`wcu-icon-tile wcu-icon-${it.icon}`}>
                  <Icon name={it.icon} />
                </div>
              </div>

              <div className="wcu-card-body">
                <h3 className="wcu-card-title">{it.title}</h3>
                <p className="wcu-card-desc">{it.desc}</p>
              </div>
            </article>
          ))}

          {list.slice(3).map((it, idx) => (
            <article key={it.key || `b${idx}`} data-icon={it.icon} className="wcu-card wcu-wide-card" tabIndex={0} aria-label={it.title}>
              <div className="wcu-card-body wide-left">
                <h3 className="wcu-card-title">{it.title}</h3>
                <p className="wcu-card-desc">{it.desc}</p>
              </div>

              <div className="wcu-card-icon-right" aria-hidden>
                <div className={`wcu-icon-tile wcu-icon-${it.icon}`}>
                  <Icon name={it.icon} size={72} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
