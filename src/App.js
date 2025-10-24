// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Leads from "./pages/Leads";
import Requirements from "./pages/Requirements";
import "./App.css"; // optional: add global styles if you have them
import Quotations from "./pages/Quotations";
export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#f5f8fb" }}>
        <header style={{ borderBottom: "1px solid rgba(15,23,42,0.04)", background: "#fff", padding: "12px 20px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0b5cff" }}>Your Company</div>
              <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <NavLink
                  to="/"
                  end
                  style={({ isActive }) => ({
                    padding: "8px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: isActive ? "#fff" : "#0b5cff",
                    background: isActive ? "linear-gradient(90deg,#0b69ff,#00b4d8)" : "transparent",
                    fontWeight: 700,
                  })}
                >
                  Leads
                </NavLink>

                <NavLink
                  to="/requirements"
                  style={({ isActive }) => ({
                    padding: "8px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: isActive ? "#fff" : "#0b5cff",
                    background: isActive ? "linear-gradient(90deg,#0b69ff,#00b4d8)" : "transparent",
                    fontWeight: 700,
                  })}
                >
                  Requirements
                </NavLink>

                <NavLink
                  to="/quotations"
                  style={({ isActive }) => ({
                    padding: "8px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: isActive ? "#fff" : "#0b5cff",
                    background: isActive ? "linear-gradient(90deg,#0b69ff,#00b4d8)" : "transparent",
                    fontWeight: 700,
                  })}
                >
                  Quotations
                </NavLink>
              </nav>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* optional user / actions */}
              <div style={{ color: "#6b7280", fontSize: 13 }}>Ops Portal</div>
            </div>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Leads />} />
            <Route path="/requirements" element={<Requirements />} />
            

            {/* Optional placeholder route for quotations if you plan to add a list */}
            <Route path="/quotations" element={<Quotations/> }/>

            <Route
              path="*"
              element={
                <div className="coupons-wrap">
                  <div className="coupons-card" style={{ padding: 28 }}>
                    <h2>Page not found</h2>
                    <p className="muted">The page you are looking for does not exist.</p>
                  </div>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
