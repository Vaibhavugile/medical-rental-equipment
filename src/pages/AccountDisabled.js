import React from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import "./AccountDisabled.css";

function AccountDisabled() {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="account-disabled-page">

      <div className="account-disabled-card">

        <div className="account-disabled-icon">
          🔒
        </div>

        <h1>Access Restricted</h1>

        <p className="account-disabled-title">
          You do not have access to this account.
        </p>

        <p className="account-disabled-text">
          Your account access has been disabled or has not yet been approved.
          Please contact the administrator to activate your account and give
          you access to the dashboard.
        </p>

        <button
          className="account-disabled-button"
          onClick={handleLogout}
        >
          Back to Login
        </button>

      </div>

    </div>
  );
}

export default AccountDisabled;