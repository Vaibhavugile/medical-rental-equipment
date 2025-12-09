// src/pages/ICUPage.jsx
import React, { useEffect } from "react";
import ServicePageFull from "../frontend/ServiceStepsAnimated"; // adjust path if needed
import "../frontend/ServiceStepsAnimated.css";
import "./ICUPage.css";
import Header from "../frontend/Header";
import TopBar from "../frontend/TopBar";
import WhyChooseUsUnique from "../frontend/WhyChooseUsUnique";
import HeroWithForm from "../frontend/HeroWithForm";
import ReviewsSection from "../frontend/ReviewsSection";
import Footer from "../frontend/Footer";



export default function AmbulancePage() {
  useEffect(() => {
    document.title = " Ambulance Services | BookMyMedicare";
  }, []);

  const section1 = {
    eyebrow: "HOME HEALTHCARE SERVICES",
    title: "Ambulance Services",
    lead:
    "An ambulance service provides emergency and non-emergency medical transportation for patients who require urgent or medically supervised transfer. Ambulances are equipped with life-saving equipment and trained personnel to ensure safe, timely care while en route to hospitals or between medical facilities."
    ,
    paragraphs: [
        "We have dedicated ambulance team which ensures availability of normal (non-emergency) or cardiac ambulance 24/7, ensuring all patients are safely transported to hospital facility or home care facility."
    ],
    bullets: [
    ],
    img: "/ambulance.jpg",
    imgAlt: "Ambulance Services | BookMyMedicare",
    imageOnRight: false,

    // <<< ADDED: top padding so section1 is offset below TopBar + Header
    paddingTop: "calc(var(--topbar-height) + var(--header-height) + 22px)"
  };

  const section2 = {
    eyebrow: "When is Ambulance Service Needed?",
    title: "When is Ambulance Service Needed?",
    lead:
      "Medical emergencies (heart attack, stroke, trauma), non-emergency transport for bedridden or critical patients, and hospital-to-home transfers requiring medical supervision",
    paragraphs: [
        "Inter-hospital transfers, palliative or end-of-life transport, and event medical coverage (ambulance on standby) for various medical situations.",
        "Professional ambulance service provides rapid response in emergencies, onboard medical support by trained staff, and safe transport for critical patients with 24/7 availability."
    ],
    bullets: [],
    img: "/ambulance_img.png",
    imgAlt: "Ambulance Services | BookMyMedicare",
    imageOnRight: true
  };

  const stepsSection = {
    title: "How BookMyMedicare Team Works",
    subtitle: "Clinical + technical workflow to bring hospital-grade palliative care to your home.",
    steps: [
      {
        title: "Emergency call received and immediate response team coordination for rapid ambulance dispatch.",
        text: ""
      },
      {
        title: "GPS-tracked dispatch system ensures accurate and fast arrival at patient location with appropriate ambulance type.",
        text: ""
      },
      {
        title: "Onboard medical assessment by trained EMTs, nurses, or paramedics with life-saving equipment and monitoring.",
        text: ""
      },
      {
        title: "Safe and medically supervised transport to hospital or medical facility with continuous patient monitoring.",
        text: ""
      },
      {
        title: " Seamless transfer and coordination with receiving medical team for smooth handover and continuity of care.",
        text: ""
      }
    ]
  };

  return (
    <div>
      <TopBar />
      <Header />
      <ServicePageFull
        section1={section1}
        section2={section2}
        stepsSection={stepsSection}
      />
     <WhyChooseUsUnique />
      <HeroWithForm />
           
           <ReviewsSection  autoplay={true} autoplayDelay={3500} />
           <Footer />
      
    </div>
  );
}
