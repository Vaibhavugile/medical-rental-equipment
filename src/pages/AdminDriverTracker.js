// src/pages/AdminDriverTracker.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, InfoWindow, Circle } from "@react-google-maps/api";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";

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
  const base = role === "marketing" ? "marketing" : "drivers"; // 👈 role-aware base collection

  const [date, setDate] = useState(() => initialDate ?? toYmd(new Date()));
  const [points, setPoints] = useState([]);        // raw points
  const [live, setLive] = useState(null);          // live point
  const [attn, setAttn] = useState(null);          // attendance doc
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [cursorIdx, setCursorIdx] = useState(0);
  const [stopAddresses, setStopAddresses] = useState({}); // key => formatted address

  const mapRef = useRef(null);
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

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Date</label>
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <div className="text-sm text-black/70 ml-4">
          {attn
            ? <>Status: <b>{attn.status}</b>{" "}
               {attn.checkInMs ? `• In: ${toLocal(attn.checkInMs)}` : ""}{" "}
               {attn.checkOutMs ? `• Out: ${toLocal(attn.checkOutMs)}` : ""}</>
            : "No attendance record"}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="px-3 py-1 rounded bg-black/80 text-white"
            disabled={!effectivePoints.length}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, effectivePoints.length - 1)}
            value={Math.min(cursorIdx, Math.max(0, effectivePoints.length - 1))}
            onChange={(e) => setCursorIdx(Number(e.target.value))}
            className="w-56"
          />
          <span className="text-xs tabular-nums">
            {effectivePoints.length ? `${cursorIdx + 1}/${effectivePoints.length}` : "0/0"}
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="w-full" style={{ height }}>
        <GoogleMap
          onLoad={onMapLoad}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={mapCenter}
          zoom={zoom}
          options={{ streetViewControl: false, mapTypeControl: false }}
        >
          {/* Path with direction arrows */}
          {path.length > 1 && (
            <Polyline
              path={path}
              options={{
                strokeOpacity: 1,
                strokeWeight: 4,
                icons: window.google?.maps ? [{
                  icon: { path: window.google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2 },
                  offset: "0",
                  repeat: "60px",
                }] : undefined,
              }}
            />
          )}

          {/* Start & End */}
          {start && (
            <Marker
              position={{ lat: start.lat, lng: start.lng }}
              label="S"
              onClick={() => setSelectedPoint(start)}
            />
          )}
          {end && (
            <Marker
              position={{ lat: end.lat, lng: end.lng }}
              label="E"
              onClick={() => setSelectedPoint(end)}
            />
          )}

          {/* Playback cursor */}
          {cursor && (
            <Marker
              position={{ lat: cursor.lat, lng: cursor.lng }}
              onClick={() => setSelectedPoint(cursor)}
            />
          )}

          {/* Live */}
          {live && Number.isFinite(live.lat) && Number.isFinite(live.lng) && (
            <Marker
              position={{ lat: live.lat, lng: live.lng }}
              label="LIVE"
              onClick={() => {
                const sel = { ...live, capturedAtMs: live.capturedAtMs ?? Date.now() };
                setSelectedPoint(sel);
              }}
            />
          )}

          {/* Stops (circles + numbered markers) */}
          {report.stops.map((s, i) => (
            <React.Fragment key={`stop-${i}`}>
              <Circle
                center={{ lat: s.center.lat, lng: s.center.lng }}
                radius={18}
                options={{ strokeOpacity: 0.7, strokeWeight: 1, fillOpacity: 0.15 }}
              />
              <Marker
                position={{ lat: s.center.lat, lng: s.center.lng }}
                label={`${i + 1}`}
                onClick={() => setSelectedPoint({
                  lat: s.center.lat,
                  lng: s.center.lng,
                  capturedAtMs: s.startMs,
                  _stop: s,
                })}
              />
            </React.Fragment>
          ))}

          {/* InfoWindow (point or stop) */}
          {selectedPoint && (
            <InfoWindow
              position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
              onCloseClick={() => setSelectedPoint(null)}
            >
              <div className="text-xs space-y-1" style={{ maxWidth: 260 }}>
                {selectedPoint._stop ? (
                  <>
                    <div><b>Stop</b> #{report.stops.findIndex(s => s === selectedPoint._stop) + 1}</div>
                    <div><b>Start:</b> {toLocal(selectedPoint._stop.startMs)}</div>
                    <div><b>End:</b> {toLocal(selectedPoint._stop.endMs)}</div>
                    <div><b>Duration:</b> {fmtDuration(selectedPoint._stop.durationMs)}</div>
                    <div>
                      <b>Location:</b>{" "}
                      {stopAddresses[stopKey(selectedPoint.lat, selectedPoint.lng)] ?? "Loading..."}
                    </div>
                  </>
                ) : (
                  <>
                    <div><b>Time:</b> {selectedPoint.capturedAtMs ? toLocal(selectedPoint.capturedAtMs) : "—"}</div>
                    <div><b>Lat/Lng:</b> {selectedPoint.lat.toFixed(6)}, {selectedPoint.lng.toFixed(6)}</div>
                    {Number.isFinite(selectedPoint.speed) && (
                      <div><b>Speed:</b> {mpsToKmph(selectedPoint.speed).toFixed(1)} km/h</div>
                    )}
                    {Number.isFinite(selectedPoint.accuracy) && (
                      <div><b>Accuracy:</b> ±{Math.round(selectedPoint.accuracy)} m</div>
                    )}
                  </>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Summary / Detailed report */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <div className="text-sm p-3 border rounded">
          <div className="font-medium mb-2">Day Summary</div>
          <div>Points: {points.length} raw → {cleanPoints.length} clean</div>
          <div>
            Distance: {(report.distanceM / 1000).toFixed(2)} km •{" "}
            Moving: {fmtDuration(report.movingMs)} •{" "}
            Idle: {fmtDuration(report.idleMs)}
          </div>
          <div>
            Offline (between check-in & check-out): {fmtDuration(report.offline.totalMs)}
            {report.offline.gaps.length
              ? ` • ${report.offline.gaps.length} gap${report.offline.gaps.length > 1 ? "s" : ""}`
              : ""}
          </div>
          <div>
            {live
              ? `Live: ${isOnline(live) ? "online" : "offline"} (${live._source || "user"})`
              : "Live unavailable"}
          </div>
        </div>

        <div className="text-sm p-3 border rounded">
          <div className="font-medium mb-2">
            Stops ({report.stops.length})
          </div>
          {report.stops.length === 0 ? (
            <div className="text-black/70">No stops detected.</div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 260 }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left">
                    <th>#</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Duration</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {report.stops.map((s, i) => {
                    const key = stopKey(s.center.lat, s.center.lng);
                    return (
                      <tr key={`row-${i}`}>
                        <td>{i + 1}</td>
                        <td>{toLocal(s.startMs)}</td>
                        <td>{toLocal(s.endMs)}</td>
                        <td>{fmtDuration(s.durationMs)}</td>
                        <td>{stopAddresses[key] ?? "Loading..."}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
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
