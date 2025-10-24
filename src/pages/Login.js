import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import "./Login.css";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged in App will fire — call onLogin to let parent know if provided
      if (typeof onLogin === "function") onLogin();
    } catch (err) {
      // Friendly error messages
      const msg = err?.code
        ? (err.code === "auth/user-not-found"
            ? "No account found for this email."
            : err.code === "auth/wrong-password"
            ? "Incorrect password."
            : err.message)
        : (err.message || "Login failed.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>MedRent Login</h2>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Login"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <p style={{ marginTop: 12 }}>
        Don’t have an account?{" "}
        <a href="/signup" style={{ color: "#007bff" }}>Sign Up</a>
      </p>
    </div>
  );
}

export default Login;
