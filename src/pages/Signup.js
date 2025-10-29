// src/pages/Signup.js
import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { setDoc, doc, serverTimestamp, getDocs, query, where, collection } from "firebase/firestore";
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

    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email, and password are required.");
      return;
    }

    setLoading(true);
    try {
      // Step 1 — check if email exists in 'drivers' collection
      const driverQ = query(collection(db, "drivers"), where("loginEmail", "==", email.trim().toLowerCase()));
      const driverSnap = await getDocs(driverQ);
      const isDriver = driverSnap.docs.length > 0;

      // Step 2 — create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Step 3 — update display name for the auth profile
      try {
        await updateProfile(user, { displayName: name.trim() });
      } catch (e) {
        console.warn("updateProfile failed", e);
      }

      // Step 4 — create /users/{uid} document with auto role
      const role = isDriver ? "driver" : "sales";
      await setDoc(doc(db, "users", user.uid), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        createdAt: serverTimestamp(),
      });

      // Optional: update the driver doc with authUid if matched
      if (isDriver) {
        const driverDocId = driverSnap.docs[0].id;
        await setDoc(
          doc(db, "drivers", driverDocId),
          { authUid: user.uid, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }

      if (typeof onSignup === "function") onSignup();
    } catch (err) {
      console.error("signup error", err);
      let msg = "Signup failed.";
      if (err.code === "auth/email-already-in-use") msg = "Email already in use. Try logging in.";
      if (err.code === "auth/weak-password") msg = "Password too weak (min 6 characters).";
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
        />
        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Create Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Sign Up"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <p style={{ marginTop: 12 }}>
        Already have an account?{" "}
        <a href="/login" style={{ color: "#007bff" }}>
          Login
        </a>
      </p>
    </div>
  );
}

export default Signup;
