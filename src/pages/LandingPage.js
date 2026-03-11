import React, { useEffect } from "react";
import Header from "../frontend/Header"; // adjust path if Header lives in a subfolder
import TopBar from "../frontend/TopBar";
import styles from "./LandingPage.module.css";
import Hero from "../frontend/Hero";
import WhoWeAreUnique from "../frontend/WhoWeAre";
import HowWeWorkUnique from "../frontend/HowWeWorkUnique";
import WhyChooseUsUnique from "../frontend/WhyChooseUsUnique";
import ServicesSection from "../frontend/ServicesSection";
import HeroWithForm from "../frontend/HeroWithForm";
import ReviewsSection from "../frontend/ReviewsSection";
import Footer from "../frontend/Footer";
import SEO from "../components/SEO";
import MedicalSchema from "../components/MedicalSchema";
import TrustPremium from "../frontend/TrustSignals";
import ExperienceTrust from "../frontend/ExperienceTrust";
import AboutUs from "../frontend/AboutUs";
import FloatingContact from "../frontend/FloatingContact";
import SetupGallery from "../frontend/SetupGallery";
import TrustedProviders from "../frontend/TrustedProviders";
import YoutubeVideos from "../frontend/YoutubeVideos";
import HeroSlider from "../frontend/HeroSlider";
import StatsBar from "../frontend/StatsBar";
import AboutSection from "../frontend/AboutSection";
import SupportingPatients from "../frontend/SupportingPatients";
import Meet from "../frontend/Meet";
import "./LandingPage.module.css";
import SupportingSlider from "../frontend/SupportingSlider";


export default function LandingPage() {
  useEffect(() => {
  if (!window.location.hash) return;

  const id = window.location.hash.replace("#", "");
  const el = document.getElementById(id);

  if (!el) return;

  // wait for layout to fully paint
  setTimeout(() => {
    const header = document.querySelector("header");
    const headerOffset = header?.offsetHeight || 0;

    const elTop = el.getBoundingClientRect().top + window.pageYOffset;

    window.scrollTo({
      top: elTop - headerOffset - 12,
      behavior: "smooth",
    });
  }, 150);
}, []);

  return (
    <>
      {/* ✅ SEO — LANDING PAGE */}
      <SEO
        title="BookMyMedicCare | Home Nursing, ICU Setup, Ambulance & Medical Equipment"
        description="BookMyMedicCare provides ICU setup at home, professional nursing care, ambulance services, physiotherapy, diagnostics, pharmacy delivery and medical equipment rental."
        keywords="home nursing care, ICU setup at home, ambulance service, physiotherapy at home, medical equipment rental"
        canonical="https://www.bookmymediccare.com/"
      />
        <MedicalSchema />
    <div className={styles.page}>
     <TopBar />
      <Header />
       <section id="home">
       <HeroSlider />
      </section>
     
      
         <section id="services">
        <ServicesSection />
      </section>
    {/* <Doctors/> */}
    {/* <Meet/> */}
       <WhoWeAreUnique />
       <HowWeWorkUnique />

       <WhyChooseUsUnique />
       {/* <SupportingPatients /> */}
       <SupportingSlider />
              <TrustedProviders />

       
{/* 
         <section
  id="gallery"
  aria-label="Completed Medical Setups Gallery"
>
  <SetupGallery id="gallery" />
</section> */}

<YoutubeVideos />
 
      <AboutSection />
      <StatsBar />
      <Meet />

     

      <section id="contact">
        <HeroWithForm />
      </section>

            <TrustPremium />
<ExperienceTrust /> 

      <ReviewsSection  autoplay={true} autoplayDelay={3500} />

      <Footer />
      <FloatingContact />

      
      
    </div>
      </>
  );
}
