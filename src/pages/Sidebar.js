import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  ShoppingCart,
  Stethoscope,
  Package,
  Truck,
  Users,
  BarChart3,
  Building2,
  MapPin,
  Wallet,
  Megaphone,
} from "lucide-react";
import "./sidebar.css";

/* =========================
   SIDEBAR CONFIG
========================= */

const SECTIONS = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        path: "/crm",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Leads", path: "/crm/leads", icon: ClipboardList },
      { label: "Requirements", path: "/crm/requirements", icon: FileText },
      { label: "Quotations", path: "/crm/quotations", icon: FileText },
    ],
  },
  {
    title: "Operations",
    items: [
              { label: "Orders", path: "/crm/orders", icon: ShoppingCart },
      {
        label: "Nursing Orders",
        path: "/crm/nursing-orders",
        icon: Stethoscope,
      },


    ],
  },

  {
    title: "People",
    items: [
      { label: "Staff", path: "/crm/staff", icon: Users },
      { label: "Marketing", path: "/crm/marketing", icon: Megaphone },
      { label: "Runners", path: "/crm/drivers", icon: Truck },


    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payroll", path: "/crm/payroll", icon: Wallet },
      { label: "Reports", path: "/crm/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Branches", path: "/crm/branches", icon: Building2 },
      { label: "Tracking", path: "/crm/tracking", icon: MapPin },
     { label: "Inventory", path: "/crm/products", icon: Package },
      { label: "Visits", path: "/crm/visits", icon: MapPin },

    ],
  },
];

/* =========================
   SIDEBAR COMPONENT
========================= */

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* BRAND */}
      <div className="sidebar-brand">
        <span className="logo-dot" />
        <span className="brand-text">MedRent</span>
      </div>

      {/* NAV */}
      <div className="sidebar-scroll">
        {SECTIONS.map((section) => (
          <div key={section.title} className="sidebar-section">
            <div className="sidebar-section-title">
              {section.title}
            </div>

            {section.items.map(({ label, path, icon: Icon, exact }) => (
              <NavLink
                key={path}
                to={path}
                end={exact}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={18} />
                <span className="sidebar-link-label">{label}</span>
                <span className="active-indicator" />
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
