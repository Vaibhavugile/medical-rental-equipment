// src/pages/AdminDriverTracker.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, InfoWindow, Circle } from "@react-google-maps/api";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import "./AdminDriverTracker.css";

/**
 * AdminDriverTracker (detailed report with reverse geocoded stop addresses) — ROLE AWARE
 *
 * Props:
 * - db: Firestore instance
 * - driverId: string
 * - role: "drivers" | "marketing"  (default "drivers")
 * - initialDate: YYYY-MM-DD (optional; defaults to today)
 * - height: CSS height (default "70vh")
 * - autoFit: boolean (default true)
 *
 * Firestore:
 *   <base>/{userId}/attendance/{yyyy-MM-dd}
 *   <base>/{userId}/attendance/{yyyy-MM-dd}/locations/{id}
 *   <base>/{userId}/live/current
 *   <base>/{userId}/attendance/{yyyy-MM-dd}/live/current
 * where <base> = "drivers" | "marketing"
 */
const collectionByRole = (role) => {
  if (role === "marketing") return "marketing";
  if (role === "staff") return "staff";
  if (role === "users") return "users";   // ✅ ADD THIS
  return "drivers";
};

const DEBUG = false;
const log  = (...a) => DEBUG && console.log("[Tracker]", ...a);
const warn = (...a) => DEBUG && console.warn("[Tracker]", ...a);
const err  = (...a) => DEBUG && console.error("[Tracker]", ...a);

