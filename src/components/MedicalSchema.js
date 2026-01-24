import { useEffect } from "react";

export default function MedicalSchema() {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "MedicalOrganization",
      "name": "BookMyMedicCare",
      "url": "https://www.bookmymediccare.com",
      "logo": "https://www.bookmymediccare.com/logo192.png",
      "description":
        "BookMyMedicCare provides ICU setup at home, nursing care, ambulance services, physiotherapy, diagnostics and medical equipment rental.",
      "medicalSpecialty": [
        "CriticalCare",
        "Nursing",
        "Physiotherapy",
        "Emergency"
      ],
      "availableService": [
        {
          "@type": "MedicalService",
          "name": "ICU Setup at Home",
          "serviceType": "Home ICU Care"
        },
        {
          "@type": "MedicalService",
          "name": "Home Nursing Care",
          "serviceType": "Nursing"
        },
        {
          "@type": "MedicalService",
          "name": "Ambulance Service",
          "serviceType": "Emergency Transport"
        }
      ]
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return null;
}
