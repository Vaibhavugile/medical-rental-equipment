// ServiceStepsAnimated.js
// Full merged React components: ServiceTwoCol + ServiceStepsAnimated.
// First service section title is automatically rendered as H1.
// All other service section titles remain H2.
// Step card titles remain H3.

import React, { useEffect, useRef } from "react";
import "./ServiceStepsAnimated.css";
import { scrollToContact } from "../utils/scrollToContact";

/* =========================
   ServiceTwoCol
   - Premium two-column section for service details.
   - Automatically stacks on mobile via CSS.
   - headingTag can be used to control H1/H2/H3.
   ========================= */
export function ServiceTwoCol(props) {
  const WHATSAPP_LINK =
    "https://wa.me/917777066885?text=Hi%20BookMyMedicare%2C%20I%20need%20home%20healthcare%20assistance.";

  const {
    eyebrow = "Services",
    title = "Service Title",

    // Default heading is H2.
    // ServicePageFull will override this to H1 for the first section.
    headingTag = "h2",

    lead = "",
    paragraphs = [],
    bullets = [],
    img = "",
    imgAlt = "",
    imageOnRight = true,

    ctaPrimary = {
      text: "Talk to Specialist",
      onClick: () => window.open(WHATSAPP_LINK, "_blank"),
    },

    paddingTop
  } = props;

  const sectionRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;

    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          el.classList.add("bmm-visible");
          io.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    io.observe(el);

    return () => io.disconnect();
  }, []);

  const sectionStyle = {};

  if (paddingTop) {
    sectionStyle.paddingTop = paddingTop;
  }

  // Dynamically select the heading element.
  // Example:
  // headingTag="h1" -> <h1>
  // headingTag="h2" -> <h2>
  const HeadingTag = headingTag;

  return (
    <section
      className="bmm2-twocol"
      ref={sectionRef}
      aria-labelledby="bmm2-twocol-title"
      style={sectionStyle}
    >
      <div
        className={`bmm2-twocol-inner ${
          imageOnRight ? "" : "flip"
        }`}
      >

        {/* =========================
            MEDIA SIDE
            ========================= */}
        <div
          className="bmm2-media"
          aria-hidden="true"
        >
          <div className="bmm2-media-card">

            {img ? (
              <img
                src={img}
                alt={imgAlt}
                className="bmm2-img"
              />
            ) : (
              <div
                style={{
                  height: "240px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7e8c"
                }}
              >
                Image placeholder
              </div>
            )}

          </div>
        </div>

        {/* =========================
            CONTENT SIDE
            ========================= */}
        <div className="bmm2-content">

          <div className="bmm2-eyebrow">
            {eyebrow}
          </div>

          {/* 
            Dynamic heading:
            First section = H1
            Other sections = H2
          */}
          <HeadingTag
            id="bmm2-twocol-title"
            className="bmm2-title"
          >
            {title}
          </HeadingTag>

          <p className="bmm2-lead">
            {lead}
          </p>

          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="bmm2-par"
            >
              {p}
            </p>
          ))}

          {bullets && bullets.length > 0 && (
            <ul
              className="bmm2-list"
              aria-label="Key features"
            >
              {bullets.map((b, idx) => (
                <li
                  key={idx}
                  className="bmm2-list-item"
                >
                  <span className="bmm2-bullet">
                    ✓
                  </span>

                  <span>
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="bmm2-cta">
            <button
              className="bmm2-btn"
              onClick={ctaPrimary.onClick}
            >
              {ctaPrimary.text}
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}


/* =========================
   ServiceStepsAnimated
   - Timeline/Process section.
   - Main title remains H2.
   - Step titles remain H3.
   ========================= */
export function ServiceStepsAnimated({
  title = "How BookMyMedicare Team Works",

  subtitle =
    "Clinical + technical workflow to bring hospital-grade ICU care to your home.",

  steps = [
    {
      title: "Medical assessment",
      text: "Medical assessment of patient by doctor to understand patient need at home."
    },
    {
      title: "Technical survey",
      text: "Technical Team visit patient residence to understand equipment installation requirements."
    },
    {
      title: "Installation",
      text: "Installation of required medical equipment at residence and running trials."
    },
    {
      title: "Shift & stabilize",
      text: "Shift patient home under supervision and stabilize with treatment plan."
    },
    {
      title: "Monitoring",
      text: "Virtual monitoring daily and on-demand physical visits for treatment planning."
    }
  ]
}) {
  const rootRef = useRef(null);

  // Reveal animation logic
  useEffect(() => {
    const root = rootRef.current;

    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {

          const cards = root.querySelectorAll(
            ".bmm2-card-vertical"
          );

          cards.forEach((c, idx) => {
            setTimeout(
              () =>
                c.setAttribute(
                  "data-visible",
                  "true"
                ),
              idx * 150
            );
          });

          io.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    io.observe(root);

    return () => io.disconnect();
  }, [steps.length]);

  return (
    <section
      className="bmm2-steps-vertical"
      aria-labelledby="bmm2-steps-title"
    >
      <div
        className="bmm2-steps-inner-vertical"
        ref={rootRef}
      >

        {/* =========================
            STEPS HEADER
            Remains H2
            ========================= */}
        <header className="bmm2-steps-header">

          <h2
            id="bmm2-steps-title"
            className="bmm2-steps-title"
          >
            {title}
          </h2>

          {subtitle && (
            <p className="bmm2-steps-sub">
              {subtitle}
            </p>
          )}

        </header>


        {/* =========================
            TIMELINE
            ========================= */}
        <div className="bmm2-timeline-vertical">

          <ol
            className="bmm2-steps-list-vertical"
            role="list"
          >

            {steps.map((s, i) => (

              <li
                key={i}
                className={`bmm2-step-vertical ${
                  i % 2 === 0
                    ? "left"
                    : "right"
                }`}
              >

                {/* Badge Number */}
                <div className="bmm2-badge-vertical">
                  <span className="bmm2-badge-num">
                    {i + 1}
                  </span>
                </div>


                {/* Step Card */}
                <article
                  id={`step-card-${i}`}
                  className="bmm2-card-vertical"
                  data-visible="false"
                  tabIndex="-1"
                >

                  {/* Step title remains H3 */}
                  <h3 className="bmm2-card-title">
                    {s.title}
                  </h3>

                  <p className="bmm2-card-text">
                    {s.text}
                  </p>

                </article>

              </li>

            ))}

          </ol>

        </div>

      </div>
    </section>
  );
}


/* =========================
   FULL PAGE EXPORT
   =========================
   
   IMPORTANT:
   The FIRST ServiceTwoCol automatically
   becomes H1.

   The SECOND ServiceTwoCol remains H2.

   ServiceStepsAnimated title remains H2.

   Therefore you do NOT need to modify
   every individual page.
   ========================= */
export default function ServicePageFull({
  section1,
  section2,
  stepsSection
}) {
  return (
    <main className="bmm2-service-page">

      {/* =========================
          FIRST SECTION → H1
          ========================= */}
      <ServiceTwoCol
        {...(section1 || {})}
        headingTag="h1"
      />


      {/* =========================
          SECOND SECTION → H2
          ========================= */}
      <ServiceTwoCol
        {...(section2 || {})}
        headingTag="h2"
      />


      {/* =========================
          STEPS SECTION → H2
          ========================= */}
      <ServiceStepsAnimated
        {...(stepsSection || {})}
      />

    </main>
  );
}