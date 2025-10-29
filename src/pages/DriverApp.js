// src/pages/DriverApp.js — Scalable v4 (TanStack useVirtualizer, NA-safe, ESLint clean)

import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useVirtualizer } from "@tanstack/react-virtual";
import "./DriverApp.css";

/* ------------------------------ helpers ------------------------------ */

const NA = "NA";
const val = (v) => (v === undefined || v === null || v === "" ? NA : v);

const STAGES = ["assigned", "accepted", "in_transit", "delivered", "completed", "rejected"];
const isStage = (s) => STAGES.includes(s);
const LABEL = (s) =>
  ({
    assigned: "Assigned",
    accepted: "Accepted",
    in_transit: "Pickup / In transit",
    delivered: "Delivered",
    completed: "Completed",
    rejected: "Rejected",
  }[s] || s || NA);

function formatTS(t) {
  if (!t) return NA;
  if (typeof t === "object" && (t.seconds || t.nanoseconds)) {
    const d = new Date(((t.seconds || 0) * 1000) + Math.floor((t.nanoseconds || 0) / 1e6));
    return isNaN(d) ? NA : d.toLocaleString();
  }
  const d = t instanceof Date ? t : new Date(t);
  return isNaN(d) ? NA : d.toLocaleString();
}

/* ------------------------------ hooks ------------------------------ */

function useAuthUser() {
  const [user, setUser] = useState(auth.currentUser || null);
  useEffect(() => auth.onAuthStateChanged((u) => setUser(u || null)), []);
  return user;
}

function useDriverProfile(user) {
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const q1 = query(collection(db, "drivers"), where("authUid", "==", user.uid));
        const s1 = await getDocs(q1);
        if (!s1.empty) {
          setDriver({ id: s1.docs[0].id, ...(s1.docs[0].data() || {}) });
        } else {
          const q2 = query(collection(db, "drivers"), where("loginEmail", "==", user.email || ""));
          const s2 = await getDocs(q2);
          if (!s2.empty) setDriver({ id: s2.docs[0].id, ...(s2.docs[0].data() || {}) });
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load driver profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);
  return { driver, loading, error };
}

function useBranchesMap() {
  const [branchesMap, setBranchesMap] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "branches"));
        const map = {};
        snap.docs.forEach((d) => (map[d.id] = { id: d.id, ...(d.data() || {}) }));
        setBranchesMap(map);
      } catch (e) {
        console.warn("Branches load failed", e);
      }
    })();
  }, []);
  return branchesMap;
}

