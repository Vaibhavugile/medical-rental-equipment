import { useParams, Link } from "react-router-dom";
import { EQUIPMENT_DETAILS } from "./data";
import "./MedicalEquipment.css";
import Header from "../../frontend/Header";
import TopBar from "../../frontend/TopBar";
import WhyChooseUsUnique from "../../frontend/WhyChooseUsUnique";
import HeroWithForm from "../../frontend/HeroWithForm";
import ReviewsSection from "../../frontend/ReviewsSection";
import Footer from "../../frontend/Footer";

export default function EquipmentDetail() {
  const { slug } = useParams();
  const detail = EQUIPMENT_DETAILS[slug];

  if (!detail) {
    return (
      <div className="me-not-found">
        <h2>Equipment Not Found</h2>
        <Link to="/equipment" className="me-btn">
          Back to Equipment
        </Link>
      </div>
    );
  }

  return (
    
    <div className="me-page">
       <TopBar />
              <Header />
      {/* HERO */}
      <section className="me-detail-hero" data-aos="fade-down">
        <div className="me-hero-inner">
          <h1>{detail.title}</h1>
          <div className="me-breadcrumb">
            <Link to="/">Home</Link> /{" "}
            <Link to="/equipment">Medical Equipment</Link> /{" "}
            <span>{detail.title}</span>
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section className="me-intro">
        <div className="me-intro-inner">
          <div className="me-intro-content" data-aos="fade-right">
            {/* NOTE: h2 instead of h1 to avoid repetition */}
            <h2 className="me-intro-title">{detail.title}</h2>

            <h3 className="me-intro-subtitle">
              {detail.subtitle}
            </h3>

            <p className="me-intro-text">
              {detail.intro}
            </p>

            {detail.introPoints && detail.introPoints.length > 0 && (
              <ul className="me-intro-list">
                {detail.introPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}

            {detail.highlight && (
              <div className="me-intro-quote">
                {detail.highlight}
              </div>
            )}
          </div>

          <div className="me-intro-image" data-aos="fade-left">
            <img
              src={detail.image}
              alt={detail.title}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* USAGE */}
      {detail.useCases && detail.useCases.length > 0 && (
        <section className="me-section" data-aos="fade-up">
          <h2>Usage of {detail.title}</h2>
          <div className="me-usage-grid">
            {detail.useCases.map((u, i) => (
              <div key={i} className="me-usage-item">
                {u}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* KEY FEATURES */}
      {detail.keyFeatures && detail.keyFeatures.length > 0 && (
        <section className="me-section" data-aos="fade-up">
          <h2>Key Features</h2>
          <ul className="me-feature-list">
            {detail.keyFeatures.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      {/* KEY BENEFITS */}
      {detail.keyBenefits && detail.keyBenefits.length > 0 && (
        <section className="me-section">
          <h2 data-aos="fade-up">Key Benefits</h2>
          <div className="me-benefits">
            {detail.keyBenefits.map((b, i) => (
              <div
                key={i}
                className="me-benefit-card"
                data-aos="zoom-in"
                data-aos-delay={i * 100}
              >
                <h4>{b.title}</h4>
                <p>{b.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      {detail.howItWorks && detail.howItWorks.length > 0 && (
        <section className="me-section" data-aos="fade-up">
          <h2>How It Works</h2>
          <ul className="me-steps">
            {detail.howItWorks.map((s, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* SUMMARY */}
      {detail.summary && (
        <section className="me-summary" data-aos="fade-up">
          <h2>Summary</h2>
          <p>{detail.summary}</p>
        </section>
      )}

      {/* CTA */}
      <WhyChooseUsUnique />
           <HeroWithForm />
                      
           <ReviewsSection  autoplay={true} autoplayDelay={3500} />
           <Footer />
    </div>
  );
}
