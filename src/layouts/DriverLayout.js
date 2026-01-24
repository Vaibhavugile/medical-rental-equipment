import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../routes/ProtectedRoute";

import DriverApp from "../pages/DriverApp";
import DriverAttendance from "../pages/DriverAttendance";

export default function DriverLayout() {
  return (
    <ProtectedRoute role="driver">
      <main>
        <Routes>
          <Route path="driver-app" element={<DriverApp />} />
          <Route path="attendance" element={<DriverAttendance />} />
          <Route path="*" element={<Navigate to="/driver/attendance" replace />} />
        </Routes>
      </main>
    </ProtectedRoute>
  );
}
