import { useNavigate } from "react-router-dom";
import { EQUIPMENT_DETAILS } from "./data";
import "./MedicalEquipment.css";

export default function EquipmentList() {
  const navigate = useNavigate();

  // Convert object → array for listing
  const equipmentList = Object.entries(EQUIPMENT_DETAILS).map(
    ([slug, data]) => ({
      slug,
      name: data.title,
      image: data.image,
      shortDesc: data.intro,
    })
  );

  return (
    <div className="me-page">
      {/* HERO */}
      <section className="me-hero">
        <h1>Our Medical Equipment</h1>
        <p>
          High-quality medical equipment available for rental
          and purchase.
        </p>
      </section>

      {/* GRID */}
      <section className="me-grid">
        {equipmentList.map((eq) => (
          <div
            key={eq.slug}
            className="me-card"
            onClick={() =>
              navigate(`/equipment/${eq.slug}`)
            }
          >
            <img src={eq.image} alt={eq.name} />
            <h3>{eq.name}</h3>
            <p>{eq.shortDesc}</p>

            <button
              className="me-btn"
              onClick={(e) => {
                e.stopPropagation(); // prevent double navigation
                navigate(`/equipment/${eq.slug}`);
              }}
            >
              Know More →
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
