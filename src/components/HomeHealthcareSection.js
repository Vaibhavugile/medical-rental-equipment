// HomeHealthcareSection.jsx

import React, { useState } from "react";
import "./HomeHealthcareSection.css";

const HomeHealthcareSection = () => {

  const [expanded, setExpanded] = useState(false);

  return (

    <section className="bmm-main-section">

      <div className="bmm-main-container">

        <div className="bmm-content-wrapper">

          {/* BADGE */}

          <div className="bmm-premium-badge">
            Trusted Healthcare Partner in Mumbai
          </div>

          {/* TITLE */}

          <h1 className="bmm-main-title">
            Your Trusted Partner for
            <span> Home ICU Setup </span>
            & 24/7 Nursing Care in Mumbai
          </h1>

          {/* EXACT ORIGINAL CONTENT */}

          <p className="bmm-main-description">
            In today's fast-paced world, quality healthcare should not be confined to hospitals anymore. As more people wish to take advantage of better health choices that the internet provides, Book My Medicare is a door-to-door advanced healthcare solution. Your wish has come true!
          </p>

          <p className="bmm-main-description">
            At-home health care service in Mumbai may be provided. 24 hour nursing care at home ICU setup in Mumbai: Book My Medicare guarantees compassionate and professional care with this and every other kind of requirement available 24/7 for your convenience. The center's goal is to keep patients as comfortable as possible during recovery from illness, whether it lasts one day or one month!
          </p>

          <p className="bmm-main-description">
            Our vision is simple: to make hospital care available, affordable, and convenient wherever you may be in Mumbai. From senior citizen care to post-operative rehabilitation center and ICU emergency help services, we work for you as the only reliable partner who can deliver the same quality treatment at home as any major hospital does.
          </p>

          {/* BUTTONS */}

          <div className="bmm-cta-wrapper">

            <button
              className="bmm-readmore-button"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show Less" : "Read Full Details"}
            </button>

            

          </div>

          {/* EXPAND SECTION */}

          <div className={`bmm-expandable-content ${expanded ? "bmm-show-content" : ""}`}>

            {/* ========================================= */}
{/* FULL SEO SECTION */}
{/* EXACT SAME CONTENT */}
{/* ========================================= */}

<div className="bmm-seo-section">

  {/* SECTION 1 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">🏥</div>

    <h2>The Range of Home Health Care Services</h2>

    <p>
      At Book My Medicare, we offer a wide range of home health care services to meet different needs. Personalized care is available from our team of trained nurses and caregivers taking charge on site at the patient’s expense, without having to visit the hospital for treatment.
    </p>

    <p>These include our services:</p>

    <ul>
      <li>Nursing Care at Home in Mumbai</li>
      <li>24-hour nursing care at home</li>
      <li>Post-operative care</li>
      <li>Elderly care and assistance</li>
      <li>Physiotherapy at home</li>
      <li>Palliative and critical care</li>
      <li>Doctor visits at home</li>
    </ul>

    <p>
      For recovering at Nursing Care in Mumbai, patients are able to perform in familiar circumstances where recovery is accelerated and expert medical care close at hand.
    </p>
  </div>

  {/* SECTION 2 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">❤️</div>

    <h2>
      Home ICU Setup in Mumbai–Where the Highest Level of Critical Care Comes Home!
    </h2>

    <p>
      The hospital, while essential for emergencies and final solutions to illness, is often not a comfortable location to continue (and may be even contraindicated) long-term treatment. This is one reason Rhapsody Alliance designed our home ICU setup; with it we can provide comprehensive care custom-tailored to each patient within the peace of their own surroundings.
    </p>

    <p>
      Our models of fully-equipped home ICU setups in Mumbai can satisfy every need for sub-acute care. Monitored by competent personnel and laden with modern medical devices, our home ICU setup features:
    </p>

    <ul>
      <li>Ventilators</li>
      <li>Cardiac monitors</li>
      <li>Infusion pumps</li>
      <li>Oxygen support systems</li>
      <li>Suction Machines</li>
    </ul>

    <p>
      Our home ICU setup in Mumbai provides patients with hospital-grade treatment without any hassle. Our team is here 24-hours a day, and if something goes wrong, we’ll come out at once. For ICU setup at home, Mumbai residents turn to us.
    </p>
  </div>

  {/* SECTION 3 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">🫁</div>

    <h2>
      Rent an Oxygen Concentrator in Mumbai – Reliable Respiratory Support
    </h2>

    <p>
      Respiratory conditions require timely and efficient oxygen support. This means, at Book My Medicare, we offer an oxygen concentrator on rent Mumbai solution for patients dealing with breathing problems - so that their nursing care never breaks down.
    </p>

    <p>Our services include:</p>

    <ul>
      <li>Delivery of an oxygen concentrator on rent in Mumbai is quick</li>
      <li>On-site installation</li>
      <li>Near round-the-clock technical support</li>
      <li>Affordable rental plans</li>
    </ul>

    <p>
      Our oxygen concentrator on rent mumbai services in Mumbai are designed for short-term support, such as rehabilitation or extended nursing care at home.
    </p>
  </div>

  {/* SECTION 4 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">🩺</div>

    <h2>
      Renting Medical Equipment in Mumbia – Qick, Convenient & Inexpensive
    </h2>

    <p>
      Many medical conditions require the use of expensive equipment which is you don't want to keep around after it has served itspurpose. This is why we make available medical equipment on rent in mumbai- allowing families access to first-rate apparatuses at affordable prices.
    </p>

    <p>
      We have a range of Medical Equipment on Rental which includes:
    </p>

    <ul>
      <li>Oxygen concentrators</li>
      <li>Wheelchairs</li>
      <li>Patient monitors</li>
      <li>Suction machines</li>
      <li>Nebulizers</li>
    </ul>

    <p>
      So with our medical equipment on rent in mumbai, you can concentrate on taking care of patients without having to worry about high costs.
    </p>
  </div>

  {/* SECTION 5 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">🛏️</div>

    <h2>
      Rent a Hospital Bed in Mumbai – Comforts Meets Health
    </h2>

    <p>
      Proper rest and proper posture are essential for a fast recovery. This is exactly what our hospital bed on rent Mumbai service is designed to do: allow patients to enjoy maximum comfort and support at home.
    </p>

    <p>We offer:</p>

    <ul>
      <li>Manual or electric hospital beds</li>
      <li>Adjustable features for patient comfort</li>
      <li>Quick delivery & installation</li>
      <li>Among the rental plans are a variety that will suit everybody</li>
    </ul>

    <p>
      Renting a hospital bed in Mumbai (mailto:) will help us to avoid: interference, Iaurcele pain, and get back to full vibrancy soon.
    </p>
  </div>

  {/* SECTION 6 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">🏠</div>

    <h2>Who Needs a Home ICU Setup?</h2>

    <p>
      Home ICU setup is more than a critical emergency room, which is also called a home-based healthcare solution, in which those patients need continuous monitoring and advanced medical or nursing care, who would rather stay in the comfort of their own homes.
    </p>

    <p>
      You will have patients in home inductions requiring the setup of a whole ICU at home.
    </p>

    <ul>
      <li>Individuals recovering from major surgeries</li>
      <li>Patients with chronic disease states like COPD, heart failure or neurological conditions</li>
      <li>Geriatric Patients Requiring Long-Term Subacute Care</li>
      <li>All patients who are on a ventilator or receiving oxygen</li>
      <li>People recovering from a stroke or paralysis</li>
      <li>Terminally ill patients requiring palliative care</li>
      <li>Patients who have to be monitored constantly, but would prefer not spending long periods of time in hospital</li>
    </ul>

    <p>
      A home ICU setup in Mumbai exclusively caters to these patients, allowing treatment at hospital-grade care facilities, with none of the emotional and financial pressure that comes with longer-term inpatient therapies.
    </p>
  </div>

  {/* SECTION 7 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">⚕️</div>

    <h2>
      How to Care for Yourself Before Choosing ICU Support at Home
    </h2>

    <p>
      There are some key factors to understand before choosing a home ICU setup, as this will assure safety, efficiency, and the best care outcome possible.
    </p>

    <h3>Medical Evaluation is Essential</h3>

    <p>
      Home ICU is not for everyone. Careful evaluation by a trained intensivist can assess whether the patient's cleanliness is secure for transition and help streamline home care, if necessary.
    </p>

    <h3>Space & Infrastructure Requirements</h3>

    <p>
      There must be enough room for ICU equipment such as ventilators, monitors and oxygen systems. You'll need the right electrical infrastructure and ventilation as well.
    </p>

    <h3>Availability of Skilled Staff</h3>

    <p>
      The model requires educated Intensive Care Unit nurses and support staff. Make sure that the provider has professionals with a record of experience.
    </p>

    <h3>Emergency Preparedness</h3>

    <p>
      Emergencies can happen even at home. It should have escalation plans and rapid transport to the hospital if you work with a reliable service provider.
    </p>

    <h3>Family Involvement</h3>

    <p>
      Family members have an important role in home care. Having some basic training and awareness allows them to back-client.
    </p>
  </div>

  {/* SECTION 8 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">⭐</div>

    <h2>The Pros and Cons of Home ICU Setup</h2>

    <p>
      Of course, as with any medical service offered, there are pros and cons to providing care in the home vs. traditional hospital-based settings.
    </p>

    <h3>Benefits</h3>

    <ul>
      <li>Comfort & Familiar Environment</li>
      <li>Reduced Risk of Hospital-Acquired Infections</li>
      <li>Cost-Effective Care</li>
      <li>Personalized Attention</li>
      <li>Emotional Well-being</li>
    </ul>

    <h3>Risks</h3>

    <ul>
      <li>Limited Immediate Emergency Access</li>
      <li>Equipment and power supply dependency</li>
      <li>Need for Skilled Monitoring</li>
      <li>Not Suitable for Highly Unstable Patients</li>
    </ul>

    <p>
      At Book My Medicare, we mitigate these risks using thorough planning, advanced equipment, and ongoing supervision.
    </p>
  </div>

  {/* SECTION 9 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">🚑</div>

    <h2>BMM Process and How We Set Up an ICU at Home</h2>

    <p>
      Well organized and professional with the transition to home ICU and away from the hospital.
    </p>

    <ul>
      <li>Patient Assessment by a Qualified Intensivist in Hospital</li>
      <li>Home Assessment for Equipment Setup</li>
      <li>Nursing Deployment in Hospital for Proper Handover</li>
      <li>Patient Onboarding and Safe Transportation</li>
      <li>Intensivist Onboarding Visit at Home</li>
      <li>Daily Monitoring and Nursing Care</li>
    </ul>
  </div>

  {/* SECTION 10 */}

  <div className="bmm-content-block">
    <div className="bmm-card-icon">💙</div>

    <h2>24/7 Support You Can Trust</h2>

    <p>
      We do not stop our service at the setup part; at Book My Medicare, we start there.
    </p>

    <p>We provide round-the-clock support through:</p>

    <ul>
      <li>Dedicated nursing supervisors</li>
      <li>Experienced doctors and intensivists</li>
      <li>Skilled technical support team</li>
      <li>Emergency response coordination</li>
    </ul>

    <p>
      With our integrated care model, we are able to provide patients with a consistent and high-quality experience of treatment at all times.
    </p>
  </div>
  {/* SECTION 11 */}

<div className="bmm-content-block">

  <div className="bmm-card-icon">🚑</div>

  <h2>Bringing ICU-Level Care to Your Doorstep</h2>

  <p>
    Considering that the demand for healthcare in a city like Mumbai is far more than what local hospitals can offer, home-based medical solutions will be representative of patients care moving forward. Book My Medicare is the pioneer of this transformation, enabling your eldercare services at home.
  </p>

  <p>
    Be it home ICU setup in Mumbai, oxygen concentrator on rent Mumbai or 24 hour nursing care at home; we are determined to make health-care more affordable and accessible along with compassion.
  </p>

</div>

{/* SECTION 12 */}

<div className="bmm-content-block">

  <div className="bmm-card-icon">👨‍⚕️</div>

  <h2>24h Nursing Care at Home</h2>

  <p>
    For patients, healthcare does not keep regular hours. That's why Book My Medicare provides 24 hour nursing care at home to make sure patients are never without medical help.
  </p>

  <p>
    Our trained nurses can provide:
  </p>

  <ul>
    <li>Medication administration</li>
    <li>Vital monitoring</li>
    <li>Wound care</li>
    <li>IV therapy</li>
    <li>Emergency surport</li>
  </ul>

  <p>
    With 24-hour professional care from a nurse at home, the family can rest at ease knowing their loved ones are in safe hands day and night.
  </p>

</div>

{/* SECTION 13 */}

<div className="bmm-content-block">

  <div className="bmm-card-icon">⭐</div>

  <h2>Why Choose Book My Medicare Services</h2>

  <h3>1) Experienced Medical Professionals</h3>

  <p>
    Our team is made up of highly trained nurses, caregivers, and technicians who provide expert home health care services.
  </p>

  <h3>2) Quick Response & Delivery</h3>

  <p>
    When you need an oxygen concentrator on rent mumbai or a hospital bed on rent mumbai, we respond fast and deliver without hassle.
  </p>

  <h3>3) Affordable Rates</h3>

  <p>
    We offer low-cost solutions in Medical Equipment on Rental without compromising quality.
  </p>

  <h3>4) Individualized Care for Everyone</h3>

  <p>
    Each patient is different; our home icu setup in mumbai and nursing services are tailored to individual needs.
  </p>

  <h3>5) 24/7 Care</h3>

  <p>
    Our twenty-four hour nursing care at home service ensures round-the clock help to assist patients and their families.
  </p>

