import React, { useEffect, useState } from "react";
import "./TrustedProviders1.css";

const CircleSlider = ({ images }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 1000);

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="circle">
      {images.map((img, i) => (
        <img
          key={i}
          src={img}
          alt="provider"
          className={i === index ? "active" : ""}
        />
      ))}
    </div>
  );
};

const TrustedProviders1 = () => {
  return (
    <>
      <h1 className="main-heading">
        <span>Our</span> Trusted <span>Providers</span>
      </h1>

      <div className="container">
        <div className="left-section">
          <CircleSlider
            images={[
              "/img1.jpeg",
              "/img2.jpg",
              "/img3.jpeg",
            ]}
          />

          <CircleSlider
            images={[
              "/img4.jpeg",
              "/img5.webp",
              "/img3.jpeg",
            ]}
          />
        </div>

        <div className="content-box">
          <h2>
            <span>Our Trusted</span> Providers
          </h2>
          <p>
            We work with carefully selected providers who meet our quality,
            reliability, and service standards. Through continuous evaluation
            and quality checks, we ensure our partners deliver professional,
            dependable, and customer-focused services.
          </p>
        </div>
      </div>
    </>
  );
};

export default TrustedProviders1;