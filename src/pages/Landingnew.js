import React, { useEffect,useState } from "react";
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
import ServicesGrid from "../frontend/ServicesGrid";
import FloatingContact from "../frontend/FloatingContact";
import EnquiryModal from "../frontend/EnquiryModal";
import EnquiryForm from "../frontend/EnquiryForm";
export default function LandingNew() {
    const [open, setOpen] = useState(false);

  // ✅ AUTO OPEN ON PAGE LOAD
  useEffect(() => {
    const t = setTimeout(() => {
      setOpen(true);
    }, 300); // small delay for smooth UX

    return () => clearTimeout(t);
  }, []);
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
        <Hero />
      </section>
      <section className="about-us" id="about-us">

      <AboutUs />
      </section>
      <ServicesGrid />
      {/* <TrustPremium />
<ExperienceTrust /> 
       <WhoWeAreUnique />
       <HowWeWorkUnique /> */}
       <WhyChooseUsUnique />
        

      <section id="contact">
        <HeroWithForm />
      </section>
      <section id="reviews">
      <ReviewsSection  autoplay={true} autoplayDelay={3500} />
      </section>
      <Footer />
 <FloatingContact />
  <EnquiryModal open={open} onClose={() => setOpen(false)}>
        <h3 style={{ marginBottom: "12px" }}>Request a Callback</h3>
        <EnquiryForm onSuccess={() => setTimeout(() => setOpen(false), 1200)} />
      </EnquiryModal>
      
      
      
    </div>
      </>
  );
}
