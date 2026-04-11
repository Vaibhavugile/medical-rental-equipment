import React from "react";
import { Helmet } from "react-helmet";
import Header from "../frontend/Header"; // adjust path if Header lives in a subfolder
import TopBar from "../frontend/TopBar";
import Footer from "../frontend/Footer";
import FloatingContact from "../frontend/FloatingContact";
const BrochurePage = () => {
  return (
    
    <div style={{ padding: "40px", textAlign: "center", background: "#f5f5f5", minHeight: "100vh" }}>
     <TopBar />
      <Header />

      <Helmet>
  <title>ResMed Lumis Ventilator Brochure PDF Download | BookMyMedicare</title>

  <meta 
    name="description" 
    content="Download ResMed Lumis ventilator brochure PDF. Get full specifications, features and ICU usage details." 
  />

  <meta name="keywords" content="ResMed Lumis brochure, ventilator brochure PDF, ICU ventilator PDF" />
</Helmet>

      <div style={{
        background: "#fff",
        padding: "30px",
        borderRadius: "10px",
        maxWidth: "800px",
        margin: "auto",
        marginTop:"50px",
        boxShadow: "0 0 10px rgba(13, 13, 13, 0.1)"
      }}>

        <h1>ResMed Lumis Ventilator Brochure</h1>

        <p>
  Download ResMed Lumis ventilator brochure PDF. 
  This non-invasive ventilator is ideal for home ICU.
</p>

<p style={{ fontSize: "14px", color: "#666" }}>
  ResMed Lumis ventilator brochure PDF download, ICU ventilator details, home ICU equipment brochure.
</p>

        {/* 👇 PDF Preview */}
        <iframe
          src="/brochureresmed-lumis.pdf"
          width="100%"
          height="500px"
          style={{ marginTop: "20px", borderRadius: "10px" }}
          title="Brochure Preview"
        ></iframe>

        {/* Buttons */}
        <div style={{ marginTop: "20px" }}>
          <a 
            href="/brochureresmed-lumis.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "#007bff",
              color: "#fff",
              padding: "10px 20px",
              marginRight: "10px",
              textDecoration: "none",
              borderRadius: "5px"
            }}
          >
            View Full Brochure
          </a>

          <a 
            href="/brochureresmed-lumis.pdf"
            download
            style={{
              background: "#28a745",
              color: "#fff",
              padding: "10px 20px",
              textDecoration: "none",
              borderRadius: "5px"
            }}
          >
            Download PDF
          </a>
        </div>

      </div>
        
    </div>
  );
};

export default BrochurePage;