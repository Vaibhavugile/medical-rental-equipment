// src/AdminDriverTracker.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, InfoWindow } from "@react-google-maps/api";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";

/**
 * AdminDriverTracker
 *
 * Props:
 * - db: Firestore instance
 * - driverId: string
 * - initialDate: YYYY-MM-DD
 * - height: string (CSS height, default "70vh")
 *
 * Firestore layout expected:
 *   drivers/{driverId}/attendance/{yyyy-MM-dd}/locations/{autoId}
 *   drivers/{driverId}/live/current                 (preferred LIVE)
 *   drivers/{driverId}/attendance/{yyyy-MM-dd}/live/current  (fallback LIVE)
 */

export default function AdminDriverTracker({
  db,
  driverId,
  initialDate,
  height = "70vh",
}) {
  // -------------------- state --------------------
  const [date, setDate] = useState(() => initialDate ?? toYmd(new Date()));
  const [points, setPoints] = useState([]);          // raw points from Firestore
  const [live, setLive] = useState(null);            // live doc (driver/day)
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [cursorIdx, setCursorIdx] = useState(0);

  const mapRef = useRef(null);
  const playbackTimer = useRef(null);

  useEffect(() => {
    console.log("🗺️ AdminDriverTracker mounted. window.google?", !!window.google);
  }, []);

  // keep date in sync with prop changes
  useEffect(() => {
    if (initialDate) {
      console.log("🔁 initialDate prop changed:", initialDate);
      setDate(initialDate);
    }
  }, [initialDate]);

  // -------------------- subscribe: day path --------------------
  useEffect(() => {
    if (!db || !driverId || !date) {
      console.warn("⏸️ Missing db/driverId/date", { hasDb: !!db, driverId, date });
      return;
    }
    const path = `drivers/${driverId}/attendance/${date}/locations`;
    console.log("🔎 Subscribing to:", path);

    const qy = query(collection(db, path), orderBy("capturedAtMs", "asc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        console.log("📥 Snapshot size:", snap.size);
        const arr = [];
        snap.forEach((d) => {
          const v = d.data();
          if (Number.isFinite(v?.lat) && Number.isFinite(v?.lng)) {
            arr.push({
              id: d.id,
              lat: v.lat,
              lng: v.lng,
              accuracy: v.accuracy ?? null,
              speed: v.speed ?? null,
              heading: v.heading ?? null,
              capturedAtMs: v.capturedAtMs ?? null,
            });
          }
        });
        console.log("✅ Valid points parsed:", arr.length);
        setPoints(arr);
        setCursorIdx((idx) => Math.min(idx, Math.max(0, arr.length - 1)));
        if (arr.length && mapRef.current) {
          fitToPath(mapRef.current, arr);
          console.log("🎯 Fit map to path");
        }
      },
      (err) => {
        console.error("🔥 onSnapshot error (locations):", err);
      }
    );
    return () => {
      console.log("🧹 Unsubscribe:", path);
      unsub();
    };
  }, [db, driverId, date]);

  // -------------------- subscribe: LIVE (driver-level, fallback day-level) --------------------
  useEffect(() => {
    if (!db || !driverId) return;

    const today = date || toYmd(new Date());
    const driverLivePath = `drivers/${driverId}/live/current`;
    const dayLivePath = `drivers/${driverId}/attendance/${today}/live/current`;

    console.log("🔎 Try LIVE (driver-level):", driverLivePath);

    let cleanup = () => {};
    const unsubDriver = onSnapshot(
      doc(db, driverLivePath),
      (d) => {
        const v = d.data();
        if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng)) {
          console.log("🟢 LIVE (driver-level) found:", v);
          setLive({ ...v, id: d.id, _source: "driver" });
        } else {
          console.log("🟡 No driver-level LIVE, trying day-level:", dayLivePath);
          const unsubDay = onSnapshot(
            doc(db, dayLivePath),
            (d2) => {
              const v2 = d2.data();
              console.log("📡 Day-level LIVE snapshot:", v2);
              if (v2 && Number.isFinite(v2.lat) && Number.isFinite(v2.lng)) {
                setLive({ ...v2, id: d2.id, _source: "day" });
              } else {
                setLive(null);
              }
            },
            (err) => console.error("🔥 onSnapshot error (day live):", err)
          );
          cleanup = () => unsubDay();
        }
      },
      (err) => console.error("🔥 onSnapshot error (driver live):", err)
    );

    return () => {
      console.log("🧹 Unsubscribe LIVE (any)");
      unsubDriver();
      cleanup();
    };
  }, [db, driverId, date]);

  // -------------------- preprocess & derive --------------------
  // Clean/smooth raw points before drawing
  const cleanPoints = useMemo(() => {
    const cleaned = preprocessPoints(points, {
      maxAcc: 60,        // skip low-accuracy points (>60m). Use 40 for stricter.
      maxJump: 120,      // drop jumps >120m between consecutive samples
      collapseWithin: 12,// collapse near-duplicates (<12m) when slow
      slowSpeed: 1.2,    // m/s threshold for "moving"
      emaAlpha: 0.25,    // smoothing factor
    });
    console.log(`🧼 Cleaned points: ${cleaned.length} (raw ${points.length})`);
    return cleaned;
  }, [points]);

  const path = useMemo(
    () => cleanPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
    [cleanPoints]
  );

  const start = cleanPoints[0] ?? null;
  const end   = cleanPoints.length ? cleanPoints[cleanPoints.length - 1] : null;
  const cursor = cleanPoints[cursorIdx] ?? null;

  const summary = useMemo(() => summarizeDay(cleanPoints), [cleanPoints]);

  // -------------------- playback --------------------
  useEffect(() => {
    if (!playing || cleanPoints.length < 2) return;
    playbackTimer.current && clearInterval(playbackTimer.current);
    playbackTimer.current = setInterval(() => {
      setCursorIdx((i) => (i + 1 < cleanPoints.length ? i + 1 : i));
    }, 500);
    console.log("▶️ Playback started");
    return () => {
      playbackTimer.current && clearInterval(playbackTimer.current);
      console.log("⏸️ Playback stopped");
    };
  }, [playing, cleanPoints]);

  function onMapLoad(map) {
    mapRef.current = map;
    console.log("🗺️ Map onLoad. Map instance saved.");
    if (path.length) {
      fitToPath(map, cleanPoints);
      console.log("🎯 Fit map to initial path");
    }
  }

  // -------------------- render --------------------
  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Date</label>
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={date}
          onChange={(e) => {
            console.log("📝 Date UI changed:", e.target.value);
            setDate(e.target.value);
          }}
        />

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="px-3 py-1 rounded bg-black/80 text-white"
            disabled={!cleanPoints.length}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, cleanPoints.length - 1)}
            value={cursorIdx}
            onChange={(e) => {
              const v = Number(e.target.value);
              console.log("🎚️ Cursor moved to index", v, cleanPoints[v]);
              setCursorIdx(v);
            }}
            className="w-56"
          />
          <span className="text-xs tabular-nums">
            {cleanPoints.length ? `${cursorIdx + 1}/${cleanPoints.length}` : "0/0"}
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="w-full" style={{ height }}>
        <GoogleMap
          onLoad={onMapLoad}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={path[0] ?? { lat: 20.5937, lng: 78.9629 }}
          zoom={path.length ? 15 : 5}
          options={{ streetViewControl: false, mapTypeControl: false }}
        >
          {/* Path */}
          {path.length > 1 && (
            <Polyline
              path={path}
              options={{ strokeOpacity: 1, strokeWeight: 4 }}
              onLoad={() => console.log("➰ Polyline loaded")}
            />
          )}

          {/* Start & End */}
          {start && (
            <Marker
              position={{ lat: start.lat, lng: start.lng }}
              label="S"
              onClick={() => {
                console.log("📍 Start marker clicked", start);
                setSelectedPoint(start);
              }}
            />
          )}
          {end && (
            <Marker
              position={{ lat: end.lat, lng: end.lng }}
              label="E"
              onClick={() => {
                console.log("🏁 End marker clicked", end);
                setSelectedPoint(end);
              }}
            />
          )}

          {/* Playback cursor */}
          {cursor && (
            <Marker
              position={{ lat: cursor.lat, lng: cursor.lng }}
              onClick={() => {
                console.log("▶️ Cursor marker clicked", cursor);
                setSelectedPoint(cursor);
              }}
            />
          )}

          {/* Live */}
          {live && Number.isFinite(live.lat) && Number.isFinite(live.lng) && (
            <Marker
              position={{ lat: live.lat, lng: live.lng }}
              label="LIVE"
              onClick={() => {
                const sel = { ...live, capturedAtMs: live.capturedAtMs ?? Date.now() };
                console.log("🟢 LIVE marker clicked", sel);
                setSelectedPoint(sel);
              }}
            />
          )}

          {/* Info */}
          {selectedPoint && (
            <InfoWindow
              position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
              onCloseClick={() => {
                console.log("❎ InfoWindow closed");
                setSelectedPoint(null);
              }}
            >
              <div className="text-xs space-y-1">
                <div>
                  <span className="font-medium">Time: </span>
                  {selectedPoint.capturedAtMs
                    ? new Date(selectedPoint.capturedAtMs).toLocaleString()
                    : "—"}
                </div>
                <div>
                  <span className="font-medium">Lat/Lng: </span>
                  {selectedPoint.lat.toFixed(6)}, {selectedPoint.lng.toFixed(6)}
                </div>
                {Number.isFinite(selectedPoint.speed) && (
                  <div>
                    <span className="font-medium">Speed: </span>
                    {mpsToKmph(selectedPoint.speed).toFixed(1)} km/h
                  </div>
                )}
                {Number.isFinite(selectedPoint.accuracy) && (
                  <div>
                    <span className="font-medium">Accuracy: </span>
                    ±{Math.round(selectedPoint.accuracy)} m
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Summary / Diagnostics */}
      <div className="text-xs text-black/70" style={{ marginTop: 8 }}>
        <div>
          Points: {points.length} raw → {cleanPoints.length} clean
        </div>
        <div>
          Distance: {(summary.distanceM / 1000).toFixed(2)} km •{" "}
          Moving: {fmtDuration(summary.movingMs)} •{" "}
          Idle: {fmtDuration(summary.idleMs)}
        </div>
        <div>
          {live
            ? `Live OK (${isOnline(live) ? "online" : "offline"} via ${live._source || "driver"})`
            : "Live unavailable."}
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

function fitToPath(map, pts) {
  if (!pts?.length) return;
  const bounds = new window.google.maps.LatLngBounds();
  pts.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
  map.fitBounds(bounds, 64);
}

function mpsToKmph(mps) {
  return mps * 3.6;
}

function isOnline(l) {
  if (!l?.capturedAtMs) return false;
  return Date.now() - l.capturedAtMs <= 3 * 60 * 1000;
}

// Haversine in meters
function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Clean + smooth raw points
function preprocessPoints(raw, {
  maxAcc = 60,        // meters
  maxJump = 120,      // meters between consecutive points
  collapseWithin = 12,// meters: collapse near-duplicates when slow
  slowSpeed = 1.2,    // m/s threshold for "slow/idle"
  emaAlpha = 0.25,    // smoothing factor 0..1
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
        // Replace last with newer (more recent time)
        out[out.length - 1] = p;
        continue;
      }
    }

    // 4) EMA smoothing of lat/lng (visual only)
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

function summarizeDay(points) {
  if (!points || points.length < 2) return { distanceM: 0, movingMs: 0, idleMs: 0 };
  let dist = 0, moving = 0, idle = 0;
  const MOVE_SPEED_MPS = 1.2;
  const MAX_GAP = 10 * 60 * 1000; // ignore gaps > 10 min (phone sleeps etc.)
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
function fmtDuration(ms) {
  if (!ms || ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}h ${m}m ${ss}s`;
}