export default function AdminDriverTracker({
  db,
  driverId,
  role = "drivers",            // 👈 NEW: role prop
  initialDate,
  height = "70vh",
  autoFit = true,
}) {
const base = collectionByRole(role);

  const [date, setDate] = useState(() => initialDate ?? toYmd(new Date()));
  const [points, setPoints] = useState([]);        // raw points
  const [live, setLive] = useState(null);          // live point
  const [attn, setAttn] = useState(null);          // attendance doc
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [cursorIdx, setCursorIdx] = useState(0);
  const [stopAddresses, setStopAddresses] = useState({}); // key => formatted address

  const mapRef = useRef(null);
  const mapShellRef = useRef(null);
  const [mapType, setMapType] = useState("roadmap");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playbackTimer = useRef(null);
  const liveUnsubRef = useRef(null);
  const dayUnsubRef = useRef(null);
  const locUnsubRef = useRef(null);
  const attnUnsubRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(playbackTimer.current);
      try { liveUnsubRef.current && liveUnsubRef.current(); } catch {}
      try { dayUnsubRef.current && dayUnsubRef.current(); } catch {}
      try { locUnsubRef.current && locUnsubRef.current(); } catch {}
      try { attnUnsubRef.current && attnUnsubRef.current(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  // Attendance (check-in/out/status)
  useEffect(() => {
    if (!db || !driverId || !date) return;
    try { attnUnsubRef.current && attnUnsubRef.current(); } catch {}
    attnUnsubRef.current = onSnapshot(
      doc(db, `${base}/${driverId}/attendance/${date}`), // 👈 role-aware
      (d) => {
        const v = d.data();
        if (v) {
          setAttn({
            status: v.status || "unknown",
            checkInMs: v.checkInMs ?? null,
            checkOutMs: v.checkOutMs ?? null,
          });
        } else {
          setAttn(null);
        }
      },
      (e) => err("🔥 onSnapshot(attendance)", e)
    );
    return () => {
      try { attnUnsubRef.current && attnUnsubRef.current(); } catch {}
      attnUnsubRef.current = null;
    };
  }, [db, driverId, date, base]);

  // Day locations
  useEffect(() => {
    if (!db || !driverId || !date) {
      warn("⏸️ missing db/driverId/date", { hasDb: !!db, driverId, date });
      return;
    }
    if (locUnsubRef.current) {
      try { locUnsubRef.current(); } catch {}
      locUnsubRef.current = null;
    }

    const path = `${base}/${driverId}/attendance/${date}/locations`; // 👈 role-aware
    const qy = query(collection(db, path), orderBy("capturedAtMs", "asc"));
    locUnsubRef.current = onSnapshot(
      qy,
      (snap) => {
        const arr = [];
        snap.forEach((d) => {
          const v = d.data();
          if (Number.isFinite(v?.lat) && Number.isFinite(v?.lng)) {
            // robust timestamp extraction
            const ts =
              (Number.isFinite(v.capturedAtMs) ? v.capturedAtMs : null) ??
              (v.capturedAtServer && typeof v.capturedAtServer.toMillis === "function"
                ? v.capturedAtServer.toMillis()
                : null) ??
              (v.capturedAt && typeof v.capturedAt.toMillis === "function"
                ? v.capturedAt.toMillis()
                : null);

            arr.push({
              id: d.id,
              lat: v.lat,
              lng: v.lng,
              accuracy: v.accuracy ?? null,
              speed: v.speed ?? null,
              heading: v.heading ?? null,
              capturedAtMs: ts,
            });
          }
        });
        setPoints(arr);
        setCursorIdx((idx) => Math.min(idx, Math.max(0, arr.length - 1)));

        if (autoFit && arr.length && mapRef.current && window.google?.maps) {
          fitToPath(mapRef.current, arr);
        }
      },
      (e) => err("🔥 onSnapshot(locations)", e)
    );

    return () => {
      if (locUnsubRef.current) {
        try { locUnsubRef.current(); } catch {}
        locUnsubRef.current = null;
      }
    };
  }, [db, driverId, date, autoFit, base]);

  // Live (user-level, fallback to day-level)
  useEffect(() => {
    if (!db || !driverId) return;

    try { liveUnsubRef.current && liveUnsubRef.current(); } catch {}
    try { dayUnsubRef.current && dayUnsubRef.current(); } catch {}
    liveUnsubRef.current = null;
    dayUnsubRef.current = null;

    const today = date || toYmd(new Date());
    const userLivePath = `${base}/${driverId}/live/current`;                       // 👈 role-aware
    const dayLivePath = `${base}/${driverId}/attendance/${today}/live/current`;     // 👈 role-aware

    // user-level
    liveUnsubRef.current = onSnapshot(
      doc(db, userLivePath),
      (d) => {
        const v = d.data();
        if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng)) {
          const ts =
            (Number.isFinite(v.capturedAtMs) ? v.capturedAtMs : null) ??
            (v.capturedAtServer && typeof v.capturedAtServer.toMillis === "function"
              ? v.capturedAtServer.toMillis()
              : null) ??
            (v.capturedAt && typeof v.capturedAt.toMillis === "function"
              ? v.capturedAt.toMillis()
              : null);

          setLive({ ...v, id: d.id, _source: "user", capturedAtMs: ts });
          try { dayUnsubRef.current && dayUnsubRef.current(); } catch {}
          dayUnsubRef.current = null;
        } else {
          // fallback day-level
          if (!dayUnsubRef.current) {
            dayUnsubRef.current = onSnapshot(
              doc(db, dayLivePath),
              (d2) => {
                const v2 = d2.data();
                if (v2 && Number.isFinite(v2.lat) && Number.isFinite(v2.lng)) {
                  const ts2 =
                    (Number.isFinite(v2.capturedAtMs) ? v2.capturedAtMs : null) ??
                    (v2.capturedAtServer && typeof v2.capturedAtServer.toMillis === "function"
                      ? v2.capturedAtServer.toMillis()
                      : null) ??
                    (v2.capturedAt && typeof v2.capturedAt.toMillis === "function"
                      ? v2.capturedAt.toMillis()
                      : null);

                  setLive({ ...v2, id: d2.id, _source: "day", capturedAtMs: ts2 });
                } else {
                  setLive(null);
                }
              },
              (e) => err("🔥 onSnapshot(day-live)", e)
            );
          }
        }
      },
      (e) => err("🔥 onSnapshot(user-live)", e)
    );

  }, [db, driverId, date, base]);

  // Clean points (looser thresholds)
  const cleanPoints = useMemo(() => {
    return preprocessPoints(points, {
      maxAcc: 200,
      maxJump: 2000,
      collapseWithin: 8,
      slowSpeed: 0.8,
      emaAlpha: 0.15,
    });
  }, [points]);

  // Fall back to raw if cleaning leaves < 2
  const effectivePoints = cleanPoints.length >= 2 ? cleanPoints : points;

  const path = useMemo(
    () => effectivePoints.map((p) => ({ lat: p.lat, lng: p.lng })),
    [effectivePoints]
  );

  const start  = effectivePoints[0] ?? null;
  const end    = effectivePoints.length ? effectivePoints[effectivePoints.length - 1] : null;
  const cursor = effectivePoints[cursorIdx] ?? null;

  // Report (distance, moving/idle, stops, offline gaps)
  const report = useMemo(() => {
    const { distanceM, movingMs, idleMs } = summarizeDay(effectivePoints);
    const stops = detectStops(effectivePoints, { radiusM: 25, minDurationMs: 3 * 60 * 1000 });
    const offline = computeOfflineGaps(
      effectivePoints,
      attn?.checkInMs ?? null,
      attn?.checkOutMs ?? null,
      5 * 60 * 1000
    );
    return { distanceM, movingMs, idleMs, stops, offline };
  }, [effectivePoints, attn]);

  // Fetch addresses for newly-detected stops (reverse geocode)
  useEffect(() => {
    if (!report?.stops?.length) return;
    report.stops.forEach(async (s) => {
      const key = stopKey(s.center.lat, s.center.lng);
      if (!stopAddresses[key]) {
        const address = await getAddressFromLatLng(s.center.lat, s.center.lng);
        setStopAddresses((prev) => ({ ...prev, [key]: address }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.stops]);

  // Playback
  useEffect(() => {
    if (!playing || effectivePoints.length < 2) return;
    clearInterval(playbackTimer.current);
    playbackTimer.current = setInterval(() => {
      setCursorIdx((i) => (i + 1 < effectivePoints.length ? i + 1 : i));
    }, 500);
    return () => clearInterval(playbackTimer.current);
  }, [playing, effectivePoints]);

  function onMapLoad(map) {
    mapRef.current = map;
    if (autoFit && path.length && window.google?.maps) {
      fitToPath(map, effectivePoints);
    }
  }

  const mapCenter = path[0] ?? { lat: 20.5937, lng: 78.9629 }; // India fallback
  const zoom = path.length ? 15 : 5;
  const online = live ? isOnline(live) : false;
  const activePoint = cursor || end;
  const focusPoint = (point) => {
    if (!point || !mapRef.current) return;
    mapRef.current.panTo({ lat: point.lat, lng: point.lng });
    mapRef.current.setZoom(17);
    setSelectedPoint(point);
  };
  const fitRoute = () => {
    if (!mapRef.current || !window.google?.maps) return;
    const all = [...effectivePoints];
    if (live && Number.isFinite(live.lat) && Number.isFinite(live.lng)) all.push(live);
    if (all.length) fitToPath(mapRef.current, all);
  };
  const changeZoom = (delta) => {
    if (!mapRef.current) return;
    const current = mapRef.current.getZoom() || 14;
    mapRef.current.setZoom(Math.max(3, Math.min(21, current + delta)));
  };
  const toggleFullscreen = async () => {
    const node = mapShellRef.current;
    if (!node) return;
    try {
      if (!document.fullscreenElement) await node.requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) { console.warn("Fullscreen is not available", e); }
  };
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  return (
    <section className="adt-page">
      <header className="adt-header">
        <div>
          <div className="adt-eyebrow"><span className="adt-eyebrow-dot" /> LIVE OPERATIONS</div>
          <h2>Location & activity</h2>
          <p>Review the route, stops and movement history for the selected day.</p>
        </div>
        <div className="adt-header-status">
          <span className={`adt-status-dot ${online ? "is-online" : "is-offline"}`} />
          <span>{online ? "Live location active" : "Live location unavailable"}</span>
        </div>
      </header>

      <div className="adt-toolbar">
        <label className="adt-date-field"><span>TRACKING DATE</span><input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPlaying(false); setSelectedPoint(null); }} /></label>
        <div className="adt-attendance">
          <span className="adt-attendance-label">ATTENDANCE</span>
          <strong className={`adt-attendance-state ${attn?.status === "checked_in" || attn?.status === "present" ? "good" : ""}`}>{attn?.status || "No record"}</strong>
          <small>{attn?.checkInMs ? `In ${toLocal(attn.checkInMs)}` : "Not checked in"}{attn?.checkOutMs ? ` · Out ${toLocal(attn.checkOutMs)}` : ""}</small>
        </div>
        <div className="adt-playback">
          <button className={`adt-button ${playing ? "adt-button-dark" : "adt-button-primary"}`} onClick={() => { if (cursorIdx >= effectivePoints.length - 1) setCursorIdx(0); setPlaying((v) => !v); }} disabled={effectivePoints.length < 2}>
            <span>{playing ? "Ⅱ" : "▶"}</span>{playing ? "Pause replay" : "Replay route"}
          </button>
          <div className="adt-range-wrap"><input aria-label="Route playback position" type="range" min={0} max={Math.max(0, effectivePoints.length - 1)} value={Math.min(cursorIdx, Math.max(0, effectivePoints.length - 1))} onChange={(e) => { setPlaying(false); setCursorIdx(Number(e.target.value)); }} disabled={!effectivePoints.length} /><span>{effectivePoints.length ? `${Math.min(cursorIdx + 1, effectivePoints.length)} / ${effectivePoints.length}` : "0 / 0"}</span></div>
        </div>
      </div>

      <div className="adt-kpis">
        <div className="adt-kpi"><span className="adt-kpi-icon purple">↗</span><div><small>DISTANCE COVERED</small><strong>{(report.distanceM / 1000).toFixed(2)} <em>km</em></strong></div></div>
        <div className="adt-kpi"><span className="adt-kpi-icon green">◷</span><div><small>MOVING TIME</small><strong>{fmtDuration(report.movingMs)}</strong></div></div>
        <div className="adt-kpi"><span className="adt-kpi-icon amber">Ⅱ</span><div><small>IDLE TIME</small><strong>{fmtDuration(report.idleMs)}</strong></div></div>
        <div className="adt-kpi"><span className="adt-kpi-icon blue">⌖</span><div><small>STOPS DETECTED</small><strong>{report.stops.length}</strong></div></div>
      </div>

      <div className="adt-main-grid">
        <section className="adt-map-card">
          <div className="adt-map-heading"><div><h3>Route map</h3><p>{effectivePoints.length ? `${effectivePoints.length.toLocaleString()} recorded location points` : "No route points for this date"}</p></div><div className="adt-map-legend"><span><i className="legend-start" /> Start</span><span><i className="legend-stop" /> Stop</span><span><i className="legend-live" /> Live</span></div></div>
          <div className="adt-map-shell" ref={mapShellRef}>
            <GoogleMap onLoad={onMapLoad} mapContainerStyle={{ width: "100%", height: "100%" }} center={mapCenter} zoom={zoom} options={{
              streetViewControl: false, mapTypeControl: false, fullscreenControl: false, zoomControl: false,
              clickableIcons: false, gestureHandling: "greedy", mapTypeId: mapType,
              keyboardShortcuts: true, disableDoubleClickZoom: false,
              styles: mapType === "roadmap" ? [
                { featureType: "poi", elementType: "labels", stylers: [{ visibility: "simplified" }] },
                { featureType: "transit", elementType: "labels", stylers: [{ visibility: "on" }] }
              ] : undefined
            }}>
              {path.length > 1 && <Polyline path={path} options={{ strokeColor: "#5267e8", strokeOpacity: 0.95, strokeWeight: 5, geodesic: true, zIndex: 2, icons: window.google?.maps ? [{ icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2, fillColor: "#ffffff", fillOpacity: 1, strokeColor: "#5267e8", strokeWeight: 1 }, offset: "50%", repeat: "120px" }] : undefined }} />}
              {start && <Marker position={{ lat: start.lat, lng: start.lng }} title="Route start" label={{ text: "S", color: "#fff", fontWeight: "700" }} icon={window.google?.maps ? { path: window.google.maps.SymbolPath.CIRCLE, scale: 13, fillColor: "#159b70", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 } : undefined} onClick={() => focusPoint(start)} />}
              {end && effectivePoints.length > 1 && <Marker position={{ lat: end.lat, lng: end.lng }} title="Last recorded location" label={{ text: "E", color: "#fff", fontWeight: "700" }} icon={window.google?.maps ? { path: window.google.maps.SymbolPath.CIRCLE, scale: 13, fillColor: "#e05262", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 } : undefined} onClick={() => focusPoint(end)} />}
              {cursor && <Marker position={{ lat: cursor.lat, lng: cursor.lng }} title="Playback position" zIndex={10} icon={window.google?.maps ? { path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: "#5367e8", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 } : undefined} onClick={() => focusPoint(cursor)} />}
              {live && Number.isFinite(live.lat) && Number.isFinite(live.lng) && <Marker position={{ lat: live.lat, lng: live.lng }} title={online ? "Live location" : "Last known location"} zIndex={20} icon={window.google?.maps ? { path: window.google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: online ? "#16a36a" : "#8b95a7", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 4 } : undefined} onClick={() => focusPoint({ ...live, capturedAtMs: live.capturedAtMs ?? Date.now() })} />}
              {report.stops.map((stop, i) => <React.Fragment key={`stop-${i}`}><Circle center={stop.center} radius={22} options={{ strokeColor: "#e39a32", strokeOpacity: 0.75, strokeWeight: 1.5, fillColor: "#f7b955", fillOpacity: 0.18, clickable: false }} /><Marker position={stop.center} title={`Stop ${i + 1} · ${fmtDuration(stop.durationMs)}`} label={{ text: String(i + 1), color: "#fff", fontWeight: "800", fontSize: "12px" }} icon={window.google?.maps ? { path: window.google.maps.SymbolPath.CIRCLE, scale: 13, fillColor: "#e59a35", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 } : undefined} onClick={() => focusPoint({ lat: stop.center.lat, lng: stop.center.lng, capturedAtMs: stop.startMs, _stop: stop })} /></React.Fragment>)}
              {selectedPoint && <InfoWindow position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }} onCloseClick={() => setSelectedPoint(null)}><div className="adt-infowindow">{selectedPoint._stop ? <><b>Stop {report.stops.findIndex((s) => s === selectedPoint._stop) + 1}</b><span>{fmtDuration(selectedPoint._stop.durationMs)} stopped</span><small>{toLocal(selectedPoint._stop.startMs)} – {toLocal(selectedPoint._stop.endMs)}</small><small>{stopAddresses[stopKey(selectedPoint.lat, selectedPoint.lng)] || "Resolving address…"}</small></> : <><b>{selectedPoint === live ? "Live location" : "Recorded location"}</b><span>{selectedPoint.capturedAtMs ? toLocal(selectedPoint.capturedAtMs) : "Time unavailable"}</span><small>{selectedPoint.lat.toFixed(6)}, {selectedPoint.lng.toFixed(6)}</small>{Number.isFinite(selectedPoint.speed) && <small>{mpsToKmph(selectedPoint.speed).toFixed(1)} km/h</small>}</>}</div></InfoWindow>}
            </GoogleMap>
            <div className="adt-map-controls"><button type="button" title="Zoom in" onClick={() => changeZoom(1)}>＋</button><button type="button" title="Zoom out" onClick={() => changeZoom(-1)}>−</button><i /><button type="button" title="Fit route" onClick={fitRoute}>⌗</button><button type="button" title={isFullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>{isFullscreen ? "↙" : "⛶"}</button></div>
            <div className="adt-map-type"><button className={mapType === "roadmap" ? "active" : ""} onClick={() => setMapType("roadmap")}>Map</button><button className={mapType === "satellite" ? "active" : ""} onClick={() => setMapType("satellite")}>Satellite</button></div>
            {!effectivePoints.length && <div className="adt-map-empty"><span>⌖</span><b>No route recorded</b><small>Try another date or check whether location tracking was enabled.</small></div>}
          </div>
          <div className="adt-map-footer"><span><b>{points.length}</b> raw points <i /> <b>{cleanPoints.length}</b> filtered points</span><button onClick={fitRoute} disabled={!effectivePoints.length}>Fit entire route <span>↗</span></button></div>
        </section>

        <aside className="adt-side-card">
          <div className="adt-side-heading"><div><h3>Journey timeline</h3><p>Stops and key moments</p></div><span className="adt-count-pill">{report.stops.length} stops</span></div>
          <div className="adt-timeline">
            {start && <button className="adt-timeline-item" onClick={() => focusPoint(start)}><span className="adt-timeline-marker start-marker">S</span><span className="adt-timeline-content"><b>Journey started</b><small>{start.capturedAtMs ? toLocal(start.capturedAtMs) : "Time unavailable"}</small></span><span className="adt-timeline-arrow">↗</span></button>}
            {report.stops.map((stop, i) => <button className="adt-timeline-item" key={`timeline-${i}`} onClick={() => focusPoint({ lat: stop.center.lat, lng: stop.center.lng, capturedAtMs: stop.startMs, _stop: stop })}><span className="adt-timeline-marker stop-marker">{i + 1}</span><span className="adt-timeline-content"><b>Stop {i + 1}</b><small>{toLocal(stop.startMs)}</small><small className="adt-address">{stopAddresses[stopKey(stop.center.lat, stop.center.lng)] || "Finding address…"}</small><em>{fmtDuration(stop.durationMs)} stop duration</em></span><span className="adt-timeline-arrow">↗</span></button>)}
            {end && effectivePoints.length > 1 && <button className="adt-timeline-item" onClick={() => focusPoint(end)}><span className="adt-timeline-marker end-marker">E</span><span className="adt-timeline-content"><b>Last recorded point</b><small>{end.capturedAtMs ? toLocal(end.capturedAtMs) : "Time unavailable"}</small></span><span className="adt-timeline-arrow">↗</span></button>}
            {!start && <div className="adt-empty-state"><span>⌖</span><b>No journey activity</b><small>Location history will appear here when points are available.</small></div>}
          </div>
          <div className="adt-side-bottom"><div><span>OFFLINE TIME</span><b>{fmtDuration(report.offline.totalMs)}</b><small>{report.offline.gaps.length} tracking gaps detected</small></div><div><span>LIVE STATUS</span><b className={online ? "text-online" : "text-offline"}>{online ? "Online" : "Unavailable"}</b><small>{live?.capturedAtMs ? `Updated ${toLocal(live.capturedAtMs)}` : "No live coordinates"}</small></div></div>
        </aside>
      </div>

      <section className="adt-detail-card"><div className="adt-detail-heading"><div><h3>Stop details</h3><p>Tap any stop to locate it on the map.</p></div><span className="adt-count-pill">{report.stops.length} locations</span></div>
        {report.stops.length ? <div className="adt-stop-list">{report.stops.map((stop, i) => { const key = stopKey(stop.center.lat, stop.center.lng); return <button className="adt-stop-row" key={`detail-${i}`} onClick={() => focusPoint({ lat: stop.center.lat, lng: stop.center.lng, capturedAtMs: stop.startMs, _stop: stop })}><span className="adt-stop-number">{i + 1}</span><span className="adt-stop-main"><b>Stop {i + 1}</b><small>{stopAddresses[key] || "Address is being resolved…"}</small></span><span className="adt-stop-time"><b>{fmtDuration(stop.durationMs)}</b><small>{toLocal(stop.startMs)}</small></span><span className="adt-stop-chevron">↗</span></button>; })}</div> : <div className="adt-no-stops">No stops of 3 minutes or longer were detected for this day.</div>}
      </section>
      <div className="adt-footnote">Route and stop details are based on location points received by the device. Gaps may occur when GPS, network or background permissions are unavailable.</div>
    </section>
  );
}

/* -------------------- helpers -------------------- */

function toYmd(d) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}
function toLocal(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}
function stopKey(lat, lng) {
  // normalize to 6 decimals to avoid mismatched keys due to floating rounding
  return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
}

