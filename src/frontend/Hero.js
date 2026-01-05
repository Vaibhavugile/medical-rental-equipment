import React from "react";
import "./Hero.css";

export default function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-container">

        {/* LEFT CONTENT */}
        <div className="hero-left">
          <p className="hero-eyebrow">HOME HEALTHCARE SERVICES</p>

          <h1 className="hero-title">BOOKMYMEDICARE</h1>

          <p className="hero-subtitle">
            EVERYTIME, ANYWHERE AT YOUR SERVICE!
          </p>

          <div className="hero-pill">
            Homecare <strong>You Need And Deserve</strong> With Your Loved Ones
          </div>

          {/* CTA */}
          <a
            href="/#contact"
            className="hero-cta"
            onClick={(e) => {
              const isOnLanding = window.location.pathname === "/";
              if (isOnLanding) {
                e.preventDefault();

                const el = document.getElementById("contact");
                if (el) {
                  const header = document.querySelector("header");
                  const headerOffset = header?.offsetHeight || 0;
                  const elTop =
                    el.getBoundingClientRect().top + window.pageYOffset;

                  window.scrollTo({
                    top: elTop - headerOffset - 12,
                    behavior: "smooth",
                  });
                } else {
                  window.location.hash = "contact";
                }
              }
              // else → allow default navigation to /#contact
            }}
          >
            Request a Callback →
          </a>
        </div>

        {/* RIGHT IMAGE */}
        <div className="hero-right">
          <div className="hero-image-wrap">
            <img
              src="/hero-right.png"
              alt="Caregiver assisting an elderly patient"
              loading="eager"
            />
          </div>
        </div>

      </div>
    </section>
  );
}
