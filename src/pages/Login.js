import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import useAuth from "./useAuth";
import { getRedirectPath } from "../utils/getRedirectPath";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  /* 🔁 AUTO REDIRECT IF ALREADY LOGGED IN */
  useEffect(() => {
    if (user && userProfile) {
      const redirectTo = getRedirectPath(userProfile);
      navigate(redirectTo, { replace: true });
    }
  }, [user, userProfile, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      // ⛔ DO NOT navigate here
      // Redirect happens via useEffect once profile loads
    } catch (err) {
      const msg =
        err.code === "auth/user-not-found"
          ? "No account found for this email."
          : err.code === "auth/wrong-password"
          ? "Incorrect password."
          : "Login failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

 return (
  <div className="login-page">

    <div className="login-card">

      <div className="login-header">
        <h1 className="login-title">BookMyMediCare</h1>
        <p className="login-subtitle">Sign in to your dashboard</p>
      </div>

      <form className="login-form" onSubmit={handleLogin}>

        <div className="login-field">
          <input
            className="login-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div className="login-field">
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button
          className="login-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Login"}
        </button>

      </form>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

    </div>

  </div>
);
}

export default Login;
