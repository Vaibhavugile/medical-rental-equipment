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
  Menu,
} from "lucide-react";
import "./sidebar.css";
import useSidebarAccess from "../hooks/useSidebarAccess";

/* =========================
   SIDEBAR CONFIG
========================= */

const SECTIONS = [
  {
    title: "Overview",
    items: [
      {
        key: "dashboard",          // ✅
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
      {
        key: "leads",              // ✅
        label: "Leads",
        path: "/crm/leads",
        icon: ClipboardList,
      },
      {
        key: "requirements",       // ✅
        label: "Requirements",
        path: "/crm/requirements",
        icon: FileText,
      },
      {
        key: "quotations",         // ✅
        label: "Quotations",
        path: "/crm/quotations",
        icon: FileText,
      },
      {
  key: "appointments",          // permission key
  label: "Appointments",
  path: "/crm/adminappointment",
  icon: ClipboardList,
},

    ],
  },
  {
    title: "Operations",
    items: [
      {
        key: "orders",             // ✅
        label: "Orders",
        path: "/crm/orders",
        icon: ShoppingCart,
      },
      {
        key: "nursing_orders",     // ✅
        label: "Nursing Orders",
        path: "/crm/nursing-orders",
        icon: Stethoscope,
      },
         {
        key: "caretaker-orders",     // ✅
        label: "Caretakers Orders",
        path: "/crm/caretaker-orders",
        icon: Stethoscope,
      },

      
    ],
  },
  {
    title: "People",
    items: [
      {
        key: "staff",              // ✅
        label: "Nurses",
        path: "/crm/staff",
        icon: Users,
      },
      {
        key: "marketing",          // ✅
        label: "Marketing",
        path: "/crm/marketing",
        icon: Megaphone,
      },
      {
        key: "runners",            // ✅
        label: "Runners",
        path: "/crm/drivers",
        icon: Truck,
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        key: "payroll",            // ✅
        label: "Payroll",
        path: "/crm/payroll",
        icon: Wallet,
      },
      {
        key: "reports",            // ✅
        label: "Reports",
        path: "/crm/reports",
        icon: BarChart3,
      },
        {
        key: "Nurse_caretakerpay",            // ✅
        label: "Basepay",
        path: "/crm/staffsalary",
        icon: BarChart3,
      },
       {
        key: "Payment_Increase_Request",            // ✅
        label: "Salary Increase Request",
        path: "/crm/salaryrequest",
        icon: BarChart3,
      },
      
    ],
  },
  {
    title: "Admin",
    items: [
      {
        key: "branches",           // ✅
        label: "Branches",
        path: "/crm/branches",
        icon: Building2,
      },
      {
        key: "tracking",           // ✅
        label: "Tracking",
        path: "/crm/tracking",
        icon: MapPin,
      },
      {
        key: "inventory",          // ✅
        label: "Inventory",
        path: "/crm/products",
        icon: Package,
      },
      {
        key: "visits",             // ✅
        label: "Visits",
        path: "/crm/visits",
        icon: MapPin,
      },
      {
        key: "roles_users",        // ✅ (for superadmin later)
        label: "Roles & Users",
        path: "/crm/roles-users",
        icon: Users,
      },

    ],
  },
];

/* =========================
   SIDEBAR COMPONENT
========================= */

export default function Sidebar({ collapsed, onToggle }) {
   const { allowedKeys, loading } = useSidebarAccess();
     if (loading) return null; // or loader

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* BRAND */}
      <div className="sidebar-brand">
        <span className="logo-dot" />
        {!collapsed && <span className="brand-text">BMM</span>}

        {/* HAMBURGER */}
        <button className="collapse-btn" onClick={onToggle}>
          <Menu size={20} />
        </button>
      </div>

      {/* NAV */}
      <div className="sidebar-scroll">
        {SECTIONS.map((section) => (
          <div key={section.title} className="sidebar-section">
            {!collapsed && (
              <div className="sidebar-section-title">
                {section.title}
              </div>
            )}

            {section.items
  .filter(item =>
    !allowedKeys || allowedKeys.includes(item.key)
  )
  .map(({ key, label, path, icon: Icon, exact }) => (

      <NavLink
  key={key}
  to={path}
  end={exact}
  className={({ isActive }) =>
    `sidebar-link ${isActive ? "active" : ""}`
  }
>
  <Icon size={18} />

  {/* Normal label when expanded */}
  {!collapsed && (
    <span className="sidebar-link-label">{label}</span>
  )}

  {/* Tooltip when collapsed */}
  {collapsed && (
    <span className="sidebar-tooltip">{label}</span>
  )}

  <span className="active-indicator" />
</NavLink>


            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
