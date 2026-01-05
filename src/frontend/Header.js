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

const NAV_ITEMS = [
  { id: "home", label: "Home", route: "/" },
  { id: "services", label: "Services" },
  { id: "blogs", label: "Blogs", route: "/blogs" },
  { id: "providers", label: "Providers", route: "/our-team" },
  { id: "contact", label: "Contact" },
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

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState("home");
  const firstMobileLinkRef = useRef(null);
  const headerRef = useRef(null);

  /* ================= SET ACTIVE ON LOAD ================= */
  useEffect(() => {
    const path = window.location.pathname || "/";
    const hash = window.location.hash.replace("#", "");

    if (path === "/" && hash) setActiveId(hash);
    else if (path === "/") setActiveId("home");
    else if (path.startsWith("/blogs")) setActiveId("blogs");
    else if (path.startsWith("/our-team")) setActiveId("providers");
  }, []);

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
    const isOnLanding = window.location.pathname === "/";

    // Scroll-only items
    if (!item.route) {
      if (!isOnLanding) {
        window.location.href = `/#${item.id}`;
        return;
      }
      scrollToSection(item.id);
      return;
    }

    // Route items
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
            <li key={item.id} role="none">
              <a
                role="menuitem"
                href={item.route ? item.route : `#${item.id}`}
                className={activeId === item.id ? "active" : ""}
                aria-current={activeId === item.id ? "page" : undefined}
                onClick={(e) => handleNavClick(e, item)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        {/* RIGHT ACTIONS */}
        <div className="rightActions">
          <a href="/#contact" className="btn-primary">
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
          <a href="/#contact" className="btn-primary">
            Talk to Specialist
          </a>
        </div>
      </div>
    </header>
  );
}
