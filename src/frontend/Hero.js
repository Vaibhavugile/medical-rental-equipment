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
            <span>
              Homecare <strong>You Need And Deserve</strong> With your Loved Ones
            </span>
          </div>

          <a href="#booking" className="hero-cta">
            Request a Callback →
          </a>
        </div>

        {/* RIGHT IMAGE */}
        <div className="hero-right">
          <div className="hero-image-wrap">
            <img
              src="/hero-right.png"
              alt="Caregiver assisting an elderly patient"
            />


           

            
          </div>
        </div>

      </div>
    </section>
  );
}