function fitToPath(map, pts) {
  if (!pts?.length || !window.google?.maps) return;
  const bounds = new window.google.maps.LatLngBounds();
  pts.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
  map.fitBounds(bounds, 64);
}

function mpsToKmph(mps) {
  return mps * 3.6;
}

function isOnline(l) {
  if (!l?.capturedAtMs) return false;
  return Date.now() - l.capturedAtMs <= 3 * 60 * 1000; // 3 minutes
}

// Haversine (meters)
function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Clean + smooth raw points
function preprocessPoints(raw, {
  maxAcc = 200,
  maxJump = 2000,
  collapseWithin = 8,
  slowSpeed = 0.8,
  emaAlpha = 0.15,
} = {}) {
  const out = [];
  let ema = null;

  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;

    // 1) accuracy filter
    if (Number.isFinite(p.accuracy) && p.accuracy > maxAcc) continue;

    // 2) jump filter (needs previous kept point)
    const last = out[out.length - 1];
    if (last) {
      const d = haversineMeters(last, p);
      if (d > maxJump) continue;

      // 3) collapse close points when slow
      const dt = Math.max(0, (p.capturedAtMs ?? 0) - (last.capturedAtMs ?? 0));
      const spd = dt > 0 ? d / (dt / 1000) : 0;
      if (d < collapseWithin && spd < slowSpeed) {
        out[out.length - 1] = p; // keep newer point
        continue;
      }
    }

    // 4) EMA smoothing (visual only)
    if (!ema) {
      ema = { lat: p.lat, lng: p.lng };
    } else {
      ema.lat = ema.lat + emaAlpha * (p.lat - ema.lat);
      ema.lng = ema.lng + emaAlpha * (p.lng - ema.lng);
    }

    out.push({ ...p, lat: ema.lat, lng: ema.lng });
  }
  return out;
}

