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



export default function DiagnosticPage() {
useEffect(() => {
  document.title = "Lab Services at Home | Home Health Care Services | Book My Medicare";

  const description = document.querySelector('meta[name="description"]');

  if (description) {
    description.setAttribute(
      "content",
      "Get lab services at home with Book My Medicare. Trusted home health care services for sample collection, accurate reports and doorstep testing today."
    );
  }
}, []);

  const section1 = {
    eyebrow: "HOME HEALTHCARE SERVICES",
    title: "Diagnostic Services At Home",
    lead:
    "Diagnostic services at home offer medical tests like blood work and ultrasounds directly at your place, providing convenience, especially for those unable to visit medical facilities easily."
    ,
    paragraphs: [
    ],
    bullets: [
    ],
    img: "/service1.png",
    imgAlt: "Diagnostic Services | BookMyMedicare",
    imageOnRight: true,

    // <<< ADDED: top padding so section1 is offset below TopBar + Header
    paddingTop: "calc(var(--topbar-height) + var(--header-height) + 22px)"
  };



 

  return (
    <div>
      <TopBar />
      <Header />
      <ServicePageFull
        section1={section1}
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
