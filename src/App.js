import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads"; // ✅ Added Leads Page

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";

// ✅ Layout Wrapper for authenticated users
function Layout({ onLogout, children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { path: "/", label: "🏠 Dashboard" },
    { path: "/leads", label: "📋 Leads" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f7fb" }}>
      {/* === Sidebar === */}
      <aside
        style={{
          width: menuOpen ? "200px" : "60px",
          background: "#007bff",
          color: "white",
          transition: "width 0.3s ease",
          display: "flex",
          flexDirection: "column",
          alignItems: menuOpen ? "flex-start" : "center",
          padding: "10px 5px",
        }}
      >
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            fontSize: "20px",
            marginBottom: "20px",
            cursor: "pointer",
          }}
        >
          {menuOpen ? "«" : "☰"}
        </button>

        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              display: "block",
              textDecoration: "none",
              color: "white",
              fontWeight: location.pathname === item.path ? "bold" : "normal",
              background:
                location.pathname === item.path ? "rgba(255,255,255,0.2)" : "",
              padding: menuOpen ? "10px 15px" : "10px 0",
              borderRadius: "6px",
              width: menuOpen ? "100%" : "auto",
              textAlign: menuOpen ? "left" : "center",
              transition: "all 0.2s ease",
              marginBottom: "6px",
            }}
          >
            {item.label}
          </Link>
        ))}

        <div style={{ flexGrow: 1 }} />
        <button
          onClick={onLogout}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "white",
            padding: "8px 12px",
            borderRadius: "6px",
            cursor: "pointer",
            marginBottom: "10px",
          }}
        >
          🚪 Logout
        </button>
      </aside>

      {/* === Main content === */}
      <main
        style={{
          flexGrow: 1,
          padding: "20px 30px",
          animation: "fadeSlide 0.5s ease",
        }}
      >
        {children}
      </main>
    </div>
  );
}

// === App Root ===
function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            !user ? (
              <Login onLogin={() => setUser(auth.currentUser)} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/signup"
          element={
            !user ? (
              <Signup onSignup={() => setUser(auth.currentUser)} />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            user ? (
              <Layout onLogout={handleLogout}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/leads" element={<Leads />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
