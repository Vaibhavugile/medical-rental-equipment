import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function useSidebarAccess() {
  const [allowedKeys, setAllowedKeys] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // 1️⃣ get user role
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const role = userSnap.data()?.role;

        if (!role) {
          setAllowedKeys([]);
          setLoading(false);
          return;
        }

        // 2️⃣ get role permissions
        const roleSnap = await getDoc(doc(db, "roles", role));
        const sidebar = roleSnap.data()?.sidebar || [];

        setAllowedKeys(sidebar);
      } catch (e) {
        console.error("Sidebar access error:", e);
        setAllowedKeys([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { allowedKeys, loading };
}
