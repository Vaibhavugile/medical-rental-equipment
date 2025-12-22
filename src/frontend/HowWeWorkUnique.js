import React, { useEffect, useRef } from "react";
import "./HowWeWorkUnique.css";

export default function HowWeWorkUnique({
  id = "how-we-work",
  imgSrc = "/how-image.jpg",
  bullets = [
    "A proper and complete clinical assessment of each patient by our medical team.",
    "Daily monitoring of patients as per BookMyMedicare protocol with documentation.",
    "Continuous supervision by experienced medical nursing supervisors.",
    "Daily patient status updates shared with the respective consultants."
  ]
}) {
  const sectionRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id={id} className="how" ref={sectionRef}>
      <div className="how-inner">

        {/* LEFT CONTENT */}
        <div className="how-content">
          <h2 className="how-title">
            HOW <span>WE WORK</span>
          </h2>

          <ul className="how-list">
            {bullets.map((text, idx) => (
              <li key={idx}>
                <span className="how-icon">{idx + 1}</span>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT IMAGE */}
        <div className="how-media">
          <img src={imgSrc} alt="Medical professionals providing patient care" />
        </div>

      </div>
    </section>
  );
}
