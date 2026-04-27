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
import {
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { useEffect, useState } from "react";
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
        path: "/crm/dashboard",
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
      // {
      //   key: "staff",              // ✅
      //   label: "Staff",
      //   path: "/crm/staff",
      //   icon: Users,
      // },
      {
        key: "nurses",              // ✅
        label: "Nurses",
        path: "/crm/nurses",
        icon: Users,
      },
      {
        key: "caretakers",              // ✅
        label: "Caretakers",
        path: "/crm/caretakers",
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

      {
        key: "employee",            // ✅
        label: "Employees",
        path: "/crm/employees",
        icon: Truck,
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        key: "accountreport",            // ✅
        label: " Account Reports",
        path: "/crm/accountreport",
        icon: BarChart3,
      },
      {
        key: "payroll",            // ✅
        label: "Nursing Report",
        path: "/crm/payroll",
        icon: Wallet,
      },
      {
        key: "caretakers_report",            // ✅
        label: "Caretaker Report",
        path: "/crm/reports/caretaker",
        icon: Wallet,
      },

      {
        key: "reports",            // ✅
        label: "Equipment Reports",
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
      {
        key: "salarypayroll",            // ✅
        label: "Salary",
        path: "/crm/salarypayroll",
        icon: BarChart3,
      },


    ],
  },
  {
    title: "Recycle Bin",
    items: [
      {
        key: "recycle-bin",            // ✅
        label: "Equipment Recycle Orders",
        path: "/crm/recycle-bin",
        icon: BarChart3,
      },
      {
        key: "nursing-recycle-bin",            // ✅
        label: "Nurse & Caretaker Recycle Orders",
        path: "/crm/nursing-orders/recycle-bin",
        icon: Wallet,
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
  const [notifications, setNotifications] = useState({
    leads: 0,
    salary: 0
  });
  useEffect(() => {

  const q = query(collection(db,"leads"));

  const unsubscribe = onSnapshot(q,(snap)=>{

    let unseenCount = 0;

    snap.docs.forEach((d)=>{

      const data = d.data();

      // treat missing seen as false
      const isSeen = data.seen === true;

      if(!isSeen){
        unseenCount++;
      }

    });

    setNotifications(prev=>({
      ...prev,
      leads:unseenCount
    }));

  });

  return ()=>unsubscribe();

},[]);
  useEffect(() => {

  const q = query(collection(db,"salaryOverrideRequests"));

  const unsubscribe = onSnapshot(q,(snap)=>{

    let unseenCount = 0;

    snap.docs.forEach((d)=>{

      const data = d.data();

      const isSeen = !!data.seenBy;

      if(!isSeen){
        unseenCount++;
      }

    });

    setNotifications(prev=>({
      ...prev,
      salary: unseenCount
    }));

  });

  return ()=>unsubscribe();

},[]);
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
                    <span className="sidebar-link-label">

  {label}

  {key === "leads" && notifications.leads > 0 && (
    <span className="sidebar-badge">
      {notifications.leads}
    </span>
  )}

  {key === "Payment_Increase_Request" && notifications.salary > 0 && (
    <span className="sidebar-badge">
      {notifications.salary}
    </span>
  )}

</span>
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
