import React, { useEffect, useRef, useState } from "react";
import "./Header.css";

/**
 * Header.jsx
 *
 * - Desktop nav scroll-to-section behavior preserved
 * - If a nav item has `route`, the click navigates to that route (desktop + mobile)
 * - No react-router dependency required (uses window.location.href fallback)
 * - Mobile menu accessible, trap-focus-ish behavior (basic)
 */

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "services", label: "Services" },
  { id: "blogs", label: "Blogs", route: "/blogs" }, // ✅ NEW
  { id: "providers", label: "Providers", route: "/our-team" },
  { id: "contact", label: "Contact" },
];


function MenuIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
function CloseIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export default function Header({ logo = "BookMyMedicare" }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState("home");
  const firstMobileLinkRef = useRef(null);
  const headerRef = useRef(null);

  // On mount, set active based on current path (so /our-team highlights Providers)
 useEffect(() => {
  const path = window.location.pathname || "/";

  if (path.startsWith("/our-team")) {
    setActiveId("providers");
  } else if (path.startsWith("/blogs")) {
    setActiveId("blogs"); // ✅ highlight Blogs
  }
}, []);


  // Close mobile menu on resize > breakpoint, or on Escape key
  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 900 && mobileOpen) setMobileOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // Trap focus into mobile menu when open (simple)
  useEffect(() => {
    if (mobileOpen) {
      // focus first link after menu opens
      setTimeout(() => firstMobileLinkRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // IntersectionObserver to set active link based on sections in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id");
            if (id) {
              // only set active for items that exist in NAV_ITEMS (hash-based)
              const found = NAV_ITEMS.find((n) => n.id === id);
              if (found) setActiveId(id);
            }
          }
        });
      },
      { root: null, rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    );

    NAV_ITEMS.forEach((it) => {
      // only observe sections that exist on this page (hash sections)
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });

    // also observe booking if present (for CTA strong state)
    const bookingEl = document.getElementById("booking");
    if (bookingEl) observer.observe(bookingEl);

    return () => observer.disconnect();
  }, []);

  // Toggle .strong class on CTA reliably (for visual emphasis)
  useEffect(() => {
    const btn = document.querySelector(".btn-primary");
    if (!btn) return;
    // Customize which sections make the CTA stronger:
    const strongWhen = new Set(["booking", "home"]);
    if (strongWhen.has(activeId)) btn.classList.add("strong");
    else btn.classList.remove("strong");
  }, [activeId]);

  // Smooth scroll handler for nav links that use section ids
  function handleNavClick(e, item) {
    // item is the nav object { id, label, route? }
    if (item.route) {
      // route present: navigate to route instead of scrolling
      e.preventDefault();
      // Use full navigation so it works with/without react-router
      window.location.href = item.route;
      // close mobile menu if open
      setMobileOpen(false);
      return;
    }

    // Otherwise, smooth-scroll to hash-section
    e.preventDefault();
    setActiveId(item.id); // immediate visual feedback
    const el = document.getElementById(item.id);
    if (!el) {
      // fallback: navigate to hash
      window.location.hash = item.id;
      setMobileOpen(false);
      return;
    }
    const headerOffset = headerRef.current?.offsetHeight || 0;
    const elTop = el.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({ top: elTop - headerOffset - 12, behavior: "smooth" });
    setMobileOpen(false);
  }

  return (
    <header className="header" role="banner" ref={headerRef}>
      <nav className="nav" role="navigation" aria-label="Primary">
        <div className="logo" tabIndex={0}>{logo}</div>

        {/* Desktop nav */}
        <ul className="navLinks" role="menubar" aria-label="Main">
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
                <span className="underline" aria-hidden></span>
              </a>
            </li>
          ))}
        </ul>

        {/* Right actions */}
        <div className="rightActions">
          <a
            href="#booking"
            className="btn-primary"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("booking");
              if (el) {
                const headerOffset = headerRef.current?.offsetHeight || 0;
                const elTop = el.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({ top: elTop - headerOffset - 12, behavior: "smooth" });
              } else {
                window.location.hash = "booking";
              }
            }}
          >
            Call Us Now
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

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`mobileMenu ${mobileOpen ? "open" : "closed"}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileOpen}
      >
        <div className="mobileMenuInner" role="document">
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
              href="#booking"
              className="btn-primary"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById("booking");
                if (el) {
                  const headerOffset = headerRef.current?.offsetHeight || 0;
                  const elTop = el.getBoundingClientRect().top + window.pageYOffset;
                  window.scrollTo({ top: elTop - headerOffset - 12, behavior: "smooth" });
                } else {
                  window.location.hash = "booking";
                }
                setMobileOpen(false);
              }}
            >
              Call Us Now
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