function useDriverDeliveries(driver, branchesMap) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!driver?.id) return;
    setLoading(true);
    const qy = query(collection(db, "deliveries"), where("driverId", "==", driver.id));

    const unsub = onSnapshot(
      qy,
      async (snap) => {
        try {
          const out = [];
          for (const d of snap.docs) {
            const del = { id: d.id, ...(d.data() || {}) };

            // Attach order minimal
            if (del.orderId) {
              try {
                const oSnap = await getDoc(doc(db, "orders", del.orderId));
                if (oSnap.exists()) {
                  const order = { id: oSnap.id, ...(oSnap.data() || {}) };
                  const branchIds = Array.from(new Set((order.items || []).map((it) => it?.branchId).filter(Boolean)));
                  order.stores = branchIds.map((bId) => ({
                    id: bId,
                    name: branchesMap?.[bId]?.name || branchesMap?.[bId]?.displayName || bId,
                  }));
                  del.order = order;
                } else {
                  del.order = { id: del.orderId };
                }
              } catch {
                del.order = { id: del.orderId };
              }
            } else if (!del.order) {
              del.order = {};
            }

            // Merge histories safely
            const canon = (arr) =>
              (Array.isArray(arr) ? arr : []).map((h) => ({
                stage: h?.stage || h?.name || h?.note || "",
                at: h?.at || h?.createdAt || h?.timestamp || null,
                by: h?.by || h?.byId || h?.createdBy || "",
                note: h?.note || "",
              }));
            const combined = [...canon(del.order?.deliveryHistory), ...canon(del.history)].sort((a, b) => {
              const A = Date.parse(a.at) || (a.at?.seconds ? a.at.seconds * 1000 : 0) || 0;
              const B = Date.parse(b.at) || (b.at?.seconds ? b.at.seconds * 1000 : 0) || 0;
              return A - B;
            });
            del.combinedHistory = combined;

            out.push(del);
          }
          setDeliveries(out);
          setLoading(false);
        } catch (e) {
          console.error(e);
          setError("Failed to load deliveries");
          setDeliveries([]);
          setLoading(false);
        }
      },
      (e) => {
        console.error(e);
        setError("Failed to subscribe to deliveries.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [driver?.id, branchesMap]);

  return { deliveries, loading, error, setDeliveries };
}

/* ------------------------------ UI pieces ------------------------------ */

function TopBar({ driver, onSignOut }) {
  return (
    <header className="driver-topbar">
      <div>
        <h2>🚚 {val(driver?.name)}</h2>
        <p className="muted">{val(driver?.vehicle)}</p>
      </div>
      <button className="signout-btn" onClick={onSignOut}>Sign Out</button>
    </header>
  );
}
TopBar.propTypes = { driver: PropTypes.object, onSignOut: PropTypes.func };

function Tabs({ active, counts, onChange }) {
  const c = counts || {};
  const handleChange = (s) => onChange(isStage(s) ? s : "assigned");
  return (
    <div className="tabs">
      {STAGES.map((s) => (
        <button key={s} className={`tab ${active === s ? "active" : ""}`} onClick={() => handleChange(s)}>
          {LABEL(s)} <span className="count-chip">{Number(c?.[s] || 0)}</span>
        </button>
      ))}
    </div>
  );
}
Tabs.propTypes = { active: PropTypes.string, counts: PropTypes.object, onChange: PropTypes.func };

function SearchBar({ value, onChange, onRefresh }) {
  return (
    <div className="driver-section">
      <div className="driver-cards" style={{ gridTemplateColumns: "1fr" }}>
        <div className="driver-card" role="region" aria-label="Filter controls">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="search"
              placeholder="Search address, order no, customer…"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{ flex: 1, minWidth: 280 }}
            />
            <button className="cp-btn ghost" onClick={onRefresh}>Refresh</button>
          </div>
        </div>
      </div>
    </div>
  );
}
SearchBar.propTypes = { value: PropTypes.string, onChange: PropTypes.func, onRefresh: PropTypes.func };

function CompactRow({ index, style, data }) {
  const d = data?.items?.[index];
  if (!d) return <div style={style} />;

  const open = data?.onOpen || (() => {});
  const onStage = data?.onStage || (() => {});
  const o = d?.order || {};
  const status = (d?.status || o?.deliveryStatus || "assigned").toLowerCase();
  const address = o?.deliveryAddress || o?.address || o?.dropAddress || d?.address;

  return (
    <div className="row" style={style}>
      <div className="row-main" onClick={() => open(d)}>
        <div className="row-title">{val(o?.customerName)}</div>
        <div className="row-sub muted">{val(address)}</div>
        <div className="row-meta">
          <span>Order: {val(o?.orderNo || d?.orderId || d?.id)}</span>
          <span>Updated: {formatTS(d?.updatedAt || o?.updatedAt || d?.createdAt)}</span>
        </div>
      </div>
      <div className={`status-pill ${status}`}>{LABEL(status)}</div>
      <div className="row-actions">
        {status === "assigned" && (
          <>
            <button className="cp-btn" onClick={() => onStage(d.id, "accepted")}>Accept</button>
            <button className="cp-btn ghost" onClick={() => onStage(d.id, "rejected")}>Reject</button>
          </>
        )}
        {status === "accepted" && (
          <button className="cp-btn" onClick={() => onStage(d.id, "in_transit")}>Start Pickup</button>
        )}
        {status === "in_transit" && (
          <>
            <button className="cp-btn" onClick={() => onStage(d.id, "delivered")}>Delivered</button>
            {address && address !== NA && (
              <button
                className="cp-btn ghost"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
                    "_blank"
                  )
                }
              >
                Navigate
              </button>
            )}
          </>
        )}
        {status === "delivered" && (
          <button className="cp-btn" onClick={() => onStage(d.id, "completed")}>Complete</button>
        )}
      </div>
    </div>
  );
}
CompactRow.propTypes = { index: PropTypes.number, style: PropTypes.object, data: PropTypes.object };

