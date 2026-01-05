// ServiceStepsAnimated.js
// Full merged React components: ServiceTwoCol (same DOM structure as earlier) + ServiceStepsAnimated (unchanged structure, premium styling).
// Import this file and the CSS above in your app.

import React, { useEffect, useRef } from "react";
import "./ServiceStepsAnimated.css";
import { scrollToContact } from "../utils/scrollToContact";

/* =========================
   ServiceTwoCol
   - Keeps your previous DOM structure and logic, only adds a reveal class for nicer animation.
   ========================= */
/* === Updated ServiceTwoCol (applies optional paddingTop prop) === */
export function ServiceTwoCol(props) {
  const {
    eyebrow = "Services",
    title = "Service Title",
    lead = "",
    paragraphs = [],
    bullets = [],
    img = "",
    imgAlt = "",
    imageOnRight = true,
ctaPrimary = {
  text: "Talk to a specialist",
  onClick: scrollToContact,
},

    // optional paddingTop value passed via props spread (e.g., from ICUPage.section1.paddingTop)
    paddingTop
  } = props;

  const sectionRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        el.classList.add("bmm-visible");
        io.disconnect();
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // apply inline style only if paddingTop is provided
  const sectionStyle = {};
  if (paddingTop) sectionStyle.paddingTop = paddingTop;

  return (
    <section className="bmm2-twocol" ref={sectionRef} aria-labelledby="bmm2-twocol-title" style={sectionStyle}>
      <div className={`bmm2-twocol-inner ${imageOnRight ? "" : "flip"}`}>
        {/* MEDIA side */}
        <div className="bmm2-media" aria-hidden>
          <div className="bmm2-media-card">
            {img ? (
              <img src={img} alt={imgAlt} className="bmm2-img" />
            ) : (
              <div style={{height: "240px", display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7e8c"}}>
                Image placeholder
              </div>
            )}
          </div>
        </div>

        {/* CONTENT side */}
        <div className="bmm2-content">
          <div className="bmm2-eyebrow">{eyebrow}</div>
          <h2 id="bmm2-twocol-title" className="bmm2-title">{title}</h2>
          <p className="bmm2-lead">{lead}</p>

          {paragraphs.map((p, i) => <p key={i} className="bmm2-par">{p}</p>)}

          {bullets && bullets.length > 0 && (
            <ul className="bmm2-list" aria-label="List">
              {bullets.map((b, idx) => (
                <li key={idx} className="bmm2-list-item">
                  <span className="bmm2-bullet">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="bmm2-cta">
            <button className="bmm2-btn" onClick={ctaPrimary.onClick}>{ctaPrimary.text}</button>
          </div>
        </div>
      </div>
    </section>
  );
}


/* =========================
   ServiceStepsAnimated
   - Preserves your earlier structure and behavior (badges anchored to cards, reveal)
   - No SVG glows (removed earlier per your request)
   ========================= */
export function ServiceStepsAnimated({
  title = "How BookMyMedicare Team Works",
  subtitle = "Clinical + technical workflow to bring hospital-grade ICU care to your home.",
  steps = [
    { title: "Medical assessment of patient", text: "Medical assessment of patient by doctor to understand patient need at home." },
    { title: "Technical home survey", text: "Technical Team visit patient residence to understand the requirement at home for installing the medical equipment." },
    { title: "Installation & testing", text: "Installation of required medical equipment at patient residence and running trials." },
    { title: "Shift & stabilize", text: "Shift patient to home under supervision and stabilize with treatment plan." },
    { title: "Daily monitoring & follow-up", text: "Virtual monitoring daily and on-demand physical visits for treatment planning." },
  ],
}) {
  const rootRef = useRef(null);

  // Reveal cards when section enters viewport
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const cards = root.querySelectorAll(".bmm2-card-vertical");
        cards.forEach((c, idx) => setTimeout(() => c.setAttribute("data-visible", "true"), idx * 110 + 120));
        io.disconnect();
      }
    }, { threshold: 0.12 });
    io.observe(root);
    return () => io.disconnect();
  }, [steps.length]);

  // Position badges anchored to each card's top-center. Robust to resizes.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const badges = Array.from(root.querySelectorAll(".bmm2-badge-vertical"));
    const cards = Array.from(root.querySelectorAll(".bmm2-card-vertical"));

    function positionBadges() {
      const containerRect = root.getBoundingClientRect();
      badges.forEach((b, i) => {
        const card = cards[i];
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const anchorX = rect.left + rect.width / 2;
        const anchorY = rect.top + rect.height * 0.12; // slightly above top center
        const left = Math.round(anchorX - containerRect.left);
        const top = Math.round(anchorY - containerRect.top);
        b.style.left = `${left}px`;
        b.style.top = `${top}px`;
        b.setAttribute("aria-label", `Step ${i + 1}: ${steps[i] && steps[i].title ? steps[i].title : "Step"}`);
      });
    }

    const ro = new ResizeObserver(positionBadges);
    ro.observe(root);
    const cardsArr = root.querySelectorAll(".bmm2-card-vertical");
    cardsArr.forEach((c) => ro.observe(c));
    window.addEventListener("resize", positionBadges);
    const t = setTimeout(positionBadges, 60);

    return () => { ro.disconnect(); window.removeEventListener("resize", positionBadges); clearTimeout(t); };
  }, [steps]);

  return (
    <section className="bmm2-steps-vertical" aria-labelledby="bmm2-steps-title">
      <div className="bmm2-steps-inner-vertical" ref={rootRef}>
        <header className="bmm2-steps-header">
          <h2 id="bmm2-steps-title" className="bmm2-steps-title">{title}</h2>
          {subtitle && <p className="bmm2-steps-sub">{subtitle}</p>}
        </header>

        <div className="bmm2-timeline-vertical" role="region" aria-label={`${title} timeline`}>
          {/* badges (positioned by JS) */}
          {steps.map((s, i) => (
            <button
              key={`badge-${i}`}
              className="bmm2-badge-vertical"
              aria-describedby={`step-${i}-title`}
              tabIndex={0}
              title={s.title}
              onClick={() => {
                const el = document.getElementById(`step-card-${i}`);
                if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); }
              }}
            >
              <span className="bmm2-badge-num">{i + 1}</span>
            </button>
          ))}

          <ol className="bmm2-steps-list-vertical" role="list">
            {steps.map((s, i) => {
              const alignLeft = i % 2 === 0;
              return (
                <li key={i} className={`bmm2-step-vertical ${alignLeft ? "left" : "right"}`}>
                  <article id={`step-card-${i}`} className="bmm2-card-vertical" data-visible="false" tabIndex={-1} aria-labelledby={`step-${i}-title`} role="article">
                    <h3 id={`step-${i}-title`} className="bmm2-card-title">{s.title}</h3>
                    <p className="bmm2-card-text">{s.text}</p>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* Full page export (optional wrapper) */
export default function ServicePageFull({ section1, section2, stepsSection }) {
  return (
    <main className="bmm2-service-page">
      <ServiceTwoCol {...(section1 || {})} />
      <ServiceTwoCol {...(section2 || {})} />
      <ServiceStepsAnimated {...(stepsSection || {})} />
    </main>
  );
}
