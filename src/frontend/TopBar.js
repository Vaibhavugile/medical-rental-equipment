import React from "react";
import "./TopBar.css";

export default function TopBar() {
  return (
    <div className="topbar" role="region" aria-label="Top support bar">
      <div className="topbar-inner">

        {/* Left Side */}
        <div className="left">
          <span className="welcome">
            Welcome to <strong>BookMyMedicare</strong>
          </span>

          <div className="contact-row">
            {/* Phone 1 */}
            <a
              className="contact-item"
              href="tel:+918080310240"
              aria-label="Call BookMyMedicare at 8080310240"
            >
              <span className="icon icon-phone" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M3 5.5C3 5.5 6 4 9.5 7.5C13 11 11.5 14 11.5 14L8.5 17C10 18.5 12 20.5 15.5 23C19 25.5 21 24 21 24C21 24 20 20 16.5 16.5C13 13 9.5 11.5 6 12C4.5 12.3 3 12 3 12"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="contact-text">+91 8080310240</span>
            </a>

            {/* Phone 2 */}
            <a
              className="contact-item"
              href="tel:+917777066885"
              aria-label="Call BookMyMedicare at 7777066885"
            >
              <span className="icon icon-phone" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M3 5.5C3 5.5 6 4 9.5 7.5C13 11 11.5 14 11.5 14L8.5 17C10 18.5 12 20.5 15.5 23C19 25.5 21 24 21 24C21 24 20 20 16.5 16.5C13 13 9.5 11.5 6 12C4.5 12.3 3 12 3 12"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="contact-text">+91 7777066885</span>
            </a>

            {/* Email */}
            <a
              className="contact-item"
              href="mailto:bookmymedicare@gmail.com"
              aria-label="Email BookMyMedicare"
            >
              <span className="icon icon-mail" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M3 6.5h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 6.5L12 13 3 6.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="contact-text">bookmymedicare@gmail.com</span>
            </a>
          </div>
        </div>

        {/* Right Side - 24/7 Support Badge */}
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
