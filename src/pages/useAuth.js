// src/hooks/useAuth.js
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

/**
 * useAuth hook
 * - returns { user, userProfile, loading }
 * - user = firebase auth user (or null)
 * - userProfile = document from /users/{uid} (or null)
 *
 * NOTE: we subscribe to the users doc so role changes propagate in realtime.
 */
export default function useAuth() {
  const [user, setUser] = useState(auth.currentUser || null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setUserProfile(null);
      if (!u) {
        setLoading(false);
        return;
      }

      // subscribe to /users/{uid} doc for role & metadata
      const userRef = doc(db, "users", u.uid);
      const unsubDoc = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            setUserProfile({ id: snap.id, ...(snap.data() || {}) });
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error("user doc snapshot error", err);
          setUserProfile(null);
          setLoading(false);
        }
      );

      // cleanup doc listener when auth changes
      return () => unsubDoc();
    });

    return () => {
      try { unsubAuth(); } catch (e) {}
    };
  }, []);

  return { user, userProfile, loading };
}
