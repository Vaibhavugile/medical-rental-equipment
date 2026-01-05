// src/App.js
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Navigate,useLocation } from "react-router-dom";

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
import DriverAttendance from "./pages/DriverAttendance";
import Marketing from "./pages/Marketing";
import useAuth from "./pages/useAuth";
import { auth } from "./firebase";
import "./App.css";
import AttendanceAdmin from "./pages/AttendanceAdmin";
import Visits from "./pages/Visits";
import LandingPage from "./pages/LandingPage";
import ICUPage from "./pages/ICUPage";
import SurgeryPage from "./pages/SurgeryPage";
import PalliativePage from "./pages/PalliativePage";
import AmbulancePage from "./pages/AmbulancePage";
import DiagnosticPage from "./pages/DiagnosticPage";
import PharmacyPage from "./pages/PharmacyPage";
import NursingPage from "./pages/NursingPage";
import PhysiotherapyPage from "./pages/PhysiotherapyPage";
import RespiratoryPage from "./pages/RespiratoryPage";
import TeamPage from "./pages/TeamPage";
import BlogList from "./pages/BlogList";
import BlogDetail from "./pages/BlogDetail";
import AddBlog from "./pages/AddBlog";
import EquipmentList from "./pages/medical-equipment/EquipmentList";
import EquipmentDetail from "./pages/medical-equipment/EquipmentDetail";
import ProductReport from "./pages/reports/ProductReport";
import FinancialReport from "./pages/reports/FinancialReport";
import AssetsReport from "./pages/reports/AssetsReport";
import ReportsHome from "./pages/reports/ReportsHome";
import OutstandingOrdersReport from "./pages/reports/OutstandingOrdersReport";
const TrackingPage = lazy(() => import("./pages/TrackingPage"));

/* ---------------- Header for CRM ---------------- */
function HeaderRight() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate("/landing");
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
                to="/leads"
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
                Inventory
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
                Runners
              </NavLink>
               <NavLink
                to="/marketing"
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
                Marketing
              </NavLink>
              <NavLink
                to="/visits"
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
                Visits
              </NavLink>
                <NavLink
                to="/reports"
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
                Reports
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

              

              {/* Optional: quick links to driver views for admins/testing */}
              {/* <NavLink
                to="/driver-app"
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
                Driver App
              </NavLink> */}

              <NavLink
                to="/tracking"
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
                Tracking
              </NavLink>
             
              
            </nav>
          </div>

          <HeaderRight />
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/leads" element={<Leads />} />
          <Route path="/requirements" element={<Requirements />} />
          <Route path="/quotations" element={<Quotations />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/products" element={<Products />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/reports" element={<ReportsHome />} />
          {/* Driver/testing routes inside CRM */}
          <Route path="/driver-app" element={<DriverApp />} />
          <Route path="/attendance" element={<AttendanceAdmin />} />
 <Route path="/tracking" element={<TrackingPageWithParams />} />
 <Route path="/visits" element={<Visits />} />

        </Routes>
      </main>
    </>
  );
}

/* -------------- Simple layout for driver role -------------- */
function DriverLayout() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate("/");
    } catch (err) {
      console.error("Signout error", err);
      alert("Signout failed");
    }
  };

  return (
    <>
      <header
        style={{
          borderBottom: "1px solid rgba(15,23,42,0.04)",
          background: "#fff",
          padding: "10px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <NavLink
              to="/driver-app"
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
              Tasks
            </NavLink>

            <NavLink
              to="/attendance"
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
              Attendance
            </NavLink>
          </nav>

          <button className="cp-btn ghost" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/driver-app" element={<DriverApp />} />
          <Route path="/attendance" element={<DriverAttendance />} />
          {/* Default to attendance for drivers */}
          <Route path="*" element={<Navigate to="/attendance" replace />} />
        </Routes>
      </main>
    </>
  );
}
function TrackingPageWithParams() {
  const params = new URLSearchParams(useLocation().search);
  const presetDriverId = params.get("driverId") || "";
  const presetDate = params.get("date") || new Date().toISOString().slice(0,10);
  const presetRole = (params.get("role") || "drivers").toLowerCase();
   return (
   <TrackingPage
     presetRole={presetRole}
     presetDriverId={presetDriverId}
     presetDate={presetDate}
   />
 );
}
/* ------------------------------ App root ------------------------------ */
export default function App() {
  const { user, userProfile, loading } = useAuth();

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<LandingPage/>} />
        <Route path="/icu" element={<ICUPage/>} />
        <Route path="/post-surgery-care" element={<SurgeryPage/>} />
        <Route path="/palliative-care" element={<PalliativePage/>} />
        <Route path="/ambulance" element={<AmbulancePage/>} />
        <Route path="/lab-services" element={<DiagnosticPage/>} />
        <Route path="/pharmacy-delivery" element={<PharmacyPage/>} />
        <Route path="/nursing-care" element={<NursingPage/>} />
        <Route path="/physiotherapy" element={<PhysiotherapyPage/>} />
<Route
        path="/equipment"
        element={<EquipmentList />}
      />
      <Route
        path="/equipment/:slug"
        element={<EquipmentDetail />}
      />

        <Route path="/respiratory-care" element={<RespiratoryPage/>} />
        <Route
  path="/reports/products"
  element={<ProductReport />}
/>
<Route path="/reports/financial" element={<FinancialReport />} />
<Route
  path="/reports/financial/outstanding"
  element={<OutstandingOrdersReport />}
/>

<Route path="/reports/assets" element={<AssetsReport />} />



        <Route path="/our-team" element={<TeamPage/>} />
        <Route path="/blogs" element={<BlogList />} />
        <Route path="/blogs/:slug" element={<BlogDetail />} />
        <Route path="/add-blog" element={<AddBlog />} />

        <Route path="/signup" element={<Signup />} />

        {/* Driver-only experience */}
        {user && userProfile?.role === "driver" ? (
          <Route path="/*" element={<DriverLayout />} />
        ) : (
          // CRM for admins/others
          <Route path="/*" element={<CRMApp />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
