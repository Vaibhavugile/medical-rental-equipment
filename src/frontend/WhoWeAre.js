import React, { useEffect, useRef } from "react";
import "./WhoWeAre.css";

export default function WhoWeAre({ imgSrc = "/who-image.jpg", id = "who-we-are" }) {
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
    <section id={id} className="who" ref={sectionRef}>
      <div className="who-inner">

        {/* LEFT IMAGE */}
        <div className="who-media">
          <img src={imgSrc} alt="Professional caregiver assisting patient at home" />
        </div>

        {/* RIGHT CONTENT */}
        <div className="who-content">
          <h2 className="who-title">
            WHO <span>WE ARE</span>
          </h2>

          <ul className="who-list">
            <li>
              Created to make quality home healthcare simple, accessible, and
              stress-free for every family.
            </li>
            <li>
              A trusted provider of nursing, elderly care, physiotherapy,
              palliative and critical care at home.
            </li>
            <li>
              Backed by certified nurses, caregivers, physiotherapists, and
              trained medical staff.
            </li>
            <li>
              Chosen by thousands for compassionate, reliable, and affordable
              healthcare at their doorstep.
            </li>
          </ul>
        </div>

      </div>
    </section>
  );
}
