import React, { useEffect, useRef, useState } from "react";
import "./Header.css";

/**
 * Header.jsx
 *
 * - Desktop nav scroll-to-section behavior preserved
 * - Cross-page section navigation supported
 * - Logo image instead of text
 * - Mobile menu improved
 * - No react-router dependency
 */

const BASE_NAV_ITEMS = [
  { id: "home", label: "Home", route: "/" },
  { id: "services", label: "Services", dropdown: true },
  { id: "blogs", label: "Blogs", route: "/blogs" },
  { id: "providers", label: "Providers", route: "/our-team" },
  { id: "contact", label: "Contact" },
];

const LANDING_ONLY_ITEMS = [
  { id: "about-us", label: "About" },
  { id: "reviews", label: "Reviews" },
];


function MenuIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 6h18M3 12h18M3 18h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6l12 12M6 18L18 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
const SERVICES_LIST = [
  { label: "Medical Equipment", link: "/equipment" },
  { label: "ICU Setup", link: "/icu" },
  { label: "Post Surgery Care", link: "/post-surgery-care" },
  { label: "Palliative Care", link: "/palliative-care" },
  { label: "Ambulance Services", link: "/ambulance" },
  { label: "Lab Services", link: "/lab-services" },
  { label: "Pharmacy Delivery", link: "/pharmacy-delivery" },
  { label: "Nursing Care", link: "/nursing-care" },
  { label: "Physiotherapy", link: "/physiotherapy" },
  { label: "Respiratory Care", link: "/respiratory-care" },
];


export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState("home");
  const firstMobileLinkRef = useRef(null);
  const headerRef = useRef(null);
const [servicesOpen, setServicesOpen] = useState(false);
const isLandingPage = window.location.pathname === "/landing";

useEffect(() => {
  function close() {
    setServicesOpen(false);
  }
  window.addEventListener("click", close);
  return () => window.removeEventListener("click", close);
}, []);
const WHATSAPP_NUMBER = "917777066885"; // country code + number
const WHATSAPP_LINK =
  "https://wa.me/917777066885?text=Hi%20BookMyMedicare%2C%20I%20need%20home%20healthcare%20assistance.";

  /* ================= SET ACTIVE ON LOAD ================= */
  useEffect(() => {
    const path = window.location.pathname || "/";
    const hash = window.location.hash.replace("#", "");

    if (path === "/" && hash) setActiveId(hash);
    else if (path === "/") setActiveId("home");
    else if (path.startsWith("/blogs")) setActiveId("blogs");
    else if (path.startsWith("/our-team")) setActiveId("providers");
  }, []);
const NAV_ITEMS = isLandingPage
  ? [
      { id: "home", label: "Home", route: "/" },
      { id: "about-us", label: "About" },
      { id: "services", label: "Services", dropdown: true },
      { id: "reviews", label: "Reviews" },
      { id: "blogs", label: "Blogs", route: "/blogs" },
      { id: "providers", label: "Providers", route: "/our-team" },
      { id: "contact", label: "Contact" },
    ]
  : BASE_NAV_ITEMS;

  /* ================= CLOSE MOBILE MENU ================= */
  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 900 && mobileOpen) setMobileOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  /* ================= LOCK BODY SCROLL ================= */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    if (mobileOpen) {
      setTimeout(() => firstMobileLinkRef.current?.focus(), 80);
    }
    return () => (document.body.style.overflow = "");
  }, [mobileOpen]);

  /* ================= OBSERVE SECTIONS ================= */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (NAV_ITEMS.some((n) => n.id === id)) {
              setActiveId(id);
            }
          }
        });
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );

    NAV_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  /* ================= SCROLL HELPERS ================= */
  function scrollToSection(id) {
    setActiveId(id);
    const el = document.getElementById(id);

    if (!el) {
      window.location.hash = id;
      setMobileOpen(false);
      return;
    }

    const offset = headerRef.current?.offsetHeight || 0;
    const top = el.getBoundingClientRect().top + window.pageYOffset;

    window.scrollTo({
      top: top - offset - 12,
      behavior: "smooth",
    });

    setMobileOpen(false);
  }

  function handleNavClick(e, item) {
  e.preventDefault();

  // Scroll-only items (About, Reviews, Contact, etc.)
  if (!item.route) {
    const el = document.getElementById(item.id);

    // If section exists on CURRENT page → smooth scroll
    if (el) {
      const offset = headerRef.current?.offsetHeight || 0;
      const top = el.getBoundingClientRect().top + window.pageYOffset;

      window.scrollTo({
        top: top - offset - 12,
        behavior: "smooth",
      });

      setMobileOpen(false);
      return;
    }

    // If section NOT present → stay on same page, just update hash
    window.location.hash = item.id;
    setMobileOpen(false);
    return;
  }

  // Route-based navigation
  window.location.href = item.route;
}


  /* ================= RENDER ================= */
  return (
    <header className="header" ref={headerRef} role="banner">
      <nav className="nav" role="navigation" aria-label="Primary">

        {/* LOGO */}
        <a href="/" className="logo" aria-label="BookMyMedicare Home">
          <img src="/logo.png" alt="BookMyMedicare" />
        </a>

        {/* DESKTOP NAV */}
     <ul className="navLinks" role="menubar">
  {NAV_ITEMS.map((item) => (
    <li
      key={item.id}
      role="none"
      style={{ position: "relative" }}
    >
      {/* NORMAL LINKS */}
      {!item.dropdown && (
        <a
          role="menuitem"
          href={item.route ? item.route : `#${item.id}`}
          className={activeId === item.id ? "active" : ""}
          onClick={(e) => handleNavClick(e, item)}
        >
          {item.label}
        </a>
      )}

      {/* SERVICES MEGA DROPDOWN */}
      {item.dropdown && (
        <div
          className="servicesHoverWrap"
          onMouseEnter={() => setServicesOpen(true)}
          onMouseLeave={() => setServicesOpen(false)}
        >
          <button
            type="button"
            className="navServicesBtn"
            aria-haspopup="true"
            aria-expanded={servicesOpen}
          >
            {item.label} ▾
          </button>

          {servicesOpen && (
            <div className="servicesDropdown">
              <div className="servicesDropdownTitle">
                Home Healthcare Services
              </div>

              {SERVICES_LIST.map((s) => (
                <a key={s.link} href={s.link}>
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  ))}
</ul>


        {/* RIGHT ACTIONS */}
        <div className="rightActions">
        <a
  href={WHATSAPP_LINK}
  className="btn-primary"
  target="_blank"
  rel="noopener noreferrer"
>
  Talk to Specialist
</a>


          <button
            className="mobileToggle"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((s) => !s)}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      <div
        id="mobile-menu"
        className={`mobileMenu ${mobileOpen ? "open" : "closed"}`}
        role="dialog"
        aria-modal="true"
      >
        {NAV_ITEMS.map((item, idx) => (
          <a
            key={item.id}
            href={item.route ? item.route : `#${item.id}`}
            onClick={(e) => handleNavClick(e, item)}
            ref={idx === 0 ? firstMobileLinkRef : undefined}
          >
            {item.label}
          </a>
        ))}

        <div className="mobileMenuCTA">
          <a
  href={WHATSAPP_LINK}
  className="btn-primary"
  target="_blank"
  rel="noopener noreferrer"
>
  Talk to Specialist
</a>

        </div>
      </div>
    </header>
  );
}
