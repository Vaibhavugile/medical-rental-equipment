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



export default function SurgeryPage() {
  useEffect(() => {
    document.title = "Post Surgery Care at Home | BookMyMedicare";
  }, []);

  const section1 = {
    eyebrow: "HOME HEALTHCARE SERVICES",
    title: "Post Surgery Care at Home",
    lead:
      "Post-surgery care at home is a structured recovery support service provided to patients who have undergone surgical procedures and are discharged from the hospital but still require medical supervision, wound care, medication management, and daily assistance.",
    paragraphs: [
      "This care ensures the patient recovers safely and comfortably at home, while reducing the risk of complications and hospital readmissions."
    ],
    bullets: [
    ],
    img: "/post_surgery.jpg",
    imgAlt: "Post Surgery Care at Home | BookMyMedicare",
    imageOnRight: true,

    // <<< ADDED: top padding so section1 is offset below TopBar + Header
    paddingTop: "calc(var(--topbar-height) + var(--header-height) + 22px)"
  };

  const section2 = {
    eyebrow: "WHO REQUIRES Post-SurgeryCare at Home",
    title: "Who Needs Post-SurgeryCare at Home?",
    lead:
      "Post-operative home care is ideal for patients who have undergone orthopedic surgeries (hip/knee replacement, spine surgery), cardiac surgeries (bypass, valve replacement), and abdominal surgeries (hernia repair, appendix, hysterectomy).",
    paragraphs: [
        "Also suitable for neuro surgeries (spinal cord, brain procedures) and any major/minor surgery requiring bed rest, wound care, or physiotherapy.",
        "Home care is cost-effective compared to prolonged hospital stays and provides comfortable recovery in a familiar environment with family support."
    ],
    bullets: [],
    img: "/post_surgery2.jpg",
    imgAlt: "Patient receiving post surgery care at home",
    imageOnRight: false
  };

  const stepsSection = {
    title: "How BookMyMedicare Team Works",
    subtitle: "Clinical + technical workflow to bring hospital-grade post surgery care to your home.",
    steps: [
      {
        title: "Medical assessment of patient by post-surgical specialist to understand recovery needs and wound care requirements at home.",
        text: ""
      },
      {
        title: "Technical team visit patient residence to understand the requirement for installing medical equipment like hospital bed, walker,commode, oxygen support if needed.",
        text: ""
      },
      {
        title: "Installation of required medical equipment at patient residence by technical team and running trials to ensure all equipment are working fine.",
        text: ""
      },
      {
        title: "Setup of nursing care schedule and training family members on wound care, medication management, and emergency procedures.",
        text: ""
      },
      {
        title: "The post-surgical care team monitors patient recovery daily with physical visits for wound inspection, medication management, and physiotherapy coordination.",
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
