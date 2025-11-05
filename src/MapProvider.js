// src/MapProvider.jsx
import React from "react";
import { useJsApiLoader } from "@react-google-maps/api";

const LIBRARIES = ["places"]; // keep this constant outside the component
const GOOGLE_MAPS_KEY = "AIzaSyCi0Y6Q3d5KUZBiF_umvz2-tFXJdjDf5cQ"; // <-- put your key here

export default function MapProvider({ children }) {
  console.log("🔧 MapProvider mounted. Using hard-coded key?",
    typeof GOOGLE_MAPS_KEY === "string" && GOOGLE_MAPS_KEY.length > 0
  );

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: LIBRARIES,
  });

  if (loadError) {
    console.error("❌ Google Maps failed to load:", loadError);
    return <div>Failed to load Google Maps</div>;
  }

  if (!isLoaded) {
    console.log("⏳ Google Maps: loading…");
    return <div>Loading map…</div>;
  }

  console.log("✅ Google Maps loaded. window.google?", !!window.google);
  return children;
}
