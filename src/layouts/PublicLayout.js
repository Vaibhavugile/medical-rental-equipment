import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <>
      {/* Your existing website header/navbar stays here */}
      <Outlet />
      {/* Footer stays here */}
    </>
  );
}
