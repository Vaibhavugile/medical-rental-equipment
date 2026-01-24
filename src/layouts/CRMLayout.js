// src/layouts/CRMLayout.js
import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import useAuth from "../pages/useAuth";

export default function CRMLayout() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await auth.signOut();
    navigate("/login");
  };

  return (
    <>
      {/* ================= HEADER ================= */}
      <header
        style={{
          borderBottom: "1px solid rgba(15,23,42,0.05)",
          background: "#fff",
          padding: "12px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <div style={{ fontWeight: 800, color: "#0b5cff" }}>
            MedRent CRM
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", gap: 10 }}>
            {[
              ["Leads", "leads"],
              ["Requirements", "requirements"],
              ["Quotations", "quotations"],
              ["Orders", "orders"],
              ["Inventory", "products"],
              ["Drivers", "drivers"],
              ["Marketing", "marketing"],
              ["Visits", "visits"],
              ["Reports", "reports"],
              ["Tracking", "tracking"],
            ].map(([label, path]) => (
              <NavLink
                key={path}
                to={`/crm/${path}`}
                style={({ isActive }) => ({
                  padding: "8px 10px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 700,
                  color: isActive ? "#fff" : "#0b5cff",
                  background: isActive
                    ? "linear-gradient(90deg,#0b69ff,#00b4d8)"
                    : "transparent",
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700 }}>
              {userProfile?.name || user?.email}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {userProfile?.role}
            </div>
            <button
              onClick={handleSignOut}
              style={{ marginTop: 4 }}
              className="cp-btn ghost"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ================= CONTENT ================= */}
      <main style={{ padding: 20 }}>
        <Outlet />
      </main>
    </>
  );
}
