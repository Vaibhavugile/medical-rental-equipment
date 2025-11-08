// src/pages/Signup.js
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase"; // adjust the import path if your project differs

import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

import {
  setDoc,
  doc,
  serverTimestamp,
  getDocs,
  query,
  where,
  collection,
} from "firebase/firestore";

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMsg("Please enter your name.");
      return;
    }
    if (!trimmedEmail) {
      setErrorMsg("Please enter your email.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Check if this email belongs to a driver or marketing person
      const driverQ = query(
        collection(db, "drivers"),
        where("loginEmail", "==", trimmedEmail)
      );
      const driverSnap = await getDocs(driverQ);
      const isDriver = driverSnap.docs.length > 0;

      const marketingQ = query(
        collection(db, "marketing"),
        where("loginEmail", "==", trimmedEmail)
      );
      const marketingSnap = await getDocs(marketingQ);
      const isMarketing = marketingSnap.docs.length > 0;

      // 2) Create auth account
      const cred = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      // 3) Optionally set displayName for nicer UX elsewhere
      if (trimmedName) {
        await updateProfile(cred.user, { displayName: trimmedName });
      }

      // 4) Create the /users/{uid} profile with the correct role
      const role = isDriver ? "driver" : isMarketing ? "marketing" : "sales";

      await setDoc(doc(db, "users", cred.user.uid), {
        name: trimmedName,
        email: trimmedEmail,
        role,
        createdAt: serverTimestamp(),
      });

      // 5) Backfill authUid into the matched domain document (drivers/marketing)
      if (isDriver) {
        const driverDocId = driverSnap.docs[0].id;
        await setDoc(
          doc(db, "drivers", driverDocId),
          {
            authUid: cred.user.uid,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      if (isMarketing) {
        const marketingDocId = marketingSnap.docs[0].id;
        await setDoc(
          doc(db, "marketing", marketingDocId),
          {
            authUid: cred.user.uid,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // 6) Send them to Login; your auth-based redirect can route to /marketing for marketing users
      navigate("/login", { replace: true });
    } catch (err) {
      console.error(err);
      let message = "Something went wrong. Please try again.";
      if (err?.code === "auth/email-already-in-use") {
        message = "That email is already in use.";
      } else if (err?.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (err?.code === "auth/weak-password") {
        message = "Password is too weak (min 6 characters).";
      }
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "40px auto",
        padding: 24,
        border: "1px solid #eee",
        borderRadius: 12,
      }}
    >
      <h2 style={{ marginBottom: 16 }}>Create your account</h2>

      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            style={{
              width: "100%",
              padding: "10px 12px",
              marginTop: 6,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
            disabled={submitting}
            autoComplete="name"
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            style={{
              width: "100%",
              padding: "10px 12px",
              marginTop: 6,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
            disabled={submitting}
            autoComplete="email"
          />
        </label>

        <label style={{ display: "block", marginBottom: 12 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "10px 12px",
              marginTop: 6,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
            disabled={submitting}
            autoComplete="new-password"
          />
        </label>

        {errorMsg ? (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              background: "#ffeaea",
              color: "#b00020",
              borderRadius: 8,
              border: "1px solid #ffcccc",
            }}
          >
            {errorMsg}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            background: submitting ? "#999" : "#111",
            color: "#fff",
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <div style={{ marginTop: 12, fontSize: 14 }}>
        Already have an account? <Link to="/login">Log in</Link>
      </div>

      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Tip: if your email matches a record in <code>drivers</code> or{" "}
        <code>marketing</code>, your role is set automatically. Otherwise,
        you’ll get the default <code>sales</code> role.
      </p>
    </div>
  );
}