function DetailsModal({ delivery, onClose }) {
  const o = delivery?.order || {};
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} tabIndex={-1} ref={dialogRef}>
        <header>
          <h3>Delivery Details</h3>
          <button onClick={onClose} aria-label="Close">✖</button>
        </header>

        <div className="modal-section">
          <h5>Customer</h5>
          <p>{val(o?.customerName)}</p>
          <p className="muted">{val(o?.deliveryAddress || o?.address || o?.dropAddress)}</p>
        </div>

        {Array.isArray(o?.items) && o.items.length > 0 && (
          <div className="modal-section">
            <h5>Items</h5>
            {o.items.map((it, i) => (
              <div key={i}>
                {val(it?.name)} × {val(it?.qty)}
                {it?.branchId ? ` · branch: ${val(it.branchId)}` : ""}
              </div>
            ))}
          </div>
        )}

        <div className="modal-section">
          <h5>History</h5>
          <ul className="timeline">
            {(Array.isArray(delivery?.combinedHistory) ? delivery.combinedHistory : [])
              .slice()
              .reverse()
              .map((h, i) => (
                <li key={i}>
                  <span>{val(h?.stage || h?.note)}</span>
                  <span className="time">{formatTS(h?.at)}{h?.by ? ` • by ${val(h.by)}` : ""}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
DetailsModal.propTypes = { delivery: PropTypes.object, onClose: PropTypes.func };

/* ------------------------------ main ------------------------------ */

export default function DriverApp() {
  const user = useAuthUser();
  const { driver, loading: profileLoading, error: profileError } = useDriverProfile(user);
  const branchesMap = useBranchesMap();
  const { deliveries, loading: deliveriesLoading, error: deliveriesError, setDeliveries } =
    useDriverDeliveries(driver, branchesMap);

  const [selected, setSelected] = useState(null);
  const [activeTab, _setActiveTab] = useState("assigned");
  const [queryText, setQueryText] = useState("");
  const [search, setSearch] = useState("");

  // ✅ All hooks before any return
  const parentRef = useRef(null);

  const setActiveTab = (s) => _setActiveTab(isStage(s) ? s : "assigned");

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(queryText), 250);
    return () => clearTimeout(t);
  }, [queryText]);

  const loading = !!(profileLoading || deliveriesLoading);
  const error = profileError || deliveriesError;

  // Filter (always array)
  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    const src = Array.isArray(deliveries) ? deliveries : [];
    if (!q) return src;
    return src.filter((d) => {
      const text = [
        d?.order?.customerName,
        d?.order?.orderNo,
        d?.order?.deliveryAddress,
        d?.order?.address,
        d?.order?.dropAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [deliveries, search]);

  // Group (never undefined)
  const grouped = useMemo(() => {
    const init = {
      assigned: [],
      accepted: [],
      in_transit: [],
      delivered: [],
      completed: [],
      rejected: [],
      other: [],
    };
    (Array.isArray(filtered) ? filtered : []).forEach((d) => {
      const s = (d?.status || d?.order?.deliveryStatus || "assigned").toLowerCase();
      (init[s] ?? init.other).push(d);
    });
    return init;
  }, [filtered]);

  const counts = useMemo(() => {
    const c = {};
    for (const s of STAGES) c[s] = Array.isArray(grouped?.[s]) ? grouped[s].length : 0;
    return c;
  }, [grouped]);

  const safeTab = isStage(activeTab) ? activeTab : "assigned";
  const activeItems = Array.isArray(grouped?.[safeTab]) ? grouped[safeTab] : [];

  // ✅ Virtualizer hooks also before any return
  const rowVirtualizer = useVirtualizer({
    count: activeItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 8,
  });

  const handleSignOut = async () => {
    await auth.signOut();
    window.location.href = "/login";
  };

  const updateStage = async (deliveryId, newStage) => {
    const list = Array.isArray(deliveries) ? deliveries : [];
    const idx = list.findIndex((d) => d?.id === deliveryId);
    if (idx === -1) return;
    const before = list[idx];

    const optimistic = list.slice();
    optimistic[idx] = {
      ...before,
      status: newStage,
      history: [...(before?.history || []), { stage: newStage, at: new Date().toISOString(), by: user?.uid || "" }],
    };
    setDeliveries(optimistic);

    try {
      const ref = doc(db, "deliveries", deliveryId);
      const historyEntry = {
        stage: newStage,
        at: new Date().toISOString(),
        by: user?.uid || auth.currentUser?.uid || "",
        note: `Driver ${driver?.name || ""} set ${newStage}`,
      };
      await updateDoc(ref, {
        status: newStage,
        history: arrayUnion(historyEntry),
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || "",
      });

      const orderId = before?.orderId || before?.order?.id;
      if (orderId) {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
          deliveryStatus: newStage,
          deliveryHistory: arrayUnion(historyEntry),
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || "",
        });
      }
    } catch (e) {
      const rolled = list.slice();
      rolled[idx] = before;
      setDeliveries(rolled);
      alert("Failed to update stage. Check your connection and permissions.");
      console.error("Stage update failed", e);
    }
  };

  // Early returns AFTER hooks — allowed
  if (loading) return <div className="driver-loading">Loading your dashboard…</div>;
  if (!driver) return <div className="driver-empty">No driver profile linked. Please contact admin.</div>;

  const forceRefresh = () => setDeliveries((arr) => (Array.isArray(arr) ? arr.slice() : []));

  return (
    <div className="driver-app">
      <TopBar driver={driver} onSignOut={handleSignOut} />

      <SearchBar value={queryText} onChange={setQueryText} onRefresh={forceRefresh} />

      <div className="driver-section">
        <Tabs active={safeTab} counts={counts || {}} onChange={setActiveTab} />

        <div className="list-card">
          {activeItems.length === 0 ? (
            <p className="muted">No {LABEL(safeTab).toLowerCase()} tasks.</p>
          ) : (
            <div
              ref={parentRef}
              className="list-viewport"
              style={{ height: "60vh", minHeight: 360, overflow: "auto" }}
            >
              <div
                style={{
                  height: rowVirtualizer.getTotalSize(),
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((vi) => {
                  const item = activeItems[vi.index];
                  return (
                    <div
                      key={item?.id ?? vi.key}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: vi.size,
                        transform: `translateY(${vi.start}px)`,
                      }}
                    >
                      <CompactRow
                        index={vi.index}
                        style={{}}
                        data={{ items: activeItems, onOpen: setSelected, onStage: updateStage }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && <DetailsModal delivery={selected} onClose={() => setSelected(null)} />}

      {error && <div className="driver-error" role="alert">{val(error)}</div>}
    </div>
  );
}