</div>

{/* SECTION 14 */}

<div className="bmm-content-block">

  <div className="bmm-card-icon">🏥</div>

  <h2>
    Home ICU Setup in Mumbai – The Safe Alternative to Hospitals
  </h2>

  <p>
    Stays in hospital can be stressful, expensive, and uncomfortable; our home icu setup in mumbai o ers a safer, more convenient option.
  </p>

  <p>
    Being at home o ers many advantages:
  </p>

  <ul>
    <li>Cut the risk of infection</li>
    <li>Individual treatment</li>
    <li>Family involvement</li>
    <li>Cheaper treatment</li>
  </ul>

  <p>
    With our know-how in treating patients at home, including setting up an home icu, Mumbai sees turned into a complete medical environment.
  </p>

</div>

{/* SECTION 15 */}

<div className="bmm-content-block">

  <div className="bmm-card-icon">🩺</div>

  <h2>
    Medical Equipment on Rental – Convenient and Adaptable
  </h2>

  <p>
    Our medical Equipment on Rental services is for all short term recovery or long term care. No matter, you will never have lack of equipment when you need it.
  </p>

  <p>
    From medical equipment on rent in mumbai and oxygen concentrator, to ICU doctor in the doorsteps of a hospital, all these things are being satisfiedunder one roof.
  </p>

  <p>
    Explore our wide range of medical equipment on rent in Mumbai designed to support patient care at home with ease and affordability.
  </p>

