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



export default function PharmacyPage() {
  useEffect(() => {
    document.title = "Pharmacy Home Delivery | BookMyMedicare";
  }, []);

  const section1 = {
    eyebrow: "Pharmacy Home Delivery",
    title: "Pharmacy Home Delivery",
    lead:
      "Pharmacy home delivery is a service that allows patients to receive their prescribed medications and health essentials directly at their home, without the need to visit a pharmacy.",
    paragraphs: [
      "It ensures timely access to medications, especially for elderly patients, chronically ill patients, individuals recovering at home, and patients with limited mobility."
    ],
    bullets: [
    ],
    img: "/pharmacy-delivery.jpg",
    imgAlt: "Pharmacy Home Delivery | BookMyMedicare",
    imageOnRight: true,

    // <<< ADDED: top padding so section1 is offset below TopBar + Header
    paddingTop: "calc(var(--topbar-height) + var(--header-height) + 22px)"
  };

  const section2 = {
    eyebrow: "Why is Pharmacy Home Delivery Needed?",
    title: "Why is Pharmacy Home Delivery Needed?",
    lead:
      "Reduces the need for patients or caregivers to travel, ensuring timely and uninterrupted medication supply. Especially critical for patients on long-term treatments, bedridden, or under palliative care",
    paragraphs: [
        "Provides convenience for elderly patients, chronically ill patients, individuals recovering at home, and patients with limited mobility who cannot easily visit pharmacies",
        "Home delivery ensures medication compliance, reduces infection exposure for immunocompromised patients, and provides emergency delivery options for urgent medication needs."
    ],
    bullets: [],
    img: "/delivery.jpg",
    imgAlt: "Pharmacy Home Delivery | BookMyMedicare",
    imageOnRight: false
  };

  const stepsSection = {
    title: "How BookMyMedicare Team Works",
    subtitle: "Clinical + technical workflow to bring hospital-grade palliative care to your home.",
    steps: [
      {
        title: "Share your prescription via WhatsApp or our website for pharmacist verification.",
        text: ""
      },
      {
        title: "Our pharmacist verifies the prescription and confirms medication availability and pricing.",
        text: ""
      },
      {
        title: "Choose payment method - easy online payments or cash on delivery option available.",
        text: ""
      },
      {
        title: "Medicines are carefully packaged with proper storage requirements and cold-chain maintenance if needed.",
        text: ""
      },
      {
        title: "Same-day or next-day delivery to your home with medication reminders and refill scheduling on request.",
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
