import { useState } from "react";
import "./Nursingreadmore.css";

const pages = [
  {
    title: "Nursing Care at Home for Compassionate and Professional Patient Support",
    content: `
      Being ill, having a long-term medical condition, surgery, or injury can be difficult to recover from, and sometimes you need to have regular care and monitoring. Remaining in the comfort and security of home can sometimes make it easier for many of the patients to make their recuperation at home. At home care nursing offers patients a chance to receive nursing care from trained nursing staff without having to visit the hospital or clinic frequently.

      Home-based nursing may be useful for geriatric patients, post-surgery patients, patients with chronic diseases, bedridden patients, and patients who need to be cared for with their chronic medical conditions. Patients have the opportunity to be supported at home with the right care and stay within the comfort of home and their family.

      <b> Book My Medicare </b> offers access to <b> nursing care services at home </b>, which are tailored to the needs of patients with various healthcare needs. Based on the patient's care plan and health status, nursing care professionals can help with medication management, vital monitoring, wound care, injections, catheter care, post-surgery support, and other nursing needs prescribed.
`,
  },

{
  title: "What Is Nursing Care at Home?",
  content: `
Nursing care is a health care service that provides patients with <b>nursing care at home by qualified nursing professionals.</b> Some nursing needs can be handled at home, rather than having to visit a healthcare center or stay in a hospital many times.

The amount of care will vary based on the patient's health status, physicians' recommendations, and the patient's needs. Patients might need a brief nursing visit for a particular procedure or might require frequent or ongoing assistance.

<h2>Home nursing services can be provided for:</h2>

<ul>
 <li>Patients who need frequent health support, usually elderly</li>
  <li>Patients who have undergone surgery.</li>
  <li>Patients who cannot get around or who are lying in bed.</li>
  <li>Chronic patients who are dealing with chronic diseases.</li>
  <li>Persons who need wound or dressing care.</li>
  <li>Patients who need assistance with medications.</li>
  <li>People recovering after hospitalisation</li>
  <li>Patients who need monitoring on a regular basis.</li>
  <li>People who require supportive care in their homes.</li>
</ul>

This individualised approach is essential as each patient has unique health needs. The nursing plan should thus be designed according to the patient's condition and the recommended care from the health care provider.
`,
},

  {
    title: "Why opt for Home Nursing Care?",
    content: `
<b>  Home nursing care services</b> offer one of the most significant benefits of those services is that patients receive proper care without having to completely change their surroundings. While hospitals are needed for acute and complex medical conditions, there are some chronic medical needs that can be safely treated at home if advised by a health care provider.

<h3> Comfort and Familiarity </h3>

Patients will feel emotionally supported, especially elderly patients and patients who have been ill for a long period of time, when at home. The patient can be cared for with the help of nursing staff without losing their family and familiar surroundings.

<h3> Personalised Attention </h3>

Home care settings offer the potential for more personalised care than in a busy healthcare setting. The nursing professional can dedicate the planned visit or shift to the patient's individual needs.

<h3> Support After Hospital Discharge </h3>

Sometimes, the whole journey from the hospital to home is tough. Patients might still need help with medication schedules, wound care, walking, or other prescribed needs. During this crucial healing phase, home healthcare nursing care can help.

<h3> Reduced Need for Frequent Travel </h3>

For patients who are not very mobile, it may be difficult to travel back and forth to hospitals or clinics. For some routine nursing needs, appropriate home nursing services can decrease the need for unnecessary travel.

<h3> Family Support </h3>

Family members often want to care for their relatives, but they may lack professional nursing knowledge. A skilled nurse can tend the patient properly and educate the family members on the essentials of the patient's care.

`,
  },

  {
    title: "What Do Home Nursing Care Services Include? ",
    content: `
Services depend on the patient's condition and the nursing care plan. There are a number of types of professional support that can be provided in a home nursing care setting.

<h3>Vital Signs Monitoring</h3>

Nursing professionals can take the following vital signs: Blood pressure, Pulse rate, Temperature, Oxygen saturation, and other parameters as recommended by the health care provider.

Routine check-ups can be carried out to help maintain a check on whether the patient's condition has improved or worsened.

<h3>Medication Assistance</h3>

Sometimes patients have trouble taking medication, especially if they are prescribed several medications at the same time. Nursing professionals can help administer medications as directed.

Nurses never change medication, and medication is always given as directed by the healthcare provider.

<h3>Wound and Dressing Care </h3>

Those who have undergone surgery or injury might need to have their wounds observed and dressed regularly. Wound care is important for keeping the wound clean and helping it heal.

Nursing professionals can dress and provide wound care assistance as prescribed and monitor for any changes that may need medical intervention.

<h3>Injection and Clinical Procedures</h3>

Some medical treatments (such as certain vaccines and nursing care) can be administered at home if medically appropriate. These services should be conducted by trained health care workers, with proper safety precautions.

<h3>Catheter Care</h3>

In some patients, the catheter may need to be cared for after surgery, sickness or certain illnesses. With the help of a professional nurse, prescribed catheter care and monitoring can be performed.

<h3>Post-Surgical Nursing Support</h3>

The recovery from surgery may include medication, wound care, mobility assistance, monitoring, and more. Patients can be treated at their homes by professional nurses to help them cope through their convalescence period.

How the care is given varies from surgery to surgery and according to the directions given by the doctor performing the surgery.

Try Physiotherapy at Home to experience customised therapy, enhanced movement, pain relief, and recovery assistance right in the convenience of your home.


`,
  },

  {
    title: "Who Can Benefit from Nursing Services at Home? ",
    content: `
Depending on the medical needs of the patient, nursing at home may be helpful for a variety of patients.

<h3> Elderly Patients </h3>

Chronic health issues, illness, mobility challenges, and other issues associated with aging may be a need in older adults requiring extra help. Regular professional support can be given at home when they stay at home.

<h3> Bedridden Patients </h3>

Limited mobility or bedridden patients may need to be monitored regularly, supported, positioned, cared for wounds, and receive other nursing care. There are some requirements that can be met with a suitable care plan.

<h3> Post-Operative Patients </h3>

Patients may require help in caring for their wound, ensuring the administration and monitoring of medication, and with activities required to help patients recover from surgery. As recommended by the health care provider, support during the recovery period can be provided at home.

<h3> Patients with Chronic Conditions </h3>

Those with a long-term health condition might need frequent support and monitoring. Nursing staff will be able to administer a prescribed plan of care and assist families in follow-up regarding changes that should be reported to their treating physician, depending on the condition.

<h3> Patients Recovering from Hospitalisation </h3>

Not every time patients are discharged from a hospital does this mean they are completely recovered. A few people need nursing assistance at home. Going home from the hospital to everyday life can be easier if you receive home care.

<h3> 24 Hour Nursing Care at Home </h3>

In some cases, patients might need support not just for a short nursing visit. Under these circumstances, <b> 24 hour nursing care at home </b> may be sought if it is recommended.

In around-the-clock care, patients need monitoring throughout the day and night, particularly those who need a lot of attention, elderly people who do, people who are not very mobile, or those who are sick.

The exact level of care should be determined according to the patient's condition. Home nursing is not a substitute for emergency medical care. In the event of a serious or life-threatening emergency, immediate assistance from the Emergency Medical Services and hospital care may be necessary.

A nursing professional who is responsible for the patient's care can facilitate the patient's prescribed care plan, see changes, and communicate with the family or appropriate healthcare professional.

`,
  },

   {
    title: "Professional Nursing Care at Home for Post-Hospital Recovery ",
    content: ` This can be a sensitive time right after leaving the hospital. Patients might experience weakness, limited mobility, or require assistance with prescribed care.

<b> Home nursing care </b> can help during the recovery process after hospital discharge in many ways, including:
 
<ul>
      <li>Vital signs are monitored by a physician, as recommended.</li>
      <li>Assisting with prescribed medication habits</li>
      <li>Caring for wounds and dressings.</li>
      <li>Support for carrying out prescribed procedures</li>
      <li>Keeping a watchful eye out for any shift in patient condition</li>
      <li>Assisting with the basic recovery needs.</li>
      <li>Being able to share important findings with family or health care workers</li>
</ul>


The aim is to ensure the transition home is smoother and that the patient's care plans are adhered to.

`,
  },

     {
    title: "Home Nursing Services for Elderly Care ",
    content: ` 
For the elderly, comfort, safety, and professional support merge into a care setting that is beneficial. Some older people may be able to live alone; others require more frequent nursing care.

There are levels of support, and home nursing can be adjusted. A nurse can help with care, observation, established care requirements, administration, and other nursing needs for this patient.

Families can also benefit from the help of professionals, as they may have work or other responsibilities that make it difficult to be able to provide constant care to the person.

But always, the care offered in the nursing home should be in accordance with the individual's health requirements rather than age.

<h1> How Nursing Care at Home Works </h1>

Initiating <b> nursing care at home </b> usually begins with an understanding of the patient's condition, and then the type of support needed is determined.

<h3> Step 1: Understand the Care Requirement</h3>

The patient's family can share details of the medical condition, recent hospitalisation, surgery, mobility restrictions, or any other aspects of care.

<h3> Step 2: Review Prescribed Care Plan </h3>

Prescriptions, discharge summaries, medical instructions, and recommendations of the treating doctor are all available and can be used to assist in determining the nursing needs.

<h3> Step 3: Choose the Suitable Nursing Assistance </h3>

Nursing care can be provided on a single visit, for a few hours, or for a longer period of time depending on the patient's requirements.

<h3> Step 4: Start Home-Based Care </h3>

When the nursing services are agreed to, they are carried out at home by a suitable nursing professional and in accordance with the nursing instructions.

<h3> Step 5: Monitor and Communicate </h3> 

The family and, if necessary, the physician in charge of the patient should be notified of changes in the patient's condition.


`,
  },

       {
    title: "Choosing the Best Nursing Care at Home",
    content: ` 
    Work out the best nursing care at home is not just picking a company that is convenient. The patient's medical needs and the experience and qualifications of the nursing professional should be taken into account by the family.

<h4>When looking for home nursing care, ask about:</h4>

<ul>
<li>If qualified nursing personnel are available</li>
<li>Whether the service is appropriate to the medical needs of the patient</li>
<li>The nurse's experience in regard to the subject.</li>
<li>The capacity to provide scheduled or continuous care (ACQA)</li>
<li>There is effective communication between the nurse and family.</li>
<li>Responsible behaviour and health and hygiene measures</li>
<li>Capable of adhering to required treatment guidelines</li>
<li>Support available to meet changing needs.</li>

</ul>

It is also crucial to convey the correct information to the patient before treatment. A good understanding of the patient's needs can be achieved through the provision of relevant medical information.

<h1> Nursing Care at Home vs Hospital Based Care</h1>

Hospital care and home nursing service both play a significant role in the health care. Depending on the patient's medical condition, the appropriate one is available.

Hospitals serve as critical care facilities when patients need immediate treatment or advanced diagnostics, intensive monitoring, surgery, or other sophisticated medical interventions.

Conversely,<b> home nursing care</b> can be appropriate for patients with good medical status who need nursing care on an ongoing basis that can be provided safely in a home setting.

The decision should be made for medical reasons and not convenience. When the symptoms are severe or the patient's condition suddenly worsens, professional EMA should be sought immediately.

<h1>Why Choose Book My Medicare for Home Nursing? </h1>

Determining the right healthcare support for a loved one may be a critical choice to make. Families can use Book My Medicare to learn more about home healthcare support based on each patient's needs.

The main goal of home nursing is to offer patients the necessary professional support while ensuring that those who are eligible receive care in their own home.

If there is a need for post-operative care, elderly care, regular monitoring, wound care, or any other care as prescribed to the patient, the service can be planned to fit the patient's condition and care needs.

`,
  },


       {
    title: "Frequently Asked Questions",
    content: ` 
    <h3> 1. What is nursing care at home? </h3>

<b> Nursing care at home </b> is a medical service that provides professional nursing care to qualified patients in their own homes. They can provide monitoring, medication administration, wound care, injections, catheter care, and other prescribed nursing care.

<h3> 2. Who needs home nursing care services?  </h3>

Home nursing can be helpful at the following stages: for elderly patients, after an operation, for bedridden patients, after hospitalisation, and for patients with certain chronic or long-term healthcare needs.

<h3> 3. Am I able to receive 24-hour nursing care at home? </h3>

Yes, a patient may receive continuous nursing care if preferred and if the patient's medical needs and/or the nursing care plan deems it appropriate.

<h3> 4. Are nursing services at home suitable after surgery? </h3>

Yes. Those who have just undergone surgery could need nursing care with respect to wound care, medication treatment, surveillance, and other requirements as per their doctor. Specific treatment will depend on the surgery performed and directions from the physician.

<h3> 5. Do nurses have the ability to care for wounds in the home? </h3>

Yes, when appropriate, qualified nurses can be trained to care for a wound and dress it at home. The nursing professional should follow the instructions for care given by the health care provider who is treating the patient.

<h1> Get Reliable Nursing Support at Home </h1>

Patients receive the help they need from professionals and can recover at home more easily. Nursing at home can be beneficial in assisting families to deal better with continual health needs, whether it be post-operative care, caring for the elderly, monitoring, wound care, prescribed nursing care, etc.

Any care plan should always be based on the individual patient's condition and medical advice. If the care your loved one needs at home is professional, look for appropriate <b> home nursing services </b> and talk with a trained healthcare professional about the patient's needs.

<b> Home nursing care </b> can provide patients with the necessary care in their comfortable environment.


`,
  },

];

