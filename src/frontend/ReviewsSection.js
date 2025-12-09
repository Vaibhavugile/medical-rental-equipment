import React, { useEffect, useRef, useState } from "react";
import "./ReviewsSection.css";

/*
  ReviewsSection
  Props:
   - reviews: optional array of review objects:
       { id, name, avatar (url or initials), rating (1-5), text, date }
   - autoplay: boolean (default true)
   - autoplayDelay: ms (default 3500)
*/
export default function ReviewsSection({
  reviews,
  autoplay = true,
  autoplayDelay = 3500,
}) {
  // fallback example reviews (replace or pass real data)
  const sample = [
    {
      id: 1,
      name: "Shankar Nalawade",
      avatar: "SN",
      rating: 5,
      text: `Nice person good communication with him — very humble and kind hearted person`,
      date: "Jan 2025",
    },
    {
      id: 2,
      name: "Udaybhan Singh",
      avatar:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80&auto=format&fit=crop",
      rating: 5,
      text: `Good company and experience to all staff`,
      date: "Feb 2025",
    },
    {
      id: 3,
      name: "Anas Khan",
      avatar: "AK",
      rating: 5,
      text: `Excellent Healthcare services at home`,
      date: "Mar 2025",
    },
    {
      id: 4,
      name: "Dinesh",
      avatar:
        "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=200&q=80&auto=format&fit=crop",
      rating: 5,
      text: `Really helpful staff and timely service.`,
      date: "Apr 2025",
    },
    {
      id: 5,
      name: "Priya",
      avatar: "P",
      rating: 5,
      text: `Highly recommended — professional & compassionate.`,
      date: "May 2025",
    },
  ];

  const items = reviews && reviews.length ? reviews : sample;

  const containerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const autoplayRef = useRef(null);
  const isHovered = useRef(false);
  const scrollTimer = useRef(null);

  // keep indexRef in sync
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // move to index with smooth scroll
  const goTo = (i) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const card = container.children[i];
    if (!card) return;
    const padLeft = parseFloat(getComputedStyle(container).paddingLeft || 0);
    const left = card.offsetLeft - padLeft;
    container.scrollTo({ left, behavior: "smooth" });
    setIndex(i);
  };

  // next/prev (wrap)
  const next = () => {
    const nextIndex = (indexRef.current + 1) % items.length;
    goTo(nextIndex);
  };
  const prev = () => {
    const prevIndex = (indexRef.current - 1 + items.length) % items.length;
    goTo(prevIndex);
  };

  // stable autoplay: single interval that reads indexRef
  useEffect(() => {
    if (!autoplay || items.length <= 1) return;
    // clear any existing
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }

    autoplayRef.current = setInterval(() => {
      if (isHovered.current) return;
      const nextIndex = (indexRef.current + 1) % items.length;
      // directly call goTo so scroll animation happens
      goTo(nextIndex);
    }, Math.max(1200, autoplayDelay));

    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, autoplayDelay, items.length]);

  // keep index in sync when user scrolls manually (optimized)
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    let raf = null;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const scrollLeft = c.scrollLeft;
        let closestIndex = 0;
        let minDist = Infinity;
        for (let i = 0; i < c.children.length; i++) {
          const child = c.children[i];
          const dist = Math.abs(child.offsetLeft - scrollLeft);
          if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
          }
        }
        setIndex(closestIndex);
      });
    };

    c.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      c.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // pause on hover (both container and arrows/dots)
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onEnter = () => (isHovered.current = true);
    const onLeave = () => (isHovered.current = false);
    c.addEventListener("mouseenter", onEnter);
    c.addEventListener("mouseleave", onLeave);
    return () => {
      c.removeEventListener("mouseenter", onEnter);
      c.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // keyboard accessibility: left/right arrows
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // helper for "read all reviews" (open page bottom etc.)
  const readAll = () => {
    // example: scroll to bottom or open a reviews modal
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  return (
    <section className="bmm-reviews" aria-label="Patient reviews">
      <div className="bmm-reviews-inner">
        <header className="bmm-reviews-header">
          <h2 className="bmm-title">What Our Patients Have To Say</h2>
          <p className="bmm-sub">Trusted by families — real feedback from our patients</p>
        </header>

        <div className="bmm-score-row">
          <div className="bmm-score-card">
            <div className="bmm-score-left">
              <div className="bmm-score-number">4.7</div>
              <div className="bmm-stars" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="star" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <path fill="#FFCC33" d="M12 .587l3.09 6.26L22 8.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 13.14 2 8.27l6.91-1.42z"/>
                  </svg>
                ))}
              </div>
              <div className="bmm-score-sub">Based on {items.length * 5 - 3} reviews</div>
            </div>

            <div className="bmm-score-action">
              <button className="bmm-btn-ghost" onClick={readAll} aria-label="Read all reviews">
                ★ Read all reviews
              </button>
            </div>
          </div>
        </div>

        <div className="bmm-carousel-wrap">
          <button
            className="bmm-arrow bmm-arrow-left"
            onClick={prev}
            aria-label="Previous reviews"
            >
            ‹
          </button>

          <div
            className="bmm-carousel"
            ref={containerRef}
            role="list"
            aria-live="polite"
            tabIndex={0}
          >
            {items.map((r, i) => (
              <article key={r.id || i} className={`bmm-card${i === index ? " active" : ""}`} role="listitem" aria-label={`Review by ${r.name}`}>
                <div className="bmm-card-top">
                  <div className="bmm-avatar" aria-hidden>
                    {r.avatar && typeof r.avatar === "string" && r.avatar.startsWith("http") ? (
                      <img src={r.avatar} alt={r.name} />
                    ) : (
                      <span className="bmm-initials" aria-hidden>{r.avatar || r.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span>
                    )}
                  </div>
                  <div className="bmm-card-meta">
                    <div className="bmm-name">{r.name}</div>
                    <div className="bmm-rating" aria-hidden>
                      {Array.from({ length: 5 }).map((_, si) => (
                        <svg key={si} className={`star ${si < r.rating ? "on" : ""}`} viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                          <path fill={si < r.rating ? "#FFCC33" : "#e8e8e8"} d="M12 .587l3.09 6.26L22 8.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 13.14 2 8.27l6.91-1.42z"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>

                <blockquote className="bmm-text">“{r.text}”</blockquote>

                <div className="bmm-card-footer">
                  <span className="bmm-date">{r.date}</span>
                </div>
              </article>
            ))}
          </div>

          <button
            className="bmm-arrow bmm-arrow-right"
            onClick={next}
            aria-label="Next reviews"
            >
            ›
          </button>
        </div>

        <div className="bmm-dots" role="tablist">
          {items.map((_, i) => (
            <button
              key={i}
              className={`bmm-dot ${i === index ? "active" : ""}`}
              onClick={() => goTo(i)}
              aria-selected={i === index}
              aria-label={`Go to review ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
