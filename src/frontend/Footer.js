import React, { useState } from "react";
import "./Footer.css";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // null | "sending" | "ok" | "err"

  const submitNewsletter = async (e) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("err");
      setTimeout(() => setStatus(null), 2200);
      return;
    }
    setStatus("sending");
    // Simulate request — replace with real API call
    setTimeout(() => {
      setStatus("ok");
      setEmail("");
      setTimeout(() => setStatus(null), 3000);
    }, 900);
  };

  const readAll = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  return (
    <footer className="bmm-footer" role="contentinfo">
      <div className="bmm-footer-inner">

        {/* Top: brand + CTA */}
        <div className="bmm-footer-top">
          <div className="bmm-brand-block" aria-hidden>
            <div className="bmm-logo-mark" title="BookMyMedicare">
              {/* simple SVG mark, replace with your logo img if available */}
              <svg width="44" height="44" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <circle cx="24" cy="24" r="22" fill="#0C2340" />
                <path d="M14 30c6-8 20-8 24 0" stroke="#de7a2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>

            <div>
              <div className="bmm-brand-name">BookMyMedicare</div>
              <p className="bmm-brand-sub">Trusted home healthcare — compassionate, reliable care at your doorstep.</p>
            </div>
          </div>

          <div className="bmm-footer-cta">
            <div className="bmm-cta-title">Need help now?</div>
            <a className="bmm-cta-phone" href="tel:+918080310240" aria-label="Call BookMyMedicare">
              📞 +91 8080310240
            </a>
            <a className="bmm-cta-phone bmm-cta-phone-2" href="tel:+917777066885" aria-label="Call BookMyMedicare">
              📞 +91 7777066885
            </a>
            <a className="bmm-cta-email" href="mailto:bookmymedicare@gmail.com">bookmymedicare@gmail.com</a>
          </div>
        </div>

        {/* Middle: columns */}
        <div className="bmm-footer-grid">

          <div className="bmm-col bmm-col-links" aria-labelledby="f-links">
            <h4 id="f-links" className="bmm-col-title">Quick links</h4>
            <ul className="bmm-links-list">
              <li><a href="/#home">Home</a></li>
              <li><a href="/#services">Services</a></li>
              <li><a href="/#providers">Providers</a></li>
              <li><a href="/#about">About</a></li>
              <li><a href="/#contact">Contact</a></li>
            </ul>
          </div>

          <div className="bmm-col bmm-col-services" aria-labelledby="f-services">
            <h4 id="f-services" className="bmm-col-title">Our Services</h4>
            <ul className="bmm-links-list">
              <li><a href="/icu">ICU Setup</a></li>
              <li><a href="/nursing">Nursing Care</a></li>
              <li><a href="/physiotherapy">Physiotherapy</a></li>
              <li><a href="/ambulance">Ambulance Services</a></li>
              <li><a href="/equipment">Medical Equipment</a></li>
            </ul>
          </div>

          <div className="bmm-col bmm-col-contact" aria-labelledby="f-contact">
            <h4 id="f-contact" className="bmm-col-title">Contact & Address</h4>
            <address className="bmm-address">
              Shop No 10, Sun & Moon Building<br />
              Near XYZ Landmark, Pune, Maharashtra<br />
              <a href="https://goo.gl/maps/" target="_blank" rel="noreferrer">Get directions →</a>
            </address>

            <div className="bmm-social-row" aria-label="Social links">
              <a href="#" className="bmm-social" aria-label="Facebook" title="Facebook" rel="noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#0C2340" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M22 12.07C22 6.48 17.52 2 11.93 2S2 6.48 2 12.07c0 4.99 3.66 9.13 8.43 9.93v-7.03H8.07v-2.9h2.36V9.7c0-2.33 1.38-3.62 3.49-3.62 1.01 0 2.06.18 2.06.18v2.27h-1.16c-1.14 0-1.5.71-1.5 1.44v1.74h2.56l-.41 2.9h-2.15V22C18.34 21.2 22 17.06 22 12.07z"/>
                </svg>
              </a>

              <a href="#" className="bmm-social" aria-label="Twitter" title="Twitter" rel="noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#0C2340" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M22 5.92c-.63.28-1.3.48-2 .57a3.48 3.48 0 0 0-6 2.38c0 .27.03.53.09.78C7.72 9.8 5.08 7.8 3 5.04c-.3.51-.48 1.1-.48 1.73 0 1.2.61 2.26 1.55 2.88-.56 0-1.1-.17-1.57-.43v.04c0 1.66 1.18 3.05 2.74 3.36a3.6 3.6 0 0 1-1.56.06c.44 1.36 1.72 2.36 3.24 2.39A7.26 7.26 0 0 1 2 19.54a10.22 10.22 0 0 0 5.53 1.62c6.63 0 10.26-5.5 10.26-10.27v-.47c.7-.5 1.3-1.12 1.8-1.82a7.7 7.7 0 0 1-2.77.76z"/>
                </svg>
              </a>

              <a href="#" className="bmm-social" aria-label="Instagram" title="Instagram" rel="noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#0C2340" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.2a4 4 0 1 0 0 7.999A4 4 0 0 0 12 8.2zm4.5-.9a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                </svg>
              </a>
            </div>
          </div>

          <div className="bmm-col bmm-col-news" aria-labelledby="f-news">
            <h4 id="f-news" className="bmm-col-title">Stay informed</h4>
            <p className="bmm-news-sub">Subscribe for updates, service alerts and tips.</p>

            <form className="bmm-news-form" onSubmit={submitNewsletter} onReset={() => setEmail("")}>
              <label className="bmm-sr" htmlFor="bmm-news-email">Email address</label>
              <div className="bmm-news-input-row">
                <input
                  id="bmm-news-email"
                  className="bmm-input"
                  type="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email address"
                />
                <button type="submit" className="bmm-news-btn" aria-live="polite">
                  {status === "sending" ? "Sending..." : "Subscribe"}
                </button>
              </div>

              <div className={`bmm-news-status ${status === "ok" ? "ok" : status === "err" ? "err" : ""}`} role="status" aria-live="polite">
                {status === "ok" && "Thanks — subscribed!"}
                {status === "err" && "Please enter a valid email."}
              </div>
            </form>
          </div>
        </div>

        {/* Bottom: legal */}
        <div className="bmm-footer-bottom">
          <div className="bmm-legal">
            <span>© {new Date().getFullYear()} BookMyMedicare. All rights reserved.</span>
            <span className="bmm-sep">•</span>
            <a href="/privacy">Privacy Policy</a>
            <span className="bmm-sep">•</span>
            <a href="/terms">Terms & Conditions</a>
          </div>

          <div className="bmm-made">
            <span>Made with care • <strong>BookMyMedicare</strong></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
