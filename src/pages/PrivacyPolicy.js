import React from "react";
import "./PrivacyPolicy.css";
import Header from "../frontend/Header";
import TopBar from "../frontend/TopBar";
import Footer from "../frontend/Footer";

export default function PrivacyPolicy() {
  return (
    <div className="privacy-page">
        <TopBar />
                      <Header />
      <div className="privacy-container">
        <h1 className="privacy-title">Privacy Policy</h1>
        <p className="privacy-updated">Last updated: January 2026</p>

        <section>
          <p>
            <strong>BookMyMedicare.com</strong> is committed to ensuring that the
            privacy of our customers’ information is handled with the utmost
            care and importance. This Privacy Policy explains the types of
            personal information we collect through our website and mobile
            applications, the purpose for which such data is used, the measures
            we take to protect your information, and the rights and choices
            available to you regarding your personal data.
          </p>
        </section>

        <section>
          <h2>Information We Collect from Our Customers</h2>

          <h3>1. Demographic and Contact Information</h3>
          <p>
            This includes first and last name, email address, postal address,
            country, employer, phone number, and other similar contact details.
          </p>

          <h3>2. Technical Information</h3>
          <p>
            We collect information related to your use of our website and mobile
            applications, including device details, browser type, mobile app
            usage, Internet Protocol (IP) address, and information collected
            through cookies and similar technologies.
          </p>

          <h3>3. Health-Related Information</h3>
          <p>
            We may collect health-related information such as your medical or
            health history (or that of an added family member), diet information,
            lifestyle data, and other health-related details voluntarily shared
            by you.
          </p>

          <h3>4. Product and Service Information</h3>
          <p>
            This includes account or membership details, registration and
            payment information, program-specific data, and your reviews,
            feedback, and opinions regarding our products, programs, and
            services.
          </p>
        </section>

        <section>
          <h2>How Data Is Collected</h2>
          <ul>
            <li>Information you provide directly on our website or mobile app</li>
            <li>Data collected through cookies and similar technologies</li>
            <li>Email communications and customer interactions</li>
            <li>Data received from trusted third-party partners</li>
            <li>
              Information shared during registration, transactions,
              subscriptions, or services like “Know Your Diet” or “Know Your
              Health”
            </li>
            <li>Information shared through promotional advertisements</li>
          </ul>

          <p>
            You provide consent at the beginning of your interaction with
            BookMyMedicare. You may refuse, edit, modify, or delete your personal
            information at any time through our website or mobile application.
          </p>

          <p>
            We also automatically collect certain information such as IP
            address, operating system, device details, browsing activity, and
            language settings to improve site performance, content, navigation,
            and security.
          </p>
        </section>

        <section>
          <h2>Purpose of Data Collection</h2>
          <ul>
            <li>To understand your healthcare needs over time</li>
            <li>To analyze healthcare trends and create preventive solutions</li>
            <li>To provide personalized services and offers</li>
            <li>To improve our website, mobile app, and business operations</li>
            <li>
              To prevent fraud, illegal activity, financial loss, and security
              risks
            </li>
            <li>To comply with legal and regulatory obligations</li>
          </ul>
        </section>

        <section>
          <h2>Sharing of Data</h2>
          <p>
            We may share your data with trusted partners to ensure timely and
            effective service delivery. All partners are required to follow
            strict confidentiality and data protection standards.
          </p>

          <p>
            We may disclose data to comply with applicable laws, legal processes,
            enforce our Terms of Use, protect BookMyMedicare from harm or
            financial loss, or investigate suspected fraud or illegal activity.
          </p>

          <p>
            We do not sell personal information for commercial purposes in
            violation of this Privacy Policy.
          </p>

          <p>
            In case of a merger, acquisition, or sale of business units, your
            data may be transferred as part of that transaction and will remain
            subject to this Privacy Policy.
          </p>
        </section>

        <section>
          <h2>Data Security</h2>
          <p>
            We use appropriate technical and organizational measures to protect
            your data. Information is stored on secure servers, and procedures
            are in place to handle suspected data breaches.
          </p>

          <p>
            If you believe your data has been misused or accessed without
            authorization, contact us immediately at:
            <br />
            <strong>support@bookmymedicare.com</strong>
          </p>
        </section>

        <section>
          <h2>Data Retention</h2>
          <p>
            We retain your data only as long as necessary to provide services,
            meet legal obligations, or resolve disputes. All data is stored on
            company servers located in Maharashtra, India.
          </p>
        </section>

        <section>
          <h2>Customer Rights</h2>
          <p>
            You have the right to decide what personal information you disclose,
            except information required to provide essential services. You may
            modify, correct, or delete your personal data at any time through
            our platform.
          </p>
        </section>

        <section>
          <h2>Severability</h2>
          <p>
            If any provision of this Privacy Policy is found to be invalid or
            unlawful, the remaining provisions shall remain fully enforceable.
          </p>
        </section>
      </div>
      <Footer />
    </div>
    
  );
}
