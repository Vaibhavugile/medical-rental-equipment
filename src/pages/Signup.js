import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./Signup.css";

function Signup({ onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email and password are required.");
      return;
    }

    setLoading(true);
    try {
      // create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const user = userCredential.user;

      // update displayName for auth user (so auth.currentUser.displayName is available)
      try {
        await updateProfile(user, { displayName: name.trim() });
      } catch (updErr) {
        // non-fatal: continue even if updateProfile fails
        console.warn("updateProfile failed:", updErr);
      }

      // create user profile doc in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name.trim(),
        email: email.trim(),
        role: "sales", // default role, change as needed
        createdAt: serverTimestamp(),
      });

      // Notify parent (App will also detect onAuthStateChanged)
      if (typeof onSignup === "function") onSignup();
    } catch (err) {
      console.error("signup error", err);
      const msg = err?.code
        ? (err.code === "auth/email-already-in-use"
            ? "Email already in use. Try logging in."
            : err.code === "auth/weak-password"
            ? "Password is too weak (min 6 characters)."
            : err.message)
        : (err.message || "Signup failed.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <h2>Create Account</h2>

      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Create Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Sign Up"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <p style={{ marginTop: 12 }}>
        Already have an account?{" "}
        <a href="/login" style={{ color: "#007bff" }}>Login</a>
      </p>
    </div>
  );
}

export default Signup;
