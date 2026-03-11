import React from "react";

const Support = () => {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "40px", maxWidth: "900px", margin: "auto" }}>
      
      <h1>BMM Workforce Support</h1>
      <p>
        Welcome to the official support page for <strong>BMM Workforce</strong>. 
        If you are experiencing issues with the application or need help, 
        please review the information below or contact our support team.
      </p>

      <hr />

      <h2>About the App</h2>
      <p>
        BMM Workforce is a driver and workforce management platform designed 
        to help businesses track field employees, monitor deliveries, and 
        manage workforce activities in real time.
      </p>

      <ul>
        <li>Real-time driver location tracking</li>
        <li>Delivery and task management</li>
        <li>Workforce activity monitoring</li>
        <li>Secure authentication</li>
        <li>Camera verification for deliveries</li>
      </ul>

      <hr />

      <h2>Frequently Asked Questions</h2>

      <h4>1. I cannot log in to my account</h4>
      <p>
        Please verify that your email and password are correct. If you forgot 
        your password, use the <strong>Forgot Password</strong> option inside 
        the app.
      </p>

      <h4>2. Location tracking is not working</h4>
      <p>
        Ensure that location permissions are enabled for the app in your 
        device settings.
      </p>

      <h4>3. App is not updating driver location</h4>
      <p>
        Make sure that the app has permission for background location access 
        and that internet connectivity is available.
      </p>

      <h4>4. Delivery verification camera not working</h4>
      <p>
        Ensure camera permission is enabled for the app in device settings.
      </p>

      <hr />

      <h2>Contact Support</h2>

      <p>If you need further assistance, please contact our support team.</p>

      <p>
        📧 Email: <a href="mailto:support@bmmworkforce.com">support@bmmworkforce.com</a>
      </p>

      <p>
        🌐 Website: <a href="https://bmmworkforce.com">https://bmmworkforce.com</a>
      </p>

      <p>
        We usually respond within <strong>24–48 hours</strong>.
      </p>

      <hr />

      <h2>Privacy</h2>

      <p>
        BMM Workforce respects user privacy. The app may collect location 
        data during active work sessions to enable delivery tracking and 
        workforce monitoring.
      </p>

      <p>
        For more information please read our Privacy Policy.
      </p>

      <footer style={{ marginTop: "40px", color: "#777" }}>
        © {new Date().getFullYear()} BMM Workforce. All rights reserved.
      </footer>

    </div>
  );
};

export default Support;