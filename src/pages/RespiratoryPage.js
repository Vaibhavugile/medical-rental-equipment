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



export default function RespiratoryPage() {
  useEffect(() => {
    document.title = "Respiratory Care at Home | BookMyMedicare";
  }, []);

  const section1 = {
    eyebrow: "HOME HEALTHCARE SERVICES",
    title: "Respiratory Care at Home",
    lead:
     "Respiratory care at home involves providing specialized medical support to patients with breathing difficulties, lung diseases, or those recovering from respiratory illnesses all in the comfort and safety of their home.",
    paragraphs: [
      "It includes the use of oxygen therapy, nebulization, BiPAP/CPAP machines, and monitoring by trained professionals, ensuring patients can breathe easier without frequent hospital visits."
    ],
    bullets: [
    ],
    img: "/respiratory.jpg",
    imgAlt: "Respiratory Care At Home | BookMyMedicare",
    imageOnRight: false,

    // <<< ADDED: top padding so section1 is offset below TopBar + Header
    paddingTop: "calc(var(--topbar-height) + var(--header-height) + 22px)"
  };

  const section2 = {
    eyebrow: "Who Requires Respiratory Care at Home?",
    title: "Who Requires Respiratory Care at Home?",
    lead:
    "Patients with Chronic Obstructive Pulmonary Disease (COPD), post-COVID recovery patients with lung complications, and individuals with pneumonia, asthma, or bronchitis.",
    paragraphs: [
        "People with interstitial lung disease (ILD), neurological or bedridden patients with weak respiratory muscles, and elderly patients requiring long-term oxygen therapy.",
        "Home respiratory care is more cost-effective than hospital stays and provides comfort in familiar surroundings while reducing infection risks.",
    ],
    bullets: [],
    img: "/respiratory2.jpg",
    imgAlt: "Respiratory Care At Home",
    imageOnRight: true
  };

  const stepsSection = {
    title: "How BookMyMedicare Team Works",
    subtitle: "Clinical + technical workflow to bring hospital-grade palliative care to your home.",
    steps: [
      {
        title: "Medical assessment of patient by respiratory specialist to understand patient breathing needs at home.",
        text: ""
      },
      {
        title: "Technical team visit patient residence to understand the requirement for installing respiratory equipment like oxygen concentrators, BiPAP/CPAP machines.",
        text: ""
      },
      {
        title: "Installation of required respiratory equipment at patient residence by technical team and running trials to ensure all equipment are working fine.",
        text: ""
      },
      {
        title: "Setup of monitoring systems and training family members on equipment usage and emergency procedures.",
        text: ""
      },
      {
        title: "The respiratory care team virtually assess the patient vitals and breathing status daily with physical visits for treatment plan and proper counseling.",
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
