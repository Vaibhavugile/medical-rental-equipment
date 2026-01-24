import React from "react";
import "./TopBar.css";

export default function TopBar() {
  return (
    <div className="topbar" role="region" aria-label="Top support bar">
      <div className="topbar-inner">

        {/* Left Side */}
        <div className="left">
          <span className="welcome hide-mobile">
            Welcome to <strong>BookMyMedicare</strong>
          </span>

          <div className="contact-row">
            {/* Primary Call (always visible) */}
            <a
              className="contact-item primary-call"
              href="tel:+917777066885"
              aria-label="Call BookMyMedicare at 7777066885 "
            >
              <span className="icon icon-phone" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M3 5.5C3 5.5 6 4 9.5 7.5C13 11 11.5 14 11.5 14L8.5 17C10 18.5 12 20.5 15.5 23C19 25.5 21 24 21 24"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="contact-text">Call Now</span>
            </a>

            {/* Secondary Phone (desktop only) */}
            <a
              className="contact-item "
              href="tel:+917777066885"
              aria-label="Call BookMyMedicare at 7777066885"
            >
              <span className="contact-text">+91 7777066885</span>
            </a>
             <a
              className="contact-item hide-mobile"
              href="tel:+917400244335"
              aria-label="Call BookMyMedicare at 7400244335"
            >
              <span className="contact-text">+91 7400244335</span>
            </a>

            {/* Email (desktop only) */}
            <a
              className="contact-item hide-mobile"
              href="mailto:bookmymedicare@gmail.com"
              aria-label="Email BookMyMedicare"
            >
              <span className="contact-text">bookmymedicare@gmail.com</span>
            </a>
          </div>
        </div>

        {/* Right Side */}
        <div className="right">
          <span className="badge">
            <span className="pulse"></span>
            24/7 Support
          </span>
        </div>

      </div>
    </div>
  );
}
