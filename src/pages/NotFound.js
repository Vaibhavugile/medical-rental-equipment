import React from "react";
import { useNavigate } from "react-router-dom";
import "./NotFound.css";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="notfound-page">
      <div className="notfound-container">
        <div className="notfound-code">404</div>

        <h1 className="notfound-title">Page Not Found</h1>

        <p className="notfound-text">
          Oops! The page you’re looking for doesn’t exist or may have been moved.
        </p>

        <div className="notfound-actions">
          <button className="notfound-btn" onClick={() => navigate("/")}>
            Go to Home
          </button>

          <button
            className="notfound-btn ghost"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
