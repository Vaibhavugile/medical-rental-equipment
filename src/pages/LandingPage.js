import React from "react";
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
  return (
    <div className={styles.page}>
     <TopBar />
      <Header />
       <Hero />
       <WhoWeAreUnique />
       <HowWeWorkUnique />
       <WhyChooseUsUnique />
       <ServicesSection />
       <HeroWithForm />
      
      <ReviewsSection  autoplay={true} autoplayDelay={3500} />
      <Footer />

      
      
    </div>
  );
}
