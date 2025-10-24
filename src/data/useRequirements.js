import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebase";

/**
 * useRequirements hook
 * params: { status, assignedTo, leadId }
 */
export default function useRequirements(filters = {}) {
  const { status, assignedTo, leadId } = filters;
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      let qRef = collection(db, "requirements");
      const queries = [];
      if (status) queries.push(where("status", "==", status));
      if (assignedTo) queries.push(where("assignedTo", "==", assignedTo));
      if (leadId) queries.push(where("leadId", "==", leadId));
      // compose query with ordering
      let q = queries.length ? query(qRef, ...queries, orderBy("createdAt", "desc")) : query(qRef, orderBy("createdAt", "desc"));
      const unsub = onSnapshot(q, snap => {
        setRequirements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, err => {
        console.error("useRequirements onSnapshot error:", err);
        setError(err);
        setLoading(false);
      });
      return () => unsub();
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }, [status, assignedTo, leadId]);

  return { requirements, loading, error };
}
