import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import MapProvider from "./MapProvider";
import { HelmetProvider } from "react-helmet-async";

// If you already have BrowserRouter here, keep it.
// If BrowserRouter is inside App.js, that's fine too.

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <MapProvider>
        <App />
      </MapProvider>
    </HelmetProvider>
  </React.StrictMode>
);

// Optional CRA default:
// import reportWebVitals from './reportWebVitals';
// reportWebVitals();

console.log("🚀 index.js rendered with HelmetProvider + MapProvider");