// Distance & time buckets
function summarizeDay(points) {
  if (!points || points.length < 2) return { distanceM: 0, movingMs: 0, idleMs: 0 };
  let dist = 0, moving = 0, idle = 0;
  const MOVE_SPEED_MPS = 1.2;
  const MAX_GAP = 45 * 60 * 1000; // ignore gaps > 45 min
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1], p2 = points[i];
    const dt = Math.max(0, (p2.capturedAtMs ?? 0) - (p1.capturedAtMs ?? 0));
    if (!dt || dt > MAX_GAP) continue;
    const d = haversineMeters(p1, p2);
    dist += d;
    const spd = d / (dt / 1000);
    if (spd >= MOVE_SPEED_MPS) moving += dt; else idle += dt;
  }
  return { distanceM: dist, movingMs: moving, idleMs: idle };
}

// Stops detection
function detectStops(points, { radiusM = 25, minDurationMs = 3 * 60 * 1000 } = {}) {
  if (!points || points.length < 2) return [];
  const stops = [];
  let cluster = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = cluster[cluster.length - 1];
    const cur = points[i];
    const d = haversineMeters(prev, cur);
    if (d <= radiusM) {
      cluster.push(cur);
    } else {
      maybePushStop(cluster);
      cluster = [cur];
    }
  }
  maybePushStop(cluster);

  function maybePushStop(group) {
    if (!group || group.length < 2) return;
    const startMs = group[0].capturedAtMs ?? 0;
    const endMs   = group[group.length - 1].capturedAtMs ?? 0;
    const duration = Math.max(0, endMs - startMs);
    if (duration >= minDurationMs) {
      const center = centroid(group);
      stops.push({ startMs, endMs, durationMs: duration, center });
    }
  }

  return stops;
}

