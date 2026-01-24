import React from "react";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="bmm-footer" role="contentinfo">
      <div className="bmm-footer-inner">

        {/* Top */}
        <div className="bmm-footer-top">
          <div className="bmm-brand">
            <div className="bmm-brand-name">BookMyMediCare</div>
            <p className="bmm-brand-sub">
              Trusted home healthcare services — ICU, nursing & medical care at your doorstep.
            </p>
          </div>

          <div className="bmm-contact">
            <a href="tel:+918080310240">📞 +91 7777066885</a>
            <a href="tel:+917777066885">📞 +91 7400244335</a>
            <a href="mailto:bookmymedicare@gmail.com">
              ✉ bookmymedicare@gmail.com
            </a>
          </div>
        </div>

        {/* Links */}
        <div className="bmm-footer-links">
          <a href="/">Home</a>
          <a href="/icu">ICU at Home</a>
          <a href="/nursing">Nursing Care</a>
          <a href="/physiotherapy">Physiotherapy</a>
          <a href="/ambulance">Ambulance</a>
          <a href="/our-team">Our Team</a>
        </div>

        {/* Bottom */}
        <div className="bmm-footer-bottom">
          <span>
            © {new Date().getFullYear()} BookMyMedicCare. All rights reserved.
          </span>
          <div className="bmm-legal">
            <a href="/privacy">Privacy</a>
            <span>•</span>
            <a href="/terms">Terms</a>
          </div>
           <div className="bmm-powered">
    Powered by{" "}
    <a
      href="https://syteos.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      Syteos Labs LLP
    </a>
  </div>
        </div>
      </div>
    </footer>
  );
}
