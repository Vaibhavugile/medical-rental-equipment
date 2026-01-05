import { useNavigate } from "react-router-dom";
import { EQUIPMENT_DETAILS } from "./data";
import "./MedicalEquipment.css";
import Header from "../../frontend/Header";
import TopBar from "../../frontend/TopBar";
import WhyChooseUsUnique from "../../frontend/WhyChooseUsUnique";
import HeroWithForm from "../../frontend/HeroWithForm";
import ReviewsSection from "../../frontend/ReviewsSection";
import Footer from "../../frontend/Footer";
export default function EquipmentList() {
  const navigate = useNavigate();

  // Convert object → array for listing (SHORT DESCRIPTION ONLY)
  const equipmentList = Object.entries(EQUIPMENT_DETAILS).map(
    ([slug, data]) => ({
      slug,
      name: data.title,
      image: data.image,
      shortDesc: data.intro
        ? data.intro.slice(0, 90) + "..."
        : "",
    })
  );

  return (
    <div className="me-page">
       <TopBar />
        <Header />
      {/* ===============================
          HERO – BOOKMYMEDICARE STYLE
      =============================== */}
      <section className="me-hero-alt">
        <div className="me-hero-alt-inner">
          {/* LEFT IMAGE */}
          <div className="me-hero-alt-img">
            <img
              src="/medical.jpg"
              alt="Medical Equipment on Rental and Purchase"
            />
          </div>

          {/* RIGHT CONTENT */}
          <div className="me-hero-alt-content">
            <span className="me-hero-tag">Services</span>

            <h1>
              Medical Equipment on <br />
              Rental / Purchase
            </h1>

            <p>
              We use the latest and most advanced medical equipment.
              Providing reliable solutions for hospitals, homecare,
              and rehabilitation needs.
            </p>

            <button className="me-btn">
              Get a Callback
            </button>
          </div>
        </div>
      </section>

      {/* ===============================
          EQUIPMENT GRID
      =============================== */}
      <section className="me-grid">
        {equipmentList.map((eq) => (
          <article
            key={eq.slug}
            className="me-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/equipment/${eq.slug}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigate(`/equipment/${eq.slug}`);
              }
            }}
          >
            {/* IMAGE */}
            <div className="me-card-img">
              <img
                src={eq.image}
                alt={eq.name}
                loading="lazy"
              />
            </div>

            {/* CONTENT */}
            <div className="me-card-body">
              <h3>{eq.name}</h3>
              <p>{eq.shortDesc}</p>
            </div>

            {/* ACTION */}
            <div className="me-card-action">
              <button
                className="me-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/equipment/${eq.slug}`);
                }}
              >
                Know More →
              </button>
            </div>
          </article>
        ))}
      </section>
      <WhyChooseUsUnique />
      <HeroWithForm />
                 
      <ReviewsSection  autoplay={true} autoplayDelay={3500} />
      <Footer />
    </div>
  );
}
