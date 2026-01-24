import React, { useEffect } from "react";
import "./EnquiryModal.css";

export default function EnquiryModal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;

    // lock background scroll
    document.body.style.overflow = "hidden";

    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onEsc);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="enq-backdrop" role="dialog" aria-modal="true">
      <div className="enq-modal">
        <button
          className="enq-close"
          onClick={onClose}
          aria-label="Close enquiry form"
        >
          ×
        </button>

        {children}
      </div>

      {/* click outside closes */}
      <div className="enq-clickaway" onClick={onClose} />
    </div>
  );
}
