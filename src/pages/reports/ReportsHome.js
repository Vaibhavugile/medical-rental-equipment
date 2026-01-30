import React from "react";
import { useNavigate } from "react-router-dom";
import "./ReportsHome.css";

export default function ReportsHome() {
  const navigate = useNavigate();

  return (
    <div className="reports-home">
      <h1>📊 Reports</h1>
      <p className="muted">
        Business insights across products, finances, and assets
      </p>

      <div className="reports-grid">
        {/* Product Report */}
        <ReportCard
          icon="📦"
          title="Product Report"
          description="Revenue, quantity, and order performance by product"
          onClick={() => navigate("/crm/reports/products")}
        />

        {/* Financial Report */}
        <ReportCard
          icon="💰"
          title="Financial Report"
          description="Revenue, payments, taxes, and outstanding analysis"
          onClick={() => navigate("/crm/reports/financial")}
        />

        {/* Asset Report */}
        <ReportCard
          icon="🏗"
          title="Asset Report"
          description="Asset utilization, revenue attribution, and downtime"
          onClick={() => navigate("/crm/reports/assets")}
        />
      </div>
    </div>
  );
}

/* ---------- Card Component ---------- */

function ReportCard({ icon, title, description, onClick }) {
  return (
    <div className="report-card" onClick={onClick}>
      <div className="report-icon">{icon}</div>
      <div className="report-title">{title}</div>
      <div className="report-desc">{description}</div>
      <div className="report-link">View report →</div>
    </div>
  );
}
