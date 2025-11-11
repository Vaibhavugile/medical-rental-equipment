// src/components/DeliveryHistory.jsx
import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const STAGE_LABELS = {
  assigned: "Assigned",
  accepted: "Accepted",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  completed: "Completed",
};
const niceStage = (s) => STAGE_LABELS[s] || String(s || "").replace(/_/g, " ");

const fmtAt = (at) => {
  if (!at) return "—";
  if (at?.seconds) return new Date(at.seconds * 1000).toLocaleString("en-IN");
  if (typeof at === "number") return new Date(at).toLocaleString("en-IN");
  const raw = String(at);
  const cleaned = raw.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?$/, "$1");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? raw : d.toLocaleString("en-IN");
};

const getHistoryFromOrder = (o) => {
  if (!o) return [];
  // prefer your field
  if (Array.isArray(o.deliveryhistory)) return o.deliveryhistory;
  // fallbacks just in case
  if (Array.isArray(o.deliveryHistory)) return o.deliveryHistory;
  if (Array.isArray(o.history)) return o.history;
  if (Array.isArray(o?.delivery?.history)) return o.delivery.history;
  return [];
};

/**
 * Props:
 * - order?: object            // full order document; reads order.deliveryhistory
 * - orderId?: string          // subscribes to orders/{orderId} and reads deliveryhistory
 * - history?: array           // direct array override
 * - collection?: string       // default "orders"
 */
export default function DeliveryHistory({ order, orderId, history, collection = "orders" }) {
  const [liveOrder, setLiveOrder] = useState(null);

  useEffect(() => {
    if (!history && !order && orderId) {
      const ref = doc(db, collection, orderId);
      const unsub = onSnapshot(ref, (snap) => {
        setLiveOrder(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      });
      return () => unsub();
    }
  }, [history, order, orderId, collection]);

  const effectiveOrder = order || liveOrder || null;

  const items = useMemo(() => {
    const arr =
      (Array.isArray(history) && history) ||
      getHistoryFromOrder(effectiveOrder) ||
      [];
    return [...arr].sort((a, b) => {
      const tA = new Date(String(a?.at || "").split(".")[0]).getTime() || 0;
      const tB = new Date(String(b?.at || "").split(".")[0]).getTime() || 0;
      return tA - tB;
    });
  }, [history, effectiveOrder]);

  if (!items.length) return <div style={{ color: "#6b7280" }}>No history yet.</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((h, i) => (
        <div
          key={(h.at || "") + i}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            alignItems: "start",
            gap: 10,
            padding: "10px 12px",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 10,
            background: "#fff",
          }}
        >
          <div style={{ width: 10, height: 10, marginTop: 6, borderRadius: 9999, background: "#0b5cff" }} />
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
              <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{niceStage(h?.stage)}</span>
              <span style={{ color: "#6b7280" }}>• {fmtAt(h?.at)}</span>
              {h?.by && <span style={{ color: "#6b7280" }}>• by {h.by}</span>}
            </div>
            {h?.note && <div style={{ marginTop: 4, color: "#374151" }}>{h.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
