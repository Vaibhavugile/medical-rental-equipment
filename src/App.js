// src/App.js
import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import useAuth from "./pages/useAuth";
import { auth } from "./firebase";
import "./App.css";

/* ======================= PUBLIC PAGES ======================= */
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
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import NotFound from "./pages/NotFound";
import AddBlog from "./pages/AddBlog";
/* ======================= PRIVATE (CRM) PAGES ======================= */
import Leads from "./pages/Leads";
import Requirements from "./pages/Requirements";
import Quotations from "./pages/Quotations";
import Orders from "./pages/Orders";
import Products from "./pages/Products";
import Drivers from "./pages/Drivers";
import Branches from "./pages/Branches";
import Marketing from "./pages/Marketing";
import Visits from "./pages/Visits";
import ReportsHome from "./pages/reports/ReportsHome";
import AttendanceAdmin from "./pages/AttendanceAdmin";

/* ======================= EQUIPMENT ======================= */
import EquipmentList from "./pages/medical-equipment/EquipmentList";
import EquipmentDetail from "./pages/medical-equipment/EquipmentDetail";

/* ======================= REPORTS ======================= */
import ProductReport from "./pages/reports/ProductReport";
import FinancialReport from "./pages/reports/FinancialReport";
import OutstandingOrdersReport from "./pages/reports/OutstandingOrdersReport";
import AssetsReport from "./pages/reports/AssetsReport";

/* ======================= TRACKING ======================= */
import TrackingPage from "./pages/TrackingPage";
import LandingNew from "./pages/Landingnew";
import Staff from "./pages/Staff";

/* ============================================================
   PRIVATE ROUTE (AUTH ONLY, SILENT)
============================================================ */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

/* ============================================================
   CRM HEADER
============================================================ */
function HeaderRight() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await auth.signOut();
    navigate("/login");
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 700 }}>
          {userProfile?.name || user?.email}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Authenticated
        </div>
      </div>
      <button className="cp-btn ghost" onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  );
}

/* ============================================================
   CRM APP (PRIVATE AREA)
============================================================ */
function CRMApp() {
  return (
    <>
      <header style={{ background: "#fff", borderBottom: "1px solid #eee" }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <strong style={{ color: "#0b5cff" }}>MedRent CRM</strong>

          <nav style={{ display: "flex", gap: 8 }}>
            {[
              ["Leads", "/crm/leads"],
              ["Requirements", "/crm/requirements"],
              ["Quotations", "/crm/quotations"],
              ["Orders", "/crm/orders"],
              ["Inventory", "/crm/products"],
              ["Runners", "/crm/drivers"],
              ["Marketing", "/crm/marketing"],
              ["Nursing","/crm/staff"],
              ["Visits", "/crm/visits"],
              ["Reports", "/crm/reports"],
              ["Branches", "/crm/branches"],
              ["Tracking", "/crm/tracking"],

            ].map(([label, path]) => (
              <NavLink
                key={path}
                to={path}
                style={({ isActive }) => ({
                  padding: "6px 10px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontWeight: 600,
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

          <HeaderRight />
        </div>
      </header>

      <main style={{ padding: 20 }}>
        <Routes>
          <Route path="leads" element={<Leads />} />
          <Route path="requirements" element={<Requirements />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="orders" element={<Orders />} />
          <Route path="products" element={<Products />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="branches" element={<Branches />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="staff" element={<Staff />} />
          <Route path="visits" element={<Visits />} />
          <Route path="reports" element={<ReportsHome />} />
          <Route path="attendance" element={<AttendanceAdmin />} />


          {/* ✅ RESTORED WRAPPER (FIXES ROLE ISSUE) */}
          <Route path="tracking" element={<TrackingPageWithParams />} />

          <Route path="reports/products" element={<ProductReport />} />
          <Route path="reports/financial" element={<FinancialReport />} />
          <Route
            path="reports/financial/outstanding"
            element={<OutstandingOrdersReport />}
          />
          <Route path="reports/assets" element={<AssetsReport />} />

          {/* 🔴 PRIVATE NOT FOUND */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

/* ============================================================
   TRACKING PAGE WITH PARAMS (URL IS SOURCE OF TRUTH)
============================================================ */
function TrackingPageWithParams() {
  const params = new URLSearchParams(useLocation().search);

  const presetDriverId = params.get("driverId") || "";
  const presetDate =
    params.get("date") || new Date().toISOString().slice(0, 10);
  const presetRole = (params.get("role") || "drivers").toLowerCase();

  return (
    <TrackingPage
      presetRole={presetRole}
      presetDriverId={presetDriverId}
      presetDate={presetDate}
    />
  );
}

/* ============================================================
   ROOT APP
============================================================ */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        
{/* <Route
  path="/palliative.php"
  element={<Navigate to="/palliative-care" replace />}
/>

<Route
  path="/surgery.php"
  element={<Navigate to="/post-surgery-care" replace />}
/>

<Route
  path="/pharmacy-delivery.php"
  element={<Navigate to="/pharmacy-delivery" replace />}
/>

<Route
  path="/our-team.php"
  element={<Navigate to="/our-team" replace />}
/>

<Route
  path="/contact.php"
  element={<Navigate to="/#contact" replace />}
/> */}
        {/* ================= PUBLIC ================= */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingNew />} />
        <Route path="/icu" element={<ICUPage />} />
        <Route path="/post-surgery-care" element={<SurgeryPage />} />
        <Route path="/palliative-care" element={<PalliativePage />} />
        <Route path="/ambulance" element={<AmbulancePage />} />
        <Route path="/lab-services" element={<DiagnosticPage />} />
        <Route path="/pharmacy-delivery" element={<PharmacyPage />} />
        <Route path="/nursing-care" element={<NursingPage />} />
        <Route path="/physiotherapy" element={<PhysiotherapyPage />} />
        <Route path="/respiratory-care" element={<RespiratoryPage />} />

        <Route path="/equipment" element={<EquipmentList />} />
        <Route path="/equipment/:slug" element={<EquipmentDetail />} />

        <Route path="/our-team" element={<TeamPage />} />
        <Route path="/blogs" element={<BlogList />} />
        <Route path="/blogs/:slug" element={<BlogDetail />} />
       <Route path="/addblog" element={<AddBlog />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />

        {/* Legacy redirects */}
        <Route
          path="/attendance"
          element={<Navigate to="/crm/attendance" replace />}
        />
        <Route
          path="/tracking"
          element={<Navigate to="/crm/tracking" replace />}
        />




        {/* ================= PRIVATE ================= */}
        <Route
          path="/crm/*"
          element={
            <PrivateRoute>
              <CRMApp />
            </PrivateRoute>
          }
        />

        {/* 🔴 PUBLIC NOT FOUND */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
