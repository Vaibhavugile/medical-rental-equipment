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



export default function PalliativePage() {
  useEffect(() => {
    document.title = "Palliative Care at Home | BookMyMedicare";
  }, []);

  const section1 = {
    eyebrow: "HOME HEALTHCARE SERVICES",
    title: "Palliative Care at Home",
    lead:
      "Palliative care at home is specialized, compassionate care focused on relieving pain, managing symptoms, and improving the quality of life for patients with serious, chronic, or life-limiting conditions all from the comfort of home.",
    paragraphs: [
      "It is ideal for patients with cancer (advanced stages), heart, lung, kidney, or liver failure, neurological disorders, elderly patients with multiple health issues, and those choosing comfort-focused care over aggressive treatment."
    ],
    bullets: [
    ],
    img: "/palliative.jpg",
    imgAlt: "Palliative Care At Home | BookMyMedicare",
    imageOnRight: true,

    // <<< ADDED: top padding so section1 is offset below TopBar + Header
    paddingTop: "calc(var(--topbar-height) + var(--header-height) + 22px)"
  };

  const section2 = {
    eyebrow: "Who Needs Palliative Care at Home?",
    title: "Who Needs Palliative Care at Home?",
    lead:
      "Patients with cancer (advanced stages), heart, lung, kidney, or liver failure, and neurological disorders like Parkinson's, Alzheimer's, or stroke requiring specialized comfort care.",
    paragraphs: [
        "Elderly patients with multiple health issues and those choosing comfort-focused care over aggressive treatment benefit greatly from home-based palliative care.",
        "Home palliative care provides comfort in familiar surroundings, personalized care tailored to patient needs, and emotional support for both patient and family during critical situations."
    ],
    bullets: [],
    img: "/palliative2.jpg",
    imgAlt: "Patient receiving palliative care at home",
    imageOnRight: false
  };

  const stepsSection = {
    title: "How BookMyMedicare Team Works",
    subtitle: "Clinical + technical workflow to bring hospital-grade palliative care to your home.",
    steps: [
      {
        title: "Initial assessment by palliative care specialist to understand patient condition and comfort care requirements at home.",
        text: ""
      },
      {
        title: "Technical team visit patient residence to understand the requirement for installing palliative care equipment like hospital bed, oxygen support, suction machine, air mattress.",
        text: ""
      },
      {
        title: "Delivery and setup of medical equipment on rent or purchase as per patient's condition with proper installation and testing.",
        text: ""
      },
      {
        title: " Deployment of trained nurses and caregivers with coordination with existing physician for continuity of care.",
        text: ""
      },
      {
        title: " Ongoing palliative care with pain management, symptom monitoring, and 24/7 on-call support for urgent medical needs.",
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