</div>

{/* SECTION 16 */}

<div className="bmm-content-block">

  <div className="bmm-card-icon">📍</div>

  <h2>Serving Mumbai with Success</h2>

  <p>
    Book My Medicare as a business is committed to delivering the best in home health care service in Mumbai whether it is nursing care at home mumbai, hospital bed on rent mumbai, or oxygen concentrator on rent mumbai.
  </p>

</div>

{/* SECTION 17 */}

<div className="bmm-content-block">

  <div className="bmm-card-icon">💙</div>

  <h2>Our Commitment of Care</h2>

  <p>
    At Book My Medicare, we believe that healthcare should be:
  </p>

  <ul>
    <li>Accessible</li>
    <li>Affordable</li>
    <li>Reliable</li>
    <li>Compassionate</li>
  </ul>

  <p>
    We aim to offer high-quality home health care services that improve patient and family life.
  </p>

</div>

{/* SECTION 18 */}

<div className="bmm-content-block">

  <div className="bmm-card-icon">📞</div>

  <h2>Get Started Today</h2>

  <p>
    If you need professional home health care services, nursing care at home in Mumbai, ICU Set-up in Home Mumbai, or even medical equipment on rent in mumbai or a housing care center located in Mumbai, then someday we will be able to meet your needs.
  </p>

  <p>
    Contact us today, and learn more about our range of services that include:
  </p>

  <ul>
    <li>Home ICU setup in Mumbai</li>
    <li>Oxygen concentrator on rent mumbai</li>
    <li>Hospital bed on rent mumbai</li>
    <li>24 hour nursing care at home</li>
    <li>Nursing Care at Home in Mumbai</li>
    <li>Medical Equipment on Rental</li>
  </ul>

  <p>
    Bring healthcare home where your loved ones feel most comfortable – after all, they deserve the best care available.
  </p>

</div>

</div>

          </div>

        </div>

      </div>

    </section>

  );
};

export default HomeHealthcareSection;