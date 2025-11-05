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

/* ⬇️ QR scanner + inventory checkout */
import { Html5Qrcode } from "html5-qrcode";
import { checkoutAsset } from "../utils/inventory";

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
    return Number.isNaN(d) ? NA : d.toLocaleString();
  }
  const d = t instanceof Date ? t : new Date(t);
  return Number.isNaN(d) ? NA : d.toLocaleString();
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
        // eslint-disable-next-line no-console
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
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() || {}) };
        });
        setBranchesMap(map);
      } catch (e) {
        // eslint-disable-next-line no-console
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
    if (!driver?.id) return undefined;
    setLoading(true);
    const qy = query(collection(db, "deliveries"), where("driverId", "==", driver.id));

    const unsub = onSnapshot(
      qy,
      async (snap) => {
        try {
          const out = [];
          // eslint-disable-next-line no-restricted-syntax
          for (const d of snap.docs) {
            const del = { id: d.id, ...(d.data() || {}) };

            // Attach order minimal
            if (del.orderId) {
              try {
                const oSnap = await getDoc(doc(db, "orders", del.orderId));
                if (oSnap.exists()) {
                  const order = { id: oSnap.id, ...(oSnap.data() || {}) };
                  const branchIds = Array.from(
                    new Set((order.items || []).map((it) => it?.branchId).filter(Boolean)),
                  );
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
          // eslint-disable-next-line no-console
          console.error(e);
          setError("Failed to load deliveries");
          setDeliveries([]);
          setLoading(false);
        }
      },
      (e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        setError("Failed to subscribe to deliveries.");
        setLoading(false);
      },
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
  const onStartPickup = data?.onStartPickup || null;

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
          <button
            className="cp-btn"
            onClick={() => {
              if (onStartPickup) onStartPickup(d);
              else onStage(d.id, "in_transit");
            }}
          >
            Start Pickup
          </button>
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
                    "_blank",
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

/* ------------------------------ QR Scanner ------------------------------ */
/* StrictMode-safe: initialize once; keep callback fresh via ref */
/* ------------------------------ QR Scanner ------------------------------ */
/* StrictMode-safe, single video, no dashboard */
/* ------------------------------ QR Scanner ------------------------------ */
/* One-video scanner with controls: start/stop, camera switch, image file */
function QRScanner({ onResult }) {
  const containerId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const latestOnResult = useRef(onResult);
  latestOnResult.current = onResult;

  const instRef = useRef(null);
  const startedRef = useRef(false);   // true only after start() succeeds
  const runningRef = useRef(false);   // mirrors state; avoids stale closures

  const [devices, setDevices] = useState([]);
  const [cameraId, setCameraId] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");

  // keep ref in sync with state
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => {
    // list cameras once
    (async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === "videoinput");
        setDevices(cams);
        const back = cams.find((d) => /back|rear|environment/i.test(d.label));
        setCameraId((back || cams[0] || {}).deviceId || null);
      } catch {
        setErr("Camera list unavailable. Check permissions (HTTPS/localhost).");
      }
    })();
  }, []);

  // create instance once
  useEffect(() => {
    const el = document.getElementById(containerId.current);
    if (el) el.innerHTML = "";
    instRef.current = new Html5Qrcode(containerId.current, false);

    return () => {
      const inst = instRef.current;
      instRef.current = null;

      (async () => {
        try {
          // Only stop if we actually started or are running/paused
          if (startedRef.current || runningRef.current) {
            try { await inst?.stop(); } catch { /* already stopped */ }
          }
        } finally {
          try { await inst?.clear(); } catch { /* ignore */ }
          startedRef.current = false;
        }
      })();
    };
  }, []);

  const start = async () => {
    if (!instRef.current || running || !cameraId) return;
    setErr("");
    try {
      await instRef.current.start(
        { deviceId: { exact: cameraId } },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (text) => { try { latestOnResult.current?.(text); } catch {} },
        () => {} // ignore decode noise
      );
      startedRef.current = true;
      setRunning(true);
    } catch {
      setErr("Failed to start camera. Try another device or allow permission.");
      setRunning(false);
      startedRef.current = false;
    }
  };

  const stop = async () => {
    if (!instRef.current) return;
    try {
      if (runningRef.current || startedRef.current) {
        await instRef.current.stop();
      }
    } catch {
      /* already stopped */
    } finally {
      try { await instRef.current.clear(); } catch {}
      const el = document.getElementById(containerId.current);
      if (el) el.innerHTML = "";
      startedRef.current = false;
      setRunning(false);
    }
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !instRef.current) return;
    setErr("");
    try {
      if (runningRef.current) await stop();
      if (typeof instRef.current.scanFileV2 === "function") {
        const { decodedText } = await instRef.current.scanFileV2(file, true);
        latestOnResult.current?.(decodedText);
      } else {
        const decodedText = await instRef.current.scanFile(file, true);
        latestOnResult.current?.(decodedText);
      }
    } catch {
      setErr("Could not decode that image.");
    } finally {
      if (cameraId) start();
      e.target.value = "";
    }
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <select
          value={cameraId || ""}
          onChange={(e) => setCameraId(e.target.value || null)}
          disabled={running}
          style={{ minWidth: 160 }}
          aria-label="Select camera"
        >
          {devices.length === 0 ? <option value="">No camera</option> : null}
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Camera ${d.deviceId.slice(-4)}`}
            </option>
          ))}
        </select>

        {!running ? (
          <button className="cp-btn" onClick={start} disabled={!cameraId}>Start scanning</button>
        ) : (
          <button className="cp-btn ghost" onClick={stop}>Stop</button>
        )}

        <label className="cp-btn ghost" style={{ cursor: "pointer" }}>
          Scan image file
          <input type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
        </label>

        <span className="muted" aria-live="polite">
          {running ? "Camera running" : "Camera idle"}
        </span>
      </div>

      {/* Video region */}
      <div
        id={containerId.current}
        style={{
          width: "100%",
          maxWidth: 520,
          height: 300,
          background: "#f5f7fa",
          border: "1px solid #e3e8ef",
          borderRadius: 10,
          overflow: "hidden",
        }}
      />
      {err && <div className="driver-error" role="alert" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

/* ------------------------------ Details modal ------------------------------ */

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
              // eslint-disable-next-line react/no-array-index-key
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
                // eslint-disable-next-line react/no-array-index-key
                <li key={i}>
                  <span>{val(h?.stage || h?.note)}</span>
                  <span className="time">
                    {formatTS(h?.at)}
                    {h?.by ? ` • by ${val(h.by)}` : ""}
                  </span>
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
    // eslint-disable-next-line no-restricted-syntax
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

  /* ------------------ Pickup scan state + helpers ------------------ */
  const [scanState, setScanState] = useState({
    open: false,
    delivery: null,
    expected: [],   // [{ assetDocId, assetId, itemName }]
    scanned: {},    // { assetId: true }
    error: "",
  });

  // Robust loader: delivery.items → order.items → delivery.expectedAssetIds
  async function loadExpectedAssets(delivery) {
    const order = delivery?.order || {};
    const items = Array.isArray(order.items) ? order.items : [];

    // A) DELIVERY items[].assignedAssets
    const assetToItemName = new Map();
    const dItems = Array.isArray(delivery?.items) ? delivery.items : [];
    dItems.forEach((it) => {
      const arr = Array.isArray(it?.assignedAssets) ? it.assignedAssets : [];
      arr.forEach((assetDocId) => assetToItemName.set(assetDocId, it?.name || "Item"));
    });

    // B) ORDER items[].assignedAssets
    if (assetToItemName.size === 0) {
      items.forEach((it) => {
        const arr = Array.isArray(it?.assignedAssets) ? it.assignedAssets : [];
        arr.forEach((assetDocId) => assetToItemName.set(assetDocId, it?.name || "Item"));
      });
    }

    // C) DELIVERY expectedAssetIds
    if (assetToItemName.size === 0) {
      const exp = Array.isArray(delivery?.expectedAssetIds) ? delivery.expectedAssetIds : [];
      exp.forEach((assetDocId) => assetToItemName.set(assetDocId, "Item"));
    }

    if (assetToItemName.size === 0) {
      return { expected: [], reason: "No assigned assets found on delivery/order." };
    }

    // Resolve asset doc IDs → human assetId used in QR
    const expected = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const [assetDocId, itemName] of assetToItemName.entries()) {
      try {
        const snap = await getDoc(doc(db, "assets", assetDocId));
        if (!snap.exists()) continue;
        const a = snap.data() || {};

        // Skip already-out items (comment to include)
        if ((a.status || "").toLowerCase() === "out_for_rental") continue;

        expected.push({ assetDocId, assetId: a.assetId, itemName });
      } catch {
        /* ignore */
      }
    }

    return {
      expected,
      reason: expected.length ? "" : "Assets exist but were filtered (likely already out_for_rental).",
    };
  }

  const openPickupScan = async (delivery) => {
    const { expected, reason } = await loadExpectedAssets(delivery);
    setScanState({
      open: true,
      delivery,
      expected,
      scanned: {},
      error: expected.length ? "" : (reason || "No assets assigned to this delivery."),
    });
  };

  const matchScanToExpected = (text) => {
    const payload = String(text || "").trim();
    const setIds = new Set(scanState.expected.map((e) => e.assetId));
    if (setIds.has(payload)) return payload;
    // Support deep links like /asset/<assetId>
    // eslint-disable-next-line no-restricted-syntax
    for (const id of setIds) {
      if (payload.includes(id)) return id;
    }
    return null;
  };

  const confirmPickup = async () => {
    try {
      const toCheckout = scanState.expected
        .filter((x) => scanState.scanned[x.assetId])
        .map((x) => x.assetDocId);

      // checkout each asset (out_for_rental)
      // eslint-disable-next-line no-restricted-syntax
      for (const assetDocId of toCheckout) {
        // eslint-disable-next-line no-await-in-loop
        await checkoutAsset(assetDocId, { note: "Checked out at pickup by driver" });
      }

      // move delivery + order to in_transit
      // eslint-disable-next-line no-use-before-define
      await updateStage(scanState.delivery.id, "in_transit");

      setScanState((s) => ({ ...s, open: false }));
    } catch (e) {
      // eslint-disable-next-line no-alert, no-console
      alert("Pickup failed. Please retry.");
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

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
      // eslint-disable-next-line no-alert, no-console
      alert("Failed to update stage. Check your connection and permissions.");
      // eslint-disable-next-line no-console
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
                        data={{
                          items: activeItems,
                          onOpen: setSelected,
                          onStage: updateStage,
                          onStartPickup: openPickupScan,
                        }}
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

      {/* ---------- Pickup Scan Modal ---------- */}
      {scanState.open && (
        <div className="modal-overlay" onClick={() => setScanState((s) => ({ ...s, open: false }))}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <header>
              <h3>Pickup — Scan assigned assets</h3>
              <button onClick={() => setScanState((s) => ({ ...s, open: false }))} aria-label="Close">✖</button>
            </header>

            {/* List of required items with names & asset ids */}
            <div className="modal-section">
              <div className="muted" style={{ marginBottom: 8 }}>
                Required: {scanState.expected.length} • Scanned: {Object.keys(scanState.scanned).length}
              </div>
              <table className="cp-table">
                <thead>
                  <tr><th>Item</th><th>Asset ID</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {scanState.expected.map((x) => (
                    <tr key={x.assetDocId}>
                      <td>{x.itemName}</td>
                      <td className="strong">{x.assetId}</td>
                      <td>{scanState.scanned[x.assetId] ? "✓ scanned" : "pending"}</td>
                    </tr>
                  ))}
                  {scanState.expected.length === 0 && (
                    <tr><td colSpan={3} className="muted">No assets assigned.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Scanner */}
            <div className="modal-section">
              <QRScanner
                onResult={(text) => {
                  const matched = matchScanToExpected(text);
                  if (!matched) {
                    setScanState((st) => ({ ...st, error: "Scanned code not part of this pickup." }));
                    return;
                  }
                  setScanState((st) => ({
                    ...st,
                    scanned: st.scanned[matched] ? st.scanned : { ...st.scanned, [matched]: true },
                    error: "",
                  }));
                }}
              />
              {scanState.error && <div className="driver-error" role="alert" style={{ marginTop: 8 }}>{scanState.error}</div>}
            </div>

            <div className="modal-section" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="cp-btn ghost" onClick={() => setScanState((s) => ({ ...s, open: false }))}>Cancel</button>
              <button
                className="cp-btn"
                disabled={
                  scanState.expected.length === 0 ||
                  Object.keys(scanState.scanned).length < scanState.expected.length
                }
                onClick={confirmPickup}
              >
                Confirm Pickup
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="driver-error" role="alert">{val(error)}</div>}
    </div>
  );
}
