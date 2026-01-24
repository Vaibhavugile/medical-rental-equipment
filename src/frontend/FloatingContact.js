import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { faPhone } from "@fortawesome/free-solid-svg-icons";
import "./FloatingContact.css";

const FloatingContact = () => {
  const phone = "917777066885";
  const message = "Hello BookMyMedicare, I would like to enquire about your services.";

  return (
    <div className="bmm-float">
      {/* WhatsApp */}
      <a
        href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bmm-float-icon whatsapp"
        aria-label="WhatsApp"
      >
        <FontAwesomeIcon icon={faWhatsapp} />
      </a>

      {/* Call */}
      <a
        href="tel:+917777066885"
        className="bmm-float-icon call"
        aria-label="Call"
      >
        <FontAwesomeIcon icon={faPhone} />
      </a>
    </div>
  );
};

export default FloatingContact;
