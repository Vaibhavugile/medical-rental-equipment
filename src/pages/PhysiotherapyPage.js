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



export default function PhysiotherapyPage() {
  useEffect(() => {
    document.title = "Physiotherapy at Home| BookMyMedicare";
  }, []);

  const section1 = {
    eyebrow: "HOME HEALTHCARE SERVICES",
    title: "Physiotherapy at Home",
    lead:
    "Physiotherapy at home is a personalized rehabilitation service where a licensed physiotherapist visits the patient's home to provide therapeutic exercises, pain relief techniques, mobility training, and recovery support.",
    paragraphs: [
     "This service helps individuals recover faster, regain strength, and manage chronic conditions in the comfort of their own home."
    ],
    bullets: [
    ],
    img: "/Physiotherapy.jpg",
    imgAlt: "Physiotherapy at Home | BookMyMedicare",
    imageOnRight: false,

    // <<< ADDED: top padding so section1 is offset below TopBar + Header
    paddingTop: "calc(var(--topbar-height) + var(--header-height) + 22px)"
  };

  const section2 = {
    eyebrow: "Who Needs Home Physiotherapy?",
    title: "Who Needs Home Physiotherapy?",
    lead:
    "Patients recovering from orthopedic surgery (knee/hip replacement), individuals with stroke, paralysis, or neurological issues, and elderly patients needing balance, mobility, or fall prevention support.",
    paragraphs: [
      "People with chronic pain such as back pain, arthritis, or frozen shoulder, post-hospital discharge patients who cannot travel, and children or adults with developmental delays or injuries.",
      "Home physiotherapy provides one-on-one attention in a stress-free environment, ideal for bedridden or mobility-limited patients with flexible timing to suit the patient's routine.",
    ],
    bullets: [],
    img: "/Physiotherapy2.jpg",
    imgAlt: "Physiotherapy at Home",
    imageOnRight: true
  };

  const stepsSection = {
    title: "How BookMyMedicare Team Works",
    subtitle: "Clinical + technical workflow to bring hospital-grade palliative care to your home.",
    steps: [
      {
        title: "Thorough initial assessment by certified physiotherapist to understand patient condition and mobility needs at home.",
        text: ""
      },
      {
        title: "Development of goal-based treatment plan customized for patient's specific condition and recovery requirements.",
        text: ""
      },
      {
        title: "Setup of home exercise program with necessary equipment like TENS, exercise tools, bands, etc. if needed.",
        text: ""
      },
      {
        title: " Regular physiotherapy sessions with progress tracking and family education on exercises and care techniques.",
        text: ""
      },
      {
        title: "Ongoing progress monitoring with coordination with doctors for complex cases and adjustment of treatment plans as needed.",
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
