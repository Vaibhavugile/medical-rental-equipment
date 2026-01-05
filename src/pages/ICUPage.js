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



export default function ICUPage() {
  useEffect(() => {
    document.title = "ICU Setup at Home | BookMyMedicare";
  }, []);

  const section1 = {
    eyebrow: "HOME HEALTHCARE SERVICES",
    title: "ICU Setup at Home",
    lead:
      "ICU setup at home is a clinical term where a patient who requires intensive care are supervised under healthcare team who have expertise in handling Critical patients.",
    paragraphs: [
      "These Healthcare team consist of"
    ],
    bullets: [
      "Senior Physician & On-call Consultant",
      "Skilled & Experienced Nursing Team",
      "Respiratory Therapist & Physiotherapist",
      "Certified Technical Engineers",
      "24/7 Clinical & Technical Support"
    ],
    img: "/icu_setup.png",
    imgAlt: "ICU setup at home",
    imageOnRight: false,

    // <<< ADDED: top padding so section1 is offset below TopBar + Header
    paddingTop: "calc(var(--topbar-height) + var(--header-height) + 22px)"
  };

  const section2 = {
    eyebrow: "WHO REQUIRES ICU",
    title: "Who Requires ICU Setup at Home?",
    lead:
      "Home ICU is chosen after clinical evaluation — when continued intensive monitoring or specific equipment is required but the patient can be managed safely outside hospital.",
    paragraphs: [],
    bullets: [
      "Mainly the treating consultant may advice the Patient relative for HomeCare services owing to a. Infection risk at hospital b. No further intervention is required for the patient",
      "Financially Homecare service is more cost effective than in Hospital, almost 35 to 40%",
      "Healing & Recovery fastens with family member around and in familiar environment"
    ],
    img: "/icu2.png",
    imgAlt: "Patient receiving home ICU care",
    imageOnRight: true
  };

  const stepsSection = {
    title: "How BookMyMedicare Team Works",
    subtitle: "Clinical + technical workflow to bring hospital-grade ICU care to your home.",
    steps: [
      {
        title: "Medical assessment of patient",
        text: "Medical assessment of patient by doctor to understand patient need at home."
      },
      {
        title: "Technical home survey",
        text: "Technical Team visit patient residence to understand the requirement at home for installing the medical equipment."
      },
      {
        title: "Installation & testing",
        text: "Installation of required medical equipment at patient residence by technical team and running a trial to ensure all equipment are working fine."
      },
      {
        title: "Shift & stabilize",
        text: "Finally shifting of patient at residence under medical team supervision, stabilizing the patient at home and followed by consultant treatment plan."
      },
      {
        title: "Daily monitoring & follow-up",
        text: "The Medical Team virtually assesses the patient vitals and status daily and does on-demand physical visits for further treatment planning and counseling."
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
