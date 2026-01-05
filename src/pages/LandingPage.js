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
    <div className={styles.page}>
     <TopBar />
      <Header />
       <section id="home">
        <Hero />
      </section>
       <WhoWeAreUnique />
       <HowWeWorkUnique />
       <WhyChooseUsUnique />
        <section id="services">
        <ServicesSection />
      </section>

      <section id="contact">
        <HeroWithForm />
      </section>
      
      <ReviewsSection  autoplay={true} autoplayDelay={3500} />
      <Footer />

      
      
    </div>
  );
}
