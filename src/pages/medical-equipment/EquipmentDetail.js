import { useParams, Link } from "react-router-dom";
import { EQUIPMENT_DETAILS } from "./data";
import "./MedicalEquipment.css";

export default function EquipmentDetail() {
  const { slug } = useParams();
  const detail = EQUIPMENT_DETAILS[slug];

  if (!detail) {
    return <div style={{ padding: 60, textAlign: "center" }}>Not Found</div>;
  }

  return (
    <div className="me-page">
      {/* HERO */}
      <section className="me-detail-hero" data-aos="fade-down">
        <h1>{detail.title}</h1>
        <div className="me-breadcrumb">
          <Link to="/">Home</Link> /{" "}
          <Link to="/medical-equipment">Medical Equipment</Link> /{" "}
          <span>{detail.title}</span>
        </div>
      </section>

      {/* INTRO (BOOKMYMEDICARE STYLE) */}
      <section className="me-intro">
        <div className="me-intro-inner">
          <div className="me-intro-content" data-aos="fade-right">
            <h1 className="me-intro-title">{detail.title}</h1>

            <h3 className="me-intro-subtitle">
              {detail.subtitle}
            </h3>

            <p className="me-intro-text">{detail.intro}</p>

            <ul className="me-intro-list">
              {detail.introPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>

            <div className="me-intro-quote">
              {detail.highlight}
            </div>
          </div>

          <div className="me-intro-image" data-aos="fade-left">
            <img src={detail.image} alt={detail.title} />
          </div>
        </div>
      </section>

      {/* USAGE */}
      <section className="me-section" data-aos="fade-up">
        <h2>Usage of {detail.title}</h2>
        <ul>
          {detail.useCases.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </section>

      {/* KEY FEATURES */}
      <section className="me-section" data-aos="fade-up">
        <h2>Key Features</h2>
        <ul className="me-feature-list">
          {detail.keyFeatures.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </section>

      {/* KEY BENEFITS */}
      <section className="me-section">
        <h2 data-aos="fade-up">Key Benefits</h2>
        <div className="me-benefits">
          {detail.keyBenefits.map((b, i) => (
            <div
              key={i}
              className="me-benefit-card"
              data-aos="zoom-in"
              data-aos-delay={i * 120}
            >
              <h4>{b.title}</h4>
              <p>{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="me-section" data-aos="fade-up">
        <h2>How It Works</h2>
        <ul>
          {detail.howItWorks.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </section>

      {/* SUMMARY */}
      <section className="me-summary" data-aos="fade-up">
        <h2>Summary</h2>
        <p>{detail.summary}</p>
      </section>

      {/* CTA */}
      <div className="me-cta" data-aos="zoom-in">
        <button className="me-btn">Contact Us</button>
      </div>
    </div>
  );
}
