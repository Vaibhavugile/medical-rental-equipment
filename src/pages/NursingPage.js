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



export default function NursingPage() {
  useEffect(() => {
    document.title = "Nursing Care at Home | BookMyMedicare";
  }, []);

  const section1 = {
    eyebrow: "HOME HEALTHCARE SERVICES",
    title: "Nursing Care at Home",
    lead:
    "Nursing care at home brings skilled medical support to patients in the comfort of their own home, whether for critical ICU-level care or basic daily nursing needs.",
    paragraphs: [
     "It helps patients recover, manage long-term illnesses, or live comfortably without repeated hospital visits."
    ],
    bullets: [
    ],
    img: "/nursary-care.jpg",
    imgAlt: "Nursing Care at Home | BookMyMedicare",
    imageOnRight: true,

    // <<< ADDED: top padding so section1 is offset below TopBar + Header
    paddingTop: "calc(var(--topbar-height) + var(--header-height) + 22px)"
  };

  const section2 = {
    eyebrow: "Who Needs Nursing Care at Home?",
    title: "Who Needs Nursing Care at Home?",
    lead:
        "Patients on ventilator, BiPAP, or oxygen support, recovering from major surgery or trauma, in end-stage or palliative conditions, and requiring 24/7 monitoring and advanced medical attention",
    paragraphs: [
        "Also suitable for patients needing post-surgical dressing and injections, catheter insertion or care, feeding support (Ryle's tube, PEG tube), bedsore prevention, and daily assistance for immobile, elderly, or recovering patients.",
        "Home nursing care provides hospital-level medical support in familiar surroundings with family involvement and is more cost-effective than prolonged hospital stays."
    ],
    bullets: [],
    img: "/nurse-2.jpg",
    imgAlt: "Nursing Care at Home",
    imageOnRight: false
  };

  const stepsSection = {
    title: "How BookMyMedicare Team Works",
    subtitle: "Clinical + technical workflow to bring hospital-grade post surgery care to your home.",
    steps: [
      {
        title: "Medical assessment of patient by nursing specialist to understand patient care needs and medical requirements at home.",
        text: ""
      },
      {
        title: "Technical team visit patient residence to understand the requirement for installing nursing equipment like ICU setup, monitors, oxygen, suction machines.",
        text: ""
      },
      {
        title: "Installation of required medical equipment at patient residence by technical team and running trials to ensure all equipment are working fine.",
        text: ""
      },
      {
        title: "Deployment of qualified nursing staff with appropriate shift schedules and training family members on basic care techniques.",
        text: ""
      },
      {
        title: "Continuous nursing care with daily monitoring, medication management, and coordination with treating doctors for ongoing treatment plans.",
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
         <section id="contact">
        <HeroWithForm />
      </section>
           
           <ReviewsSection  autoplay={true} autoplayDelay={3500} />
           <Footer />
      
    </div>
  );
}
