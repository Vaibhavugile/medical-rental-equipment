// src/components/RoleRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import useAuth from "../pages/useAuth";

/**
 * RoleRoute
 * - roles: array of allowed roles, e.g. ['driver']
 * - fallback: where to redirect if not allowed (default: '/login')
 *
 * Usage:
 * <Route path="/driver" element={<RoleRoute roles={['driver']}><DriverApp /></RoleRoute>} />
 */
export default function RoleRoute({ roles = [], fallback = "/login", children }) {
  const { user, userProfile, loading } = useAuth();

  // still loading auth/profile
  if (loading) return <div style={{ padding: 20 }}>Checking access…</div>;

  // not signed in
  if (!user) return <Navigate to={fallback} replace />;

  // no userProfile available — redirect to fallback or ask admin to link
  if (!userProfile) return <Navigate to={fallback} replace />;

  // ensure role(s) contain at least one of allowed roles
  const userRole = userProfile.role || userProfile.roles || null;
  // role may be a string or array
  const allowed =
    Array.isArray(userRole) ? roles.some((r) => userRole.includes(r)) : roles.includes(userRole);

  if (!allowed) return <Navigate to={fallback} replace />;

  return children;
}
