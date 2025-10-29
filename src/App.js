// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";

import Leads from "./pages/Leads";
import Requirements from "./pages/Requirements";
import Quotations from "./pages/Quotations";
import Branches from "./pages/Branches";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Drivers from "./pages/Drivers";
import DriverApp from "./pages/DriverApp";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

import useAuth from "./pages/useAuth";
import { auth } from "./firebase";
import "./App.css";

function HeaderRight() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate("/login");
    } catch (err) {
      console.error("Signout error", err);
      alert("Signout failed");
    }
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {user ? (
        <>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700 }}>{userProfile?.name || user.email}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {userProfile?.role || "user"}
            </div>
          </div>
          <button className="cp-btn ghost" onClick={handleSignOut}>
            Sign Out
          </button>
        </>
      ) : (
        <>
          <NavLink
            to="/login"
            style={{ color: "#0b5cff", fontWeight: 700, textDecoration: "none" }}
          >
            Login
          </NavLink>
          <NavLink
            to="/signup"
            style={{ color: "#0b5cff", fontWeight: 700, textDecoration: "none" }}
          >
            Signup
          </NavLink>
        </>
      )}
    </div>
  );
}

function CRMApp() {
  return (
    <>
      <header
        style={{
          borderBottom: "1px solid rgba(15,23,42,0.04)",
          background: "#fff",
          padding: "12px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0b5cff" }}>
              MedRent CRM
            </div>

            <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <NavLink
                to="/"
                end
                style={({ isActive }) => ({
                  padding: "8px 10px",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: isActive ? "#fff" : "#0b5cff",
                  background: isActive
                    ? "linear-gradient(90deg,#0b69ff,#00b4d8)"
                    : "transparent",
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
                  background: isActive
                    ? "linear-gradient(90deg,#0b69ff,#00b4d8)"
                    : "transparent",
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
                  background: isActive
                    ? "linear-gradient(90deg,#0b69ff,#00b4d8)"
                    : "transparent",
                  fontWeight: 700,
                })}
              >
                Quotations
              </NavLink>

              <NavLink
                to="/orders"
                style={({ isActive }) => ({
                  padding: "8px 10px",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: isActive ? "#fff" : "#0b5cff",
                  background: isActive
                    ? "linear-gradient(90deg,#0b69ff,#00b4d8)"
                    : "transparent",
                  fontWeight: 700,
                })}
              >
                Orders
              </NavLink>

              <NavLink
                to="/drivers"
                style={({ isActive }) => ({
                  padding: "8px 10px",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: isActive ? "#fff" : "#0b5cff",
                  background: isActive
                    ? "linear-gradient(90deg,#0b69ff,#00b4d8)"
                    : "transparent",
                  fontWeight: 700,
                })}
              >
                Drivers
              </NavLink>

              <NavLink
                to="/branches"
                style={({ isActive }) => ({
                  padding: "8px 10px",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: isActive ? "#fff" : "#0b5cff",
                  background: isActive
                    ? "linear-gradient(90deg,#0b69ff,#00b4d8)"
                    : "transparent",
                  fontWeight: 700,
                })}
              >
                Branches
              </NavLink>

              <NavLink
                to="/products"
                style={({ isActive }) => ({
                  padding: "8px 10px",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: isActive ? "#fff" : "#0b5cff",
                  background: isActive
                    ? "linear-gradient(90deg,#0b69ff,#00b4d8)"
                    : "transparent",
                  fontWeight: 700,
                })}
              >
                Products
              </NavLink>
            </nav>
          </div>

          <HeaderRight />
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Leads />} />
          <Route path="/requirements" element={<Requirements />} />
          <Route path="/quotations" element={<Quotations />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/products" element={<Products />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  const { user, userProfile, loading } = useAuth();

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  // ✅ If logged-in user is a driver → show only DriverApp
  if (user && userProfile?.role === "driver") {
    return (
      <BrowserRouter>
        <DriverApp />
      </BrowserRouter>
    );
  }

  // Otherwise, show CRM + auth routes
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/*" element={<CRMApp />} />
      </Routes>
    </BrowserRouter>
  );
}
