import React, { useEffect, useRef, useState } from "react";
import "./StatsBar.css";

const StatItem = ({ icon, end, suffix, title }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // start animation only when visible
        if (entry.isIntersecting && !started.current) {
          started.current = true;

          const duration = 1800;
          const startTime = performance.now();

          const animate = (time) => {
            const progress = Math.min((time - startTime) / duration, 1);
            const value = Math.floor(progress * end);

            setCount(value);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setCount(end);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      {
        threshold: 0.6, // start when 60% visible
      }
    );

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, [end]);

  return (
    <div className="stat-item" ref={ref}>
      <div className="icon-wrapper">
        <i className={`fa-solid ${icon}`} />
      </div>

      <div className="stat-text">
        <h2>
          {count}
          {suffix}
        </h2>
        <p>{title}</p>
      </div>
    </div>
  );
};

const StatsBar = () => {
  return (
    <section className="stats-section">
      <div className="stats-bar">

        <StatItem
          icon="fa-heart-pulse"
          end={99}
          suffix="%"
          title="Customer Satisfaction Achieved By Us"
        />

        <StatItem
          icon="fa-user-doctor"
          end={20}
          suffix="+"
          title="Experienced Medical Specialists"
        />

        <StatItem
          icon="fa-stethoscope"
          end={12}
          suffix=""
          title="Highly Specialized Physiotherapists"
        />

      </div>
    </section>
  );
};

export default StatsBar;