function centroid(arr) {
  let lat = 0, lng = 0, n = 0;
  for (const p of arr) {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      lat += p.lat; lng += p.lng; n++;
    }
  }
  return { lat: lat / n, lng: lng / n };
}

// Offline gaps confined to check-in/out window
function computeOfflineGaps(points, checkInMs, checkOutMs, gapThresholdMs = 5 * 60 * 1000) {
  const res = { totalMs: 0, gaps: [] };
  if (!checkInMs || !checkOutMs || checkOutMs <= checkInMs) return res;

  const inWindow = points.filter(p => {
    const t = p.capturedAtMs ?? 0;
    return t >= checkInMs && t <= checkOutMs;
  });
  if (inWindow.length < 2) {
    res.totalMs = Math.max(0, checkOutMs - checkInMs);
    res.gaps.push({ startMs: checkInMs, endMs: checkOutMs, durationMs: res.totalMs });
    return res;
  }

  // Leading gap
  if ((inWindow[0].capturedAtMs - checkInMs) > gapThresholdMs) {
    const d = inWindow[0].capturedAtMs - checkInMs;
    res.totalMs += d;
    res.gaps.push({ startMs: checkInMs, endMs: inWindow[0].capturedAtMs, durationMs: d });
  }

  // Middle gaps
  for (let i = 1; i < inWindow.length; i++) {
    const prev = inWindow[i - 1], cur = inWindow[i];
    const dt = (cur.capturedAtMs ?? 0) - (prev.capturedAtMs ?? 0);
    if (dt > gapThresholdMs) {
      res.totalMs += dt;
      res.gaps.push({ startMs: prev.capturedAtMs, endMs: cur.capturedAtMs, durationMs: dt });
    }
  }

  // Trailing gap
  if ((checkOutMs - inWindow[inWindow.length - 1].capturedAtMs) > gapThresholdMs) {
    const d = checkOutMs - inWindow[inWindow.length - 1].capturedAtMs;
    res.totalMs += d;
    res.gaps.push({ startMs: inWindow[inWindow.length - 1].capturedAtMs, endMs: checkOutMs, durationMs: d });
  }

  return res;
}

// Format durations like "1h 23m" or "12m 10s"
function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// Reverse Geocode (lat,lng → address)
async function getAddressFromLatLng(lat, lng) {
  return new Promise((resolve) => {
    if (!window.google || !window.google.maps) return resolve("Unknown location");
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve("Unknown location");
      }
    });
  });
}
