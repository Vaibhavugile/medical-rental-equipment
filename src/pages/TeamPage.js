import React, { useEffect } from "react";
import "./TeamPage.css";
import Header from "../frontend/Header";
import TopBar from "../frontend/TopBar";
import WhyChooseUsUnique from "../frontend/WhyChooseUsUnique";
import HeroWithForm from "../frontend/HeroWithForm";
import ReviewsSection from "../frontend/ReviewsSection";
import Footer from "../frontend/Footer";
import SEO from "../components/SEO";

const executiveTeam = [
  {
    name: "Dr. Nilesh M Gumardar",
    role: "Chief Operating Officer",
    image: "/team/doctor-male.png",
  },
  {
    name: "Dr. Satish Sharma",
    role: "Consultant Oncologist",
    image: "/team/doctor-male.png",
  },
  {
    name: "Dr. Rupali Mathur",
    role: "Consultant Physician",
    image: "/team/doctor-female.png",
  },
];

const medicalTeam = [

  {
    name: "Dr. Ritu Nandanikar",
    role: "MS General Surgeon",
    image: "/team/doctor-female.png",
  },
  {
    name: "Dr. Divyen Kothia",
    role: "DM Cardiologist",
    image: "/team/doctor-female.png",
  },
  {
    name: "Dr. Nikunj Kothia",
    role: "Senior Radiologist",
    image: "/team/doctor-male.png",
  },
  {
    name: "Dr. Khushboo Khatri & Team",
    role: "Master Physiotherapy",
    image: "/team/doctor-female.png",
  },
];

function TeamSection({ title, subtitle, members }) {
  return (
    <section className="team-section">
      
      {subtitle && <p className="team-subtitle">{subtitle}</p>}
      <h2 className="team-title">{title}</h2>

      <div className="team-grid">
        {members.map((m, i) => (
          <div key={i} className="team-card">
            <div className="avatar">
              <img src={m.image} alt="Our Team" />
            </div>
            <h3>{m.name}</h3>
            <p>{m.role}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TeamPage() {
	

  return (
  <>
  <SEO
        title="Our Team | Health Care at Home Experts | Book My Medicare"
        description="Meet our experienced home health agency team delivering trusted health care at home, nursing services, ICU at home solutions and quality patient support."
        keywords="home nursing care, ICU setup at home, ambulance service, physiotherapy at home, medical equipment rental"
        canonical="https://bookmymedicare.com/our-team"
      />
    <main className="team-page">
            <TopBar />
            <Header />
      
      <TeamSection
        subtitle="MEET OUR EXECUTIVE TEAM"
        title="Committed to Providing the Best Care & Support"
        members={executiveTeam}
      />

      <TeamSection
        title="Our Medical Specialists"
        members={medicalTeam}
      />
           <WhyChooseUsUnique />
               <section id="contact">
              <HeroWithForm />
            </section>
                 
                 <ReviewsSection  autoplay={true} autoplayDelay={3500} />
                 <Footer />
      
    </main>
    </>
  );
}