function Nursingreadmore() {
  const [visiblePages, setVisiblePages] = useState(1);

  const showMore = () => {
    setVisiblePages((prev) => Math.min(prev + 1, pages.length));
  };

  const showLess = () => {
    setVisiblePages(1);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="app">
      <div className="document">

        {pages.slice(0, visiblePages).map((page, index) => (
          <div className="page" key={index}>

            <div className="page-header">
              <div className="logo">
                BookMyMedicare
              </div>

              <div className="page-number">
                Page {index + 1}
              </div>
            </div>

            <div className="page-content">

              <h1>{page.title}</h1>

              <div className="heading-line"></div>

              <div className="content-text">
  {page.content
    .trim()
    .split("\n\n")
    .map((paragraph, i) => (
      <p
        key={i}
        dangerouslySetInnerHTML={{
          __html: paragraph.trim(),
        }}
      />
    ))}
</div>
            </div>

            <div className="page-footer">
              <span>BookMyMedicare</span>
              <span>{index + 1}</span>
            </div>

          </div>
        ))}

        <div className="buttons">

          {visiblePages < pages.length && (
            <button
              className="show-more"
              onClick={showMore}
            >
              Show More
            </button>
          )}

          {visiblePages > 1 && (
            <button
              className="show-less"
              onClick={showLess}
            >
              Show Less
            </button>
          )}

        </div>

      </div>
    </div>
  );
}

export default Nursingreadmore;